import React, { useEffect, useRef } from 'react';
import { ArrowUp, CornerUpRight, CornerUpLeft, ArrowUpRight, ArrowUpLeft, Flag, AlertTriangle, RefreshCw } from 'lucide-react';
import type { TurnManeuver } from '../../hooks/useRouteTracker';
import { VoiceGuidanceService } from '../../services/voiceGuidanceService';

interface TurnByTurnBannerProps {
  maneuver: TurnManeuver | null;
  isOffRoute?: boolean;
  offRouteDistanceM?: number;
  onManualReroute?: () => void;
}

export const TurnByTurnBanner: React.FC<TurnByTurnBannerProps> = ({
  maneuver,
  isOffRoute,
  offRouteDistanceM,
  onManualReroute,
}) => {
  const lastSpokenRef = useRef<string>('');

  // Audio voice guidance trigger on approach
  useEffect(() => {
    if (!maneuver) return;

    if (maneuver.isApproaching && lastSpokenRef.current !== `${maneuver.action}-200`) {
      lastSpokenRef.current = `${maneuver.action}-200`;
      VoiceGuidanceService.speak(maneuver.instruction);
    } else if (maneuver.isImminent && lastSpokenRef.current !== `${maneuver.action}-50`) {
      lastSpokenRef.current = `${maneuver.action}-50`;
      VoiceGuidanceService.speak(`Jetzt ${maneuver.instruction.replace(/In \d+m /, '')}`);
    }
  }, [maneuver]);

  if (isOffRoute) {
    return (
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          border: '1px solid var(--accent-gold)',
          boxShadow: 'var(--glow-gold)',
          backgroundColor: 'rgba(25, 20, 10, 0.9)',
          borderRadius: '16px',
          maxWidth: '90%',
          width: '460px',
        }}
      >
        <AlertTriangle size={28} className="glow-text-gold" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-gold)' }}>
            Strecke verlassen ({offRouteDistanceM}m)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Automatische Routenkorrektur aktiv...
          </div>
        </div>
        {onManualReroute && (
          <button
            className="btn-cyberpunk btn-gold"
            onClick={onManualReroute}
            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
          >
            <RefreshCw size={14} className="spin-icon" /> Neu berechnen
          </button>
        )}
      </div>
    );
  }

  if (!maneuver) return null;

  const renderTurnIcon = () => {
    const size = 32;
    const color = 'var(--accent-cyan)';
    switch (maneuver.action) {
      case 'turn-left':
        return <CornerUpLeft size={size} color={color} />;
      case 'turn-right':
        return <CornerUpRight size={size} color={color} />;
      case 'slight-left':
        return <ArrowUpLeft size={size} color={color} />;
      case 'slight-right':
        return <ArrowUpRight size={size} color={color} />;
      case 'arrive':
        return <Flag size={size} color="var(--accent-neon-green)" />;
      case 'straight':
      default:
        return <ArrowUp size={size} color={color} />;
    }
  };

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        top: '76px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        borderRadius: '16px',
        boxShadow: 'var(--glow-cyan)',
        border: '1px solid var(--accent-cyan)',
        backgroundColor: 'rgba(10, 18, 30, 0.85)',
        backdropFilter: 'blur(16px)',
        maxWidth: '92%',
        width: '480px',
        userSelect: 'none',
      }}
    >
      {/* Turn Icon Box */}
      <div
        style={{
          width: '52px',
          height: '52px',
          borderRadius: '12px',
          backgroundColor: 'rgba(0, 240, 255, 0.15)',
          border: '1px solid var(--accent-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 15px rgba(0, 240, 255, 0.3)',
        }}
      >
        {renderTurnIcon()}
      </div>

      {/* Distance & Instructions */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '1.5rem', fontWeight: '900', color: '#ffffff', letterSpacing: '0.5px' }}>
            {maneuver.distanceM}
          </span>
          <span style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
            Meter
          </span>
        </div>
        <div style={{ fontSize: '0.9rem', color: '#e2e8f0', fontWeight: '600', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {maneuver.instruction}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {maneuver.nextStreet}
        </div>
      </div>
    </div>
  );
};
