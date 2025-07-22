# Live Chat System Documentation

## Overview

The live chat system enables real-time communication between admins and sellers in the fashion marketplace. It uses Socket.io for real-time messaging and Supabase for data persistence.

## Architecture

### Frontend Components
- **Admin Chat Page** (`/admin/chat`) - Full-screen chat interface for admins
- **Seller Chat Page** (`/dashboard/seller-chat`) - Full-screen chat interface for sellers
- **Chat Widget** - Floating chat widget for quick conversations
- **Chat Context** - Global state management for socket connections

### Backend Components
- **Socket.io Server** - Real-time communication server
- **API Routes** - REST endpoints for chat operations
- **Database Tables** - PostgreSQL tables for chat data

## Database Schema

### Tables

#### `chat_rooms`
- `id` (UUID) - Primary key
- `room_type` (VARCHAR) - 'admin_seller' or 'customer_seller'
- `seller_id` (UUID) - Reference to seller user
- `admin_id` (UUID) - Reference to admin user
- `customer_id` (UUID) - Reference to customer user
- `is_active` (BOOLEAN) - Room status
- `last_message_at` (TIMESTAMP) - Last message timestamp
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

#### `chat_messages`
- `id` (UUID) - Primary key
- `room_id` (UUID) - Reference to chat room
- `sender_id` (UUID) - Reference to sender user
- `sender_type` (VARCHAR) - 'admin', 'seller', or 'customer'
- `message` (TEXT) - Message content
- `message_type` (VARCHAR) - 'text', 'image', 'file', or 'system'
- `is_read` (BOOLEAN) - Read status
- `created_at` (TIMESTAMP) - Creation timestamp

#### `user_chat_status`
- `id` (UUID) - Primary key
- `user_id` (UUID) - Reference to user
- `is_online` (BOOLEAN) - Online status
- `last_seen` (TIMESTAMP) - Last seen timestamp
- `status_message` (VARCHAR) - Custom status message
- `created_at` (TIMESTAMP) - Creation timestamp
- `updated_at` (TIMESTAMP) - Last update timestamp

## API Endpoints

### Chat Rooms
- `GET /api/chat/rooms?userType=admin&roomType=admin_seller` - Get chat rooms for user
- `POST /api/chat/rooms` - Create or join a chat room

### Chat Messages
- `GET /api/chat/messages?roomId={roomId}` - Get messages for a room

### Chat Users
- `GET /api/chat/users?userType=admin` - Get users for admin
- `GET /api/chat/users?userType=seller` - Get users for seller

## Socket.io Events

### Client to Server
- `authenticate` - Authenticate user with socket
- `join_room` - Join a specific chat room
- `send_message` - Send a message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator

### Server to Client
- `authenticated` - Authentication response
- `room_joined` - Room join confirmation
- `new_message` - New message received
- `user_typing` - User typing indicator
- `user_stopped_typing` - User stopped typing
- `user_status_change` - User online/offline status change

## Usage

### For Admins
1. Navigate to `/admin/chat`
2. Select a seller from the list
3. Start chatting in real-time

### For Sellers
1. Navigate to `/dashboard/seller-chat`
2. Select an admin from the list
3. Start chatting in real-time

### Using Chat Widget
```tsx
import ChatWidget from '@/components/ChatWidget';

// In your component
<ChatWidget userType="admin" targetUserId="seller-id" />
```

## Features

### Real-time Messaging
- Instant message delivery
- Typing indicators
- Online/offline status
- Message read status

### Security
- Row Level Security (RLS) policies
- User authentication required
- Room access verification
- Message sender validation

### User Experience
- Responsive design
- Message timestamps
- User avatars
- Last message preview
- Unread message indicators

## Setup Instructions

1. **Database Migration**
   ```bash
   # Run the chat system migration
   supabase db push
   ```

2. **Environment Variables**
   ```env
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. **Start Development Server**
   ```bash
   npm run dev
   ```

## Customization

### Adding New Message Types
1. Update the `message_type` enum in the database
2. Modify the message handling in the socket server
3. Update the frontend components to handle new types

### Adding New User Types
1. Update the `sender_type` enum in the database
2. Modify the user type handling in API routes
3. Update the frontend components

### Styling
The chat components use Tailwind CSS classes and can be customized by modifying the className props.

## Troubleshooting

### Common Issues

1. **Socket Connection Failed**
   - Check if the custom server is running
   - Verify environment variables
   - Check browser console for errors

2. **Messages Not Sending**
   - Verify user authentication
   - Check room access permissions
   - Ensure socket is connected

3. **Users Not Loading**
   - Check API route permissions
   - Verify user roles in database
   - Check RLS policies

### Debug Mode
Enable debug logging by checking the browser console and server logs for detailed error information. 