import { useState } from 'react';
import confetti from 'canvas-confetti';
import { Camera, Zap, Sparkles, Award } from 'lucide-react';
import type { PlugType, ChargingStation } from '../../types/navigation';
import { AiAssistantService } from '../../services/aiAssistantService';
import { UserIdentity } from '../../services/userIdentity';

interface ScannerModalProps {
  userLocation: { lat: number; lng: number };
  onStationAdded: (station: Omit<ChargingStation, 'id' | 'createdAt'>) => void;
  onClose: () => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({ userLocation, onStationAdded, onClose }) => {
  const [stationName, setStationName] = useState('');
  const [plugType, setPlugType] = useState<PlugType>('unknown');
  const [isWeatherproof, setIsWeatherproof] = useState(true);
  const [isFree, setIsFree] = useState(true);
  const [photoCaptured, setPhotoCaptured] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [stationSubmitted, setStationSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Trigger Sound Effect ("KATSCHINGG!")
  const playKatchingSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.log('AudioContext sound effect playback', e);
    }
  };

  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPhotoCaptured(base64);

      try {
        // Run real Gemini Vision analysis on user's actual photograph!
        const result = await AiAssistantService.analyzeChargingStationPhoto(base64);
        setPlugType(result.plugType);
      } catch (error) {
        console.error('Gemini Vision Analysis failed:', error);
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!stationName) return;
    setSubmitError(null);
    try {
      await onStationAdded({
        name: stationName.trim(),
        lat: userLocation.lat,
        lng: userLocation.lng,
        plugType,
        isWeatherproof,
        isFree,
        openingHours: '24/7',
        nearbyAmenities: ['Fahrradständer', 'WC'],
        photoUrl: photoCaptured || undefined,
        verifiedByCount: 1,
        createdByUserId: UserIdentity.getUserId(),
        isVerifiedBikeInfrastructure: true,
      });
      setStationSubmitted(true);
    } catch (error) {
      console.error('[ScannerModal] Station konnte nicht gespeichert werden:', error);
      setSubmitError('Der Stationsbeitrag konnte nicht gespeichert werden. Bitte prüfe die Verbindung und versuche es erneut.');
      return;
    }

    // Play "KATSCHINGG!" sound & launch confetti
    playKatchingSound();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#00E6A3', '#00ff66', '#ffb700']
    });

    setTimeout(() => {
      onClose();
    }, 1800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(20, 20, 20, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        className="glass-panel"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '24px',
          border: '1px solid var(--accent-neon-green)',
          boxShadow: 'var(--glow-green)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glow-text-green">
            <Zap size={20} />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>LADESÄULE ERFASSEN</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8a99ad', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>

        {/* Tokens Celebration Modal State */}
        {stationSubmitted ? (
          <div style={{ textAlign: 'center', padding: '30px 10px' }}>
            <Award size={64} className="glow-text-gold" style={{ margin: '0 auto 16px' }} />
            <h2 className="glow-text-gold" style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '8px' }}>
              KATSCHINGG!!
            </h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--accent-neon-green)', fontWeight: 'bold' }}>
              Stationsbeitrag gespeichert
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
              Danke für deinen Beitrag. Für Stationsmeldungen gibt es derzeit keine Token-Prämie.
            </p>
          </div>
        ) : (
          <>
            {/* 5 Essential Questions Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  1. Name der Ladesäule / Ort
                </label>
                <input
                  type="text"
                  placeholder="z.B. Ladesäule Gasthof Lindengarten"
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(28, 28, 28, 0.8)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Photo Capture & Gemini Vision Analysis */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  2. Foto der Ladesäule aufnehmen (Foto-Dokumentation)
                </label>
                <div
                  style={{
                    position: 'relative',
                    height: '140px',
                    borderRadius: '12px',
                    border: '2px dashed var(--accent-neon-green)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    backgroundColor: 'rgba(0, 255, 102, 0.05)',
                  }}
                >
                  {photoCaptured ? (
                    <img src={photoCaptured} alt="Captured charger" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <label
                      className="btn-cyberpunk"
                      style={{
                        borderColor: 'var(--accent-neon-green)',
                        color: 'var(--accent-neon-green)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 16px',
                        borderRadius: '8px',
                      }}
                    >
                      <Camera size={18} /> Foto aufnehmen & scannen
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoCapture}
                        style={{ display: 'none' }}
                      />
                    </label>
                  )}

                  {isScanning && (
                    <div className="scanner-line" />
                  )}
                </div>
              </div>

              {/* Plug Type Selector */}
              <div>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                  3. Steckertyp (KI-Erkannt)
                </label>
                <select
                  value={plugType}
                  onChange={(e) => setPlugType(e.target.value as PlugType)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(28, 28, 28, 0.8)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                >
                  <option value="schuko_230v">230V Schuko Steckdose</option>
                  <option value="bosch">Bosch Fast Charger</option>
                  <option value="bike_energy">BikeEnergy System</option>
                  <option value="shimano">Shimano Steps</option>
                  <option value="unknown">Unbekannt / Bitte Stecker fotografieren</option>
                </select>
              </div>

              {/* Weatherproof & Price Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    4. Überdacht?
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsWeatherproof(!isWeatherproof)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      backgroundColor: isWeatherproof ? 'rgba(0, 255, 102, 0.2)' : 'transparent',
                      color: isWeatherproof ? 'var(--accent-neon-green)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {isWeatherproof ? 'Ja (Überdacht)' : 'Nein (Freiluft)'}
                  </button>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    5. Kostenlos?
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsFree(!isFree)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      backgroundColor: isFree ? 'rgba(0, 230, 163, 0.2)' : 'transparent',
                      color: isFree ? 'var(--accent-cyan)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    {isFree ? 'Ja (Gratis Strom)' : 'Nein (Gebührenpflichtig)'}
                  </button>
                </div>
              </div>
            </div>

            {submitError && <p role="alert" style={{ color: '#ff7777', marginBottom: '10px' }}>{submitError}</p>}
            <button
              onClick={handleSubmit}
              className="btn-gold"
              disabled={!stationName}
              style={{ width: '100%', padding: '12px', fontWeight: 'bold', fontSize: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              <Sparkles size={18} /> Stationsbeitrag speichern
            </button>
          </>
        )}
      </div>
    </div>
  );
};
