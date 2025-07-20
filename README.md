# My Fashion Marketplace

A modern, full-featured fashion marketplace built with Next.js, Supabase, and TypeScript.

## Features

- 🛍️ **E-commerce Platform**: Complete shopping experience with products, cart, and checkout
- 💳 **Multiple Payment Methods**: Telebirr, Chapa, and MPesa integration
- 🚚 **Delivery System**: Real-time delivery tracking and management
- 📱 **Telegram Integration**: Instant notifications and customer support
- 👥 **User Management**: Customer and seller accounts with verification
- 📊 **Admin Dashboard**: Comprehensive analytics and management tools
- 🔔 **Notification System**: Email and Telegram notifications
- 🌍 **Multi-language Support**: Internationalization ready
- 📱 **Responsive Design**: Mobile-first approach

## Telegram Integration

The marketplace includes a comprehensive Telegram bot integration that provides:

### 🤖 Bot Features

- **Real-time Notifications**: Order updates, payment confirmations, delivery tracking
- **Customer Support**: 24/7 automated support with human escalation
- **Order Management**: Check order status, track deliveries, view history
- **Marketing**: Flash sale alerts, new product announcements
- **Admin Alerts**: System monitoring and critical notifications

### 📋 Setup Instructions

1. **Create a Telegram Bot**:
   - Message [@BotFather](https://t.me/botfather) on Telegram
   - Use `/newbot` command and follow instructions
   - Save the bot token

2. **Get Your Chat ID**:
   - Start a chat with your bot
   - Send `/start` command
   - Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
   - Find your chat ID in the response

3. **Configure Environment Variables**:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_WEBHOOK_URL=https://yourdomain.com/api/telegram/webhook
   TELEGRAM_ADMIN_CHAT_ID=your_admin_chat_id_here
   TELEGRAM_SUPPORT_CHAT_ID=your_support_chat_id_here
   ```

4. **Run Database Migration**:
   ```bash
   npx supabase db push
   ```

5. **Set Webhook**:
   - Deploy your application
   - Visit: `/api/telegram/setup-webhook` with your webhook URL
   - Or use the admin panel to set it up

### 🔧 API Endpoints

- `POST /api/telegram/webhook` - Handle incoming bot messages
- `POST /api/telegram/send-notification` - Send notifications
- `POST /api/telegram/link-account` - Link user accounts
- `POST /api/telegram/setup-webhook` - Configure webhook

### 📱 Bot Commands

- `/start` - Welcome message and setup
- `/help` - Show available commands
- `/orders` - View recent orders
- `/profile` - Account information
- `/support` - Contact customer support

### 🎯 Notification Types

- **Order Created**: New order notifications to sellers
- **Payment Success/Failed**: Payment status updates
- **Delivery Updates**: Real-time delivery tracking
- **Admin Alerts**: System monitoring notifications
- **Marketing**: Promotional messages and flash sales

## Getting Started

### Prerequisites

- Node.js 18+ 
- Supabase account
- Payment gateway accounts (Telebirr, Chapa, MPesa)
- Telegram bot (optional)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/my-fashion-marketplace.git
   cd my-fashion-marketplace
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set up Supabase**:
   - Create a new Supabase project
   - Run migrations: `npx supabase db push`
   - Update environment variables with your Supabase credentials

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Set up Telegram Bot** (optional):
   - Follow the Telegram setup instructions above
   - Configure bot settings in the admin panel

## Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── telegram/      # Telegram integration
│   │   ├── payments/      # Payment processing
│   │   └── admin/         # Admin API endpoints
│   ├── admin/             # Admin dashboard pages
│   ├── dashboard/         # Seller dashboard
│   └── ...                # Other pages
├── components/            # React components
├── lib/                   # Utility libraries
│   ├── telegram.ts        # Telegram bot integration
│   ├── supabase.ts        # Database client
│   └── ...                # Other utilities
├── types/                 # TypeScript type definitions
└── utils/                 # Helper functions
```

## Payment Integration

The marketplace supports multiple payment methods:

- **Telebirr**: Ethiopian mobile money
- **Chapa**: International payments
- **MPesa**: Kenyan mobile money

## Delivery System

- Real-time delivery tracking
- Delivery person management
- Proof of delivery uploads
- Status updates via Telegram

## Admin Features

- Revenue analytics and reporting
- User management and verification
- Payment processing and payouts
- Telegram bot configuration
- System monitoring and alerts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Email: support@yourmarketplace.com
- Telegram: @your_support_bot
- Documentation: [docs.yourmarketplace.com](https://docs.yourmarketplace.com)
