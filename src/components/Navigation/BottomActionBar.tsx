import React, { useState } from 'react';
import { Mic, Camera, Plus } from 'lucide-react';

interface BottomActionBarProps {
  onOpenScanner: () => void;
  onOpenVoice: () => void;
  onOpenSearch: () => void;
  isNavigating: boolean;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  onOpenScanner,
  onOpenVoice,
  onOpenSearch,
  isNavigating
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // If navigating, we might want to hide it or keep it depending on requirements.
  // The user said: "Suchleiste und Burger-Menü verschwinden für maximale Sicht auf die Karte, nur Bottom-Bar und rechte Controls bleiben"
  // So it stays visible.

  return (
    <div 
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: isFocused ? '12px 20px' : '8px 16px',
        backgroundColor: 'rgba(10, 16, 28, 0.95)',
        backdropFilter: 'blur(12px)',
        borderRadius: '40px',
        border: '1px solid rgba(0, 255, 255, 0.3)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
        transition: 'all 0.3s ease',
        width: isFocused ? '320px' : '260px',
        justifyContent: 'space-between'
      }}
      onClick={() => setIsFocused(true)}
      onMouseLeave={() => setIsFocused(false)}
    >
      <button 
        className="btn-cyberpunk"
        onClick={(e) => { e.stopPropagation(); onOpenScanner(); }}
        style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0, justifyContent: 'center' }}
      >
        <Camera size={20} />
      </button>

      <button 
        className="btn-cyberpunk btn-cyan"
        onClick={(e) => { e.stopPropagation(); onOpenVoice(); }}
        style={{ 
          borderRadius: '50%', 
          width: '64px', 
          height: '64px', 
          padding: 0, 
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)'
        }}
      >
        <Mic size={28} />
      </button>

      <button 
        className="btn-cyberpunk"
        onClick={(e) => { e.stopPropagation(); onOpenSearch(); }}
        style={{ borderRadius: '50%', width: '44px', height: '44px', padding: 0, justifyContent: 'center' }}
      >
        <Plus size={22} />
      </button>
    </div>
  );
};
