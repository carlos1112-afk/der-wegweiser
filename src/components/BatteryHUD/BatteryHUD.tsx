import React, { useState } from 'react';
import { Battery, Zap, AlertTriangle, ShieldCheck, Cpu, Gauge, Thermometer, Bluetooth, ChevronDown, Plus } from 'lucide-react';
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
  bosch: { bg: 'rgba(59, 130, 246, 0.25)', text: '#60a5fa', label: 'BOSCH BES3' },
  shimano: { bg: 'rgba(14, 165, 233, 0.25)', text: '#38bdf8', label: 'SHIMANO STEPS' },
  specialized: { bg: 'rgba(239, 68, 68, 0.25)', text: '#f87171', label: 'SPECIALIZED TURBO' },
  mahle: { bg: 'rgba(168, 85, 247, 0.25)', text: '#c084fc', label: 'MAHLE SMARTBIKE' },
  fazua: { bg: 'rgba(34, 197, 94, 0.25)', text: '#4ade80', label: 'FAZUA RIDE' },
  bafang: { bg: 'rgba(249, 115, 22, 0.25)', text: '#fb923c', label: 'BAFANG CAN' },
  generic: { bg: 'rgba(148, 163, 184, 0.25)', text: '#94a3b8', label: 'BLE SENSOR' },
};

export const BatteryHUD: React.FC<BatteryHUDProps> = ({
  telemetry,
  currentRoute,
  onConnectBLE,
  onOpenBoschModal,
}) => {
  const isBatterySafe = currentRoute ? currentRoute.isBatterySafe : true;
  const [showDetailsDropdown, setShowDetailsDropdown] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const mBadge = manufacturerColors[telemetry.manufacturer || 'generic'];

  const handleModeChange = async (mode: 'off' | 'eco' | 'tour' | 'turbo') => {
    setAssistError(null);
    const success = await BleManager.setAssistMode(mode);
    if (!success) {
      setAssistError('Keine E-Bike Hardware verbunden.');
    }
  };

  const hasBattery = typeof telemetry.batteryPercent === 'number' && telemetry.batteryPercent !== null;

  // Unconnected State Trigger Pill
  if (!telemetry.isConnected) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          className="glass-panel"
          onClick={() => (onOpenBoschModal ? onOpenBoschModal() : onConnectBLE())}
          style={{
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            borderRadius: '20px',
            backgroundColor: 'rgba(22, 26, 32, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          title="E-Bike über Bluetooth verbinden (Bosch, Shimano, Specialized, Bafang, Mahle)"
        >
          <Bluetooth size={15} className="glow-text-cyan" />
          <span>E-Bike verbinden</span>
          <Plus size={14} style={{ color: 'var(--accent-cyan)' }} />
        </button>
      </div>
    );
  }

  // Connected State Telemetry Bar Pill
  return (
    <div style={{ position: 'relative' }}>
      {/* Compact Main Bar Pill */}
      <div
        className="glass-panel hud-battery-pill"
        onClick={() => setShowDetailsDropdown(!showDetailsDropdown)}
        style={{
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          borderRadius: '20px',
          backgroundColor: 'rgba(22, 26, 32, 0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1.5px solid var(--accent-neon-green)',
          boxShadow: 'var(--glow-green)',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title="Akku & E-Bike Telemetrie Details anzeigen"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Battery
            size={16}
            className={
              hasBattery && (telemetry.batteryPercent as number) < 25 ? 'glow-text-gold' : 'glow-text-green'
            }
          />
          <span
            style={{ fontSize: '0.85rem', fontWeight: '800' }}
            className={
              hasBattery && (telemetry.batteryPercent as number) < 25 ? 'glow-text-gold' : 'glow-text-green'
            }
          >
            {hasBattery ? `${telemetry.batteryPercent}%` : '--'}
          </span>
        </div>

        <div style={{ width: '1px', height: '14px', backgroundColor: 'rgba(0, 230, 163, 0.3)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Zap size={14} className="glow-text-cyan" />
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: 'var(--accent-cyan)',
              textTransform: 'uppercase',
            }}
          >
            {telemetry.motorAssistMode || 'ECO'}
          </span>
        </div>

        <ChevronDown
          size={14}
          style={{
            color: 'var(--text-muted)',
            transform: showDetailsDropdown ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.25s ease',
          }}
        />
      </div>

      {/* Expanded Telemetry & Assist Modal Dropdown */}
      {showDetailsDropdown && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: '125%',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2500,
            padding: '16px',
            minWidth: '290px',
            maxWidth: '340px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            backgroundColor: 'rgba(22, 26, 32, 0.96)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1.5px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            borderRadius: '16px',
          }}
        >
          {/* Header & Manufacturer Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Battery
                size={22}
                className={
                  hasBattery && (telemetry.batteryPercent as number) < 25 ? 'glow-text-gold' : 'glow-text-green'
                }
              />
              <div>
                <span
                  style={{ fontSize: '1.2rem', fontWeight: 'bold' }}
                  className={
                    hasBattery && (telemetry.batteryPercent as number) < 25 ? 'glow-text-gold' : 'glow-text-green'
                  }
                >
                  {hasBattery ? `${telemetry.batteryPercent}%` : '--'}
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
                fontWeight: '800',
                padding: '3px 8px',
                borderRadius: '6px',
                backgroundColor: mBadge.bg,
                color: mBadge.text,
                letterSpacing: '0.5px',
              }}
            >
              {mBadge.label}
            </span>
          </div>

          {/* Motor Assist Mode Switcher */}
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 'bold' }}>
              Unterstützungsstufe:
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['off', 'eco', 'tour', 'turbo'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`btn-cyberpunk ${telemetry.motorAssistMode?.toLowerCase() === m ? 'btn-gold' : ''}`}
                  style={{
                    flex: 1,
                    fontSize: '0.7rem',
                    padding: '6px 4px',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
            {assistError && (
              <div style={{ fontSize: '0.7rem', color: 'var(--accent-danger)', marginTop: '6px' }}>
                {assistError}
              </div>
            )}
          </div>

          {/* Motor & Rider Watts */}
          {(telemetry.motorPowerWatts !== undefined || telemetry.riderPowerWatts > 0) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 0',
                borderTop: '1px solid rgba(0, 230, 163, 0.2)',
              }}
            >
              <Cpu size={16} style={{ color: 'var(--accent-cyan)' }} />
              <div style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                <strong>{telemetry.motorPowerWatts ?? 0} W Motor</strong> · {telemetry.riderPowerWatts ?? 0} W Eigenleistung
              </div>
            </div>
          )}

          {/* Gear or Motor Temp */}
          {(telemetry.currentGear || telemetry.motorTemperatureC !== undefined) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
              }}
            >
              {telemetry.currentGear && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Gauge size={14} style={{ color: '#38bdf8' }} />
                  <span>Gang {telemetry.currentGear}</span>
                </div>
              )}
              {telemetry.motorTemperatureC !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Thermometer
                    size={14}
                    style={{ color: telemetry.motorTemperatureC > 60 ? 'var(--accent-danger)' : 'var(--accent-neon-green)' }}
                  />
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
                padding: '8px 10px',
                borderRadius: '10px',
                backgroundColor: isBatterySafe ? 'rgba(0, 255, 102, 0.12)' : 'rgba(255, 183, 0, 0.15)',
                border: `1px solid ${isBatterySafe ? 'var(--accent-neon-green)' : 'var(--accent-gold)'}`,
              }}
            >
              {isBatterySafe ? (
                <ShieldCheck size={18} style={{ color: 'var(--accent-neon-green)' }} />
              ) : (
                <AlertTriangle size={18} style={{ color: 'var(--accent-gold)' }} />
              )}
              <div style={{ fontSize: '0.75rem' }}>
                <div
                  style={{
                    fontWeight: 'bold',
                    color: isBatterySafe ? 'var(--accent-neon-green)' : 'var(--accent-gold)',
                  }}
                >
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
                style={{ flex: 1, padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
              >
                <Bluetooth size={14} /> Kopplung
              </button>
            )}
            <button
              className="btn-cyberpunk"
              onClick={() => {
                setShowDetailsDropdown(false);
                onConnectBLE();
              }}
              style={{ flex: 1, padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}
            >
              Neu Scannen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
