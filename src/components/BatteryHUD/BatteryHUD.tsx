import { Battery, Zap, AlertTriangle, ShieldCheck } from 'lucide-react';
import type { Route, LiveBikeTelemetry } from '../../types/navigation';

interface BatteryHUDProps {
  telemetry: LiveBikeTelemetry;
  currentRoute: Route | null;
  onConnectBLE: () => void;
}

export const BatteryHUD: React.FC<BatteryHUDProps> = ({ telemetry, currentRoute, onConnectBLE }) => {
  const isBatterySafe = currentRoute ? currentRoute.isBatterySafe : true;

  return (
    <div className="glass-panel" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '16px' }}>
      {/* Battery Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Battery size={22} className={telemetry.batteryPercent < 25 ? 'glow-text-gold' : 'glow-text-green'} />
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }} className="glow-text-green">
            {telemetry.batteryPercent}%
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {telemetry.deviceName || 'Bosch Smart System'}
          </div>
        </div>
      </div>

      <div style={{ width: '1px', height: '30px', backgroundColor: 'var(--border-glass)' }} />

      {/* Assist Mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Zap size={18} className="glow-text-cyan" />
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
            {telemetry.motorAssistMode}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Modus</div>
        </div>
      </div>

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
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Verbrauch: ~{currentRoute.estimatedBatteryConsumptionWh} Wh ({currentRoute.elevationGainM}m hm)
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
