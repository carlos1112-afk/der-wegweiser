import React, { useState } from 'react';
import { Battery, Zap, AlertTriangle, ShieldCheck, Cpu, Gauge, Thermometer, Bluetooth, ChevronDown } from 'lucide-react';
import type { Route, LiveBikeTelemetry, BikeManufacturer } from '../../types/navigation';
import { BleManager } from '../../services/ble/bleManager';

interface BatteryHUDProps {
  telemetry: LiveBikeTelemetry;
  currentRoute: Route | null;
  onConnectBLE: () => void;
  onOpenBoschModal?: () => void;
  compact?: boolean;
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

export const BatteryHUD: React.FC<BatteryHUDProps> = ({ telemetry, currentRoute, onConnectBLE, onOpenBoschModal }) => {
  const isBatterySafe = currentRoute ? currentRoute.isBatterySafe : true;
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const mBadge = manufacturerColors[telemetry.manufacturer || 'generic'];

  const handleModeChange = async (mode: 'off' | 'eco' | 'tour' | 'turbo') => {
    await BleManager.setAssistMode(mode);
  };

  return (
    <div style={{ position: 'relative' }}>
      {/* Compact Main Bar Pill */}
      <div
        className="glass-panel hud-battery-pill"
        onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
        style={{
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          cursor: 'pointer',
          border: '1px solid rgba(0, 240, 255, 0.3)',
        }}
        title="Akku & E-Bike Telemetrie Details anzeigen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Battery size={16} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'} />
          <span style={{ fontSize: '0.82rem', fontWeight: 'bold' }} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'}>
            {telemetry.batteryPercent}%
          </span>
        </div>

        <div className="mobile-hide-assist" style={{ width: '1px', height: '14px', backgroundColor: 'var(--border-glass)' }} />

        <div className="mobile-hide-assist" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <Zap size={13} className="glow-text-cyan" />
          <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>
            {telemetry.motorAssistMode}
          </span>
        </div>

        <ChevronDown size={13} className="mobile-hide-assist" style={{ color: 'var(--text-muted)', transform: showDetailsDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {/* Expanded Telemetry & Assist Modal Dropdown */}
      {showDetailsDropdown && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: '120%',
            right: 0,
            zIndex: 2500,
            padding: '14px',
            minWidth: '280px',
            maxWidth: '340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(10, 16, 28, 0.96)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
          }}
        >
          {/* Header & Manufacturer Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Battery size={20} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'} />
              <div>
                <span style={{ fontSize: '1.1rem', fontWeight: 'bold' }} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'}>
                  {telemetry.batteryPercent}%
                </span>
                {telemetry.batteryWhRemaining && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '6px' }}>
                    ({telemetry.batteryWhRemaining} Wh)
                  </span>
                )}
              </div>
            </div>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 'bold',
                padding: '2px 8px',
                borderRadius: '4px',
                backgroundColor: mBadge.bg,
                color: mBadge.text,
              }}
            >
              {mBadge.label}
            </span>
          </div>

          {/* Motor Assist Mode Switcher */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Unterstützungsstufe:
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['off', 'eco', 'tour', 'turbo'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`btn-cyberpunk ${telemetry.motorAssistMode.toLowerCase() === m ? 'btn-gold' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '4px 6px',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Motor & Rider Watts */}
          {(telemetry.motorPowerWatts !== undefined || telemetry.riderPowerWatts > 0) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--border-glass)' }}>
              <Cpu size={16} style={{ color: '#a78bfa' }} />
              <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                <strong>{telemetry.motorPowerWatts ?? 0} W Motor</strong> · {telemetry.riderPowerWatts ?? 0} W Fahrer
              </div>
            </div>
          )}

          {/* Di2 Gear or Motor Temp */}
          {(telemetry.currentGear || telemetry.motorTemperatureC !== undefined) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {telemetry.currentGear && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Gauge size={14} style={{ color: '#38bdf8' }} />
                  <span>Gang {telemetry.currentGear}</span>
                </div>
              )}
              {telemetry.motorTemperatureC !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Thermometer size={14} style={{ color: telemetry.motorTemperatureC > 60 ? '#f87171' : '#34d399' }} />
                  <span>{telemetry.motorTemperatureC}°C</span>
                </div>
              )}
            </div>
          )}

          {/* Topography & Battery Safety Status */}
          {currentRoute && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: isBatterySafe ? 'rgba(0, 255, 102, 0.1)' : 'rgba(255, 183, 0, 0.15)',
                border: `1px solid ${isBatterySafe ? 'var(--accent-neon-green)' : 'var(--accent-gold)'}`,
              }}
            >
              {isBatterySafe ? (
                <ShieldCheck size={18} style={{ color: 'var(--accent-neon-green)' }} />
              ) : (
                <AlertTriangle size={18} style={{ color: 'var(--accent-gold)' }} />
              )}
              <div style={{ fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 'bold', color: isBatterySafe ? 'var(--accent-neon-green)' : 'var(--accent-gold)' }}>
                  {isBatterySafe ? 'Reichweite Ausreichend' : 'Ladestopp Empfohlen'}
                </div>
                <div style={{ color: 'var(--text-muted)' }}>
                  ~{currentRoute.estimatedBatteryConsumptionWh} Wh ({currentRoute.elevationGainM}m hm)
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {onOpenBoschModal && (
              <button
                className="btn-cyberpunk btn-cyan"
                onClick={() => {
                  setShowDetailsDropdown(false);
                  onOpenBoschModal();
                }}
                style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
              >
                <Bluetooth size={14} /> E-Bike Kopplung
              </button>
            )}
            <button
              className="btn-cyberpunk"
              onClick={() => {
                setShowDetailsDropdown(false);
                onConnectBLE();
              }}
              style={{ flex: 1, padding: '6px', fontSize: '0.75rem' }}
            >
              Schnell-Scan
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
