import React, { useState } from 'react';
import { Bluetooth, Sparkles, CheckCircle2, RefreshCw, X, Radio, Cpu, Gauge, Thermometer, Battery, ShieldCheck } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import { BleManager } from '../../services/ble/bleManager';
import type { LiveBikeTelemetry, BikeManufacturer } from '../../types/navigation';
import confetti from 'canvas-confetti';

interface BleConnectModalProps {
  isOpen: boolean;
  onConnected: (telemetry: LiveBikeTelemetry) => void;
  onClose: () => void;
  initialManufacturer?: BikeManufacturer;
}

interface ManufacturerMeta {
  name: string;
  badge: string;
  color: string;
  borderColor: string;
  description: string;
  instructions: string[];
  mockDevices: { id: string; name: string; rssi: number }[];
}

const MANUFACTURERS: Record<BikeManufacturer, ManufacturerMeta> = {
  bosch: {
    name: 'Bosch Smart System',
    badge: 'BES3',
    color: '#00509d',
    borderColor: '#00f0ff',
    description: 'Kiox 300, Kiox 500, SmartphoneGrip, Purion 200 & LED Remote',
    instructions: [
      'Schalte dein Bosch E-Bike am Akku oder an der LED Remote ein.',
      'Halte die Einstellungen-Taste (⚙️) an der LED Remote für 3 Sekunden gedrückt, bis das BLE-Symbol blau blinkt.',
      'Klicke unten auf "Bosch E-Bike Scannen".',
    ],
    mockDevices: [
      { id: 'bosch-bes3-750', name: 'Bosch Kiox 300 (BES3 #4829)', rssi: -54 },
      { id: 'bosch-grip-01', name: 'Bosch SmartphoneGrip Connect', rssi: -72 },
    ],
  },
  specialized: {
    name: 'Specialized Turbo',
    badge: 'TCU',
    color: '#dc2626',
    borderColor: '#f87171',
    description: 'Turbo Levo, Kenevo, Vado, Como, Creo & MasterMind TCU',
    instructions: [
      'Schalte das Specialized Turbo Bike am Oberrohr (TCU / MasterMind) ein.',
      'Drücke und halte den Power-Knopf für 3 Sekunden bis der Pairing-Modus aktiv ist.',
      'Klicke auf "Specialized Bike Scannen" und bestätige ggf. den 6-stelligen PIN-Code.',
    ],
    mockDevices: [
      { id: 'spec-levo-gen3', name: 'Specialized Turbo Levo Pro (TCU)', rssi: -58 },
      { id: 'spec-creo-sl', name: 'Specialized Turbo Creo SL', rssi: -75 },
    ],
  },
  shimano: {
    name: 'Shimano STEPS & Di2',
    badge: 'D-FLY',
    color: '#0284c7',
    borderColor: '#38bdf8',
    description: 'EP8, EP801, EP6, E8000 & Di2 elektronische Schaltung (D-Fly)',
    instructions: [
      'Schalte das Shimano E-Bike System ein.',
      'Drücke die Funktionstaste an der D-Fly Funk-Einheit (EW-WU111 / SC-EM800) für 0.5 Sekunden.',
      'Klicke unten auf "Shimano STEPS Scannen".',
    ],
    mockDevices: [
      { id: 'shimano-ep8-dfly', name: 'Shimano STEPS EP8 (EW-WU111)', rssi: -52 },
      { id: 'shimano-di2-wireless', name: 'Shimano Ultegra Di2 RD-R8150', rssi: -68 },
    ],
  },
  mahle: {
    name: 'Mahle SmartBike',
    badge: 'X35/X20',
    color: '#9333ea',
    borderColor: '#c084fc',
    description: 'Ebikemotion X35, X20, Pulsar ONE & iWoc Trio / ONE Remote',
    instructions: [
      'Schalte das Mahle System über den iWoc-Knopf am Oberrohr ein.',
      'Halte den iWoc-Knopf für ca. 3 Sekunden gedrückt, bis der LED-Ring kontinuierlich blau pulsiert.',
      'Klicke auf "Mahle SmartBike Scannen".',
    ],
    mockDevices: [
      { id: 'mahle-x35-iwoc', name: 'Mahle ebikemotion X35+ (iWoc)', rssi: -60 },
      { id: 'mahle-x20-head', name: 'Mahle X20 SmartBike System', rssi: -71 },
    ],
  },
  fazua: {
    name: 'Fazua Evation & Ride',
    badge: 'RIDE',
    color: '#16a34a',
    borderColor: '#4ade80',
    description: 'Fazua Ride 50 Trail/Street & Fazua Ride 60 Ring Control',
    instructions: [
      'Schalte das Fazua Drivepack am Akku oder Touch Remote ein.',
      'Drücke den Ring-Controller nach oben für 3 Sekunden, bis die LEDs blau leuchten.',
      'Klicke unten auf "Fazua Ride Scannen".',
    ],
    mockDevices: [
      { id: 'fazua-ride60', name: 'Fazua Ride 60 (Drivepack #104)', rssi: -56 },
    ],
  },
  bafang: {
    name: 'Bafang E-Drive',
    badge: 'CAN-BUS',
    color: '#ea580c',
    borderColor: '#fb923c',
    description: 'Bafang M400, M500, M600, Ultra CAN-Bus & UART Displays',
    instructions: [
      'Schalte das Bafang Display (z.B. DP C240 / C18) ein.',
      'Bluetooth-Broadcast ist standardmäßig beim Einschalten 2 Minuten aktiv.',
      'Klicke auf "Bafang Motor Scannen".',
    ],
    mockDevices: [
      { id: 'bafang-m500-ble', name: 'Bafang M500 CAN Controller', rssi: -63 },
    ],
  },
  generic: {
    name: 'Universal BLE Sensoren',
    badge: 'SIG',
    color: '#475569',
    borderColor: '#94a3b8',
    description: 'Standard Bluetooth SIG Sensoren (Puls, Trittfrequenz, Leistung, Akku)',
    instructions: [
      'Aktiviere deinen Bluetooth Smart Sensor oder Pulsgurt.',
      'Bewege die Kurbel oder das Laufrad, um den Sensor aus dem Standby zu wecken.',
      'Klicke unten auf "BLE Sensoren Scannen".',
    ],
    mockDevices: [
      { id: 'garmin-speed-cad', name: 'Garmin Speed/Cadence Sensor 2', rssi: -50 },
      { id: 'wahoo-tickr-fit', name: 'Wahoo TICKR Heart Rate', rssi: -65 },
    ],
  },
};

export const BleConnectModal: React.FC<BleConnectModalProps> = ({
  isOpen,
  onConnected,
  onClose,
  initialManufacturer = 'bosch',
}) => {
  const [selectedBrand, setSelectedBrand] = useState<BikeManufacturer>(initialManufacturer);
  const [step, setStep] = useState<'guide' | 'scanning' | 'connected'>('guide');
  const [discoveredDevices, setDiscoveredDevices] = useState<{ id: string; name: string; rssi: number }[]>([]);
  const [connectedTelemetry, setConnectedTelemetry] = useState<LiveBikeTelemetry | null>(null);

  if (!isOpen) return null;

  const activeMeta = MANUFACTURERS[selectedBrand];

  const handleStartScan = async () => {
    SoundFxService.playClick();
    setStep('scanning');
    setDiscoveredDevices([]);

    try {
      const liveTelemetry = await BleManager.connectToBike(selectedBrand);
      if (liveTelemetry && liveTelemetry.isConnected) {
        handleDeviceConnected(liveTelemetry);
        return;
      }
    } catch (e) {
      console.warn('[BleConnectModal] Scan exception:', e);
    }

    // Simulated scan discovery fallback matching selected brand
    setTimeout(() => {
      setDiscoveredDevices(activeMeta.mockDevices);
    }, 1500);
  };

  const handleSelectDiscovered = async (dev: { id: string; name: string; rssi: number }) => {
    console.log('[BleConnectModal] Device selected:', dev.name);
    const liveTelemetry = await BleManager.connectToBike(selectedBrand);
    liveTelemetry.deviceName = dev.name;
    handleDeviceConnected(liveTelemetry);
  };

  const handleDeviceConnected = (telemetry: LiveBikeTelemetry) => {
    SoundFxService.playClick();
    setConnectedTelemetry(telemetry);
    setStep('connected');
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
  };

  const handleTakeOver = () => {
    if (connectedTelemetry) {
      onConnected(connectedTelemetry);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 2200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '20px',
          border: `1px solid ${activeMeta.borderColor}`,
          boxShadow: `0 0 35px ${activeMeta.borderColor}40`,
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
                padding: '4px 10px',
                borderRadius: '8px',
                backgroundColor: activeMeta.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                color: '#ffffff',
                fontSize: '0.8rem',
                border: `1px solid ${activeMeta.borderColor}`,
              }}
            >
              {activeMeta.badge}
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', color: '#ffffff' }}>
                E-Bike & Sensoren Kopplung
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {activeMeta.name} — {activeMeta.description}
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

        {/* Brand Selector Tabs */}
        {step !== 'connected' && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
            }}
          >
            {(Object.keys(MANUFACTURERS) as BikeManufacturer[]).map((brand) => {
              const isSelected = selectedBrand === brand;
              const meta = MANUFACTURERS[brand];
              return (
                <button
                  key={brand}
                  onClick={() => {
                    SoundFxService.playClick();
                    setSelectedBrand(brand);
                    setStep('guide');
                    setDiscoveredDevices([]);
                  }}
                  className={`btn-cyberpunk ${isSelected ? 'btn-cyan' : ''}`}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 10px',
                    whiteSpace: 'nowrap',
                    borderColor: isSelected ? meta.borderColor : 'var(--border-glass)',
                  }}
                >
                  {meta.name.split(' ')[0]}
                </button>
              );
            })}
          </div>
        )}

        {/* Step 1: Pairing Guide */}
        {step === 'guide' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '14px',
                backgroundColor: `${activeMeta.color}25`,
                border: `1px solid ${activeMeta.borderColor}50`,
                borderRadius: '12px',
                fontSize: '0.85rem',
                lineHeight: '1.4',
              }}
            >
              <div style={{ fontWeight: 'bold', color: activeMeta.borderColor, marginBottom: '8px' }}>
                {activeMeta.name} Bluetooth-Aktivierung:
              </div>
              <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                {activeMeta.instructions.map((inst, idx) => (
                  <li key={idx}>{inst}</li>
                ))}
              </ol>
            </div>

            <button
              onClick={handleStartScan}
              className="btn-cyberpunk"
              style={{
                padding: '12px',
                justifyContent: 'center',
                fontSize: '0.9rem',
                backgroundColor: `${activeMeta.color}50`,
                borderColor: activeMeta.borderColor,
              }}
            >
              <Bluetooth size={18} /> {activeMeta.name} Scannen
            </button>
          </div>
        )}

        {/* Step 2: Scanning & Discovery */}
        {step === 'scanning' && (
          <div style={{ textAlign: 'center', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <RefreshCw size={24} className="spin-icon glow-text-cyan" />
              <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#fff' }}>
                Suche nach aktiven {activeMeta.name} Signalen...
              </span>
            </div>

            {discoveredDevices.length === 0 ? (
              <div style={{ padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Halte dein Smartphone nah an das Display oder die Funk-Einheit.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {discoveredDevices.map((dev) => (
                  <div
                    key={dev.id}
                    onClick={() => handleSelectDiscovered(dev)}
                    className="glass-panel"
                    style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: `1px solid ${activeMeta.borderColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      backgroundColor: 'rgba(0, 240, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Radio size={18} color="#00ff66" />
                      <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#fff' }}>{dev.name}</span>
                    </div>

                    <div style={{ fontSize: '0.75rem', color: '#00ff66', fontWeight: 'bold' }}>
                      Koppeln ➔
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Connection Success & Live Diagnostics */}
        {step === 'connected' && connectedTelemetry && (
          <div style={{ textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <CheckCircle2 size={50} color="#00ff66" style={{ margin: '0 auto' }} />
            <div>
              <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
                {connectedTelemetry.deviceName || activeMeta.name} verbunden!
              </h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Live GATT Telemetrie erfolgreich synchronisiert
              </p>
            </div>

            {/* Diagnostic Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '8px',
                padding: '12px',
                backgroundColor: 'rgba(0, 80, 157, 0.15)',
                borderRadius: '12px',
                border: '1px solid rgba(0, 240, 255, 0.2)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Akku-Ladestand</div>
                <div style={{ fontWeight: 'bold', color: '#00ff66', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Battery size={16} /> {connectedTelemetry.batteryPercent}%
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Unterstützung</div>
                <div style={{ fontWeight: 'bold', color: '#00f0ff', fontSize: '0.95rem', textTransform: 'uppercase' }}>
                  {connectedTelemetry.motorAssistMode}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Geschwindigkeit</div>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1rem' }}>
                  {connectedTelemetry.speedKmH} km/h
                </div>
              </div>

              {connectedTelemetry.batteryWhRemaining && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Rest-Kapazität</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>
                    {connectedTelemetry.batteryWhRemaining} Wh
                  </div>
                </div>
              )}

              {connectedTelemetry.batteryHealthPercent && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gesundheit (SOH)</div>
                  <div style={{ fontWeight: 'bold', color: '#00ff66', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> {connectedTelemetry.batteryHealthPercent}%
                  </div>
                </div>
              )}

              {connectedTelemetry.currentGear && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Di2 Gang</div>
                  <div style={{ fontWeight: 'bold', color: '#38bdf8', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Gauge size={14} /> {connectedTelemetry.currentGear}
                  </div>
                </div>
              )}

              {connectedTelemetry.motorPowerWatts !== undefined && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Motorleistung</div>
                  <div style={{ fontWeight: 'bold', color: '#a78bfa', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Cpu size={14} /> {connectedTelemetry.motorPowerWatts} W
                  </div>
                </div>
              )}

              {connectedTelemetry.motorTemperatureC !== undefined && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Motortemperatur</div>
                  <div style={{ fontWeight: 'bold', color: '#34d399', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Thermometer size={14} /> {connectedTelemetry.motorTemperatureC}°C
                  </div>
                </div>
              )}

              {connectedTelemetry.rangeRemainingKm !== undefined && (
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Restreichweite</div>
                  <div style={{ fontWeight: 'bold', color: '#ffb700', fontSize: '0.9rem' }}>
                    ~{connectedTelemetry.rangeRemainingKm} km
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleTakeOver}
              className="btn-cyberpunk btn-gold"
              style={{ padding: '12px 20px', justifyContent: 'center', marginTop: '4px' }}
            >
              <Sparkles size={16} /> Ins Cockpit Übernehmen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Backwards compatibility alias for BoschConnectModal
export const BoschConnectModal = BleConnectModal;

