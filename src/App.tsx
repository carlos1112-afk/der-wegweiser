import { useState, useEffect, lazy, Suspense } from 'react';
import { MapView } from './components/Map/MapView';
import { BatteryHUD } from './components/BatteryHUD/BatteryHUD';
import { WeatherHUD } from './components/WeatherHUD/WeatherHUD';
import { GpxRecorderHUD } from './components/Recording/GpxRecorderHUD';
import { OledBlackMode } from './components/DisplayModes/OledBlackMode';
import { FloatingMicButton } from './components/AiAssistant/FloatingMicButton';
import type { Route, ChargingStation, LiveBikeTelemetry, UserPreferences, UserMemoryPattern } from './types/navigation';
import { dataRepository } from './services/dataRepository';
import { AiAssistantService, DEFAULT_MODEL } from './services/aiAssistantService';
import type { ModelId } from './services/aiAssistantService';
import { BleService } from './services/bleService';
import { OfflineMapService } from './services/offlineMapService';
import { Camera, Gamepad2, Sparkles, Navigation, BarChart3, EyeOff, Volume2, Sun, Moon, UploadCloud, ShieldCheck } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';

// Code-Splitting: Lazy load heavy modals for sub-second cold start
const AnticipationModal = lazy(() =>
  import('./components/AiAssistant/AnticipationModal').then((m) => ({ default: m.AnticipationModal }))
);
const ScannerModal = lazy(() =>
  import('./components/ChargingScanner/ScannerModal').then((m) => ({ default: m.ScannerModal }))
);
const LoungeModal = lazy(() =>
  import('./components/ChargeAndEarn/LoungeModal').then((m) => ({ default: m.LoungeModal }))
);
const AnalyticsModal = lazy(() =>
  import('./components/Analytics/AnalyticsModal').then((m) => ({ default: m.AnalyticsModal }))
);
const VoiceSettingsModal = lazy(() =>
  import('./components/AiAssistant/VoiceSettingsModal').then((m) => ({ default: m.VoiceSettingsModal }))
);
const BoschConnectModal = lazy(() =>
  import('./components/Ble/BoschConnectModal').then((m) => ({ default: m.BoschConnectModal }))
);
const RideSummaryModal = lazy(() =>
  import('./components/Recording/RideSummaryModal').then((m) => ({ default: m.RideSummaryModal }))
);
const GpxImportModal = lazy(() =>
  import('./components/Navigation/GpxImportModal').then((m) => ({ default: m.GpxImportModal }))
);
const EmergencyRangeModal = lazy(() =>
  import('./components/AiAssistant/EmergencyRangeModal').then((m) => ({ default: m.EmergencyRangeModal }))
);
const StationReviewModal = lazy(() =>
  import('./components/ChargingScanner/StationReviewModal').then((m) => ({ default: m.StationReviewModal }))
);
const LegalModal = lazy(() =>
  import('./components/Legal/LegalModal').then((m) => ({ default: m.LegalModal }))
);
const ConsentModal = lazy(() =>
  import('./components/Legal/ConsentModal').then((m) => ({ default: m.ConsentModal }))
);

export function App() {
  const geo = useGeolocation();
  const userLocation = { lat: geo.lat, lng: geo.lng };
  const wakeLock = useScreenWakeLock();

  // State
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [tokenBalance, setTokenBalance] = useState(60);
  const [isOledModeActive, setIsOledModeActive] = useState(false);
  const [isSunlightMode, setIsSunlightMode] = useState(false);
  const [selectedStationForReview, setSelectedStationForReview] = useState<ChargingStation | null>(null);
  const [telemetry, setTelemetry] = useState<LiveBikeTelemetry>({
    isConnected: false,
    batteryPercent: 85,
    batteryWhRemaining: 550,
    speedKmH: 0,
    cadenceRpm: 0,
    riderPowerWatts: 0,
    motorAssistMode: 'auto',
  });

  // Legal & Consent State
  const [showConsentModal, setShowConsentModal] = useState<boolean>(() => {
    return !localStorage.getItem('der_wegweiser_legal_consent');
  });
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'imprint' | 'cockpit'>('terms');

  // Modal States
  const [showAnticipationModal, setShowAnticipationModal] = useState(true);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showLoungeModal, setShowLoungeModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showVoiceSettingsModal, setShowVoiceSettingsModal] = useState(false);
  const [showBoschModal, setShowBoschModal] = useState(false);
  const [showRideSummaryModal, setShowRideSummaryModal] = useState(false);
  const [showGpxImportModal, setShowGpxImportModal] = useState(false);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyAlertDismissed, setEmergencyAlertDismissed] = useState(false);

  // Initialize Data & Pre-generate "Heute-Tour"
  useEffect(() => {
    const initData = async () => {
      // 1. Fetch Charging Stations
      const stations = await dataRepository.getChargingStations();
      setChargingStations(stations);

      // 2. Fetch User Prefs & Memory
      const prefs: UserPreferences = await dataRepository.getUserPreferences('user-1');
      const memory: UserMemoryPattern = await dataRepository.getUserMemoryPattern('user-1');

      // 3. Fetch Token Account Balance from Firestore/Cache
      const tokenAcc = await dataRepository.getTokenAccount('user-1');
      setTokenBalance(tokenAcc.balance);

      // 4. Pre-generate Zero-Click "Heute-Tour"
      const anticipatedRoute = await AiAssistantService.generateAnticipatedRoute(
        userLocation.lat,
        userLocation.lng,
        prefs,
        memory
      );
      setCurrentRoute(anticipatedRoute);
    };

    initData();
  }, [userLocation.lat, userLocation.lng]);

  // Background Corridor Offline Cache
  useEffect(() => {
    if (currentRoute && currentRoute.pathCoordinates && currentRoute.pathCoordinates.length > 0) {
      OfflineMapService.prefetchRouteCorridor(currentRoute.pathCoordinates);
    }
  }, [currentRoute]);

  // Battery Emergency Range Detection (Threshold <= 15%)
  useEffect(() => {
    if (telemetry.batteryPercent <= 15 && !emergencyAlertDismissed && !showEmergencyModal) {
      setShowEmergencyModal(true);
    }
  }, [telemetry.batteryPercent, emergencyAlertDismissed, showEmergencyModal]);

  // Handlers
  const handleConnectBLE = async () => {
    const liveData = await BleService.connectToBike();
    setTelemetry(liveData);

    // Subscribe to live continuous telemetry streaming while riding
    BleService.subscribeTelemetry(liveData, (updatedData) => {
      setTelemetry(updatedData);
    });
  };

  const handleStationAdded = async (station: Omit<ChargingStation, 'id' | 'createdAt'>) => {
    const newStation = await dataRepository.addChargingStation(station);
    setChargingStations((prev) => [...prev, newStation]);

    // Add +20 Tokens
    const newBal = await dataRepository.addTokens('user-1', 20, 'Ladesäulen-Scan');
    setTokenBalance(newBal);
  };

  const handleAddTokens = async (amount: number) => {
    const newBal = await dataRepository.addTokens('user-1', amount, 'Lade-Lounge Game');
    setTokenBalance(newBal);
  };

  const handleRegenerateRoute = async (modelId: ModelId = DEFAULT_MODEL) => {
    const prefs = await dataRepository.getUserPreferences('user-1');
    const memory = await dataRepository.getUserMemoryPattern('user-1');
    const newRoute = await AiAssistantService.generateAnticipatedRoute(
      userLocation.lat,
      userLocation.lng,
      prefs,
      memory,
      modelId
    );
    setCurrentRoute(newRoute);
  };

  const handleAutoReroute = async () => {
    console.log('[App] Auto-Rerouting triggered from current GPS position...');
    const prefs = await dataRepository.getUserPreferences('user-1');
    const memory = await dataRepository.getUserMemoryPattern('user-1');
    const recalculated = await AiAssistantService.generateAnticipatedRoute(
      userLocation.lat,
      userLocation.lng,
      prefs,
      memory
    );
    setCurrentRoute(recalculated);
  };

  const handleToggleOledMode = () => {
    if (!isOledModeActive) {
      wakeLock.requestWakeLock();
      setIsOledModeActive(true);
    } else {
      wakeLock.releaseWakeLock();
      setIsOledModeActive(false);
    }
  };

  const handleToggleSunlightMode = () => {
    const next = !isSunlightMode;
    setIsSunlightMode(next);
    if (next) {
      document.body.classList.add('sunlight-mode');
    } else {
      document.body.classList.remove('sunlight-mode');
    }
  };

  const handleRerouteToStation = (station: ChargingStation) => {
    if (!currentRoute) return;
    const detourRoute: Route = {
      ...currentRoute,
      id: `detour-${station.id}`,
      title: `Umleitung zu: ${station.name}`,
      pathCoordinates: [
        [userLocation.lat, userLocation.lng],
        [station.lat, station.lng],
      ],
      waypoints: [
        { id: 'start', lat: userLocation.lat, lng: userLocation.lng, category: 'start', name: 'Aktuelle Position' },
        { id: station.id, lat: station.lat, lng: station.lng, category: 'charging', name: station.name },
      ],
    };
    setCurrentRoute(detourRoute);
  };

  const handleAddStationReview = async (review: { rating: number; comment: string; tags: string[] }) => {
    console.log('[App] Review added for station:', selectedStationForReview?.name, review);
    // Reward +10 Tokens
    await handleAddTokens(10);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* OLED Black Saver Cockpit Overlay */}
      {isOledModeActive && (
        <OledBlackMode
          telemetry={telemetry}
          onExitOledMode={() => setIsOledModeActive(false)}
        />
      )}

      {/* Top Floating Glass Header HUD (Responsive Landscape Mode Support) */}
      <div
        className="top-header-hud"
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        {/* App Logo Badge */}
        <div className="glass-panel" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={20} className="glow-text-cyan" />
          <span style={{ fontSize: '1rem', fontWeight: 'bold', letterSpacing: '0.5px' }} className="glow-text-cyan">
            DER WEGWEISER
          </span>
        </div>

        {/* Battery & Telemetry HUD */}
        <BatteryHUD
          telemetry={telemetry}
          currentRoute={currentRoute}
          onConnectBLE={handleConnectBLE}
          onOpenBoschModal={() => setShowBoschModal(true)}
        />

        {/* Weather & Wind HUD */}
        <WeatherHUD userLocation={userLocation} />

        {/* Action Buttons HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* GPX Track Recorder Pill */}
          <GpxRecorderHUD
            userLocation={userLocation}
            telemetry={telemetry}
            onFinishRide={() => setShowRideSummaryModal(true)}
          />

          {/* Token Balance */}
          <div className="glass-pill glow-text-gold" style={{ padding: '6px 14px', fontWeight: 'bold', fontSize: '0.85rem' }}>
            🪙 {tokenBalance} Tok.
          </div>

          {/* GPX Import Button */}
          <button
            className="btn-cyberpunk"
            onClick={() => setShowGpxImportModal(true)}
            style={{ padding: '8px 12px' }}
            title="GPX Track von Komoot / Strava importieren"
          >
            <UploadCloud size={15} /> GPX
          </button>

          {/* Sunlight Mode Toggle (High-Noon High Contrast) */}
          <button
            className="btn-cyberpunk"
            onClick={handleToggleSunlightMode}
            style={{ padding: '8px 12px' }}
            title="Sonnenlicht High-Contrast Modus umschalten"
          >
            {isSunlightMode ? <Moon size={15} /> : <Sun size={15} />}
          </button>

          {/* Voice Personas & Audio Settings Button */}
          <button
            className="btn-cyberpunk hide-on-landscape"
            onClick={() => setShowVoiceSettingsModal(true)}
            style={{ padding: '8px 12px' }}
            title="KI-Stimmen & Audio-Einstellungen"
          >
            <Volume2 size={15} /> Stimme
          </button>

          {/* OLED Battery Saver Button */}
          <button
            className="btn-cyberpunk hide-on-landscape"
            onClick={handleToggleOledMode}
            style={{ padding: '8px 12px' }}
            title="OLED Beeline Spar-Modus"
          >
            <EyeOff size={15} /> OLED
          </button>

          {/* Analytics Button */}
          <button
            className="btn-cyberpunk hide-on-landscape"
            onClick={() => setShowAnalyticsModal(true)}
            style={{ padding: '8px 12px' }}
          >
            <BarChart3 size={15} /> Touren
          </button>

          {/* Scanner Button */}
          <button
            className="btn-cyberpunk hide-on-landscape"
            onClick={() => setShowScannerModal(true)}
            style={{ padding: '8px 12px' }}
          >
            <Camera size={15} /> + Säule
          </button>

          {/* Lounge Button */}
          <button
            className="btn-cyberpunk btn-gold"
            onClick={() => setShowLoungeModal(true)}
            style={{ padding: '8px 14px' }}
          >
            <Gamepad2 size={15} /> Lounge
          </button>

          {/* KI Heute-Tour Button */}
          <button
            className="btn-cyberpunk"
            onClick={() => setShowAnticipationModal(true)}
            style={{ padding: '8px 12px' }}
          >
            <Sparkles size={15} /> Tour
          </button>

          {/* Legal / DSGVO Button */}
          <button
            className="btn-cyberpunk hide-on-landscape"
            onClick={() => {
              setLegalTab('terms');
              setShowLegalModal(true);
            }}
            style={{ padding: '8px 12px' }}
            title="Rechtliches, AGB & Datenschutz"
          >
            <ShieldCheck size={15} /> Recht
          </button>
        </div>
      </div>

      {/* Main Fullscreen Map */}
      <MapView
        userLocation={userLocation}
        accuracy={geo.accuracy}
        heading={geo.heading}
        currentRoute={currentRoute}
        chargingStations={chargingStations}
        onSelectStation={() => {}}
        onAutoReroute={handleAutoReroute}
        onOpenReviewModal={(station) => setSelectedStationForReview(station)}
      />

      {/* Floating Voice Assistant Mic */}
      <FloatingMicButton
        telemetry={telemetry}
        currentRoute={currentRoute}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenLounge={() => setShowLoungeModal(true)}
        onToggleOled={handleToggleOledMode}
        onRegenerateTour={() => handleRegenerateRoute()}
      />

      {/* Lazy Modals with Suspense */}
      <Suspense fallback={null}>
        {showAnticipationModal && currentRoute && (
          <AnticipationModal
            route={currentRoute}
            onAcceptRoute={(route) => {
              setCurrentRoute(route);
              setShowAnticipationModal(false);
            }}
            onRegenerate={handleRegenerateRoute}
            onClose={() => setShowAnticipationModal(false)}
          />
        )}

        {showScannerModal && (
          <ScannerModal
            userLocation={userLocation}
            onStationAdded={handleStationAdded}
            onClose={() => setShowScannerModal(false)}
          />
        )}

        {showLoungeModal && (
          <LoungeModal
            tokenBalance={tokenBalance}
            onAddTokens={handleAddTokens}
            onClose={() => setShowLoungeModal(false)}
          />
        )}

        {showAnalyticsModal && (
          <AnalyticsModal
            isOpen={showAnalyticsModal}
            currentRoute={currentRoute}
            onClose={() => setShowAnalyticsModal(false)}
          />
        )}

        {/* Voice Personas & Audio Settings Modal */}
        {showVoiceSettingsModal && (
          <VoiceSettingsModal
            isOpen={showVoiceSettingsModal}
            onClose={() => setShowVoiceSettingsModal(false)}
          />
        )}

        {/* Bosch Smart System BES3 Modal */}
        {showBoschModal && (
          <BoschConnectModal
            isOpen={showBoschModal}
            onConnected={(liveData) => {
              setTelemetry(liveData);
              setShowBoschModal(false);
            }}
            onClose={() => setShowBoschModal(false)}
          />
        )}

        {/* Ride Summary & GPX Export Modal */}
        {showRideSummaryModal && (
          <RideSummaryModal
            isOpen={showRideSummaryModal}
            onAddTokens={handleAddTokens}
            onClose={() => setShowRideSummaryModal(false)}
          />
        )}

        {/* GPX Track Import Modal */}
        {showGpxImportModal && (
          <GpxImportModal
            isOpen={showGpxImportModal}
            onRouteLoaded={(importedRoute) => {
              setCurrentRoute(importedRoute);
              setShowGpxImportModal(false);
            }}
            onClose={() => setShowGpxImportModal(false)}
          />
        )}

        {/* No-Coast Emergency Low Battery Range Modal */}
        {showEmergencyModal && (
          <EmergencyRangeModal
            isOpen={showEmergencyModal}
            batteryPercent={telemetry.batteryPercent}
            remainingWh={telemetry.batteryWhRemaining || 80}
            nearestStations={chargingStations}
            onRerouteToStation={handleRerouteToStation}
            onClose={() => {
              setShowEmergencyModal(false);
              setEmergencyAlertDismissed(true);
            }}
          />
        )}

        {/* Community Charging Station Review Modal */}
        {selectedStationForReview && (
          <StationReviewModal
            isOpen={!!selectedStationForReview}
            station={selectedStationForReview}
            onAddReview={handleAddStationReview}
            onClose={() => setSelectedStationForReview(null)}
          />
        )}

        {/* Initial First-Launch Legal Consent Modal */}
        {showConsentModal && (
          <ConsentModal
            isOpen={showConsentModal}
            onAccept={() => setShowConsentModal(false)}
            onOpenDetails={(tab) => {
              setLegalTab(tab);
              setShowLegalModal(true);
            }}
          />
        )}

        {/* Full Legal & Privacy Terms Modal */}
        {showLegalModal && (
          <LegalModal
            isOpen={showLegalModal}
            initialTab={legalTab}
            onClose={() => setShowLegalModal(false)}
          />
        )}
      </Suspense>
    </div>
  );
}

export default App;
