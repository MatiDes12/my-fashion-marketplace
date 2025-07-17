# Delivery System Documentation

## Overview

The delivery system allows sellers to create delivery accounts for delivery persons and track deliveries from assignment to completion.

## Features

### For Sellers
1. **Create Delivery Accounts**: Add delivery persons with their contact information
2. **Manage Delivery Accounts**: Activate/deactivate delivery accounts
3. **Assign Deliveries**: Assign orders to delivery persons
4. **Track Deliveries**: Monitor delivery status and progress

### For Delivery Persons
1. **View Assignments**: See all assigned deliveries
2. **Update Status**: Update delivery status (assigned → picked up → in transit → delivered)
3. **Add Notes**: Add delivery notes and comments
4. **Proof of Delivery**: Upload proof images (future feature)

## Database Schema

### delivery_accounts
- `id`: UUID (Primary Key)
- `seller_id`: UUID (Foreign Key to users)
- `delivery_person_name`: VARCHAR(255)
- `phone_number`: VARCHAR(20)
- `email`: VARCHAR(255) (Optional)
- `is_active`: BOOLEAN
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### delivery_tracking
- `id`: UUID (Primary Key)
- `order_id`: UUID (Foreign Key to orders)
- `delivery_account_id`: UUID (Foreign Key to delivery_accounts)
- `status`: VARCHAR(50) (assigned, picked_up, in_transit, delivered, failed)
- `assigned_at`: TIMESTAMP
- `picked_up_at`: TIMESTAMP (Optional)
- `delivered_at`: TIMESTAMP (Optional)
- `delivery_notes`: TEXT (Optional)
- `proof_images`: TEXT[] (Array of image URLs)
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

## Pages

### Seller Dashboard
- **URL**: `/dashboard/delivery`
- **Features**:
  - View all delivery accounts
  - Create new delivery accounts
  - Activate/deactivate accounts
  - View delivery tracking
  - Assign deliveries to delivery persons

### Delivery Dashboard
- **URL**: `/delivery`
- **Features**:
  - View assigned deliveries
  - Update delivery status
  - Add delivery notes
  - View delivery statistics

### Delivery Login
- **URL**: `/delivery/login`
- **Features**:
  - Login for delivery persons
  - Verify delivery account exists
  - Redirect to delivery dashboard

## API Endpoints

### POST /api/delivery/assign
Assign a delivery to a delivery person.

**Request Body**:
```json
{
  "orderId": "uuid",
  "deliveryAccountId": "uuid"
}
```

**Response**:
```json
{
  "success": true,
  "delivery": {
    "id": "uuid",
    "order_id": "uuid",
    "delivery_account_id": "uuid",
    "status": "assigned",
    "assigned_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/delivery/update-status
Update delivery status.

**Request Body**:
```json
{
  "deliveryId": "uuid",
  "status": "picked_up",
  "deliveryNotes": "Optional notes"
}
```

**Response**:
```json
{
  "success": true,
  "delivery": {
    "id": "uuid",
    "status": "picked_up",
    "picked_up_at": "2024-01-01T00:00:00Z",
    "delivery_notes": "Optional notes"
  }
}
```

## Security

### Row Level Security (RLS)
- Sellers can only view/manage their own delivery accounts
- Sellers can only view delivery tracking for their orders
- Delivery persons can only view/update their assigned deliveries
- Delivery persons are identified by phone number matching

### Authentication
- Delivery persons must have an active delivery account
- Phone number must match between user account and delivery account
- Only active delivery accounts can access the system

## Usage Flow

1. **Seller creates delivery account**:
   - Go to `/dashboard/delivery`
   - Click "Add Delivery Person"
   - Fill in name, phone number, and optional email
   - Account is created and active by default

2. **Delivery person registers**:
   - Delivery person creates a regular user account
   - Phone number must match the delivery account
   - Can then login at `/delivery/login`

3. **Assign delivery**:
   - Seller goes to delivery tracking tab
   - Clicks "Assign to [Delivery Person]" for unassigned orders
   - Delivery is assigned to the selected delivery person

4. **Update delivery status**:
   - Delivery person logs into `/delivery`
   - Views assigned deliveries
   - Updates status as delivery progresses
   - Can add notes for each status update

## Future Enhancements

1. **Proof Images**: Allow delivery persons to upload photos as proof of delivery
2. **Real-time Updates**: WebSocket integration for real-time status updates
3. **GPS Tracking**: Track delivery person location during deliveries
4. **Customer Notifications**: SMS/email notifications to customers about delivery status
5. **Route Optimization**: Suggest optimal delivery routes
6. **Delivery Time Estimates**: Calculate and display estimated delivery times 