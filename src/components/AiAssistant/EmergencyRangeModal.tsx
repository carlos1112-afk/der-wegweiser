import React from 'react';
import { BatteryWarning, Navigation, Zap, X } from 'lucide-react';
import type { ChargingStation } from '../../types/navigation';
import { SoundFxService } from '../../services/soundFxService';
import { VoiceGuidanceService } from '../../services/voiceGuidanceService';

interface EmergencyRangeModalProps {
  isOpen: boolean;
  batteryPercent: number;
  remainingWh: number;
  nearestStations: ChargingStation[];
  onRerouteToStation: (station: ChargingStation) => void;
  onClose: () => void;
}

export const EmergencyRangeModal: React.FC<EmergencyRangeModalProps> = ({
  isOpen,
  batteryPercent,
  remainingWh,
  nearestStations,
  onRerouteToStation,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleSelectRescueStation = (station: ChargingStation) => {
    SoundFxService.playTurnChime();
    VoiceGuidanceService.speak(`Notfall-Navigation aktiviert. Führe dich zur nächsten Ladestation: ${station.name}`);
    onRerouteToStation(station);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(25, 5, 10, 0.92)',
        backdropFilter: 'blur(20px)',
        zIndex: 2500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '520px',
          padding: '24px',
          borderRadius: '24px',
          border: '2px solid #ff3333',
          boxShadow: '0 0 40px rgba(255, 50, 50, 0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 50, 50, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ff3333',
                animation: 'micPulse 1.2s infinite ease-in-out',
              }}
            >
              <BatteryWarning size={26} color="#ff3333" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ff3333', letterSpacing: '0.5px' }}>
                NO-COAST REICHWEITEN-ALARM!
              </h3>
              <p style={{ fontSize: '0.75rem', color: '#fff' }}>
                Akku kritisch: <strong>{batteryPercent}% ({remainingWh} Wh)</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8a99ad', cursor: 'pointer', fontSize: '1.3rem' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Advisory Box */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 50, 50, 0.1)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 50, 50, 0.3)',
            fontSize: '0.85rem',
            color: '#f8fafc',
            lineHeight: '1.4',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#ff7777', marginBottom: '4px' }}>
            ⚡ Empfohlene Sofortmaßnahmen:
          </div>
          <ul style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.8rem' }}>
            <li>Motor-Unterstützung sofort auf <strong>ECO</strong> oder <strong>OFF</strong> stellen.</li>
            <li>Trittfrequenz auf <strong>75–80 RPM</strong> erhöhen, um den Motor zu entlasten.</li>
            <li>Wähle unten die nächste sichere Ladestation für eine Sofort-Umleitung.</li>
          </ul>
        </div>

        {/* Nearest Stations List */}
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
            Nächste Lade-Stopps im Umkreis:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {nearestStations.slice(0, 3).map((st) => (
              <div
                key={st.id}
                onClick={() => handleSelectRescueStation(st)}
                className="glass-panel"
                style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--accent-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  backgroundColor: 'rgba(255, 183, 0, 0.08)',
                  transition: 'transform 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Zap size={20} color="var(--accent-gold)" />
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>
                      {st.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Stecker: {st.plugType.toUpperCase()} • {st.isFree ? 'Kostenlos' : 'Kostenpflichtig'}
                    </div>
                  </div>
                </div>

                <button
                  className="btn-cyberpunk btn-gold"
                  style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Navigation size={14} /> Dorthin
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onClose}
          className="btn-cyberpunk"
          style={{ padding: '10px', fontSize: '0.8rem', justifyContent: 'center' }}
        >
          Ich fahre auf eigenes Risiko weiter
        </button>
      </div>
    </div>
  );
};
