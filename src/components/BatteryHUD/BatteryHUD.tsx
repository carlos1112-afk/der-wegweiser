import React, { useState } from 'react';
import { Battery, Zap, AlertTriangle, ShieldCheck, Cpu, Gauge, Thermometer } from 'lucide-react';
import type { Route, LiveBikeTelemetry, BikeManufacturer } from '../../types/navigation';
import { BleManager } from '../../services/ble/bleManager';

interface BatteryHUDProps {
  telemetry: LiveBikeTelemetry;
  currentRoute: Route | null;
  onConnectBLE: () => void;
}

const manufacturerColors: Record<BikeManufacturer, { bg: string; text: string; label: string }> = {
  bosch: { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', label: 'BOSCH BES3' },
  shimano: { bg: 'rgba(14, 165, 233, 0.2)', text: '#38bdf8', label: 'SHIMANO STEPS' },
  specialized: { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', label: 'SPECIALIZED TURBO' },
  mahle: { bg: 'rgba(168, 85, 247, 0.2)', text: '#c084fc', label: 'MAHLE SMARTBIKE' },
  fazua: { bg: 'rgba(34, 197, 94, 0.2)', text: '#4ade80', label: 'FAZUA RIDE' },
  bafang: { bg: 'rgba(249, 115, 22, 0.2)', text: '#fb923c', label: 'BAFANG CAN' },
  generic: { bg: 'rgba(148, 163, 184, 0.2)', text: '#94a3b8', label: 'BLE SENSOR' },
};

export const BatteryHUD: React.FC<BatteryHUDProps> = ({ telemetry, currentRoute, onConnectBLE }) => {
  const isBatterySafe = currentRoute ? currentRoute.isBatterySafe : true;
  const [showModeSelector, setShowModeSelector] = useState(false);
  const mBadge = manufacturerColors[telemetry.manufacturer || 'generic'];

  const handleModeChange = async (mode: 'off' | 'eco' | 'tour' | 'turbo') => {
    await BleManager.setAssistMode(mode);
    setShowModeSelector(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
      {/* Battery Indicator & Wh */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Battery size={22} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'} />
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }} className="glow-text-green">
              {telemetry.batteryPercent}%
            </span>
            {telemetry.batteryWhRemaining && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {telemetry.batteryWhRemaining} Wh
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontWeight: 'bold',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: mBadge.bg,
                color: mBadge.text,
                letterSpacing: '0.5px',
              }}
            >
              {mBadge.label}
            </span>
          </div>
        </div>
      </div>

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-glass)' }} />

      {/* Assist Mode & Switcher */}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => setShowModeSelector(!showModeSelector)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          title="Klicken zum Umschalten der Unterstützungsstufe"
        >
          <Zap size={18} className="glow-text-cyan" />
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
              {telemetry.motorAssistMode}
            </div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Stufe ▾</div>
          </div>
        </div>

        {showModeSelector && (
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '110%',
              left: 0,
              zIndex: 100,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              minWidth: '100px',
            }}
          >
            {(['off', 'eco', 'tour', 'turbo'] as const).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className="btn-cyberpunk"
                style={{
                  fontSize: '0.7rem',
                  padding: '4px 8px',
                  textTransform: 'uppercase',
                  textAlign: 'left',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Motor & Rider Watts */}
      {(telemetry.motorPowerWatts !== undefined || telemetry.riderPowerWatts > 0) && (
        <>
          <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-glass)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Cpu size={18} style={{ color: '#a78bfa' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#e2e8f0' }}>
                {telemetry.motorPowerWatts ?? 0} W <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>({telemetry.riderPowerWatts} W Pedal)</span>
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Motorleistung</div>
            </div>
          </div>
        </>
      )}

      {/* Di2 Gear or Motor Temp */}
      {telemetry.currentGear && (
        <>
          <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-glass)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Gauge size={18} style={{ color: '#38bdf8' }} />
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#38bdf8' }}>
                Gang {telemetry.currentGear}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Di2 Shifting</div>
            </div>
          </div>
        </>
      )}

      {telemetry.motorTemperatureC !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Thermometer size={14} style={{ color: telemetry.motorTemperatureC > 60 ? '#f87171' : '#34d399' }} />
          {telemetry.motorTemperatureC}°C
        </div>
      )}

      {/* Topography & Battery Safety Alert */}
      {currentRoute && (
        <>
          <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-glass)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isBatterySafe ? (
              <ShieldCheck size={20} style={{ color: 'var(--accent-neon-green)' }} />
            ) : (
              <AlertTriangle size={20} style={{ color: 'var(--accent-gold)' }} />
            )}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                {isBatterySafe ? 'Reichweite Sicher' : 'Ladestopp Empfohlen'}
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                ~{currentRoute.estimatedBatteryConsumptionWh} Wh ({currentRoute.elevationGainM}m hm)
              </div>
            </div>
          </div>
        </>
      )}

      {/* Connect BLE Button if not connected */}
      {!telemetry.isConnected && (
        <button className="btn-cyberpunk" onClick={onConnectBLE} style={{ marginLeft: 'auto', fontSize: '0.75rem', padding: '6px 12px' }}>
          eBike BLE Sync
        </button>
      )}
    </div>
  );
};
