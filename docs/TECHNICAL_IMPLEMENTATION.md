# Technical Implementation Guide

## Overview
This guide provides step-by-step instructions for implementing the security measures and microservices architecture to protect your codebase.

## Phase 1: Immediate Security Measures

### 1. Environment Variables Setup
```bash
# Create production environment file
cp env.example .env.production

# Set up environment variables in your deployment platform
# Vercel, Netlify, or your hosting provider
```

### 2. Database Security
```sql
-- Create separate schemas for different access levels
CREATE SCHEMA public_read;    -- Public data
CREATE SCHEMA internal;       -- Internal business logic
CREATE SCHEMA payments;       -- Payment processing (restricted)

-- Set up Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Products are publicly readable" ON products
    FOR SELECT USING (true);

CREATE POLICY "Orders are user-specific" ON orders
    FOR ALL USING (auth.uid() = user_id);
```

### 3. API Route Protection
```typescript
// src/middleware/auth.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  // Protect sensitive routes
  if (req.nextUrl.pathname.startsWith('/api/payments/')) {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check for admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();
    
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return res;
}

export const config = {
  matcher: [
    '/api/payments/:path*',
    '/api/admin/:path*',
    '/dashboard/:path*'
  ]
};
```

## Phase 2: Microservices Setup

### 1. Create Separate Repositories

#### Frontend Repository
```bash
# Create new repository for frontend
git clone https://github.com/your-org/fashion-marketplace-frontend.git
cd fashion-marketplace-frontend

# Copy only frontend-related files
cp -r src/app/* ./src/app/
cp -r src/components/* ./src/components/
cp -r src/contexts/* ./src/contexts/
cp -r src/hooks/* ./src/hooks/
cp -r src/utils/* ./src/utils/
cp -r public/* ./public/

# Remove sensitive files
rm -rf src/app/api/payments/
rm -rf src/app/api/admin/
rm -rf src/lib/telebirr/
rm -rf src/lib/mpesa/
rm -rf src/lib/chapa/
```

#### API Gateway Repository
```bash
# Create API Gateway service
mkdir fashion-marketplace-gateway
cd fashion-marketplace-gateway

# Initialize Node.js project
npm init -y
npm install express cors helmet rate-limiter-flexible
```

```typescript
// src/gateway.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 100, // Number of requests
  duration: 60, // Per 60 seconds
});

app.use('/api', async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (error) {
    res.status(429).json({ error: 'Too many requests' });
  }
});

// Route to appropriate services
app.use('/api/users', proxy('http://user-service:3001'));
app.use('/api/products', proxy('http://product-service:3002'));
app.use('/api/orders', proxy('http://order-service:3003'));
app.use('/api/payments', proxy('http://payment-service:3004'));

app.listen(3000, () => {
  console.log('API Gateway running on port 3000');
});
```

#### Payment Service Repository
```bash
# Create highly restricted payment service
mkdir fashion-marketplace-payments
cd fashion-marketplace-payments

# Initialize with minimal dependencies
npm init -y
npm install express dotenv crypto-js
```

```typescript
// src/payment-service.ts
import express from 'express';
import crypto from 'crypto-js';

const app = express();

// Service-to-service authentication
const authenticateService = (req: any, res: any, next: any) => {
  const serviceKey = req.headers['x-service-key'];
  const expectedKey = process.env.SERVICE_SECRET_KEY;
  
  if (serviceKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized service' });
  }
  
  next();
};

// Encrypt sensitive data
const encryptData = (data: any) => {
  const key = process.env.ENCRYPTION_KEY!;
  return crypto.AES.encrypt(JSON.stringify(data), key).toString();
};

// Payment endpoints
app.post('/api/payments/telebirr/initiate', authenticateService, async (req, res) => {
  try {
    // Payment logic here
    const paymentData = encryptData({
      amount: req.body.amount,
      customer: req.body.customer,
      timestamp: new Date().toISOString()
    });
    
    res.json({ success: true, data: paymentData });
  } catch (error) {
    res.status(500).json({ error: 'Payment failed' });
  }
});

app.listen(3004, () => {
  console.log('Payment service running on port 3004');
});
```

### 2. Docker Configuration

#### Frontend Dockerfile
```dockerfile
# Dockerfile.frontend
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

#### Payment Service Dockerfile
```dockerfile
# Dockerfile.payments
FROM node:18-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Change ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3004

CMD ["npm", "start"]
```

#### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://gateway:3000
    depends_on:
      - gateway

  gateway:
    build:
      context: ./gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - SERVICE_SECRET_KEY=${SERVICE_SECRET_KEY}
    depends_on:
      - user-service
      - product-service
      - order-service
      - payment-service

  payment-service:
    build:
      context: ./payments
      dockerfile: Dockerfile
    ports:
      - "3004:3004"
    environment:
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - TELEBIRR_SECRET=${TELEBIRR_SECRET}
      - CHAPA_SECRET=${CHAPA_SECRET}
    volumes:
      - payment-logs:/app/logs
    networks:
      - internal

  user-service:
    build:
      context: ./users
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - internal

  product-service:
    build:
      context: ./products
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - internal

  order-service:
    build:
      context: ./orders
      dockerfile: Dockerfile
    ports:
      - "3003:3003"
    environment:
      - DATABASE_URL=${DATABASE_URL}
    networks:
      - internal

networks:
  internal:
    driver: bridge

volumes:
  payment-logs:
```

## Phase 3: Access Control Implementation

### 1. Role-Based Access Control (RBAC)
```typescript
// src/utils/permissions.ts
export enum UserRole {
  VIEWER = 'viewer',
  DEVELOPER = 'developer',
  SENIOR_DEVELOPER = 'senior_developer',
  ADMIN = 'admin'
}

export enum Permission {
  READ_FRONTEND = 'read:frontend',
  WRITE_FRONTEND = 'write:frontend',
  READ_API = 'read:api',
  WRITE_API = 'write:api',
  READ_PAYMENTS = 'read:payments',
  WRITE_PAYMENTS = 'write:payments',
  READ_INFRASTRUCTURE = 'read:infrastructure',
  WRITE_INFRASTRUCTURE = 'write:infrastructure'
}

export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.VIEWER]: [
    Permission.READ_FRONTEND
  ],
  [UserRole.DEVELOPER]: [
    Permission.READ_FRONTEND,
    Permission.WRITE_FRONTEND,
    Permission.READ_API,
    Permission.WRITE_API
  ],
  [UserRole.SENIOR_DEVELOPER]: [
    Permission.READ_FRONTEND,
    Permission.WRITE_FRONTEND,
    Permission.READ_API,
    Permission.WRITE_API,
    Permission.READ_PAYMENTS
  ],
  [UserRole.ADMIN]: [
    Permission.READ_FRONTEND,
    Permission.WRITE_FRONTEND,
    Permission.READ_API,
    Permission.WRITE_API,
    Permission.READ_PAYMENTS,
    Permission.WRITE_PAYMENTS,
    Permission.READ_INFRASTRUCTURE,
    Permission.WRITE_INFRASTRUCTURE
  ]
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) || false;
}
```

### 2. Repository Access Control
```yaml
# .github/CODEOWNERS
# Frontend repository - accessible to all developers
* @your-org/frontend-team

# API Gateway - senior developers and above
/api/ @your-org/senior-developers
/src/gateway/ @your-org/senior-developers

# Payment service - admin only
/payments/ @your-org/admin-team
/src/payments/ @your-org/admin-team
```

### 3. CI/CD Pipeline Security
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run security scan
        run: |
          npm audit
          npm run security:scan
          
      - name: Check for secrets
        run: |
          # Scan for API keys, passwords, etc.
          grep -r "sk_live\|pk_live\|password\|secret" . || true

  deploy-frontend:
    needs: security-scan
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}

  deploy-payments:
    needs: security-scan
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy payment service
        run: |
          # Deploy to secure environment
          docker build -t payment-service .
          docker push your-registry/payment-service:latest
```

## Phase 4: Monitoring and Auditing

### 1. Access Logging
```typescript
// src/middleware/audit.ts
import { NextRequest, NextResponse } from 'next/server';

export function auditMiddleware(req: NextRequest) {
  const auditLog = {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.headers.get('user-agent'),
    method: req.method,
    url: req.url,
    userId: req.headers.get('x-user-id'),
    role: req.headers.get('x-user-role')
  };

  // Send to audit service
  fetch(process.env.AUDIT_SERVICE_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(auditLog)
  });

  return NextResponse.next();
}
```

### 2. Security Monitoring
```typescript
// src/utils/security-monitor.ts
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private suspiciousActivities: any[] = [];

  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  logActivity(activity: any) {
    this.suspiciousActivities.push({
      ...activity,
      timestamp: new Date().toISOString()
    });

    // Alert if suspicious
    if (this.isSuspicious(activity)) {
      this.alert(activity);
    }
  }

  private isSuspicious(activity: any): boolean {
    // Implement suspicious activity detection
    return activity.failedAttempts > 5 || 
           activity.unauthorizedAccess ||
           activity.sensitiveDataAccess;
  }

  private alert(activity: any) {
    // Send alert to security team
    console.error('SECURITY ALERT:', activity);
  }
}
```

## Implementation Checklist

### Immediate Actions (Week 1)
- [ ] Remove sensitive files from repository
- [ ] Set up environment variables
- [ ] Implement basic authentication middleware
- [ ] Create .gitignore file
- [ ] Set up database RLS policies

### Short Term (Month 1)
- [ ] Create separate repositories
- [ ] Implement API Gateway
- [ ] Set up Docker containers
- [ ] Configure CI/CD pipelines
- [ ] Implement role-based access control

### Medium Term (Month 2-3)
- [ ] Migrate to microservices
- [ ] Set up monitoring and auditing
- [ ] Implement security scanning
- [ ] Create legal documentation
- [ ] Train team on security practices

### Long Term (Month 4-6)
- [ ] Complete microservices migration
- [ ] Implement advanced security measures
- [ ] Set up disaster recovery
- [ ] Regular security audits
- [ ] Continuous improvement 