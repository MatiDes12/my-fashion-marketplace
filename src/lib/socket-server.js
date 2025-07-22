const { Server: SocketIOServer } = require('socket.io');
const { supabase } = require('./supabase-server');

class ChatServer {
  constructor(server) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.connectedUsers = new Map();
    this.supabase = supabase;

    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.id}`);

      // Handle user authentication and join
      socket.on('authenticate', async (data) => {
        try {
          // Update user status in database
          await this.updateUserStatus(data.userId, true);
          
          // Store user info
          this.connectedUsers.set(socket.id, {
            userId: data.userId,
            userType: data.userType,
            socketId: socket.id,
            isOnline: true
          });

          // Join user to their personal room
          socket.join(`user_${data.userId}`);
          
          // Join admin to admin room if admin
          if (data.userType === 'admin') {
            socket.join('admin_room');
          }

          // Join seller to seller room if seller
          if (data.userType === 'seller') {
            socket.join('seller_room');
          }

          // Notify others about user coming online
          this.broadcastUserStatus(data.userId, true);

          socket.emit('authenticated', { success: true });
        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authenticated', { success: false, error: 'Authentication failed' });
        }
      });

      // Handle joining a specific chat room
      socket.on('join_room', async (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (!user) {
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          // Verify user has access to this room
          const hasAccess = await this.verifyRoomAccess(data.roomId, user.userId);
          if (!hasAccess) {
            socket.emit('error', { message: 'Access denied to this room' });
            return;
          }

          socket.join(data.roomId);
          socket.emit('room_joined', { roomId: data.roomId });
        } catch (error) {
          console.error('Join room error:', error);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });

      // Handle sending messages
      socket.on('send_message', async (data) => {
        console.log('Received send_message event:', data);
        
        const user = this.connectedUsers.get(socket.id);
        if (!user) {
          console.error('User not authenticated for send_message');
          socket.emit('error', { message: 'User not authenticated' });
          return;
        }

        try {
          // Verify user has access to this room
          const hasAccess = await this.verifyRoomAccess(data.roomId, user.userId);
          if (!hasAccess) {
            console.error('Access denied to room:', data.roomId, 'for user:', user.userId);
            socket.emit('error', { message: 'Access denied to this room' });
            return;
          }

          console.log('Saving message to database:', {
            room_id: data.roomId,
            sender_id: data.senderId,
            sender_type: data.senderType,
            message: data.message
          });

          // Save message to database
          const { data: message, error } = await this.supabase
            .from('chat_messages')
            .insert({
              room_id: data.roomId,
              sender_id: data.senderId,
              sender_type: data.senderType,
              message: data.message,
              message_type: data.messageType || 'text'
            })
            .select(`
              *,
              sender:users!chat_messages_sender_id_fkey(id, email, full_name, created_at)
            `)
            .single();

          if (error) {
            console.error('Database error saving message:', error);
            throw error;
          }

          console.log('Message saved successfully:', message);

          // Broadcast message to room with sender information
          const broadcastMessage = {
            id: message.id,
            room_id: data.roomId,
            sender_id: data.senderId,
            sender_type: data.senderType,
            message: data.message,
            message_type: data.messageType || 'text',
            is_read: false,
            created_at: message.created_at,
            sender: message.sender
          };

          console.log('Broadcasting new_message:', broadcastMessage);

          this.io.to(data.roomId).emit('new_message', broadcastMessage);

        } catch (error) {
          console.error('Send message error:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          socket.to(data.roomId).emit('user_typing', {
            userId: user.userId,
            userType: user.userType
          });
        }
      });

      socket.on('typing_stop', (data) => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          socket.to(data.roomId).emit('user_stopped_typing', {
            userId: user.userId,
            userType: user.userType
          });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        const user = this.connectedUsers.get(socket.id);
        if (user) {
          // Update user status in database
          await this.updateUserStatus(user.userId, false);
          
          // Remove from connected users
          this.connectedUsers.delete(socket.id);
          
          // Notify others about user going offline
          this.broadcastUserStatus(user.userId, false);
        }
        console.log(`User disconnected: ${socket.id}`);
      });
    });
  }

  async updateUserStatus(userId, isOnline) {
    try {
      const { error } = await this.supabase
        .from('user_chat_status')
        .upsert({
          user_id: userId,
          is_online: isOnline,
          last_seen: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Update user status error:', error);
    }
  }

  async verifyRoomAccess(roomId, userId) {
    try {
      const { data, error } = await this.supabase
        .from('chat_rooms')
        .select('seller_id, admin_id, customer_id')
        .eq('id', roomId)
        .single();

      if (error || !data) return false;

      return data.seller_id === userId || 
             data.admin_id === userId || 
             data.customer_id === userId;
    } catch (error) {
      console.error('Verify room access error:', error);
      return false;
    }
  }

  broadcastUserStatus(userId, isOnline) {
    this.io.emit('user_status_change', {
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    });
  }

  getIO() {
    return this.io;
  }
}

module.exports = ChatServer; 