import { useState, useEffect } from 'react';
import { MapView } from './components/Map/MapView';
import { BatteryHUD } from './components/BatteryHUD/BatteryHUD';
import { WeatherHUD } from './components/WeatherHUD/WeatherHUD';
import { AnticipationModal } from './components/AiAssistant/AnticipationModal';
import { ScannerModal } from './components/ChargingScanner/ScannerModal';
import { LoungeModal } from './components/ChargeAndEarn/LoungeModal';
import { AnalyticsModal } from './components/Analytics/AnalyticsModal';
import { OledBlackMode } from './components/DisplayModes/OledBlackMode';
import type { Route, ChargingStation, LiveBikeTelemetry, UserPreferences, UserMemoryPattern } from './types/navigation';
import { dataRepository } from './services/dataRepository';
import { AiAssistantService, DEFAULT_MODEL } from './services/aiAssistantService';
import type { ModelId } from './services/aiAssistantService';
import { BleService } from './services/bleService';
import { Camera, Gamepad2, Sparkles, Navigation, BarChart3, EyeOff } from 'lucide-react';
import { useGeolocation } from './hooks/useGeolocation';
import { useScreenWakeLock } from './hooks/useScreenWakeLock';

import { FloatingMicButton } from './components/AiAssistant/FloatingMicButton';

export function App() {
  const geo = useGeolocation();
  const userLocation = { lat: geo.lat, lng: geo.lng };
  const wakeLock = useScreenWakeLock();

  // State
  const [currentRoute, setCurrentRoute] = useState<Route | null>(null);
  const [chargingStations, setChargingStations] = useState<ChargingStation[]>([]);
  const [tokenBalance, setTokenBalance] = useState(60);
  const [isOledModeActive, setIsOledModeActive] = useState(false);
  const [telemetry, setTelemetry] = useState<LiveBikeTelemetry>({
    isConnected: false,
    batteryPercent: 85,
    speedKmH: 0,
    cadenceRpm: 0,
    riderPowerWatts: 0,
    motorAssistMode: 'auto',
  });

  // Modal States
  const [showAnticipationModal, setShowAnticipationModal] = useState(true);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showLoungeModal, setShowLoungeModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

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

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
      {/* OLED Black Saver Cockpit Overlay */}
      {isOledModeActive && (
        <OledBlackMode
          telemetry={telemetry}
          onExitOledMode={() => setIsOledModeActive(false)}
        />
      )}

      {/* Top Floating Glass Header HUD */}
      <div
        style={{
          position: 'absolute',
          top: '16px',
          left: '16px',
          right: '16px',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
        }}
      >
        {/* App Logo Badge */}
        <div className="glass-panel" style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Navigation size={22} className="glow-text-cyan" />
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', letterSpacing: '1px' }} className="glow-text-cyan">
            DER WEGWEISER
          </span>
        </div>

        {/* Battery & Telemetry HUD */}
        <BatteryHUD telemetry={telemetry} currentRoute={currentRoute} onConnectBLE={handleConnectBLE} />

        {/* Weather & Wind HUD */}
        <WeatherHUD userLocation={userLocation} />

        {/* Action Buttons HUD */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Token Balance */}
          <div className="glass-pill glow-text-gold" style={{ padding: '8px 16px', fontWeight: 'bold' }}>
            🪙 {tokenBalance} Tokens
          </div>

          {/* OLED Battery Saver Button */}
          <button className="btn-cyberpunk" onClick={handleToggleOledMode} title="OLED Beeline Spar-Modus">
            <EyeOff size={16} /> OLED Saver
          </button>

          {/* Analytics Button */}
          <button className="btn-cyberpunk" onClick={() => setShowAnalyticsModal(true)}>
            <BarChart3 size={16} /> Analytics & GPX
          </button>

          {/* Scanner Button */}
          <button className="btn-cyberpunk" onClick={() => setShowScannerModal(true)}>
            <Camera size={16} /> + Ladesäule
          </button>

          {/* Lounge Button */}
          <button className="btn-cyberpunk btn-gold" onClick={() => setShowLoungeModal(true)}>
            <Gamepad2 size={16} /> Lade-Lounge
          </button>

          {/* KI Heute-Tour Button */}
          <button className="btn-cyberpunk" onClick={() => setShowAnticipationModal(true)}>
            <Sparkles size={16} /> Heute-Tour
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

      {/* Modals */}
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
    </div>
  );
}

export default App;
