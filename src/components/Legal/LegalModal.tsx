import React, { useState } from 'react';
import { ShieldCheck, Scale, FileText, X, AlertTriangle, Trash2, Download, CheckCircle2, Lock } from 'lucide-react';
import { SoundFxService } from '../../services/soundFxService';
import confetti from 'canvas-confetti';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: 'terms' | 'privacy' | 'imprint' | 'cockpit';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy' | 'imprint' | 'cockpit'>(initialTab);
  const [isDataDeleted, setIsDataDeleted] = useState(false);

  if (!isOpen) return null;

  // 1-Click User Data Export (Art. 20 DSGVO - Local Data)
  const handleExportAllData = () => {
    SoundFxService.playSuccessChime();
    confetti({ particleCount: 50, spread: 60 });

    const exportPayload = {
      exportDate: new Date().toISOString(),
      user: 'local-user',
      preferences: localStorage.getItem('wegweiser_user_prefs') || '{}',
      customStations: localStorage.getItem('wegweiser_custom_stations') || '[]',
      customRoutes: localStorage.getItem('wegweiser_custom_routes') || '[]',
      tokens: localStorage.getItem('wegweiser_tokens') || '60',
      offlineRegions: localStorage.getItem('wegweiser_offline_regions') || '[]',
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `der-wegweiser-lokale-daten-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 1-Click Complete Local Reset (Art. 17 DSGVO)
  const handleDeleteAllUserData = () => {
    const confirmWipe = window.confirm(
      '⚠️ ACHTUNG: Möchtest du wirklich alle lokalen App-Daten, gespeicherten Touren und Tokens unwiderruflich von diesem Gerät löschen?'
    );

    if (confirmWipe) {
      SoundFxService.playWarningTone();
      localStorage.clear();
      setIsDataDeleted(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 10, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        zIndex: 2500,
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
          maxWidth: '680px',
          maxHeight: '90vh',
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
        {/* Header with Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(0, 240, 255, 0.2)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="glow-text-cyan">
            <ShieldCheck size={24} />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              RECHT &amp; DATENSCHUTZ
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
          <button
            className={`btn-cyberpunk ${activeTab === 'terms' ? 'btn-gold' : ''}`}
            onClick={() => setActiveTab('terms')}
            style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
          >
            <Scale size={13} /> AGB &amp; StVO
          </button>
          <button
            className={`btn-cyberpunk ${activeTab === 'privacy' ? 'btn-gold' : ''}`}
            onClick={() => setActiveTab('privacy')}
            style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
          >
            <ShieldCheck size={13} /> DSGVO
          </button>
          <button
            className={`btn-cyberpunk ${activeTab === 'imprint' ? 'btn-gold' : ''}`}
            onClick={() => setActiveTab('imprint')}
            style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
          >
            <FileText size={13} /> Impressum
          </button>
          <button
            className={`btn-cyberpunk ${activeTab === 'cockpit' ? 'btn-gold' : ''}`}
            onClick={() => setActiveTab('cockpit')}
            style={{ padding: '8px 4px', fontSize: '0.75rem', justifyContent: 'center' }}
          >
            <Lock size={13} /> Daten-Cockpit
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

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 1 Geltungsbereich &amp; Markenunabhängigkeit</h4>
            <p>
              "Der Wegweiser" dient als universelle, markenoffene Navigations- und Telemetriehilfe für alle E-Bikes, Pedelecs und Fahrräder ohne jegliche Bindung an bestimmte Konzerne oder Hersteller. Die manuelle Bedienung des Smartphones während der Fahrt ohne sichere Halterung ist verboten.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 2 E-Bike Reichweiten- &amp; Akkuberechnung</h4>
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

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 5 Geistiges Eigentum &amp; Datenbankherstellerrecht (§ 87a UrhG)</h4>
            <p>
              Sämtliche navigations- und telemetrieabhängigen Daten (aggregierte Streckengraphen, Steigungsprofile, E-Bike Verbrauchskurven, Ladeinfrastrukturdaten und KI-Modelle) sind und verbleiben zu jedem Zeitpunkt das <strong>alleinige und ausschließliche geistige Eigentum des Betreibers (Carlos)</strong>. Die Datenbank ist nach §§ 87a ff. UrhG und dem Geschäftsgeheimnisgesetz (GeschGehG) geschützt. Jegliches Scraping, unbefugte Entnahme oder Drittverwertung ist untersagt. Der Betreiber ist jederzeit berechtigt, die Datenbankstruktur zu sichern, zu bereinigen, neu aufzubauen oder über autorisierte Backups wiederherzustellen.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 6 Exklusive Datenabgabe &amp; Garantierter Ausschluss des Datenverkaufs</h4>
            <p>
              Der Nutzer übermittelt Daten <strong>ausschließlich an den Betreiber persönlich (Carlos)</strong>. Die Verarbeitung ist strikt auf die Kernfunktionen der App beschränkt. Ein Verkauf, eine Veräußerung oder Weitergabe von Nutzerdaten an Datenbroker oder fremde Dritte ist <strong>dauerhaft und ausnahmslos ausgeschlossen</strong>.
            </p>
          </div>
        )}

        {/* Tab 2: Privacy Policy (GDPR / DSGVO) */}
        {activeTab === 'privacy' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>1. Verantwortlicher</h4>
            <p>
              Carlos &amp; Team "Der Wegweiser"<br />
              E-Mail: <strong>carlos.condios96@gmail.com</strong><br />
              Server-Standort: Google Cloud Platform (Frankfurt am Main, Region `europe-west3`).
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>2. Erhebung von Standort- &amp; Bluetooth-Daten</h4>
            <p>
              * <strong>GPS &amp; Hintergrund-Navigation (Art. 6 Abs. 1 lit. b DSGVO)</strong>: Standortdaten werden zur Live-Navigation, Kursausrichtung und GPX-Aufzeichnung im Vordergrund und Hintergrund verarbeitet. Es erfolgt kein dauerhaftes Bewegungsprofiling auf zentralen Servern.<br />
              * <strong>Bluetooth BLE Telemetrie</strong>: Vollkommen markenunabhängig kompatibel mit allen E-Bikes, Pedelecs und offenen Bluetooth-Sensoren. Telemetriedaten verbleiben lokal auf dem Gerät.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>3. Garantierter Ausschluss des Datenverkaufs (No-Sale Policy)</h4>
            <p>
              Deine Daten werden <strong>ausschließlich an den Betreiber (Carlos)</strong> übermittelt. Wir verkaufen niemals Nutzerdaten, Bewegungsprofile oder Telemetriewerte an Dritte oder Datenhändler. Angebote zum Kauf unserer Nutzerdaten werden kategorisch abgelehnt.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>4. Drittanbieter &amp; Monetarisierung</h4>
            <p>
              * <strong>BitLabs / CPX Research</strong>: Bei freiwilliger Teilnahme an bezahlten Marktforschungsumfragen werden pseudonyme Nutzer-IDs übermittelt.<br />
              * <strong>Google AdMob</strong>: Verarbeitung standardisierter Werbe-IDs gemäß Google Play Store Richtlinien.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>5. Deine Rechte (Art. 15–21 DSGVO)</h4>
            <p>
              Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung und Datenübertragbarkeit deiner lokal gespeicherten Daten. Nutze dafür gerne unser integriertes Daten-Cockpit im nächsten Tab.
            </p>
          </div>
        )}

        {/* Tab 3: Imprint & Open Source Licenses */}
        {activeTab === 'imprint' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Angaben gemäß § 5 TMG</h4>
            <p>
              <strong>Der Wegweiser — Autonomous E-Bike Co-Pilot</strong><br />
              Vertreten durch: Carlos &amp; Team<br />
              Kontakt: carlos.condios96@gmail.com<br />
              Projekt: GCP `der-wegweiser` (europe-west3)
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Karten- &amp; Datenlizenzen</h4>
            <p>
              * Kartenkacheln &amp; POIs: © OpenStreetMap contributors (Open Database License ODbL), © CARTO, © CyclOSM.<br />
              * Höhendaten: Open-Meteo SRTM Digital Elevation Model.<br />
              * Markenunabhängigkeit: "Der Wegweiser" ist ein 100 % unabhängiges Navigationssystem ohne Bindung an einzelne Fahrrad- oder Antriebshersteller.
            </p>
          </div>
        )}

        {/* Tab 4: Local Privacy Cockpit, Data Export & 1-Click Wipe (Art. 17 & 20 DSGVO) */}
        {activeTab === 'cockpit' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isDataDeleted ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <CheckCircle2 size={48} color="#00ff66" style={{ margin: '0 auto 12px' }} />
                <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', marginBottom: '6px' }}>
                  Alle lokalen Gerätedaten wurden erfolgreich gelöscht.
                </h4>
                <p style={{ color: 'var(--text-muted)' }}>Die App wird neu gestartet...</p>
              </div>
            ) : (
              <>
                <div style={{ padding: '12px', backgroundColor: 'rgba(0, 240, 255, 0.08)', borderRadius: '12px', border: '1px solid var(--accent-cyan)' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent-cyan)', marginBottom: '4px' }}>
                    🛡️ Deine lokale Datenhoheit auf diesem Smartphone:
                  </div>
                  <p style={{ fontSize: '0.75rem', color: '#e2e8f0' }}>
                    Deine individuellen Touren, Telemetrie-Caches und Einstellungen liegen lokal auf deinem Endgerät. Auf unseren Servern werden keine personenbezogenen Bewegungsprofile gespeichert.
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
                        Download aller lokal gespeicherten Touren, Tokens und Einstellungen als JSON (Art. 20 DSGVO).
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
                        <Trash2 size={16} /> Lokalen Speicher Leeren
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        Recht auf Vergessenwerden (Art. 17 DSGVO). Löscht alle Daten vom Smartphone und setzt die App zurück.
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
                      Gerätespeicher leeren
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
