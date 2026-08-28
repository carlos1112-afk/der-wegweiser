import React, { useState } from 'react';
import { Trophy, Download, Share2, Sparkles, CheckCircle2, X } from 'lucide-react';
import { GpxRecorderService, type RideSummary } from '../../services/gpxRecorderService';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface RideSummaryModalProps {
  isOpen: boolean;
  onAddTokens: (amount: number) => void;
  onClose: () => void;
}

export const RideSummaryModal: React.FC<RideSummaryModalProps> = ({
  isOpen,
  onAddTokens,
  onClose,
}) => {
  const [summary] = useState<RideSummary>(() => {
    const s = GpxRecorderService.stopRecording();
    confetti({ particleCount: 90, spread: 80 });
    return s;
  });

  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    SoundFxService.playClick();
    GpxRecorderService.downloadGpxFile(`wegweiser_tour_${Math.round(summary.distanceKm)}km.gpx`);
    setDownloaded(true);
  };

  const handleShare = async () => {
    SoundFxService.playClick();
    await GpxRecorderService.shareGpxTrack(`wegweiser_tour_${Math.round(summary.distanceKm)}km.gpx`);
  };

  const handleFinish = () => {
    SoundFxService.playSuccessChime();
    onAddTokens(summary.tokensEarned);
    onClose();
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${s}s`;
    }
    return `${mins}m ${s}s`;
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.9)',
        backdropFilter: 'blur(16px)',
        zIndex: 2300,
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
          padding: '28px',
          borderRadius: '24px',
          border: '1px solid var(--accent-neon-green)',
          boxShadow: 'var(--glow-green)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-green">
            <Trophy size={28} />
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                FAHRT ERFOLGREICH BEENDET!
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Hier ist deine E-Bike Touren-Auswertung mit voller Telemetrie
              </p>
            </div>
          </div>
          <button
            onClick={handleFinish}
            style={{ background: 'none', border: 'none', color: '#8a99ad', cursor: 'pointer', fontSize: '1.3rem' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Token Reward Banner */}
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: 'rgba(255, 183, 0, 0.12)',
            borderRadius: '14px',
            border: '1px solid var(--accent-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles size={24} className="glow-text-gold" />
            <div>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem', color: '#fff' }}>
                Belohnung: +{summary.tokensEarned} Tokens verdient!
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                (+1 Token pro gefahrenem Kilometer)
              </div>
            </div>
          </div>

          <div className="glow-text-gold" style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
            🪙 +{summary.tokensEarned}
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Gesamtdistanz</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              {summary.distanceKm} <span style={{ fontSize: '0.8rem' }}>km</span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Fahrzeit</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
              {formatTime(summary.durationSeconds)}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Ø Geschwindigkeit</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#fff' }}>
              {summary.avgSpeedKmH} <span style={{ fontSize: '0.8rem' }}>km/h</span>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Höhenmeter</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-neon-green)' }}>
              +{summary.elevationGainM} m
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Akku-Energie</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#ffb700' }}>
              ~{summary.energyWhUsed} Wh
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '12px', textAlign: 'center', borderRadius: '12px' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Track-Punkte</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
              {summary.trackPointsCount}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownload}
            className="btn-cyberpunk"
            style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.85rem' }}
          >
            <Download size={16} /> {downloaded ? 'GPX Gespeichert ✓' : 'GPX Herunterladen'}
          </button>

          <button
            onClick={handleShare}
            className="btn-cyberpunk btn-gold"
            style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.85rem' }}
          >
            <Share2 size={16} /> Strava / Komoot Export
          </button>
        </div>

        <button
          onClick={handleFinish}
          className="btn-cyberpunk"
          style={{ padding: '12px', justifyContent: 'center', width: '100%', borderColor: 'var(--accent-neon-green)', color: 'var(--accent-neon-green)' }}
        >
          <CheckCircle2 size={16} /> Tour Abschließen & Tokens Einlösen
        </button>
      </div>
    </div>
  );
};
