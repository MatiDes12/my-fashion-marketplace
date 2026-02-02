# /component - Generate Component

Generate a new React component following project patterns.

## Usage

```
/component <name>              # Create basic component
/component <name> --client     # Create client component
/component <name> --server     # Create server component
/component <name> --modal      # Create modal component
```

## Component Templates

### Basic Client Component
```typescript
'use client';

import { useState } from 'react';

interface ComponentNameProps {
  title: string;
  className?: string;
}

export default function ComponentName({ title, className = '' }: ComponentNameProps) {
  const [state, setState] = useState(false);

  return (
    <div className={`bg-white rounded-lg shadow-md p-4 ${className}`}>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
    </div>
  );
}
```

### Server Component
```typescript
import { supabase } from '@/lib/supabase';

interface ComponentNameProps {
  id: string;
}

export default async function ComponentName({ id }: ComponentNameProps) {
  const { data } = await supabase
    .from('table_name')
    .select('*')
    .eq('id', id)
    .single();

  return (
    <div className="p-4">
      <h1>{data?.name}</h1>
    </div>
  );
}
```

### Modal Component
```typescript
'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { X } from 'lucide-react';

interface ModalNameProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ModalName({ isOpen, onClose }: ModalNameProps) {
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
                    Modal Title
                  </Dialog.Title>
                  <button onClick={onClose}>
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>
                {/* Modal content */}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
```

## Component Locations

- `src/components/` - Feature components
- `src/components/ui/` - Reusable primitives
- `src/components/landing/` - Landing page sections
- `src/components/charts/` - Data visualizations

## Styling Guidelines

### Colors
- Primary: `primary-600`, `primary-700`
- Text: `gray-900` (heading), `gray-600` (body)
- Background: `white`, `gray-50`

### Spacing
- Padding: `p-4`, `p-6`
- Margin: `mb-4`, `mt-2`
- Gap: `gap-4`, `space-y-4`

### Responsive
```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

## Icons

Use Lucide React:
```typescript
import { ShoppingCart, Heart, Star } from 'lucide-react';

<ShoppingCart className="h-5 w-5 text-gray-600" />
```
