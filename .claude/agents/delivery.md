# Delivery Agent

A specialized agent for delivery and logistics features in the AVRIO marketplace.

## Delivery Features

### Real-time Tracking
- GPS-based location tracking
- Live map visualization
- Status updates
- ETA calculation

### Delivery Management
- Delivery person assignment
- Route optimization
- Delivery zones
- Pickup scheduling

### Proof of Delivery
- Pickup codes
- Digital signatures
- Photo confirmation
- Delivery notes

### Notifications
- SMS alerts
- Push notifications
- Telegram updates
- Email confirmations

## Key Files

### Pages
- `src/app/delivery/` - Delivery management pages

### Components
- `src/components/DeliveryMap.tsx` - Real-time tracking map
- `src/components/DeliveryStatus.tsx` - Status display

### API Routes
- `src/app/api/delivery/` - 9 delivery endpoints
  - `/status` - Get delivery status
  - `/update` - Update location
  - `/assign` - Assign delivery person
  - `/complete` - Mark as delivered
  - `/tracking` - Real-time tracking data

### Libraries
- Leaflet for maps
- React Leaflet for map components
- Pusher for real-time updates

### Utilities
- `src/utils/pickupCode.ts` - Pickup code generation

## Database Tables

### delivery_tracking
```typescript
interface DeliveryTracking {
  id: string;
  order_id: string;
  delivery_person_id: string;
  status: DeliveryStatus;
  current_location: {
    lat: number;
    lng: number;
  };
  pickup_location: {
    lat: number;
    lng: number;
    address: string;
  };
  delivery_location: {
    lat: number;
    lng: number;
    address: string;
  };
  estimated_arrival: string;
  actual_arrival?: string;
  pickup_code: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

type DeliveryStatus =
  | 'assigned'
  | 'picking_up'
  | 'picked_up'
  | 'in_transit'
  | 'arriving'
  | 'delivered'
  | 'failed';
```

## Delivery Flow

```
1. Order confirmed
2. Delivery person assigned (status: 'assigned')
3. En route to pickup (status: 'picking_up')
4. Package collected (status: 'picked_up')
5. In transit (status: 'in_transit')
6. Approaching destination (status: 'arriving')
7. Delivered with pickup code (status: 'delivered')
```

## Real-time Tracking Implementation

### Location Updates
```typescript
// Delivery person updates location
const updateLocation = async (lat: number, lng: number) => {
  await supabase
    .from('delivery_tracking')
    .update({
      current_location: { lat, lng },
      updated_at: new Date().toISOString()
    })
    .eq('id', trackingId);

  // Broadcast via Pusher
  await pusher.trigger(`delivery-${orderId}`, 'location-update', {
    lat,
    lng,
    timestamp: Date.now()
  });
};
```

### Customer Tracking View
```typescript
'use client';

import { useEffect, useState } from 'react';
import Pusher from 'pusher-js';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

export default function DeliveryTracker({ orderId }: { orderId: string }) {
  const [location, setLocation] = useState({ lat: 0, lng: 0 });

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!
    });

    const channel = pusher.subscribe(`delivery-${orderId}`);
    channel.bind('location-update', (data: { lat: number; lng: number }) => {
      setLocation(data);
    });

    return () => {
      channel.unbind_all();
      channel.unsubscribe();
    };
  }, [orderId]);

  return (
    <MapContainer center={[location.lat, location.lng]} zoom={15}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker position={[location.lat, location.lng]} />
    </MapContainer>
  );
}
```

## Pickup Code System

### Generate Code
```typescript
import { generatePickupCode } from '@/utils/pickupCode';

const code = generatePickupCode(); // e.g., "ABC123"

await supabase
  .from('delivery_tracking')
  .update({ pickup_code: code })
  .eq('order_id', orderId);
```

### Verify Code
```typescript
const verifyPickupCode = async (orderId: string, code: string) => {
  const { data } = await supabase
    .from('delivery_tracking')
    .select('pickup_code')
    .eq('order_id', orderId)
    .single();

  return data?.pickup_code === code.toUpperCase();
};
```

## Delivery Zones

Define delivery areas with polygon coordinates:
```typescript
interface DeliveryZone {
  id: string;
  name: string;
  polygon: [number, number][];
  delivery_fee: number;
  estimated_time: string; // e.g., "30-45 min"
  active: boolean;
}
```

## Notifications

### Telegram Notification
```typescript
import { sendTelegramNotification } from '@/lib/telegram';

await sendTelegramNotification(customerId, {
  type: 'delivery_update',
  status: 'in_transit',
  eta: '15 minutes',
  trackingUrl: `https://avrio.com/track/${orderId}`
});
```

### SMS Notification (via Telebirr)
```typescript
await fetch('/api/sms/send', {
  method: 'POST',
  body: JSON.stringify({
    phone: customerPhone,
    message: `Your order is on the way! Pickup code: ${pickupCode}`
  })
});
```

## Map Integration

Using Leaflet with Jawg.io tiles:
```typescript
<TileLayer
  url="https://{s}.tile.jawg.io/jawg-streets/{z}/{x}/{y}{r}.png?access-token={accessToken}"
  attribution='<a href="https://jawg.io">Jawg</a>'
/>
```
