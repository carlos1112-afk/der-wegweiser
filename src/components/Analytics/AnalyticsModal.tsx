import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Leaf,
  Navigation,
  Coins,
  Download,
  HardDrive,
  CheckCircle2,
  RefreshCw,
  Trash2,
  Sparkles,
  Zap,
  MapPin,
} from 'lucide-react';
import type { Route } from '../../types/navigation';
import { exportRouteToGpx } from '../../services/gpxExportService';
import {
  downloadOfflineRegion,
  getDownloadedRegions,
  OfflineMapService,
  type DownloadedRegionInfo,
} from '../../services/offlineMapService';
import { dataRepository } from '../../services/dataRepository';
import { CURATED_ROUTES } from '../../services/curatedDatabase';


interface AnalyticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoute?: Route | null;
}

interface TokenHistoryItem {
  id: string;
  reason: string;
  amount: number;
  date: string;
  type: 'earn' | 'spend';
}

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ isOpen, onClose, currentRoute }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'routes' | 'tokens' | 'offline'>('overview');
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [downloadedRegions, setDownloadedRegions] = useState<DownloadedRegionInfo[]>([]);
  
  // Download Offline Region State
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [selectedRegionName, setSelectedRegionName] = useState('Berlin & Brandenburg Badesee-Zone');

  // Token History Mock / Local Data
  const [tokenHistory] = useState<TokenHistoryItem[]>([
    { id: '1', reason: 'Ladesäulen-Scan am Café Badesee verifiziert', amount: 20, date: 'Heute, 14:22', type: 'earn' },
    { id: '2', reason: 'Müggelsee Panorama KI-Heute-Tour absolviert', amount: 15, date: 'Gestern, 18:05', type: 'earn' },
    { id: '3', reason: 'Gewinnspiel in Charge \'n\' Earn Lade-Lounge', amount: 10, date: '28.07.2026', type: 'earn' },
    { id: '4', reason: 'Täglicher KI-Login Bonus', amount: 5, date: '27.07.2026', type: 'earn' },
    { id: '5', reason: 'Ladesäulen-Foto-Scan beigesteuert', amount: 20, date: '25.07.2026', type: 'earn' },
  ]);

  // Default sample routes to present if repository returns empty
  const defaultSampleRoutes: Route[] = CURATED_ROUTES;

  // Load saved routes and downloaded map regions on mount
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      // Load saved routes
      try {
        let routes = await dataRepository.getSavedRoutes('user-1');
        if (!routes || routes.length === 0) {
          routes = defaultSampleRoutes;
          // Save active current route if present
          if (currentRoute) {
            routes.unshift(currentRoute);
          }
        } else if (currentRoute && !routes.some((r) => r.id === currentRoute.id)) {
          routes.unshift(currentRoute);
        }
        setSavedRoutes(routes);
      } catch (e) {
        console.warn('Failed to load saved routes:', e);
        setSavedRoutes(defaultSampleRoutes);
      }

      // Load offline regions
      try {
        const regions = await getDownloadedRegions();
        setDownloadedRegions(regions);
      } catch (e) {
        console.warn('Failed to load offline regions:', e);
      }
    };

    loadData();
  }, [isOpen, currentRoute]);

  if (!isOpen) return null;

  // Calculate environmental & ride analytics
  const totalKmRidden = savedRoutes.reduce((acc, r) => acc + r.distanceKm, 348.5); // total base + saved
  const co2SavedKg = parseFloat((totalKmRidden * 0.122).toFixed(1)); // ~122g CO2 saved per km vs avg car
  const treesEquivalent = Math.round(co2SavedKg / 2.3); // ~2.3kg CO2 per tree per year
  const totalTokensEarned = tokenHistory.reduce((acc, t) => acc + (t.type === 'earn' ? t.amount : 0), 70);

  // Trigger offline region download
  const handleStartRegionDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    const bounds = {
      minLat: 52.35,
      maxLat: 52.65,
      minLng: 13.15,
      maxLng: 13.65,
    };

    const success = await downloadOfflineRegion(selectedRegionName, bounds, (percent) => {
      setDownloadProgress(percent);
    });

    if (success) {
      const updatedRegions = await getDownloadedRegions();
      setDownloadedRegions(updatedRegions);
    }
    setIsDownloading(false);
  };

  const handleDeleteRegion = async (regionName: string) => {
    await OfflineMapService.deleteOfflineRegion(regionName);
    const updated = await getDownloadedRegions();
    setDownloadedRegions(updated);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(5, 8, 20, 0.88)',
        backdropFilter: 'blur(14px)',
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
          maxWidth: '680px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--accent-cyan)',
          boxShadow: 'var(--glow-cyan)',
          borderRadius: '18px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(0, 240, 255, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="glow-text-cyan">
            <BarChart3 size={24} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>
              FAHRDATEN & KI-ANALYTICS
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.4rem',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-glass)',
            backgroundColor: 'rgba(10, 15, 25, 0.5)',
            overflowX: 'auto',
          }}
        >
          <button
            onClick={() => setActiveTab('overview')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'overview' ? 'rgba(0, 255, 102, 0.2)' : 'transparent',
              color: activeTab === 'overview' ? 'var(--accent-neon-green)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Leaf size={16} /> Umwelt & CO2
          </button>

          <button
            onClick={() => setActiveTab('routes')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'routes' ? 'rgba(0, 240, 255, 0.2)' : 'transparent',
              color: activeTab === 'routes' ? 'var(--accent-cyan)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Navigation size={16} /> Gespeicherte Routen ({savedRoutes.length})
          </button>

          <button
            onClick={() => setActiveTab('tokens')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'tokens' ? 'rgba(255, 183, 0, 0.2)' : 'transparent',
              color: activeTab === 'tokens' ? 'var(--accent-gold)' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <Coins size={16} /> Tokens Historie
          </button>

          <button
            onClick={() => setActiveTab('offline')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border-glass)',
              backgroundColor: activeTab === 'offline' ? 'rgba(176, 38, 255, 0.2)' : 'transparent',
              color: activeTab === 'offline' ? '#b026ff' : 'var(--text-muted)',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <HardDrive size={16} /> Offline-Karten (PWA)
          </button>
        </div>

        {/* Tab Content Area */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {/* TAB 1: OVERVIEW & CO2 STATS */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Highlight Hero CO2 Box */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(0, 255, 102, 0.15), rgba(0, 240, 255, 0.08))',
                  border: '1px solid var(--accent-neon-green)',
                  boxShadow: 'var(--glow-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <Leaf className="glow-text-green" size={22} />
                    <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '1px' }}>
                      Eingesparte CO₂-Emissionen (vs. PKW)
                    </span>
                  </div>
                  <div className="glow-text-green" style={{ fontSize: '2.4rem', fontWeight: 'bold', lineHeight: 1 }}>
                    {co2SavedKg} <span style={{ fontSize: '1.2rem' }}>kg CO₂</span>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Basierend auf {totalKmRidden} gefahrenen Kilometern mit KI-E-Bike Optimierung.
                  </p>
                </div>

                <div
                  style={{
                    backgroundColor: 'rgba(0, 255, 102, 0.1)',
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: '1px solid rgba(0, 255, 102, 0.3)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#00ff66' }}>🌳 {treesEquivalent}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Bäume/Jahr Kompensation
                  </div>
                </div>
              </div>

              {/* Grid Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(18, 24, 36, 0.7)',
                    border: '1px solid var(--border-glass)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <Navigation size={16} className="glow-text-cyan" /> Gesamte Strecken
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="glow-text-cyan">
                    {totalKmRidden} km
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(18, 24, 36, 0.7)',
                    border: '1px solid var(--border-glass)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <Zap size={16} className="glow-text-gold" /> Token Guthaben
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }} className="glow-text-gold">
                    🪙 {totalTokensEarned}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(18, 24, 36, 0.7)',
                    border: '1px solid var(--border-glass)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '6px' }}>
                    <Sparkles size={16} style={{ color: '#b026ff' }} /> Akkuschonung
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#b026ff' }}>
                    +28% Reichweite
                  </div>
                </div>
              </div>

              {/* Eco tip banner */}
              <div
                style={{
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(0, 240, 255, 0.05)',
                  border: '1px dashed rgba(0, 240, 255, 0.3)',
                  fontSize: '0.85rem',
                  lineHeight: '1.4',
                  color: 'var(--text-primary)',
                }}
              >
                💡 <strong>KI-Effizienz Tipp:</strong> Durch die Bevorzugung flacher Asphaltwege in deiner &quot;Heute-Tour&quot; konntest du den Akkuverbrauch um durchschnittlich 18 Wh/km reduzieren.
              </div>
            </div>
          )}

          {/* TAB 2: SAVED ROUTES & GPX EXPORT */}
          {activeTab === 'routes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Gespeicherte Routen für Offline-Navigation & GPX Export:
                </span>
              </div>

              {savedRoutes.map((route) => (
                <div
                  key={route.id}
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(18, 24, 36, 0.8)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    transition: 'border 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginBottom: '4px' }} className="glow-text-cyan">
                        {route.title}
                      </h4>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>
                        {route.summary || route.aiStory}
                      </p>
                    </div>

                    {/* GPX Export Button */}
                    <button
                      className="btn-cyberpunk"
                      onClick={() => exportRouteToGpx(route)}
                      style={{
                        padding: '8px 14px',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <Download size={14} /> 📥 GPX Exportieren
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📏 <strong>{route.distanceKm} km</strong></span>
                    <span>⛰️ <strong>{route.elevationGainM} hm</strong></span>
                    <span>⏱️ <strong>~{route.estimatedTimeMin} min</strong></span>
                    <span>⚡ <strong>~{route.estimatedBatteryConsumptionWh} Wh</strong></span>
                    {route.chargingStopsOnRoute?.length > 0 && (
                      <span className="glow-text-green">🔌 <strong>{route.chargingStopsOnRoute.length} Ladesäulen</strong></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: TOKEN HISTORY */}
          {activeTab === 'tokens' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Erreichte Token-Aktivitäten & Belohnungen:
                </span>
                <span className="glow-text-gold" style={{ fontWeight: 'bold' }}>
                  Aktiv guthaben: 🪙 {totalTokensEarned} Tokens
                </span>
              </div>

              {tokenHistory.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(18, 24, 36, 0.7)',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Coins size={18} className="glow-text-gold" />
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>{item.reason}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.date}</div>
                    </div>
                  </div>
                  <span className="glow-text-gold" style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>
                    +{item.amount}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: OFFLINE MAPS (PWA & CacheStorage) */}
          {activeTab === 'offline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Lade Kartenausschnitte direkt in den PWA CacheStorage herunter, um auch in Funklöchern ohne Internetverbindung nahtlos zu navigieren.
              </div>

              {/* Download New Region Panel */}
              <div
                style={{
                  padding: '18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(176, 38, 255, 0.08)',
                  border: '1px solid rgba(176, 38, 255, 0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b026ff', fontWeight: 'bold' }}>
                  <MapPin size={18} /> Neue Region Offline Speichern
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={selectedRegionName}
                    onChange={(e) => setSelectedRegionName(e.target.value)}
                    placeholder="Name der Region (z.B. Potsdam Seenland)"
                    style={{
                      flex: 1,
                      minWidth: '220px',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass)',
                      backgroundColor: 'rgba(10, 15, 25, 0.8)',
                      color: '#fff',
                      fontSize: '0.88rem',
                    }}
                  />

                  <button
                    className="btn-cyberpunk"
                    onClick={handleStartRegionDownload}
                    disabled={isDownloading}
                    style={{
                      borderColor: '#b026ff',
                      color: '#b026ff',
                      cursor: isDownloading ? 'not-allowed' : 'pointer',
                      opacity: isDownloading ? 0.6 : 1,
                    }}
                  >
                    {isDownloading ? (
                      <>
                        <RefreshCw size={14} className="spin" /> Lädt herunter...
                      </>
                    ) : (
                      <>
                        <Download size={14} /> Region Herunterladen
                      </>
                    )}
                  </button>
                </div>

                {/* Download Progress Bar */}
                {isDownloading && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px', color: '#b026ff' }}>
                      <span>Pre-fetching Map Tiles (Zoom 12-15)...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '8px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: '4px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${downloadProgress}%`,
                          height: '100%',
                          backgroundColor: '#b026ff',
                          boxShadow: '0 0 10px #b026ff',
                          transition: 'width 0.2s ease',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Existing Downloaded Regions List */}
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 'bold', marginBottom: '12px' }} className="glow-text-cyan">
                  Gespeicherte Offline-Regionen:
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {downloadedRegions.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      Noch keine Regionen heruntergeladen.
                    </div>
                  ) : (
                    downloadedRegions.map((region) => (
                      <div
                        key={region.name}
                        style={{
                          padding: '12px 16px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(18, 24, 36, 0.7)',
                          border: '1px solid var(--border-glass)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <CheckCircle2 size={16} style={{ color: '#00ff66' }} /> {region.name}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Größe: {region.sizeMb} MB • Heruntergeladen: {region.date}
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteRegion(region.name)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff4d4d',
                            cursor: 'pointer',
                            padding: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.8rem',
                          }}
                          title="Region löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
