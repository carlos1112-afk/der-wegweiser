import React, { useState } from 'react';
import { Store, Coffee, Wrench, Sparkles, CheckCircle2, X } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface PartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PartnerModal: React.FC<PartnerModalProps> = ({ isOpen, onClose }) => {
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [businessType, setBusinessType] = useState<'cafe' | 'hotel' | 'workshop'>('cafe');
  const [selectedPlan, setSelectedPlan] = useState<'free' | 'verified' | 'premium'>('verified');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
    setSubmitted(true);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        zIndex: 2100,
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
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '20px',
          border: '1px solid var(--accent-gold)',
          boxShadow: 'var(--glow-gold)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-gold">
            <Store size={26} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                B2B PARTNER-LADESTOPP WERDEN
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Bringe kaufkräftige E-Biker direkt in dein Café oder deine Werkstatt
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

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 12px' }}>
            <CheckCircle2 size={54} color="#00ff66" style={{ margin: '0 auto 16px' }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff', marginBottom: '8px' }}>
              Vielen Dank für deine Registrierung!
            </h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', marginBottom: '20px' }}>
              Unser Team prüft deinen Standort <strong>"{businessName}"</strong> innerhalb von 24 Stunden und schaltet deinen verifizierten Lade-Pin auf der Karte frei.
            </p>
            <button className="btn-cyberpunk btn-gold" onClick={onClose} style={{ padding: '10px 24px' }}>
              Zurück zur App
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Business Type Selector */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setBusinessType('cafe')}
                className={`btn-cyberpunk ${businessType === 'cafe' ? 'btn-gold' : ''}`}
                style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
              >
                <Coffee size={14} /> Café & Gastro
              </button>
              <button
                type="button"
                onClick={() => setBusinessType('hotel')}
                className={`btn-cyberpunk ${businessType === 'hotel' ? 'btn-gold' : ''}`}
                style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
              >
                <Store size={14} /> Hotel / B&B
              </button>
              <button
                type="button"
                onClick={() => setBusinessType('workshop')}
                className={`btn-cyberpunk ${businessType === 'workshop' ? 'btn-gold' : ''}`}
                style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
              >
                <Wrench size={14} /> Werkstatt
              </button>
            </div>

            {/* Inputs */}
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Name deines Betriebs / Standorts:
              </label>
              <input
                type="text"
                required
                placeholder="z. B. Café Seeblick & E-Bike Ladepunkt"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(10, 15, 25, 0.8)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Geschäftliche E-Mail oder Telefon:
              </label>
              <input
                type="email"
                required
                placeholder="kontakt@mein-betrieb.de"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  backgroundColor: 'rgba(10, 15, 25, 0.8)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontSize: '0.85rem',
                }}
              />
            </div>

            {/* Plans Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
              <div
                onClick={() => setSelectedPlan('free')}
                className="glass-panel"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: selectedPlan === 'free' ? '2px solid var(--accent-cyan)' : '1px solid var(--border-glass)',
                  backgroundColor: selectedPlan === 'free' ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>Basis Eintrag</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>0 € / Monat</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Standard Pin auf Karte</div>
              </div>

              <div
                onClick={() => setSelectedPlan('verified')}
                className="glass-panel"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: selectedPlan === 'verified' ? '2px solid var(--accent-gold)' : '1px solid var(--border-glass)',
                  backgroundColor: selectedPlan === 'verified' ? 'rgba(255, 183, 0, 0.12)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>⭐ Verifiziert</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 'bold' }}>29 € / Monat</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Gold-Pin & In-App Coupons</div>
              </div>

              <div
                onClick={() => setSelectedPlan('premium')}
                className="glass-panel"
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: selectedPlan === 'premium' ? '2px solid var(--accent-pink)' : '1px solid var(--border-glass)',
                  backgroundColor: selectedPlan === 'premium' ? 'rgba(255, 0, 127, 0.12)' : 'transparent',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.8rem', color: '#fff' }}>🚀 Premium</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-pink)', fontWeight: 'bold' }}>49 € / Monat</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Push-Hinweis an Vorbeifahrende</div>
              </div>
            </div>

            <button type="submit" className="btn-cyberpunk btn-gold" style={{ padding: '12px', justifyContent: 'center', marginTop: '6px' }}>
              <Sparkles size={16} /> Jetzt Anmelden & Freischalten
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
