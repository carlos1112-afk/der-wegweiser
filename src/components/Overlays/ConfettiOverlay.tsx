import React, { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

interface ConfettiOverlayProps {
  isNavigating: boolean;
}

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({ isNavigating }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    if (!isNavigating) return;
    
    let myConfetti: any;
    let timeoutId: number;
    let isActive = true;
    
    if (canvasRef.current) {
      myConfetti = confetti.create(canvasRef.current, {
        resize: true,
        useWorker: true
      });
    } else {
      return;
    }

    const fireConfetti = () => {
      if (!isActive) return;
      
      myConfetti({
        particleCount: 2,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#00ffff', '#ffb700'],
        gravity: 0.5,
        scalar: 0.7,
      });
      
      myConfetti({
        particleCount: 2,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#00ffff', '#ffb700'],
        gravity: 0.5,
        scalar: 0.7,
      });

      timeoutId = window.setTimeout(fireConfetti, 800);
    };
    
    fireConfetti();
    
    return () => {
      isActive = false;
      clearTimeout(timeoutId);
      if (myConfetti) myConfetti.reset();
    };
  }, [isNavigating]);

  if (!isNavigating) return null;

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 50,
        opacity: 0.15 // Very subtle
      }}
    />
  );
};
