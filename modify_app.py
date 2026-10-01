import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# Add imports
imports = """
import { useUILayout } from './contexts/UILayoutContext';
import { BurgerMenu } from './components/Navigation/BurgerMenu';
import { BottomActionBar } from './components/Navigation/BottomActionBar';
import { ConfettiOverlay } from './components/Overlays/ConfettiOverlay';
import { Menu } from 'lucide-react';
"""

content = content.replace("import { Camera, Gamepad2", imports + "import { Camera, Gamepad2")

# Inject context hooks inside App component
hook_injection = """
export default function App() {
  const { isMainMenuOpen, setMainMenuOpen, isSearchActive, setSearchActive } = useUILayout();
"""
content = content.replace("export default function App() {", hook_injection)

# Now for the render part.
# We will use regex to find the start of the return statement and replace up to MapView.

render_pattern = re.compile(r'  return \(\n    <div style={{ width: \'100vw\'.*?\{/\* Main Fullscreen Map \*/\}', re.DOTALL)

new_render = """  return (
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

      {/* Main Fullscreen Map */}"""

content = render_pattern.sub(new_render, content)

with open('src/App.tsx', 'w') as f:
    f.write(content)

