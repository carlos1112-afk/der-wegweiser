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

import { useUILayout } from './contexts/UILayoutContext';
import { BurgerMenu } from './components/Navigation/BurgerMenu';
import { BottomActionBar } from './components/Navigation/BottomActionBar';
import { ConfettiOverlay } from './components/Overlays/ConfettiOverlay';
import { Menu } from 'lucide-react';
import { Camera, Gamepad2, Sparkles, Navigation, BarChart3, EyeOff, Volume2, Sun, Moon, UploadCloud, ShieldCheck, User as UserIcon, LogIn, Play, Pause, Zap, BatteryCharging, Send, X } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';
import { useAppLifecycle } from './hooks/useAppLifecycle';
import { AppLifecycleService } from './services/appLifecycleService';
import { ConsentService } from './services/consentService';
import { UserIdentity } from './services/userIdentity';

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
  const { isMainMenuOpen, setMainMenuOpen, isSearchActive, setSearchActive } = useUILayout();

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
      // Bei An-/Abmeldung muss die anonyme Kennung verworfen werden,
      // damit die echte Firebase-UID für Cloud-Pfade verwendet wird.
      UserIdentity.clearCache();
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
    batteryPercent: null,
    batteryWhRemaining: null,
    batteryKnown: false,
    speedKmH: 0,
    cadenceRpm: 0,
    riderPowerWatts: 0,
    motorAssistMode: 'off',
  });

  // Legal & Consent State
  // Die Einwilligung wird zentral über den ConsentService ausgewertet und
  // gate-t sämtliche Datenverarbeitung (Art. 6/7 DSGVO). Bislang steuerte der
  // Wert ausschließlich die Sichtbarkeit des Modals — GPS-Tracking, Firestore-
  // Zugriffe, Wetter-, KI- und Telemetrie-Aufrufe liefen unabhängig davon.
  const [consent, setConsent] = useState<boolean>(() => ConsentService.hasValidConsent());
  const [showConsentModal, setShowConsentModal] = useState<boolean>(() => !ConsentService.hasValidConsent());
  const hasConsent = consent;

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
  // Ohne gültige Einwilligung wird kein Standortwatch gestartet und keine
  // OS-Berechtigungsabfrage ausgelöst.
  const geo = useGeolocation(lifecycle.isHighAccuracyGps, hasConsent);
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

  const [showLegalModal, setShowLegalModal] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'imprint' | 'cockpit'>('terms');

  // Initialize Data & Pre-generate "Heute-Tour"
  // Startet erst, sobald eine gültige Einwilligung vorliegt.
  useEffect(() => {
    if (!hasConsent) return;

    const initData = async () => {
      try {
        // 1. Fetch Charging Stations
        const stations = await dataRepository.getChargingStations().catch(() => []);
        setChargingStations(stations);

        // 2. Fetch User Prefs & Memory
        const prefs: UserPreferences = await dataRepository.getUserPreferences(UserIdentity.getUserId());
        const memory: UserMemoryPattern = await dataRepository.getUserMemoryPattern(UserIdentity.getUserId());

        // 3. Fetch Token Account Balance from Firestore/Cache
        const tokenAcc = await dataRepository.getTokenAccount(UserIdentity.getUserId());
        setTokenBalance(tokenAcc.balance);

        // 4. Pre-generate Zero-Click "Heute-Tour"
        const anticipatedRoute = await AiAssistantService.generateAnticipatedRoute(
          userLocation.lat,
          userLocation.lng,
          prefs,
          memory
        ).catch((err) => {
          console.warn('[App] Heute-Tour konnte nicht generiert werden (Routing/Netzwerk offline):', err);
          return null;
        });
        if (anticipatedRoute) {
          setCurrentRoute(anticipatedRoute);
        }
      } catch (err) {
        console.warn('[App] Initialer Datenabruf fehlgeschlagen (Offline-Modus):', err);
      }
    };

    initData();
  }, [hasConsent, userLocation.lat, userLocation.lng]);

  // Background Corridor Offline Cache
  useEffect(() => {
    if (currentRoute && currentRoute.pathCoordinates && currentRoute.pathCoordinates.length > 0) {
      OfflineMapService.prefetchRouteCorridor(currentRoute.pathCoordinates);
    }
  }, [currentRoute]);

  // Battery Emergency Range Detection (Threshold <= 15%)
  useEffect(() => {
    if (telemetry.batteryPercent !== null && telemetry.batteryPercent <= 15 && !emergencyAlertDismissed && !showEmergencyModal) {
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
    const newBal = await dataRepository.addTokens(UserIdentity.getUserId(), 20, 'Ladesäulen-Scan');
    setTokenBalance(newBal);
  };

  const handleAddTokens = async (amount: number) => {
    const newBal = await dataRepository.addTokens(UserIdentity.getUserId(), amount, 'Lade-Lounge Game');
    setTokenBalance(newBal);
  };

  const handleRegenerateRoute = async (modelId: ModelId = DEFAULT_MODEL) => {
    try {
      const prefs = await dataRepository.getUserPreferences(UserIdentity.getUserId());
      const memory = await dataRepository.getUserMemoryPattern(UserIdentity.getUserId());
      const newRoute = await AiAssistantService.generateAnticipatedRoute(
        userLocation.lat,
        userLocation.lng,
        prefs,
        memory,
        modelId
      );
      setCurrentRoute(newRoute);
    } catch (err: any) {
      console.warn('[App] Route konnte nicht neu generiert werden:', err);
      alert('Routing-Dienst derzeit nicht erreichbar. Bitte Internetverbindung prüfen.');
    }
  };

  const handleAutoReroute = async () => {
    if (!currentRoute) return;
    console.log('[App] Auto-Rerouting triggered from current GPS position...');
    try {
      const prefs = await dataRepository.getUserPreferences(UserIdentity.getUserId());
      const memory = await dataRepository.getUserMemoryPattern(UserIdentity.getUserId());
      const recalculated = await AiAssistantService.generateAnticipatedRoute(
        userLocation.lat,
        userLocation.lng,
        prefs,
        memory
      );
      setCurrentRoute(recalculated);
    } catch (err: any) {
      console.warn('[App] Auto-Reroute fehlgeschlagen:', err);
    }
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
    try {
      const prefs = await dataRepository.getUserPreferences(UserIdentity.getUserId());
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
      newRoute.aiStory = `Fahrradoptimierte Verbindung zum gewählten Zielort (~${distKm.toFixed(1)} km) mit minimalem Höhenmeter-Widerstand (Heuristische Routenführung).`;
      setCurrentRoute(newRoute);
    } catch (err: any) {
      console.warn('[App] Navigation zum Zielpunkt fehlgeschlagen:', err);
      alert('Routenberechnung fehlgeschlagen. Der Routing-Dienst (BRouter) ist nicht erreichbar.');
    }
  };

  const handlePlanRouteToStation = async (station: ChargingStation) => {
    try {
      const prefs = await dataRepository.getUserPreferences(UserIdentity.getUserId());
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
      detourRoute.aiStory = `Direkte Anfahrt zur Ladestation ${station.name} (${station.plugType.toUpperCase()}) (Heuristische Routenführung).`;
      detourRoute.waypoints = [
        { id: 'start', lat: userLocation.lat, lng: userLocation.lng, category: 'start', name: 'Start' },
        { id: station.id, lat: station.lat, lng: station.lng, category: 'charging', name: station.name },
      ];
      setCurrentRoute(detourRoute);
    } catch (err: any) {
      console.warn('[App] Anfahrt zur Ladestation fehlgeschlagen:', err);
      alert('Routenberechnung zur Ladestation fehlgeschlagen. Der Routing-Dienst ist nicht erreichbar.');
    }
  };

  const handleAddStationReview = async (review: { rating: number; comment: string; tags: string[] }) => {
    console.log('[App] Review added for station:', selectedStationForReview?.name, review);
    // Reward +10 Tokens
    await handleAddTokens(10);
  };

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ConfettiOverlay isNavigating={!!currentRoute} />

      {/* OLED Black Saver Cockpit Overlay */}
      {isOledModeActive && (
        <OledBlackMode
          telemetry={telemetry}
          onExitOledMode={() => setIsOledModeActive(false)}
        />
      )}

      {/* NEW Top Header (Search, Burger Menu, OLED) */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button 
            className="btn-cyberpunk"
            onClick={() => setMainMenuOpen(true)}
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Search Bar Placeholder for Phase 1 - Just visual representation based on design */}
        <div 
          className="glass-panel"
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            padding: '8px 12px',
            backgroundColor: isSearchActive ? 'rgba(5, 10, 20, 0.95)' : 'rgba(5, 10, 20, 0.4)',
            transition: 'all 0.3s ease',
            cursor: 'pointer'
          }}
          onClick={() => setSearchActive(!isSearchActive)}
        >
          <span style={{ fontSize: '0.85rem', color: isSearchActive ? '#fff' : 'rgba(255,255,255,0.6)' }}>
            {currentRoute ? '▼' : (isSearchActive ? 'Ziel eingeben...' : 'Suchen...')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            className="btn-cyberpunk"
            onClick={handleToggleOledMode}
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <EyeOff size={18} />
          </button>
        </div>
      </div>

      <BurgerMenu 
        isOpen={isMainMenuOpen}
        onClose={() => setMainMenuOpen(false)}
        isSunlightMode={isSunlightMode}
        onToggleSunlightMode={handleToggleSunlightMode}
        onOpenGpx={() => setShowGpxImportModal(true)}
        onOpenVoice={() => setShowVoiceSettingsModal(true)}
        onOpenAnalytics={() => setShowAnalyticsModal(true)}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenLounge={() => setShowLoungeModal(true)}
        onOpenAnticipation={() => setShowAnticipationModal(true)}
        onOpenLegal={() => { setLegalTab('terms'); setShowLegalModal(true); }}
        onStartDemo={() => {
          if (!isSimulatingRoute) {
            setIsSimulatingRoute(true);
            setSimSpeedMultiplier(1);
          } else {
            setSimSpeedMultiplier(simSpeedMultiplier >= 10 ? 1 : simSpeedMultiplier === 1 ? 4 : 10);
          }
        }}
      />

      <BottomActionBar 
        isNavigating={!!currentRoute}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenVoice={() => setShowVoiceSettingsModal(true)}
        onOpenSearch={() => setSearchActive(true)}
      />

      {/* Battery HUD - Relocated to Bottom, above BottomActionBar */}
      <div style={{
        position: 'absolute',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1900
      }}>
        <BatteryHUD
          telemetry={telemetry}
          currentRoute={currentRoute}
          onConnectBLE={handleConnectBLE}
          onOpenBoschModal={() => setShowBoschModal(true)}
        />
      </div>

      {/* GPX Track Recorder Pill - Relocated right side above right controls */}
      {!currentRoute && (
        <div style={{ position: 'absolute', right: '10px', top: '150px', zIndex: 1900 }}>
          <GpxRecorderHUD
            userLocation={activeUserLocation}
            telemetry={telemetry}
            onFinishRide={() => setShowRideSummaryModal(true)}
          />
        </div>
      )}

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
        onOpenScanner={() => setShowScannerModal(true)}
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
            onAccept={() => {
              // Einwilligung im Service verifizieren, bevor die Verarbeitung
              // freigeschaltet wird — der State folgt der persistierten
              // Entscheidung, nicht dem Klick.
              setConsent(ConsentService.hasValidConsent());
              setShowConsentModal(false);
            }}
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
