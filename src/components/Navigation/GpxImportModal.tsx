import React, { useState } from 'react';
import { UploadCloud, FileText, AlertTriangle, Sparkles, X } from 'lucide-react';
import { GpxImportService } from '../../services/gpxImportService';
import { SoundFxService } from '../../services/soundFxService';
import type { Route } from '../../types/navigation';
import confetti from 'canvas-confetti';

interface GpxImportModalProps {
  isOpen: boolean;
  onRouteLoaded: (route: Route) => void;
  onClose: () => void;
}

export const GpxImportModal: React.FC<GpxImportModalProps> = ({
  isOpen,
  onRouteLoaded,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [parsedRoute, setParsedRoute] = useState<Route | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileProcess = async (file: File) => {
    setErrorMsg(null);
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      setErrorMsg('Bitte wähle eine gültige .gpx Datei aus.');
      SoundFxService.playWarningTone();
      return;
    }

    try {
      const route = await GpxImportService.parseGpxFile(file);
      setParsedRoute(route);
      setFileName(file.name);
      SoundFxService.playSuccessChime();
      confetti({ particleCount: 60, spread: 60 });
    } catch (err: any) {
      setErrorMsg(err.message || 'Fehler beim Parsen der GPX-Datei.');
      SoundFxService.playWarningTone();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleStartNavigation = () => {
    if (!parsedRoute) return;
    SoundFxService.playTurnChime();
    onRouteLoaded(parsedRoute);
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
          maxWidth: '540px',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-cyan">
            <UploadCloud size={26} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>GPX-TOUR IMPORTIEREN</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Komoot, Strava, Garmin & Outdooractive Tracks laden
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

        {/* Drag & Drop Zone */}
        {!parsedRoute ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            style={{
              border: isDragging ? '2px dashed var(--accent-cyan)' : '2px dashed var(--border-glass)',
              borderRadius: '16px',
              padding: '32px 16px',
              textAlign: 'center',
              backgroundColor: isDragging ? 'rgba(0, 240, 255, 0.1)' : 'rgba(10, 15, 25, 0.6)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.2s ease',
            }}
          >
            <FileText size={42} className="glow-text-cyan" />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff' }}>
                GPX-Datei hier hineinziehen
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                oder Datei vom Gerät auswählen
              </div>
            </div>

            <label
              className="btn-cyberpunk"
              style={{
                cursor: 'pointer',
                padding: '8px 18px',
                fontSize: '0.8rem',
              }}
            >
              Datei Durchsuchen
              <input
                type="file"
                accept=".gpx"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileProcess(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>
        ) : (
          /* Track Preview */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(0, 240, 255, 0.08)',
                border: '1px solid var(--accent-cyan)',
                borderRadius: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
                  ✓ {fileName}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {parsedRoute.pathCoordinates.length} Trackpunkte
                </span>
              </div>

              <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '12px' }}>
                {parsedRoute.title}
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div className="glass-panel" style={{ padding: '8px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Distanz</div>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '1.1rem' }}>
                    {parsedRoute.distanceKm} <span style={{ fontSize: '0.75rem' }}>km</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '8px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Höhenmeter</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-neon-green)', fontSize: '1.1rem' }}>
                    +{parsedRoute.elevationGainM} <span style={{ fontSize: '0.75rem' }}>m</span>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '8px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Energiebedarf</div>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-gold)', fontSize: '1.1rem' }}>
                    ~{parsedRoute.estimatedBatteryConsumptionWh} <span style={{ fontSize: '0.75rem' }}>Wh</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-cyberpunk"
                onClick={() => setParsedRoute(null)}
                style={{ padding: '10px', fontSize: '0.8rem', flex: 1, justifyContent: 'center' }}
              >
                Andere Datei
              </button>

              <button
                className="btn-cyberpunk btn-gold"
                onClick={handleStartNavigation}
                style={{ padding: '10px', fontSize: '0.8rem', flex: 2, justifyContent: 'center' }}
              >
                <Sparkles size={16} /> In Navigation Starten
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(255, 50, 50, 0.1)',
              border: '1px solid #ff3232',
              borderRadius: '10px',
              color: '#ff3232',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <AlertTriangle size={16} />
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
};
