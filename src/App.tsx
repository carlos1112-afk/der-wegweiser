import { isValidatedRoute } from './types/routing';
import type { RouteLocation } from './types/routing';
import { useCallback, useState, useEffect, lazy, Suspense } from 'react';
import { SearchInput } from './components/Search/SearchInput';
import type { SearchResult } from './components/Search/SearchInput';
import { MapView } from './components/Map/MapView';
import { BatteryHUD } from './components/BatteryHUD/BatteryHUD';
import { WeatherHUD } from './components/WeatherHUD/WeatherHUD';
import { GpxRecorderHUD } from './components/Recording/GpxRecorderHUD';
import { OledBlackMode } from './components/DisplayModes/OledBlackMode';
import type { Route, ChargingStation, LiveBikeTelemetry, UserPreferences, UserMemoryPattern } from './types/navigation';
import { dataRepository } from './services/dataRepository';
import { AiAssistantService, DEFAULT_MODEL } from './services/aiAssistantService';
import type { ModelId } from './services/aiAssistantService';
import { BleService } from './services/bleService';
import { OfflineMapService } from './services/offlineMapService';
import { AuthService } from './services/authService';
import { EBikeDisplayService } from './services/ebikeDisplayService';
import type { User } from 'firebase/auth';

import { useUILayout } from './contexts/UILayoutContext';
import { BurgerMenu } from './components/Navigation/BurgerMenu';
import { StartScreen } from './components/StartScreen/StartScreen';
import { AdvancedRoutePlanner, type AdvancedRouteOptions } from './components/StartScreen/AdvancedRoutePlanner';
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
import { PushNotificationService } from './services/pushNotificationService';
import { CoPilotService } from './services/coPilotService';
import { useRef } from 'react';

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


export function App() {
  const { isMainMenuOpen, setMainMenuOpen, isSearchActive, setSearchActive } = useUILayout();

  // Modal States (Declared first to supply active modal context to lifecycle)
  const [showAnticipationModal, setShowAnticipationModal] = useState(false);
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
  const authUserIdRef = useRef<string | null>(AuthService.getCurrentUser()?.uid ?? null);
  const [showStartScreen, setShowStartScreen] = useState(true);
  const [showAdvancedRoutePlanner, setShowAdvancedRoutePlanner] = useState(false);
  const [searchFocusRequest, setSearchFocusRequest] = useState(0);

  useEffect(() => {
    const unsubscribe = AuthService.onAuthStateChange((user) => {
      const nextUid = user?.uid ?? null;
      if (authUserIdRef.current !== nextUid) {
        activeRouteRequestId.current++;
        setCurrentRoute(null);
        setIsSimulatingRoute(false);
        setTokenBalance(0);
      }
      authUserIdRef.current = nextUid;
      setAuthUser(user);
      // Bei An-/Abmeldung muss die anonyme Kennung verworfen werden,
      // damit die echte Firebase-UID für Cloud-Pfade verwendet wird.
      UserIdentity.clearCache();
    });

    // Initialize FCM Push Notifications pipeline
    PushNotificationService.initialize();

    return () => unsubscribe();
  }, []);

  // State
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [routePreview, setRoutePreview] = useState<Route | null>(null);
  const [manualStart, setManualStart] = useState<RouteLocation | null>(null);
  const [showManualStart, setShowManualStart] = useState(false);
  const [routingNotice, setRoutingNotice] = useState<string | null>(null);
  const routeAbort = useRef<AbortController | null>(null);
  const cancelRouting = useCallback(() => { routeAbort.current?.abort(); activeRouteRequestId.current++; }, []);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [tokenBalance, setTokenBalance] = useState(0);
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

  // Track pending route calculation requests for cancellation on consent withdrawal
  const activeRouteRequestId = useRef<number>(0);

  // Subscribe to consent state changes across all modals and services (Art. 6/7 DSGVO)
  useEffect(() => {
    const unsubscribe = ConsentService.onChange((flags) => {
      const isValid = flags !== null && ConsentService.hasValidConsent();
      setConsent(isValid);
      setShowConsentModal(!isValid);
      if (!isValid) {
        // Cancel pending route generation and stop active location tracking immediately
        activeRouteRequestId.current++;
        setCurrentRoute(null);
        setIsSimulatingRoute(false);
        setSearchDestination(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // App Lifecycle Controller
  const activeModalName = showLoungeModal
    ? 'lounge'
    : showScannerModal
    ? 'scanner'
    : showAnticipationModal
    ? 'anticipation'
    : null;
  const isNavigating = isValidatedRoute(currentRoute?.validatedRoute) && currentRoute.validatedRoute.guidanceCapability === 'turn_by_turn';
  const lifecycle = useAppLifecycle(activeModalName, isNavigating, telemetry.speedKmH);

  // Hardware & Sensor Bindings throttled by Lifecycle Mode
  // Ohne gültige Einwilligung wird kein Standortwatch gestartet und keine
  // OS-Berechtigungsabfrage ausgelöst.
  const geo = useGeolocation(lifecycle.isHighAccuracyGps, hasConsent);
  const userLocation = { lat: geo.lat, lng: geo.lng, accuracyM: geo.accuracy, observedAt: geo.observedAt };
  useScreenWakeLock(lifecycle.isWakeLockActive || isOledModeActive);

  // GPS Route Simulation State (Demo-Fahrt entlang der berechneten Route)
  const [isSimulatingRoute, setIsSimulatingRoute] = useState<boolean>(false);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1);
  const [, setSimulatedCoordIndex] = useState<number>(0);
  const [isBottomCardOpen, setIsBottomCardOpen] = useState<boolean>(false);
  const [searchDestination, setSearchDestination] = useState<SearchResult | null>(null);
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
    if (!hasConsent || !ConsentService.hasValidConsent()) return;

    let isSubscribed = true;
    const reqId = ++activeRouteRequestId.current;

    const initData = async () => {
      try {
        const requestUid = authUserIdRef.current;
        // 1. Fetch Charging Stations
        const stations = await dataRepository.getChargingStations().catch(() => []);
        if (!isSubscribed || reqId !== activeRouteRequestId.current || authUserIdRef.current !== requestUid || !ConsentService.hasValidConsent()) return;
        setChargingStations(stations);

        // Lade nur die Menüdaten. Eine heutige Strecke wird erst auf Knopfdruck
        // erzeugt, damit die Startseite weder ungefragt routet noch Daten sendet.
        const tokenAcc = await dataRepository.getTokenAccount(requestUid ?? UserIdentity.getUserId());
        if (!isSubscribed || reqId !== activeRouteRequestId.current || authUserIdRef.current !== requestUid || !ConsentService.hasValidConsent()) return;
        setTokenBalance(tokenAcc.balance);
      } catch (err) {
        console.warn('[App] Initialer Datenabruf fehlgeschlagen (Offline-Modus):', err);
      }
    };

    initData();

    return () => {
      isSubscribed = false;
    };
  }, [hasConsent, authUser?.uid, userLocation.lat, userLocation.lng]);

  // Background Corridor Offline Cache
  useEffect(() => {
    if (currentRoute && currentRoute.pathCoordinates && currentRoute.pathCoordinates.length > 0) {
      OfflineMapService.prefetchRouteCorridor(currentRoute.pathCoordinates);
    }
  }, [currentRoute]);

  // Rapid Battery Drop Detection (FCM Trigger)
  const prevBatteryRef = useRef<{ percent: number, time: number } | null>(null);

  useEffect(() => {
    if (telemetry.batteryPercent === null) return;

    const now = Date.now();
    const currentPercent = telemetry.batteryPercent;

    if (prevBatteryRef.current) {
      const { percent: prevPercent, time: prevTime } = prevBatteryRef.current;
      const timeDiffMs = now - prevTime;
      const dropAmount = prevPercent - currentPercent;

      if (currentPercent > prevPercent) {
        // Battery charged/increased, reset the tracking point
        prevBatteryRef.current = { percent: currentPercent, time: now };
        return;
      }

      if (timeDiffMs > 300000) {
        // Time window exceeded, reset baseline to now to restart measurement window
        prevBatteryRef.current = { percent: currentPercent, time: now };
        return;
      }

      // Detect rapid drop: >= 5% drop in <= 5 minutes (300,000 ms)
      if (dropAmount >= 5) {
        PushNotificationService.sendEmergencyBatteryWarning(
          currentPercent,
          `Verlust von ${dropAmount}% in ${Math.max(1, Math.round(timeDiffMs / 60000))} Minuten erkannt.`
        );
        // Reset ref so we don't repeatedly trigger for the same drop
        prevBatteryRef.current = { percent: currentPercent, time: now };
      }
      // Note: If dropAmount is < 5 and time is within window, we do NOT reset the ref!
      // This allows gradual drops to accumulate and be evaluated over the 5-minute window.
    } else {
      // First data point
      prevBatteryRef.current = { percent: currentPercent, time: now };
    }
  }, [telemetry.batteryPercent]);

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
    CoPilotService.start();

    BleService.subscribeTelemetry(liveData, (updatedData) => {
      setTelemetry(updatedData);
      CoPilotService.onTelemetryUpdate(updatedData);
    });
  };

  const handleStationAdded = async (station: Omit<ChargingStation, 'id' | 'createdAt'>) => {
    const newStation = await dataRepository.addChargingStation(station);
    setChargingStations((prev) => [...prev, newStation]);
  };

  const handleTokenBalanceRefresh = async (serverBalance?: number) => {
    if (Number.isSafeInteger(serverBalance) && (serverBalance as number) >= 0) {
      setTokenBalance(serverBalance as number);
      return;
    }
    const account = await dataRepository.getTokenAccount(UserIdentity.getUserId());
    setTokenBalance(account.balance);
  };

  const handleRegenerateRoute = async (_modelId: ModelId = DEFAULT_MODEL) => {
    setRoutingNotice('KI-Premium ist noch nicht freigegeben. Kostenlose Zielplanung bleibt separat verfügbar.');
  };

  const handleAutoReroute = async () => {
    if (!currentRoute || !ConsentService.allowsEssential) return;
    setRoutingNotice('Kostenlose Rückführung ist noch nicht freigegeben. Die Originalroute bleibt erhalten; Abbiegeführung pausiert.');
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

  const handlePlanRouteToPoint = async (
    targetLat: number,
    targetLng: number,
    mode: 'standard' | 'premium' | 'offline' = 'standard',
    destinationName = searchDestination?.label || 'Ausgewähltes Ziel',
    advancedOptions?: AdvancedRouteOptions,
  ) => {
    if (!ConsentService.hasValidConsent()) {
      setShowConsentModal(true);
      return false;
    }
    const start: RouteLocation | null = manualStart ?? (geo.isTracking && !geo.error && geo.observedAt !== null && geo.observedAt <= Date.now() && Date.now() - geo.observedAt <= 10000 && geo.accuracy !== null && geo.accuracy <= 50
      ? { ...userLocation, source: 'gps', observedAt: geo.observedAt, accuracyM: geo.accuracy, confirmed: true } : null);
    if (!start) { setRoutingNotice('Aktueller GPS-Start fehlt. Bitte einen manuellen Start festlegen.'); setShowManualStart(true); return false; }
    routeAbort.current?.abort();
    const controller = new AbortController(); routeAbort.current = controller;
    const reqId = ++activeRouteRequestId.current;
    try {
      const prefs = await dataRepository.getUserPreferences(UserIdentity.getUserId());
      const routePrefs: UserPreferences = {
        ...prefs,
        preferredSurface: advancedOptions?.surfacePreference ?? prefs.preferredSurface,
        avoidSteepHills: advancedOptions?.avoidSteepHills ?? prefs.avoidSteepHills,
      };
      const newRoute = await AiAssistantService.generateDestinationRoute(
        start,
        { lat: targetLat, lng: targetLng },
        routePrefs,
        {
          mode,
          start,
          destinationName,
          via: advancedOptions?.via,
          viaName: advancedOptions?.via?.label,
          wishes: advancedOptions?.wishes,
        },
        controller.signal
      );
      if (reqId === activeRouteRequestId.current && ConsentService.hasValidConsent()) {
        setRoutePreview(newRoute);
        setShowAnticipationModal(true);
        return true;
      }
      return false;
    } catch (err: any) {
      if (reqId !== activeRouteRequestId.current || controller.signal.aborted) return false;
      console.warn('[App] Navigation zum Zielpunkt fehlgeschlagen:', err);
      if (err?.name !== 'AbortError') setRoutingNotice(err?.message || 'Routenberechnung fehlgeschlagen.');
      return false;
    }
  };

  const handleGenerateTodayRoute = () => {
    setShowStartScreen(false);
    void handleRegenerateRoute();
  };

  const handleStartSimpleRoute = () => {
    setShowStartScreen(false);
    setSearchFocusRequest((request) => request + 1);
  };

  const handleAdvancedRoute = (destination: SearchResult, options: AdvancedRouteOptions) => {
    setShowAdvancedRoutePlanner(false);
    setShowStartScreen(false);
    void handlePlanRouteToPoint(destination.lat, destination.lng, 'premium', destination.label, options);
  };

  const handlePlanRouteToStation = async (station: ChargingStation) => {
    await handlePlanRouteToPoint(station.lat, station.lng, 'standard', station.name);
  };

  const handleAddStationReview = async (_review: { rating: number; comment: string; tags: string[] }): Promise<boolean> => {
    return false;
  };

  useEffect(() => {
    const unsubscribe = ConsentService.onChange(flags => {
      routeAbort.current?.abort(); activeRouteRequestId.current++;
      setRoutePreview(null); setManualStart(null);
      if (!flags?.essential) setCurrentRoute(null);
    });
    return () => { unsubscribe(); cancelRouting(); };
  }, [cancelRouting]);

  useEffect(() => {
    routeAbort.current?.abort(); activeRouteRequestId.current++;
    setRoutePreview(null); setManualStart(null); setRoutingNotice(null);
  }, [authUser?.uid, hasConsent]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {!showStartScreen && !currentRoute && <div style={{ position: 'absolute', top: 86, left: 12, right: 12, zIndex: 2101 }}>
        <button type="button" className="glass-pill" onClick={() => setShowManualStart(value => !value)}>{manualStart ? 'Manuellen Start ändern' : 'Start manuell festlegen'}</button>
        {showManualStart && <SearchInput placeholder="Start suchen oder lat,lng" onSelect={place => {
          setManualStart({ lat: place.lat, lng: place.lng, source: 'manual', accuracyM: null, observedAt: Date.now(), confirmed: true });
          setShowManualStart(false); setRoutingNotice(`Manueller Start: ${place.label}. Navigation benötigt später eine aktuelle GPS-Position.`);
        }} />}
      </div>}
      {routingNotice && !showStartScreen && <div role="status" className="glass-panel" style={{ position: 'absolute', top: 136, left: 12, right: 12, zIndex: 1800, padding: 12 }}>
        {routingNotice} <button type="button" aria-label="Routenhinweis schließen" onClick={() => setRoutingNotice(null)}>✕</button>
      </div>}
      {showStartScreen && (
        <StartScreen
          onGenerateToday={handleGenerateTodayRoute}
          onStartSimpleRoute={handleStartSimpleRoute}
          onOpenAdvancedRoute={() => setShowAdvancedRoutePlanner(true)}
          onOpenSettings={() => setMainMenuOpen(true)}
          onOpenLogin={() => setShowAuthModal(true)}
          currentUser={authUser}
        />
      )}
      {showAdvancedRoutePlanner && (
        <AdvancedRoutePlanner
          onClose={() => { setShowAdvancedRoutePlanner(false); setShowStartScreen(true); }}
          onGenerate={handleAdvancedRoute}
        />
      )}

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
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            className="btn-cyberpunk btn-icon-ghost"
            onClick={() => setMainMenuOpen(true)}
            style={{ padding: '8px', borderRadius: '50%' }}
          >
            <Menu size={20} />
          </button>
        </div>

        {/* Search Input — Nominatim geocoding */}
        <div
          style={{ flex: 1 }}
          onClick={() => setSearchActive(true)}
          onFocus={() => setSearchActive(true)}
        >
          {!currentRoute ? (
            <SearchInput
              placeholder="Ziel eingeben..."
              focusRequest={searchFocusRequest}
              onSelect={(result) => {
                setSearchDestination(result);
                setSearchActive(false);
              }}
            />
          ) : (
            <div
              className="glass-panel"
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 12px',
                backgroundColor: 'rgba(24, 24, 24, 0.6)',
                cursor: 'default',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                ▼ Track / Route anzeigen
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            className="btn-cyberpunk btn-icon-ghost"
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
        onOpenBle={() => setShowBoschModal(true)}
        isBleConnected={telemetry.isConnected}
      />

      {!isBottomCardOpen && <BottomActionBar
        isNavigating={!!currentRoute}
        onOpenScanner={() => setShowScannerModal(true)}
        onOpenVoice={() => setShowVoiceSettingsModal(true)}
        onOpenSearch={() => { setSearchActive(true); setSearchFocusRequest((request) => request + 1); }}
      />}

      {/* Integrated E-Bike Telemetry & Bluetooth Pairing Widget */}
      {!isBottomCardOpen && <div
        style={{
          position: 'absolute',
          bottom: '88px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1900,
        }}
      >
        <BatteryHUD
          telemetry={telemetry}
          currentRoute={currentRoute}
          onConnectBLE={handleConnectBLE}
          onOpenBoschModal={() => setShowBoschModal(true)}
        />
      </div>}

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
        onPlanRouteToPoint={async (lat, lng, mode) => {
          const planned = await handlePlanRouteToPoint(lat, lng, mode);
          if (planned) setSearchDestination(null);
        }}
        onPlanRouteToStation={handlePlanRouteToStation}
        isSimulating={isSimulatingRoute}
        onToggleSimulation={() => setIsSimulatingRoute(!isSimulatingRoute)}
        onOpenScanner={() => setShowScannerModal(true)}
        onCardOpenChange={setIsBottomCardOpen}
        selectedDestination={searchDestination}
      />


      {/* Lazy Modals with Suspense */}
      <Suspense fallback={null}>
        {showAuthModal && (
          <AuthModal
            isOpen={showAuthModal}
            onClose={() => setShowAuthModal(false)}
          />
        )}
        {showAnticipationModal && routePreview && (
          <AnticipationModal
            route={routePreview}
            onAcceptRoute={(route) => {
              if (!isValidatedRoute(route.validatedRoute)) return;
              setCurrentRoute(route);
              setRoutePreview(null);
              setShowAnticipationModal(false);
            }}
            onRegenerate={handleRegenerateRoute}
            onClose={() => { routeAbort.current?.abort(); setRoutePreview(null); setShowAnticipationModal(false); }}
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
            onTokenBalanceRefresh={handleTokenBalanceRefresh}
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
