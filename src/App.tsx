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
import { AuthService } from './services/authService';
import { RoutingService } from './services/routingService';
import { EBikeDisplayService } from './services/ebikeDisplayService';
import type { User } from 'firebase/auth';
import { Camera, Gamepad2, Sparkles, Navigation, BarChart3, EyeOff, Volume2, Sun, Moon, UploadCloud, ShieldCheck, User as UserIcon, LogIn, Play, Pause, Zap, Send, X } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { AppLifecycleService } from './services/appLifecycleService';

// Code-Splitting: Lazy load heavy modals for sub-second cold start
const AuthModal = lazy(() =>
  import('./components/Auth/AuthModal').then((m) => ({ default: m.AuthModal }))
);
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

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function App() {
  // Modal States (Declared first to supply active modal context to lifecycle)
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
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(AuthService.getCurrentUser());

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      setAuthUser(user);
    });
    return () => unsubscribe();
  }, []);

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

  // App Lifecycle Controller
  const activeModalName = showLoungeModal
    ? 'lounge'
    : showScannerModal
    ? 'scanner'
    : showAnticipationModal
    ? 'anticipation'
    : null;
  const isNavigating = !showAnticipationModal && !!currentRoute;
  const lifecycle = useAppLifecycle(activeModalName, isNavigating, telemetry.speedKmH);

  // Hardware & Sensor Bindings throttled by Lifecycle Mode
  const geo = useGeolocation(lifecycle.isHighAccuracyGps);
  const userLocation = { lat: geo.lat, lng: geo.lng };
  useScreenWakeLock(lifecycle.isWakeLockActive || isOledModeActive);

  // GPS Route Simulation State (Demo-Fahrt entlang der berechneten Route)
  const [isSimulatingRoute, setIsSimulatingRoute] = useState<boolean>(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [, setSimulatedCoordIndex] = useState<number>(0);
  const [isBottomCardOpen, setIsBottomCardOpen] = useState<boolean>(false);
  const [simulatedLocation, setSimulatedLocation] = useState<{
    lat: number;
    lng: number;
    heading: number;
    speedKmH: number;
  } | null>(null);

  // Auto-hiding Push to E-Bike button state during navigation (3 min auto-hide + manual dismiss)
  const [isPushDismissed, setIsPushDismissed] = useState(false);
  const [ebikePushMessage, setEbikePushMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!currentRoute) {
      setIsPushDismissed(false);
      setEbikePushMessage(null);
      return;
    }
    setIsPushDismissed(false);
    const timer = setTimeout(() => {
      setIsPushDismissed(true);
    }, 180000); // Auto-hide after 3 minutes (180,000 ms)

    return () => clearTimeout(timer);
  }, [currentRoute]);

  const handlePushToEBikeNav = async () => {
    if (!currentRoute) return;
    setEbikePushMessage('Übertrage Route...');
    const result = await EBikeDisplayService.pushRouteToEBike(currentRoute);
    setEbikePushMessage(result.message);
    setTimeout(() => {
      setEbikePushMessage(null);
      setIsPushDismissed(true);
    }, 3000);
  };

  useEffect(() => {
    if (!isSimulatingRoute || !currentRoute || !currentRoute.pathCoordinates || currentRoute.pathCoordinates.length < 2) {
      if (simulatedLocation) setSimulatedLocation(null);
      return;
    }

    const coords = currentRoute.pathCoordinates;
    const intervalMs = simSpeedMultiplier >= 10 ? 120 : simSpeedMultiplier >= 4 ? 250 : 600;
    const stepIncrement = simSpeedMultiplier >= 10 ? 3 : simSpeedMultiplier >= 4 ? 2 : 1;

    const interval = setInterval(() => {
      setSimulatedCoordIndex((prevIndex) => {
        const nextIndex = (prevIndex + stepIncrement) % coords.length;
        const currentCoord = coords[nextIndex];
        const lookAhead = coords[(nextIndex + 1) % coords.length];

        // Calculate bearing between sequential waypoints
        const y = Math.sin(((lookAhead[1] - currentCoord[1]) * Math.PI) / 180) * Math.cos((lookAhead[0] * Math.PI) / 180);
        const x =
          Math.cos((currentCoord[0] * Math.PI) / 180) * Math.sin((lookAhead[0] * Math.PI) / 180) -
          Math.sin((currentCoord[0] * Math.PI) / 180) *
            Math.cos((lookAhead[0] * Math.PI) / 180) *
            Math.cos(((lookAhead[1] - currentCoord[1]) * Math.PI) / 180);
        const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

        const simulatedSpeed = simSpeedMultiplier >= 10 ? 68.0 : simSpeedMultiplier >= 4 ? 42.5 : 24.5;

        setSimulatedLocation({
          lat: currentCoord[0],
          lng: currentCoord[1],
          heading: Math.round(bearing),
          speedKmH: simulatedSpeed,
        });

        // Live telemetry updates during ride simulation
        setTelemetry((t) => ({
          ...t,
          speedKmH: simulatedSpeed,
          motorPowerWatts: simSpeedMultiplier >= 10 ? 340 : 190,
          riderPowerWatts: simSpeedMultiplier >= 10 ? 210 : 115,
        }));

        return nextIndex;
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isSimulatingRoute, currentRoute, simSpeedMultiplier]);

  const activeUserLocation = simulatedLocation ? { lat: simulatedLocation.lat, lng: simulatedLocation.lng } : userLocation;
  const activeHeading = simulatedLocation?.heading !== undefined ? simulatedLocation.heading : geo.heading;
  const activeAccuracy = simulatedLocation ? 5 : geo.accuracy;

  // Legal & Consent State
  const [showConsentModal, setShowConsentModal] = useState<boolean>(() => {
    return !localStorage.getItem('der_wegweiser_legal_consent');
  });
  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'imprint' | 'cockpit'>('terms');

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
    setIsOledModeActive((prev) => !prev);
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

  const handlePlanRouteToPoint = async (targetLat: number, targetLng: number) => {
    const prefs = await dataRepository.getUserPreferences('user-1');
    const distKm = calculateDistanceKm(userLocation.lat, userLocation.lng, targetLat, targetLng);
    const newRoute = await RoutingService.generateBikeRoute(
      {
        startLat: userLocation.lat,
        startLng: userLocation.lng,
        targetDistanceKm: Math.max(2, Math.round(distKm * 1.3)),
        batteryPercent: telemetry.batteryPercent,
        bikeType: prefs.bikeType || 'ebike',
        themes: ['Direktverbindung'],
        maxElevationGainM: 120,
        surfacePreference: 'any',
      },
      prefs
    );
    if (newRoute.pathCoordinates.length > 1) {
      newRoute.pathCoordinates[newRoute.pathCoordinates.length - 1] = [targetLat, targetLng];
    }
    newRoute.title = `Route zum gewählten Ziel (${newRoute.distanceKm} km)`;
    newRoute.aiStory = `Google Gemini 2.0 Flash: Fahrradoptimierte Verbindung zum gewählten Zielort (~${distKm.toFixed(1)} km) mit minimalem Höhenmeter-Widerstand.`;
    setCurrentRoute(newRoute);
  };

  const handlePlanRouteToStation = async (station: ChargingStation) => {
    const prefs = await dataRepository.getUserPreferences('user-1');
    const distKm = calculateDistanceKm(userLocation.lat, userLocation.lng, station.lat, station.lng);
    const detourRoute = await RoutingService.generateBikeRoute(
      {
        startLat: userLocation.lat,
        startLng: userLocation.lng,
        targetDistanceKm: Math.max(1, Math.round(distKm * 1.2)),
        batteryPercent: telemetry.batteryPercent,
        bikeType: prefs.bikeType || 'ebike',
        themes: ['Ladesäulen-Anfahrt'],
        maxElevationGainM: 60,
        surfacePreference: 'asphalt',
      },
      prefs
    );
    if (detourRoute.pathCoordinates.length > 1) {
      detourRoute.pathCoordinates[detourRoute.pathCoordinates.length - 1] = [station.lat, station.lng];
    }
    detourRoute.title = `Anfahrt: ${station.name}`;
    detourRoute.aiStory = `Google Gemini 2.0 Flash: Direkte Anfahrt zur Ladestation ${station.name} (${station.plugType.toUpperCase()}).`;
    detourRoute.waypoints = [
      { id: 'start', lat: userLocation.lat, lng: userLocation.lng, category: 'start', name: 'Start' },
      { id: station.id, lat: station.lat, lng: station.lng, category: 'charging', name: station.name },
    ];
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

      {/* Top Floating Glass Header HUD (Always fully visible) */}
      <div
        className="top-header-hud"
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          right: '10px',
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
        }}
      >
        {/* Left: Brand & OAuth Auth Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <div className="glass-panel header-brand-pill" style={{ padding: '5px 9px', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Navigation size={16} className="glow-text-cyan" />
            <span style={{ fontSize: '0.85rem', fontWeight: 'bold', letterSpacing: '0.4px' }} className="brand-text glow-text-cyan">
              WEGWEISER
            </span>
          </div>

          <button
            className={`btn-cyberpunk auth-btn-mobile ${authUser ? 'btn-cyan' : 'btn-gold'}`}
            onClick={() => setShowAuthModal(true)}
            style={{
              padding: '5px 8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.72rem',
              cursor: 'pointer',
            }}
            title="Account & OAuth-Anmeldung (Google / Apple / Microsoft / Facebook / X / Telegram)"
          >
            {authUser ? (
              <>
                {authUser.photoURL ? (
                  <img
                    src={authUser.photoURL}
                    alt={authUser.displayName || 'User'}
                    style={{ width: '16px', height: '16px', borderRadius: '50%' }}
                  />
                ) : (
                  <UserIcon size={13} />
                )}
                <span style={{ fontWeight: 'bold' }}>{authUser.displayName ? authUser.displayName.split(' ')[0] : 'Konto'}</span>
              </>
            ) : (
              <>
                <LogIn size={13} />
                <span className="auth-btn-text">Anmelden</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Telemetry, Weather & Token */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <BatteryHUD
            telemetry={telemetry}
            currentRoute={currentRoute}
            onConnectBLE={handleConnectBLE}
            onOpenBoschModal={() => setShowBoschModal(true)}
          />
          <WeatherHUD userLocation={userLocation} />
          <div className="glass-pill glow-text-gold hud-token-pill" style={{ padding: '5px 7px', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span>🪙</span>
            <span>{tokenBalance}</span>
          </div>
        </div>
      </div>

      {/* Top-Right Sunlight & OLED Switches during Active Navigation */}
      {currentRoute && (
        <div style={{ position: 'fixed', top: '56px', right: '12px', zIndex: 2100, display: 'flex', gap: '6px' }}>
          <button
            className="btn-cyberpunk"
            onClick={handleToggleSunlightMode}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title="Sonnenlicht High-Contrast Modus"
          >
            {isSunlightMode ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button
            className="btn-cyberpunk"
            onClick={handleToggleOledMode}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            title="OLED Sparmodus"
          >
            <EyeOff size={14} /> OLED
          </button>
        </div>
      )}

      {/* Auto-Hiding Push to E-Bike Banner during Active Navigation (First 3 Min + Manual Close X) */}
      {currentRoute && !isPushDismissed && (
        <div
          style={{
            position: 'fixed',
            top: '56px',
            left: '12px',
            zIndex: 2100,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '20px',
            backgroundColor: '#090e1a',
            border: '2px solid var(--accent-gold)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.95), 0 0 14px rgba(255, 183, 0, 0.5)',
          }}
        >
          {ebikePushMessage ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', fontWeight: 'bold', padding: '0 4px' }}>
              {ebikePushMessage}
            </span>
          ) : (
            <>
              <button
                className="btn-cyberpunk btn-gold"
                onClick={handlePushToEBikeNav}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  borderRadius: '14px',
                }}
                title="Route an verbundenes E-Bike Display senden"
              >
                <Send size={13} /> Push to E-Bike
              </button>
              <button
                onClick={() => setIsPushDismissed(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--accent-gold)',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Ausblenden"
              >
                <X size={14} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Round Scanner (+ Säule) Button stacked directly ABOVE the Floating Microphone Button on the RIGHT */}
      {currentRoute && (
        <button
          className="btn-cyberpunk btn-gold"
          onClick={() => setShowScannerModal(true)}
          style={{
            position: 'fixed',
            bottom: isBottomCardOpen ? '165px' : '88px',
            right: '16px',
            zIndex: 1800,
            width: '50px',
            height: '50px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#090e1a',
            border: '2px solid var(--accent-gold)',
            color: 'var(--accent-gold)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.95), 0 0 16px rgba(255, 183, 0, 0.6)',
          }}
          title="Ladesäule scannen / Foto hochladen"
        >
          <Camera size={22} />
        </button>
      )}

      {/* Relocated Fahrt-Modus Button on the LEFT side, positioned higher */}
      {currentRoute && (
        <button
          className="btn-cyberpunk"
          onClick={() => {
            const nextMode = lifecycle.currentMode === 'ride' ? 'charge' : 'ride';
            AppLifecycleService.setMode(nextMode);
          }}
          style={{
            position: 'fixed',
            bottom: isBottomCardOpen ? '165px' : '105px',
            left: '16px',
            zIndex: 1800,
            padding: '8px 14px',
            borderRadius: '20px',
            backgroundColor: '#090e1a',
            border: '2px solid var(--accent-cyan)',
            color: 'var(--accent-cyan)',
            boxShadow: '0 4px 18px rgba(0, 0, 0, 0.95), 0 0 14px rgba(0, 229, 255, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.82rem',
            fontWeight: '800',
          }}
          title="Modus umschalten"
        >
          <Zap size={16} /> Fahrt-Modus
        </button>
      )}

      {/* Quick Action Strip below Header */}
      <div
        className="quick-actions-bar"
        style={{
          position: 'absolute',
          top: currentRoute ? '56px' : '52px',
          left: '12px',
          right: currentRoute ? '110px' : '12px',
          zIndex: 1900,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          overflowX: 'auto',
          maxWidth: '100%',
          paddingBottom: '2px',
          scrollbarWidth: 'none',
        }}
      >
        {/* Lifecycle Mode Indicator Pill (Hidden in Nav mode as it is relocated bottom-right) */}
        {!currentRoute && (
          <div
            className="glass-pill"
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              borderColor:
                lifecycle.currentMode === 'ride'
                  ? 'var(--accent-cyan)'
                  : lifecycle.currentMode === 'charge'
                  ? 'var(--accent-gold)'
                  : 'var(--accent-neon-green)',
              color:
                lifecycle.currentMode === 'ride'
                  ? 'var(--accent-cyan)'
                  : lifecycle.currentMode === 'charge'
                  ? 'var(--accent-gold)'
                  : 'var(--accent-neon-green)',
            }}
            title="App Lifecycle: Module & Sensoren laufen nur bei echtem Bedarf zur Akkusparung"
          >
            {lifecycle.currentMode === 'ride'
              ? '⚡ Fahrt-Modus'
              : lifecycle.currentMode === 'charge'
              ? '🔋 Lade-Lounge'
              : '🗺️ Planung'}
          </div>
        )}

        {/* GPX Track Recorder Pill */}
        <GpxRecorderHUD
          userLocation={activeUserLocation}
          telemetry={telemetry}
          onFinishRide={() => setShowRideSummaryModal(true)}
        />

        {/* GPS Demo-Fahrt Simulation Button with Multi-Speed Modes */}
        <button
          className={`btn-cyberpunk ${isSimulatingRoute ? (simSpeedMultiplier >= 10 ? 'btn-gold' : 'btn-neon-green') : ''}`}
          onClick={() => {
            if (!isSimulatingRoute) {
              setIsSimulatingRoute(true);
              setSimSpeedMultiplier(1);
            } else if (simSpeedMultiplier === 1) {
              setSimSpeedMultiplier(4);
            } else if (simSpeedMultiplier === 4) {
              setSimSpeedMultiplier(10);
            } else {
              setIsSimulatingRoute(false);
              setSimSpeedMultiplier(1);
            }
          }}
          style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          title="GPS-Simulation der aktiven Route (1x -> 4x -> 10x Schnelldurchgang -> Stop)"
        >
          {isSimulatingRoute ? (
            simSpeedMultiplier >= 10 ? (
              <>
                <Zap size={15} className="glow-text-gold" />
                <span>Sim 10x 🚀</span>
              </>
            ) : simSpeedMultiplier >= 4 ? (
              <>
                <Zap size={15} className="glow-text-cyan" />
                <span>Sim 4x ⚡</span>
              </>
            ) : (
              <>
                <Pause size={15} />
                <span>Sim 1x ⏸</span>
              </>
            )
          ) : (
            <>
              <Play size={15} />
              <span>Demo-Fahrt</span>
            </>
          )}
        </button>

        {/* Main Menu Only Buttons (Hidden during active navigation) */}
        {!currentRoute && (
          <>
            {/* GPX Import Button */}
            <button
              className="btn-cyberpunk"
              onClick={() => setShowGpxImportModal(true)}
              style={{ padding: '8px 12px' }}
              title="GPX Track von Komoot / Strava importieren"
            >
              <UploadCloud size={15} /> GPX
            </button>

            {/* Sunlight Mode Toggle */}
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
          </>
        )}
      </div>

      {/* Main Fullscreen Map */}
      <MapView
        userLocation={activeUserLocation}
        accuracy={activeAccuracy}
        heading={activeHeading}
        currentRoute={currentRoute}
        chargingStations={chargingStations}
        onSelectStation={(station) => handlePlanRouteToStation(station)}
        onAutoReroute={handleAutoReroute}
        onOpenReviewModal={(station) => setSelectedStationForReview(station)}
        onPlanRouteToPoint={handlePlanRouteToPoint}
        onPlanRouteToStation={handlePlanRouteToStation}
        isSimulating={isSimulatingRoute}
        onToggleSimulation={() => setIsSimulatingRoute(!isSimulatingRoute)}
        onCardOpenChange={setIsBottomCardOpen}
      />

      {/* Floating Voice Assistant Mic */}
      <FloatingMicButton
        telemetry={telemetry}
        currentRoute={currentRoute}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenLounge={() => setShowLoungeModal(true)}
        onToggleOled={handleToggleOledMode}
        onRegenerateTour={() => handleRegenerateRoute()}
        isHidden={isBottomCardOpen}
      />

      {/* Lazy Modals with Suspense */}
      <Suspense fallback={null}>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
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
            onRerouteToStation={handlePlanRouteToStation}
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
