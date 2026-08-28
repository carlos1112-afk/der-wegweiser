import React from 'react';
import { ShieldCheck, AlertTriangle, Scale, CheckCircle2 } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onOpenDetails: (tab: 'privacy' | 'terms' | 'imprint') => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onAccept,
  onOpenDetails,
}) => {
  if (!isOpen) return null;

  const handleAgree = () => {
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
    localStorage.setItem('der_wegweiser_legal_consent', new Date().toISOString());
    onAccept();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.95)',
        backdropFilter: 'blur(20px)',
        zIndex: 3000,
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
          maxWidth: '540px',
          padding: '28px',
          borderRadius: '24px',
          border: '2px solid var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          textAlign: 'left',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="glow-text-cyan">
          <ShieldCheck size={32} />
          <div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              WILLKOMMEN BEI DER WEGWEISER
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Sicherheit & Datenschutz vor deinem ersten Tourstart
            </p>
          </div>
        </div>

        {/* Core Principles */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* 1. StVO */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(255, 183, 0, 0.1)',
              borderRadius: '14px',
              border: '1px solid rgba(255, 183, 0, 0.3)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <AlertTriangle size={20} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
              <strong>Straßenverkehrsordnung (StVO) hat Vorrang:</strong><br />
              Die Aufmerksamkeit auf den Verkehr und geltende Verkehrsregeln stehen immer über den Navigationsanweisungen der App.
            </div>
          </div>

          {/* 2. Battery */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(0, 240, 255, 0.08)',
              borderRadius: '14px',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <Scale size={20} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
              <strong>Physikalische Modellrechnungen:</strong><br />
              Reichweiten-, Steigungs- und Wattstundenangaben sind Näherungswerte. Bitte plane stets eine angemessene Akkureserve ein.
            </div>
          </div>

          {/* 3. Privacy */}
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: 'rgba(0, 255, 102, 0.08)',
              borderRadius: '14px',
              border: '1px solid rgba(0, 255, 102, 0.25)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <CheckCircle2 size={20} color="var(--accent-neon-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
              <strong>DSGVO-konforme Datenverarbeitung:</strong><br />
              Standort- und Telemetriedaten werden zur Bereitstellung der Navigation verarbeitet. Keine Weitergabe ohne deine Zustimmung.
            </div>
          </div>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', fontSize: '0.75rem', color: 'var(--accent-cyan)' }}>
          <button
            type="button"
            onClick={() => onOpenDetails('terms')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            AGB & Haftungsausschluss
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => onOpenDetails('privacy')}
            style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            Datenschutzerklärung (DSGVO)
          </button>
        </div>

        {/* Action Button */}
        <button
          onClick={handleAgree}
          className="btn-cyberpunk btn-gold"
          style={{ padding: '14px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 'bold' }}
        >
          <CheckCircle2 size={18} /> Verstanden & Akzeptieren
        </button>
      </div>
    </div>
  );
};
