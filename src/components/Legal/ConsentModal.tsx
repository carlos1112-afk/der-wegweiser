import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, Scale, CheckCircle2, Sliders, MapPin, BarChart2, Coins } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface ConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onOpenDetails: (tab: 'privacy' | 'terms' | 'imprint' | 'cockpit') => void;
}

export interface UserPrivacyConsent {
  essential: boolean;
  analytics: boolean;
  surveys: boolean;
  personalizedAds: boolean;
  acceptedAt: string;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onAccept,
  onOpenDetails,
}) => {
  const [showGranularSettings, setShowGranularSettings] = useState(false);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [surveysConsent, setSurveysConsent] = useState(true);
  const [adsConsent, setAdsConsent] = useState(false);

  if (!isOpen) return null;

  const saveConsentAndProceed = (consent: UserPrivacyConsent) => {
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 70, spread: 70 });
    localStorage.setItem('der_wegweiser_legal_consent', JSON.stringify(consent));
    onAccept();
  };

  const handleAcceptAll = () => {
    saveConsentAndProceed({
      essential: true,
      analytics: true,
      surveys: true,
      personalizedAds: true,
      acceptedAt: new Date().toISOString(),
    });
  };

  const handleAcceptEssentialOnly = () => {
    saveConsentAndProceed({
      essential: true,
      analytics: false,
      surveys: false,
      personalizedAds: false,
      acceptedAt: new Date().toISOString(),
    });
  };

  const handleSaveCustom = () => {
    saveConsentAndProceed({
      essential: true,
      analytics: analyticsConsent,
      surveys: surveysConsent,
      personalizedAds: adsConsent,
      acceptedAt: new Date().toISOString(),
    });
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
          maxWidth: '580px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '26px',
          borderRadius: '24px',
          border: '2px solid var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
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
              Sicherheit, Hintergrund-Standort & DSGVO-Einwilligung
            </p>
          </div>
        </div>

        {!showGranularSettings ? (
          <>
            {/* Core Legal Pillars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* 1. StVO Primary Warning */}
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
                  <strong>Straßenverkehrsordnung (StVO) hat stets Vorrang:</strong><br />
                  Deine visuelle und auditive Aufmerksamkeit auf den fließenden Straßenverkehr steht immer über den Anweisungen der App.
                </div>
              </div>

              {/* 2. Google Play Prominent Background Location Disclosure */}
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
                <MapPin size={20} color="var(--accent-cyan)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
                  <strong>Hintergrund-Standorterfassung (Google Play Richtlinie):</strong><br />
                  Der Wegweiser erfasst Standortdaten im Vordergrund und <strong>Hintergrund</strong> (auch bei gesperrtem Bildschirm), um <strong>Turn-by-Turn Sprachführung</strong>, automatische Routen-Neuberechnung bei Abweichungen und lückenlose <strong>GPX-Tourenaufzeichnung</strong> zu ermöglichen.
                </div>
              </div>

              {/* 3. Physics & Battery Model */}
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
                <Scale size={20} color="var(--accent-neon-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
                  <strong>E-Bike Modellrechnung:</strong><br />
                  Reichweiten- und Wattstundenangaben sind physikalische Näherungswerte. Bitte plane stets eine Sicherheitsreserve ein.
                </div>
              </div>

              {/* 4. No-Sale & Exclusive Operator Transfer Guarantee */}
              <div
                style={{
                  padding: '12px 14px',
                  backgroundColor: 'rgba(255, 183, 0, 0.08)',
                  borderRadius: '14px',
                  border: '1px solid rgba(255, 183, 0, 0.3)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <ShieldCheck size={20} color="var(--accent-gold)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: '#fff', lineHeight: '1.4' }}>
                  <strong style={{ color: 'var(--accent-gold)' }}>🛡️ Garantierter Ausschluss des Datenverkaufs:</strong><br />
                  Deine Daten werden <strong>ausschließlich an den Betreiber persönlich (Carlos)</strong> übermittelt und strikt nur für die Funktionen der App verarbeitet. Ein Weiterverkauf oder Handel an Datenbroker/Dritte ist <strong>dauerhaft und ausnahmslos ausgeschlossen</strong>.
                </div>
              </div>
            </div>

            {/* Links to Full Documents */}
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

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={handleAcceptAll}
                className="btn-cyberpunk btn-gold"
                style={{ padding: '12px', justifyContent: 'center', fontSize: '0.95rem', fontWeight: 'bold' }}
              >
                <CheckCircle2 size={18} /> Alle Akzeptieren & Tour Starten
              </button>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleAcceptEssentialOnly}
                  className="btn-cyberpunk"
                  style={{ padding: '10px', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                >
                  Nur Notwendige
                </button>

                <button
                  onClick={() => setShowGranularSettings(true)}
                  className="btn-cyberpunk"
                  style={{ padding: '10px', fontSize: '0.75rem', flex: 1, justifyContent: 'center' }}
                >
                  <Sliders size={14} /> Anpassen
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Granular GDPR Settings View */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
              Datenschutz-Präferenzen anpassen (§ 25 TDDDG / DSGVO):
            </h4>

            {/* Essential */}
            <div className="glass-panel" style={{ padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>1. Technisch Notwendig (Immer aktiv)</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>GPS-Navigation, Bluetooth-Telemetrie & lokaler Kartencache</div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-neon-green)', fontWeight: 'bold' }}>Erforderlich</span>
            </div>

            {/* Analytics */}
            <div className="glass-panel" style={{ padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart2 size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>2. Analyse & Stabilität</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Anonyme Absturzberichte & Geschwindigkeitsoptimierung</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={analyticsConsent}
                onChange={(e) => setAnalyticsConsent(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>

            {/* Surveys / BitLabs */}
            <div className="glass-panel" style={{ padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coins size={18} color="var(--accent-gold)" />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>3. Bezahlte Umfragen (BitLabs/CPX)</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Token-Verdienst durch freiwillige Marktforschungsumfragen</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={surveysConsent}
                onChange={(e) => setSurveysConsent(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-gold)', cursor: 'pointer' }}
              />
            </div>

            {/* Partner Recommendations (Zero Tracking) */}
            <div className="glass-panel" style={{ padding: '12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Scale size={18} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: '#fff' }}>4. Lokale Partner-Empfehlungen (Kein Tracking)</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Relevante E-Bike Angebote & Zubehör (ohne externe Tracker)</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={adsConsent}
                onChange={(e) => setAdsConsent(e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-cyan)', cursor: 'pointer' }}
              />
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button
                className="btn-cyberpunk"
                onClick={() => setShowGranularSettings(false)}
                style={{ padding: '10px', fontSize: '0.8rem', flex: 1, justifyContent: 'center' }}
              >
                Zurück
              </button>

              <button
                className="btn-cyberpunk btn-gold"
                onClick={handleSaveCustom}
                style={{ padding: '10px', fontSize: '0.8rem', flex: 1, justifyContent: 'center' }}
              >
                Auswahl Speichern
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
