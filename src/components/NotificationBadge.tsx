interface NotificationBadgeProps {
  count: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function NotificationBadge({ 
  count, 
  className = '', 
  size = 'md' 
}: NotificationBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = {
    sm: 'w-2 h-2 text-xs',
    md: 'w-5 h-5 text-xs',
    lg: 'w-6 h-6 text-sm'
  };

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <div className={`
      relative inline-flex items-center justify-center
      bg-red-500 text-white font-medium rounded-full
      ${sizeClasses[size]}
      ${className}
    `}>
      {size === 'sm' ? (
        <div className="w-2 h-2 bg-red-500 rounded-full" />
      ) : (
        <span className="leading-none">{displayCount}</span>
      )}
    </div>
  );
} 