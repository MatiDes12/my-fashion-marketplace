export function classNames(...classes: (string | boolean | undefined | {[key: string]: boolean})[]): string {
  return classes
    .filter(Boolean)
    .map(className => {
      if (typeof className === 'object') {
        return Object.entries(className)
          .filter(([_, value]) => value)
          .map(([key]) => key)
          .join(' ');
      }
      return className;
    })
    .join(' ');
} 