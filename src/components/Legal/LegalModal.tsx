import React, { useState } from 'react';
import { ShieldCheck, Scale, FileText, X, AlertTriangle, Trash2, Download, CheckCircle2, Lock } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: 'privacy' | 'terms' | 'imprint' | 'cockpit';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'imprint' | 'cockpit'>(initialTab);
  const [isDataDeleted, setIsDataDeleted] = useState(false);

  if (!isOpen) return null;

  const handleExportAllData = () => {
    SoundFxService.playSuccessChime();
    const exportData: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        try {
          exportData[key] = JSON.parse(localStorage.getItem(key) || '""');
        } catch {
          exportData[key] = localStorage.getItem(key);
        }
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `der-wegweiser-user-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    confetti({ particleCount: 50, spread: 60 });
  };

  const handleDeleteAllUserData = () => {
    if (window.confirm('Möchtest du wirklich alle lokal und remote gespeicherten Daten (Routen, Tokens, Einstellungen) unwiderruflich löschen?')) {
      localStorage.clear();
      setIsDataDeleted(true);
      SoundFxService.playWarningTone();
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 2600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: '740px',
          maxHeight: '92vh',
          overflowY: 'auto',
          padding: '24px',
          borderRadius: '24px',
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
            <Scale size={26} />
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>RECHTLICHE HINWEISE & DATENSCHUTZ</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Der Wegweiser • DSGVO, StVO-Sicherheit, Widerruf & Impressum
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

        {/* Tab Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button
            onClick={() => {
              SoundFxService.playClick();
              setActiveTab('terms');
            }}
            className={`btn-cyberpunk ${activeTab === 'terms' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 4px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <FileText size={13} /> AGB & StVO
          </button>

          <button
            onClick={() => {
              SoundFxService.playClick();
              setActiveTab('privacy');
            }}
            className={`btn-cyberpunk ${activeTab === 'privacy' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 4px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <ShieldCheck size={13} /> DSGVO
          </button>

          <button
            onClick={() => {
              SoundFxService.playClick();
              setActiveTab('imprint');
            }}
            className={`btn-cyberpunk ${activeTab === 'imprint' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 4px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <Scale size={13} /> Impressum
          </button>

          <button
            onClick={() => {
              SoundFxService.playClick();
              setActiveTab('cockpit');
            }}
            className={`btn-cyberpunk ${activeTab === 'cockpit' ? 'btn-gold' : ''}`}
            style={{ padding: '8px 4px', fontSize: '0.7rem', justifyContent: 'center' }}
          >
            <Lock size={13} /> Daten löschen
          </button>
        </div>

        {/* Tab 1: Terms & StVO Safety Disclaimer */}
        {activeTab === 'terms' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'rgba(255, 183, 0, 0.1)',
                border: '1px solid var(--accent-gold)',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <AlertTriangle size={24} color="var(--accent-gold)" />
              <div>
                <strong style={{ color: 'var(--accent-gold)' }}>Wichtiger StVO-Sicherheitshinweis:</strong>
                <p style={{ fontSize: '0.75rem', color: '#fff', marginTop: '2px' }}>
                  Die Straßenverkehrsordnung (StVO) und die Aufmerksamkeit auf das Verkehrsgeschehen haben stets uneingeschränkten Vorrang vor Audio- und Navigationsanweisungen.
                </p>
              </div>
            </div>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 1 Geltungsbereich & Sicherheit</h4>
            <p>
              "Der Wegweiser" dient als intelligente Navigations- und Telemetriehilfe für E-Bikes und Fahrräder. Die manuelle Bedienung des Smartphones während der Fahrt ohne sichere Halterung ist verboten.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 2 E-Bike Reichweiten- & Akkuberechnung</h4>
            <p>
              Sämtliche Angaben zu Restreichweiten (km), Energieverbrauch (~Wh), Höhenmetern und Steigungen sind <strong>mathematisch-physikalische Modellschätzungen</strong>. Witterungseinflüsse (Gegenwind, Kälte), Reifendruck, Zuladung und Akkuzustand können die tatsächliche Reichweite erheblich beeinflussen. Der Betreiber haftet nicht für das Liegenbleiben aufgrund entladener Akkus.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 3 Ladeinfrastruktur</h4>
            <p>
              Angaben zu öffentlichen Ladepunkten und Steckdosen basieren auf OpenStreetMap- und Community-Daten. Es wird keine Gewähr für ständige Verfügbarkeit, Funktion oder Stromversorgung übernommen.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 4 Widerrufsbelehrung für digitale Inhalte (EU-Recht)</h4>
            <p>
              Verbrauchern steht bei Erwerb von In-App Token-Pässen ein 14-tägiges gesetzliches Widerrufsrecht zu, es sei denn, der Nutzer hat ausdrücklich zugestimmt, dass vor Ablauf der Widerrufsfrist mit der Ausführung begonnen wird.
            </p>
          </div>
        )}

        {/* Tab 2: Privacy Policy (GDPR / DSGVO) */}
        {activeTab === 'privacy' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>1. Verantwortlicher</h4>
            <p>
              Carlos & Team "Der Wegweiser"<br />
              E-Mail: <strong>carlos.condios96@gmail.com</strong><br />
              Server-Standort: Google Cloud Platform (Frankfurt am Main, Region `europe-west3`).
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>2. Erhebung von Standort- & Bluetooth-Daten</h4>
            <p>
              * <strong>GPS & Hintergrund-Navigation (Art. 6 Abs. 1 lit. b DSGVO)</strong>: Standortdaten werden zur Live-Navigation, Kursausrichtung und GPX-Aufzeichnung im Vordergrund und Hintergrund verarbeitet. Es erfolgt kein dauerhaftes Bewegungsprofiling auf zentralen Servern.<br />
              * <strong>Bluetooth BLE Telemetrie</strong>: Akku- und Motordaten (Bosch, Shimano, Mahle, etc.) werden zur Reichweitenanalyse verarbeitet und verbleiben lokal auf dem Gerät.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>3. Drittanbieter & Monetarisierung</h4>
            <p>
              * <strong>BitLabs / CPX Research</strong>: Bei freiwilliger Teilnahme an bezahlten Marktforschungsumfragen werden pseudonyme Nutzer-IDs übermittelt.<br />
              * <strong>Google AdMob</strong>: Verarbeitung standardisierter Werbe-IDs gemäß Google Play Store Richtlinien.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>4. Deine Rechte (Art. 15–21 DSGVO)</h4>
            <p>
              Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit deiner gespeicherten Daten. Nutze dafür gerne auch unser integriertes Daten-Cockpit im nächsten Tab.
            </p>
          </div>
        )}

        {/* Tab 3: Imprint & Open Source Licenses */}
        {activeTab === 'imprint' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Angaben gemäß § 5 TMG</h4>
            <p>
              <strong>Der Wegweiser — Autonomous E-Bike Co-Pilot</strong><br />
              Vertreten durch: Carlos & Team<br />
              Kontakt: carlos.condios96@gmail.com<br />
              Projekt: GCP `der-wegweiser` (europe-west3)
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Karten- & Datenlizenzen</h4>
            <p>
              * Kartenkacheln & POIs: © OpenStreetMap contributors (Open Database License ODbL), © CARTO, © CyclOSM.<br />
              * Höhendaten: Open-Meteo SRTM Digital Elevation Model.<br />
              * Markenzeichen: Bosch®, Shimano®, Specialized®, Mahle®, Fazua® und Bafang® sind eingetragene Warenzeichen ihrer jeweiligen Eigentümer.
            </p>
          </div>
        )}

        {/* Tab 4: Privacy Cockpit, Data Export & 1-Click Wipe (Art. 17 & 20 DSGVO) */}
        {activeTab === 'cockpit' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isDataDeleted ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={48} color="#00ff66" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
                  Alle Daten wurden erfolgreich gelöscht.
                </h4>
                <p style={{ color: 'var(--text-muted)' }}>Die App wird neu gestartet...</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0, 240, 255, 0.08)', borderRadius: '12px', border: '1px solid var(--accent-cyan)' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                    🛡️ Deine Datenhoheit nach Art. 17 & 20 DSGVO:
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                    Du hast die volle Kontrolle. Exportiere alle deine gespeicherten Touren, Telemetrie-Profile und Tokens oder lösche deinen gesamten Speicher mit 1 Klick.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {/* Export */}
                  <div className="glass-panel" style={{ padding: '14px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Download size={16} className="glow-text-cyan" /> Daten Exportieren
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Download aller Touren, Tokens und Einstellungen als JSON (Art. 20 DSGVO).
                      </p>
                    </div>
                    <button className="btn-cyberpunk" onClick={handleExportAllData} style={{ padding: '8px', fontSize: '0.75rem', justifyContent: 'center' }}>
                      JSON Herunterladen
                    </button>
                  </div>

                  {/* Wipe */}
                  <div className="glass-panel" style={{ padding: '14px', borderRadius: '14px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '8px', border: '1px solid rgba(255, 50, 50, 0.4)' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', color: '#ff5555', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Trash2 size={16} /> Alle Daten Löschen
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Recht auf Vergessenwerden (Art. 17 DSGVO). Setzt die App komplett zurück.
                      </p>
                    </div>
                    <button
                      onClick={handleDeleteAllUserData}
                      style={{
                        padding: '8px',
                        fontSize: '0.75rem',
                        backgroundColor: 'rgba(255, 50, 50, 0.2)',
                        border: '1px solid #ff3333',
                        color: '#ff5555',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                      }}
                    >
                      Konto & Daten löschen
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <button
          className="btn-cyberpunk btn-gold"
          onClick={onClose}
          style={{ padding: '10px', justifyContent: 'center', marginTop: '6px' }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
};
