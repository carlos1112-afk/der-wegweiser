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
              <AlertTriangle size={24} color="var(--accent-gold)" style={{ flexShrink: 0 }} />
              <div>
                <strong style={{ color: 'var(--accent-gold)' }}>Wichtiger StVO-Sicherheitshinweis:</strong>
                <p style={{ fontSize: '0.75rem', color: '#fff', marginTop: '2px' }}>
                  Die Straßenverkehrsordnung (StVO) und die eigene Aufmerksamkeit auf das Verkehrsgeschehen haben stets uneingeschränkten Vorrang vor Audio- und Navigationsanweisungen. Das Smartphone darf während der Fahrt nur in einer sicheren Lenkerhalterung betrieben werden.
                </p>
              </div>
            </div>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 1 Geltungsbereich &amp; Markenunabhängigkeit</h4>
            <p>
              "Der Wegweiser" ist ein markenoffenes, herstellerunabhängiges Navigations- und Telemetriesystem für Fahrräder und E-Bikes aller Hersteller.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 2 Haftungsbeschränkung (§ 309 Nr. 7 BGB konform)</h4>
            <p>
              (1) Der Betreiber haftet unbeschränkt für Vorsatz, grobe Fahrlässigkeit sowie für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit.<br />
              (2) Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) ist die Haftung der Höhe nach auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden begrenzt.<br />
              (3) Reichweitenprognosen (~Wh, Rest-km) und Höhenprofile sind mathematisch-physikalische Modellschätzungen (abhängig von Wind, Reifendruck, Witterung). Eine Garantie für das Erreichen eines Ziels ohne Nachladen wird bei einfacher Fahrlässigkeit nicht übernommen.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 3 Urheberrechte, Datenbankherstellerrecht &amp; Nutzungsrechte</h4>
            <p>
              (1) Der Betreiber (Carlos) ist Hersteller der aggregierten Navigationsdatenbank gem. §§ 87a ff. UrhG.<br />
              (2) Soweit der Nutzer Wegezustandsmeldungen, Quests oder Bewertungen übermittelt, räumt er dem Betreiber hieran ein einfaches, unentgeltliches, zeitlich und räumlich unbeschränktes Nutzungsrecht zur Integration in das Navigationssystem ein. Personenbezogene Rohdaten verbleiben beim Betreiber geschützt und werden nicht veräußert.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 4 Widerrufsbelehrung &amp; Digitale Inhalte (§ 356 Abs. 5 BGB)</h4>
            <p>
              Bei Erwerb digitaler Tokens/Pässe erlischt das 14-tägige gesetzliche Widerrufsrecht vorzeitig, wenn der Nutzer im Checkout ausdrücklich zustimmt, dass vor Ablauf der Frist mit der Ausführung begonnen wird, und seine Kenntnis über den Verlust des Widerrufsrechts bestätigt.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>§ 5 Barrierefreiheit (BFSG)</h4>
            <p>
              Gemäß § 3 Abs. 1 Barrierefreiheitsstärkungsgesetz (BFSG) fällt das Angebot unter die gesetzliche Kleinstunternehmer-Ausnahme (unter 10 Mitarbeiter und Jahresumsatz &le; 2 Mio. €). Die App bietet dennoch hohe Kontraste (Sunlight Mode) und skalierbare Schriften.
            </p>
          </div>
        )}

        {/* Tab 2: Privacy Policy (GDPR / DSGVO & TDDDG) */}
        {activeTab === 'privacy' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>1. Verantwortlicher &amp; Kontakt</h4>
            <p>
              Carlos — Der Wegweiser<br />
              E-Mail: <strong>carlos.condios96@gmail.com</strong><br />
              Server: Google Cloud Platform (Frankfurt `europe-west3`, Art. 28 DSGVO DPA).
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>2. Verarbeitung von Standortdaten (Pseudonymisierung)</h4>
            <p>
              GPS-Vektoren und Routen werden zur Navigation und Aggregation verarbeitet. Da GPS-Spuren durch Start-/Zielpunkte theoretisch reidentifizierbar sein können, behandeln wir sie als <strong>pseudonymisierte personenbezogene Daten</strong> (Art. 6 Abs. 1 lit. b &amp; f DSGVO). Zur Datenfrische wird das Aufnahmedatum ohne Uhrzeit (`recordDate: YYYY-MM-DD`) erfasst.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>3. § 25 TDDDG (Endgerätespeicher)</h4>
            <p>
              Die Speicherung von Routensitzungen und Kacheln im lokalen Speicher (`localStorage`/`IndexedDB`) ist für den Betrieb der App technisch zwingend erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Optionale Werbe- und Umfragemodule erfordern eine gesonderte Einwilligung (§ 25 Abs. 1 TDDDG).
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>4. Drittanbieter &amp; Datenflüsse</h4>
            <p>
              * <strong>Open-Meteo API</strong>: Abfrage von Wind &amp; Höhenmetern. Die IP-Adresse wird zur Übertragung verarbeitet und in flüchtigen Server-Logs (max. 14 Tage) zur DDoS-Prävention gehalten.<br />
              * <strong>Google Gemini API</strong>: Inferenz für KI-Antizipation. Prompts enthalten keine Nutzer-Identifikatoren.<br />
              * <strong>BitLabs / CPX</strong>: Bei freiwilliger Umfrageteilnahme (Art. 6 Abs. 1 lit. a DSGVO) wird eine pseudonyme ID an die Umfrageplattform übertragen.
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>5. Betroffenenrechte &amp; Daten-Löschmatrix</h4>
            <p>
              * <strong>Art. 17 DSGVO (Löschung)</strong>: Lokale Daten können mit 1 Klick im Cockpit gelöscht werden. Für Cloud-Leads oder Einträge genügt eine E-Mail an carlos.condios96@gmail.com.<br />
              * <strong>Art. 20 DSGVO (Export)</strong>: 1-Klick JSON-Export im Daten-Cockpit.<br />
              * <strong>Art. 21 DSGVO (Widerspruch)</strong>: Gegen Verarbeitungen nach Art. 6 Abs. 1 lit. f DSGVO kann jederzeit widersprochen werden.
            </p>
          </div>
        )}

        {/* Tab 3: Imprint & Open Source Licenses */}
        {activeTab === 'imprint' && (
          <div style={{ fontSize: '0.82rem', lineHeight: '1.5', color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG)</h4>
            <p>
              <strong>Der Wegweiser — Autonomous E-Bike Co-Pilot</strong><br />
              Diensteanbieter: Carlos<br />
              E-Mail: carlos.condios96@gmail.com<br />
              EU-Streitbeilegung: Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit: https://ec.europa.eu/consumers/odr/
            </p>

            <h4 style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>Open-Source Lizenzen</h4>
            <p>
              * React, React-DOM, Capacitor: MIT License<br />
              * Leaflet: BSD-2-Clause License<br />
              * Firebase SDK, Google Generative AI SDK: Apache License 2.0<br />
              * Lucide Icons, Canvas Confetti: ISC License<br />
              * Kartendaten: © OpenStreetMap contributors (ODbL), © CARTO.
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
