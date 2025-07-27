import { useState, useEffect } from 'react';

export default function CountdownTimer({ endTime, className = '' }: { endTime: string; className?: string }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    if (!endTime) return;

    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  if (!endTime) return null;

  // Format the time display based on remaining time
  const formatTimeDisplay = () => {
    if (timeLeft.days > 0) {
      return (
        <span className="font-mono font-medium">
          {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
        </span>
      );
    } else if (timeLeft.hours > 0) {
      return (
        <span className="font-mono font-medium">
          {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s
        </span>
      );
    } else if (timeLeft.minutes > 0) {
      return (
        <span className="font-mono font-medium">
          {timeLeft.minutes}m {timeLeft.seconds}s
        </span>
      );
    } else {
      return (
        <span className="font-mono font-medium">
          {timeLeft.seconds}s
        </span>
      );
    }
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {formatTimeDisplay()}
    </div>
  );
} 