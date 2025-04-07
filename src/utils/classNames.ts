import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function classNames(...inputs: (string | Record<string, boolean>)[]) {
  return inputs
    .flatMap(input => {
      if (typeof input === 'string') return input;
      return Object.entries(input)
        .filter(([, value]) => value)
        .map(([key]) => key);
    })
    .filter(Boolean)
    .join(' ');
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
} 