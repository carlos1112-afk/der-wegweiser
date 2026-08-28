import { useState, useEffect } from 'react';
import { Navigation, Battery, EyeOff } from 'lucide-react';
import type { LiveBikeTelemetry } from '../../types/navigation';

interface OledBlackModeProps {
  telemetry: LiveBikeTelemetry;
  onExitOledMode: () => void;
}

export function OledBlackMode({ telemetry, onExitOledMode }: OledBlackModeProps) {
  const [isWoken, setIsWoken] = useState(false);
  const [distanceToTurnM, setDistanceToTurnM] = useState(350);
  const [turnInstruction, setTurnInstruction] = useState('In 350m links abbiegen auf Seeweg');

  // Auto wake 200m before turn
  useEffect(() => {
    const timer = setInterval(() => {
      setDistanceToTurnM((prev) => {
        const next = prev - 15;
        if (next <= 200 && !isWoken) {
          setIsWoken(true);
        }
        if (next <= 0) {
          setTurnInstruction('Jetzt abbiegen auf Seeweg');
          return 450;
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isWoken]);

  return (
    <div
      onClick={() => setIsWoken((prev) => !prev)}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#000000',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '32px 20px',
        color: '#ffffff',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {/* Top minimal status */}
      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: '#888' }}>
          <Battery size={18} color={telemetry.batteryPercent < 20 ? '#ff4444' : '#00ffcc'} />
          <span style={{ fontWeight: 'bold', color: '#fff' }}>{telemetry.batteryPercent}%</span>
        </div>

        <div style={{ fontSize: '0.8rem', color: '#666', letterSpacing: '1px' }}>
          BEELINE OLED SAVER
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onExitOledMode();
          }}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid #444',
            color: '#fff',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            cursor: 'pointer',
          }}
        >
          Karte anzeigen
        </button>
      </div>

      {/* Center Navigation Focus (Beeline Arrow or Turn Prompts) */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {isWoken ? (
          <>
            <Navigation size={84} style={{ color: '#00ffcc', transform: 'rotate(-45deg)', filter: 'drop-shadow(0 0 12px #00ffcc)' }} />
            <div style={{ fontSize: '3rem', fontWeight: '900', color: '#00ffcc', letterSpacing: '1px' }}>
              {distanceToTurnM} m
            </div>
            <div style={{ fontSize: '1.2rem', color: '#ffffff', maxWidth: '300px', fontWeight: '500' }}>
              {turnInstruction}
            </div>
          </>
        ) : (
          <>
            <EyeOff size={48} style={{ color: '#333' }} />
            <div style={{ fontSize: '1rem', color: '#444' }}>
              OLED Deep Black Active
            </div>
            <div style={{ fontSize: '0.8rem', color: '#333' }}>
              Tippen zum Aufwecken • Wacht 200m vor Kurve automatisch auf
            </div>
          </>
        )}
      </div>

      {/* Bottom Live Metrics */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-around',
          width: '100%',
          maxWidth: '400px',
          borderTop: '1px solid #222',
          paddingTop: '16px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>
            {telemetry.speedKmH}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>km/h</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>
            {telemetry.cadenceRpm}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>RPM</div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#00ffcc' }}>
            {telemetry.riderPowerWatts}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Watt</div>
        </div>
      </div>
    </div>
  );
}
