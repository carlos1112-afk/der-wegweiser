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
        {/* Left: Brand, Beenden button during Nav, or OAuth Auth Pill during Planning */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <div className="glass-panel header-brand-pill" style={{ padding: '5px 7px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Navigation size={15} className="glow-text-cyan" />
            <span style={{ fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '0.3px' }} className="brand-text glow-text-cyan">
              WEGWEISER
            </span>
          </div>

          {currentRoute ? (
            <>
              {/* Clean Route Cancel / Beenden Button */}
              <button
                className="btn-cyberpunk btn-gold"
                onClick={() => {
                  setCurrentRoute(null);
                  setIsSimulatingRoute(false);
                }}
                style={{
                  padding: '5px 7px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
                title="Navigation beenden"
              >
                <X size={12} /> Beenden
              </button>

              {/* Auto-Hiding Push to E-Bike Badge (First 3 Min + Manual Close X) */}
              {!isPushDismissed && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    padding: '2px 5px',
                    borderRadius: '14px',
                    backgroundColor: 'rgba(10, 16, 28, 0.92)',
                    backdropFilter: 'blur(12px)',
                    border: '1.2px solid var(--accent-gold)',
                    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  {ebikePushMessage ? (
                    <span style={{ fontSize: '0.68rem', color: 'var(--accent-gold)', fontWeight: 'bold', padding: '0 3px' }}>
                      {ebikePushMessage}
                    </span>
                  ) : (
                    <>
                      <button
                        className="btn-cyberpunk btn-gold"
                        onClick={handlePushToEBikeNav}
                        style={{
                          padding: '2px 5px',
                          fontSize: '0.68rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          borderRadius: '10px',
                        }}
                        title="Route an verbundenes E-Bike Display senden"
                      >
                        <Send size={11} /> Push
                      </button>
                      <button
                        onClick={() => setIsPushDismissed(true)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-gold)',
                          cursor: 'pointer',
                          padding: '1px 2px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Ausblenden"
                      >
                        <X size={11} />
                      </button>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
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
          )}
        </div>

        {/* Right: Telemetry, Weather & Token (Tokens only in non-nav) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
          <BatteryHUD
            telemetry={telemetry}
            currentRoute={currentRoute}
            onConnectBLE={handleConnectBLE}
            onOpenBoschModal={() => setShowBoschModal(true)}
          />
          {/* Wetter-Abfrage übermittelt den exakten Standort an Open-Meteo
              und benötigt daher die Analytics-Einwilligung. */}
          {hasConsent && ConsentService.allowsAnalytics && <WeatherHUD userLocation={userLocation} />}
          {!currentRoute && (
            <div className="glass-pill glow-text-gold hud-token-pill" style={{ padding: '5px 7px', fontWeight: 'bold', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span>🪙</span>
              <span>{tokenBalance}</span>
            </div>
          )}
        </div>
      </div>

      {/* Relocated Fahrt-Modus Icon on the LEFT side (Elevated round icon button) */}
      {currentRoute && (
        <button
          className="btn-cyberpunk btn-cyan"
          onClick={() => {
            const nextMode = lifecycle.currentMode === 'ride' ? 'charge' : 'ride';
            AppLifecycleService.setMode(nextMode);
          }}
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '16px',
            zIndex: 1800,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '2px solid var(--accent-cyan)',
            color: 'var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            transition: 'all 0.3s ease',
          }}
          title={lifecycle.currentMode === 'ride' ? 'Fahrmodus aktiv (Klicken für Lademodus)' : 'Lademodus aktiv (Klicken für Fahrmodus)'}
        >
          {lifecycle.currentMode === 'ride' ? (
            <Zap size={22} className="glow-text-cyan" />
          ) : (
            <BatteryCharging size={22} className="glow-text-gold" />
          )}
        </button>
      )}

      {/* Quick Action Strip below Header (Planning Mode ONLY, Hidden during Active Navigation) */}
      {!currentRoute && (
        <div
          className="quick-actions-bar"
          style={{
            position: 'absolute',
            top: '52px',
            left: '12px',
            right: '12px',
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
