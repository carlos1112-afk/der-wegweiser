import React, { useState } from 'react';
import { Database, AlertTriangle, CheckCircle2, Download, X } from 'lucide-react';
import { DatabaseBackdoorExportService } from '../../services/databaseBackdoorExportService';
import { SoundFxService } from '../../services/soundFxService';

interface DatabaseBackdoorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatabaseBackdoorModal: React.FC<DatabaseBackdoorModalProps> = ({ isOpen, onClose }) => {
  const [purgeOnlineDb, setPurgeOnlineDb] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    exported: boolean;
    totalRecords: number;
    purged: boolean;
    purgedCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleRunExport = async () => {
    setIsProcessing(true);
    try {
      const res = await DatabaseBackdoorExportService.executeMasterExport({
        purgeOnlineDbAfterExport: purgeOnlineDb,
      });

      const total =
        res.dump.metadata.totalChargingStations +
        res.dump.metadata.totalRoutes +
        res.dump.metadata.totalPartnerLeads +
        res.dump.metadata.totalReviews;

      setResult({
        exported: true,
        totalRecords: total,
        purged: res.purged,
        purgedCount: res.purgedCount,
      });
    } catch (e) {
      console.error('Master export error:', e);
      alert('Fehler beim Master-Export. Details in der Konsole.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetAndClose = () => {
    setResult(null);
    setPurgeOnlineDb(false);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 9999,
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
          maxWidth: '520px',
          borderRadius: '24px',
          padding: '24px',
          border: '1px solid var(--accent-gold)',
          backgroundColor: '#070d18',
          boxShadow: '0 0 40px rgba(255, 183, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={24} color="var(--accent-gold)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#fff', letterSpacing: '0.5px' }}>
              MASTER-DATENBANK BACKDOOR
            </h3>
          </div>
          <button
            onClick={handleResetAndClose}
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

        {/* Content */}
        {!result ? (
          <>
            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.5' }}>
              Zieht einen <strong>vollständigen 1-Klick Dump</strong> aller Firestore Cloud-Kollektionen (Ladesäulen, E-Bike Routen, B2B Leads, Community Reviews) sowie aller lokalen Caches in eine Master-JSON-Sicherungsdatei.
            </p>

            {/* Optional Cloud Purge Safety Switch */}
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                backgroundColor: purgeOnlineDb ? 'rgba(255, 50, 50, 0.12)' : 'rgba(255, 183, 0, 0.08)',
                border: purgeOnlineDb ? '1px solid #ff3333' : '1px solid rgba(255, 183, 0, 0.3)',
                transition: 'all 0.2s ease',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={purgeOnlineDb}
                  onChange={(e) => {
                    setPurgeOnlineDb(e.target.checked);
                    if (e.target.checked) SoundFxService.playWarningTone();
                  }}
                  style={{ marginTop: '3px', width: '18px', height: '18px', accentColor: '#ff3333' }}
                />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: purgeOnlineDb ? '#ff5555' : '#f8fafc' }}>
                    🔥 Online-Datenbank (Firestore) nach Export restlos leeren
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', lineHeight: '1.4' }}>
                    <strong>Optional &amp; Explizit:</strong> Löscht alle Firestore-Einträge in der Cloud erst <em>nach</em> erfolgreichem Download der JSON-Backup-Datei.
                  </div>
                </div>
              </label>

              {purgeOnlineDb && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255, 50, 50, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.75rem',
                    color: '#ff8888',
                  }}
                >
                  <AlertTriangle size={16} />
                  <span>Sicherheitsprüfung aktiv: Cloud-Daten werden unwiderruflich geleert.</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button
                className="btn-cyberpunk btn-gold"
                onClick={handleRunExport}
                disabled={isProcessing}
                style={{ flex: 1, padding: '12px', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 'bold' }}
              >
                {isProcessing ? (
                  'Exportiert & Sichert...'
                ) : (
                  <>
                    <Download size={18} /> {purgeOnlineDb ? 'Exportieren & Cloud leeren' : '1-Klick Master-Export'}
                  </>
                )}
              </button>
              <button
                onClick={handleResetAndClose}
                style={{
                  padding: '12px 18px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#cbd5e1',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Abbrechen
              </button>
            </div>
          </>
        ) : (
          /* Result Screen */
          <div style={{ textAlign: 'center', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <CheckCircle2 size={54} color="#00ff66" style={{ margin: '0 auto' }} />
            <h4 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>
              Master-Export erfolgreich!
            </h4>
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(0, 255, 102, 0.1)',
                border: '1px solid #00ff66',
                borderRadius: '12px',
                fontSize: '0.82rem',
                color: '#e2e8f0',
                lineHeight: '1.5',
              }}
            >
              ✓ <strong>{result.totalRecords} Datensätze</strong> wurden in die JSON-Sicherung heruntergeladen.<br />
              {result.purged ? (
                <span style={{ color: '#ff5555', fontWeight: 'bold' }}>
                  🔥 Online-Datenbank wurde restlos geleert ({result.purgedCount} Cloud-Einträge gelöscht).
                </span>
              ) : (
                <span style={{ color: 'var(--accent-cyan)' }}>
                  ☁️ Online-Datenbank bleibt unverändert online.
                </span>
              )}
            </div>
            <button
              className="btn-cyberpunk btn-gold"
              onClick={handleResetAndClose}
              style={{ marginTop: '8px', padding: '10px', justifyContent: 'center' }}
            >
              Fertig
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
