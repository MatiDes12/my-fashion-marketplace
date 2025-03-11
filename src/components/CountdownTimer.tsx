import { useState, useEffect } from 'react';

export default function CountdownTimer({ endTime }: { endTime: string }) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(timer);
        return;
      }

      setTimeLeft({
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000)
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return (
    <div className="flex gap-1">
      <div className="bg-black/30 px-2 py-1 rounded">
        <span className="font-mono font-bold">
          {timeLeft.hours.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="bg-black/30 px-2 py-1 rounded">
        <span className="font-mono font-bold">
          {timeLeft.minutes.toString().padStart(2, '0')}
        </span>
      </div>
      <div className="bg-black/30 px-2 py-1 rounded">
        <span className="font-mono font-bold">
          {timeLeft.seconds.toString().padStart(2, '0')}
        </span>
      </div>
    </div>
  );
} 