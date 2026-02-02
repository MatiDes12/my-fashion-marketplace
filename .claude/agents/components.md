# Component Builder Agent

A specialized agent for creating React components following AVRIO project patterns.

## Tech Stack

- React 19 with TypeScript
- Tailwind CSS for styling
- Headless UI & Radix UI for accessible primitives
- Framer Motion for animations
- Lucide React for icons

## Component Patterns

### File Structure
```
src/components/
├── landing/           # Landing page sections
├── ui/                # Reusable primitives
├── charts/            # Data visualizations
├── [FeatureName].tsx  # Feature-specific components
```

### Basic Component Template
```typescript
'use client';

import { useState } from 'react';
import { LucideIcon } from 'lucide-react';

interface ComponentNameProps {
  title: string;
  onAction?: () => void;
  className?: string;
}

export default function ComponentName({
  title,
  onAction,
  className = ''
}: ComponentNameProps) {
  const [state, setState] = useState(false);

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {/* Component content */}
    </div>
  );
}
```

### Server Component (Default)
```typescript
// No 'use client' directive
import { supabase } from '@/lib/supabase';

interface Props {
  productId: string;
}

export default async function ProductDetails({ productId }: Props) {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();

  return (
    <div className="p-4">
      <h1>{product?.name}</h1>
    </div>
  );
}
```

### With Loading State
```typescript
'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function DataComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return <div>{/* Render data */}</div>;
}
```

## Styling Conventions

### Color Palette
- Primary: `primary-50` to `primary-900`
- Text: `gray-900` (headings), `gray-600` (body)
- Background: `white`, `gray-50`, `gray-100`
- Success: `green-500`
- Error: `red-500`
- Warning: `yellow-500`

### Common Patterns
```typescript
// Card
<div className="bg-white rounded-lg shadow-md p-4 border border-gray-200">

// Button - Primary
<button className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors">

// Button - Secondary
<button className="border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50">

// Input
<input className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500" />

// Badge
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
```

### Responsive Design
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

## Icon Usage

```typescript
import { ShoppingCart, Heart, Star, ChevronRight } from 'lucide-react';

<ShoppingCart className="h-5 w-5 text-gray-600" />
<Heart className="h-5 w-5 text-red-500 fill-current" />
```

## Animation Patterns

```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

## Modal Pattern

```typescript
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md bg-white rounded-lg p-6 shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title className="text-lg font-semibold">
                    {title}
                  </Dialog.Title>
                  <button onClick={onClose}>
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                {children}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
```
