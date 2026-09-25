import React, { useState } from 'react';
import { Mic, Volume2, Camera } from 'lucide-react';
import { VoiceGuidanceService } from '../../services/voiceGuidanceService';
import { AiGatewayService } from '../../services/ai/aiGatewayService';
import type { LiveBikeTelemetry, Route } from '../../types/navigation';

interface FloatingMicButtonProps {
  telemetry: LiveBikeTelemetry;
  currentRoute: Route | null;
  onOpenScanner: () => void;
  onOpenLounge: () => void;
  onToggleOled: () => void;
  onRegenerateTour: () => void;
  isHidden?: boolean;
}

export const FloatingMicButton: React.FC<FloatingMicButtonProps> = ({
  telemetry,
  currentRoute,
  onOpenScanner,
  onOpenLounge,
  onToggleOled,
  onRegenerateTour,
  isHidden,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [lastResponse, setLastResponse] = useState<string | null>(null);

  if (isHidden && !currentRoute) return null;

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Web Speech Recognition ist im Android-WebView und in WKWebView nicht
      // verfügbar — dieser Zweig ist auf den Zielplattformen der einzige, der
      // ausgeführt wird. Früher wurde hier eine frei erfundene Antwort
      // ausgegeben ("nächste Ladesäule 1,4 km"), die keine Datengrundlage hat
      // und in einer Navigationsapp zu Fehlentscheidungen führen kann.
      // Stattdessen werden ausschließlich tatsächlich gemessene Werte genannt.
      console.warn('[VoiceAssistant] Web Speech Recognition nicht verfügbar — Sprachsteuerung deaktiviert.');
      setIsListening(false);
      setLastResponse('Sprachsteuerung ist auf diesem Gerät nicht verfügbar. Nutze die Antworten der Lade-Lounge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'de-DE';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        console.log('[VoiceAssistant] Recognized:', transcript);
        processVoiceCommand(transcript);
        setIsListening(false);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceAssistant] Error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      console.warn('[VoiceAssistant] Speech Recognition could not start:', e);
      setIsListening(false);
    }
  };

  const processVoiceCommand = (cmd: string) => {
    if (cmd.includes('akku') || cmd.includes('reichweite') || cmd.includes('batterie')) {
      const msg = `Dein Akku ist zu ${telemetry.batteryPercent} Prozent geladen. Motorleistung beträgt aktuell ${telemetry.motorPowerWatts || 0} Watt.`;
      setLastResponse(msg);
      VoiceGuidanceService.speak(msg);
    } else if (cmd.includes('lade') || cmd.includes('station') || cmd.includes('stecker')) {
      const msg = 'Ich öffne den Ladesäulen-Scanner für dich.';
      setLastResponse(msg);
      VoiceGuidanceService.speak(msg);
      onOpenScanner();
    } else if (cmd.includes('oled') || cmd.includes('sparmodus') || cmd.includes('schwarz')) {
      const msg = 'OLED-Akku-Sparmodus wird umgeschaltet.';
      setLastResponse(msg);
      VoiceGuidanceService.speak(msg);
      onToggleOled();
    } else if (cmd.includes('pause') || cmd.includes('lounge') || cmd.includes('spiel')) {
      const msg = 'Willkommen in der Lade-Lounge! Sammle jetzt In-App Tokens.';
      setLastResponse(msg);
      VoiceGuidanceService.speak(msg);
      onOpenLounge();
    } else if (cmd.includes('neue route') || cmd.includes('tour') || cmd.includes('umleitung')) {
      const msg = 'Berechne alternative Tour für dich...';
      setLastResponse(msg);
      VoiceGuidanceService.speak(msg);
      onRegenerateTour();
    } else {
      AiGatewayService.voiceDialogue({
        userQuery: cmd,
        batteryPercent: telemetry.batteryPercent,
        speedKmH: telemetry.speedKmH,
      }).then((reply) => {
        setLastResponse(reply);
        VoiceGuidanceService.speak(reply);
      }).catch(() => {
        const msg = `Ich habe verstanden: "${cmd}". Alles im Blick.`;
        setLastResponse(msg);
        VoiceGuidanceService.speak(msg);
      });
    }
  };

  return (
    <div
      className="floating-mic-wrapper"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '16px',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Speech Response Toast */}
      {lastResponse && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            bottom: currentRoute ? '124px' : '64px',
            right: '0',
            width: '260px',
            maxWidth: 'calc(100vw - 70px)',
            padding: '10px 12px',
            borderRadius: '14px',
            backgroundColor: 'rgba(10, 20, 35, 0.94)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            fontSize: '0.8rem',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <Volume2 size={16} className="glow-text-cyan" />
          <div style={{ flex: 1 }}>{lastResponse}</div>
          <span
            onClick={() => setLastResponse(null)}
            style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}
          >
            ✕
          </span>
        </div>
      )}

      {/* Round Säulen-Fotografier-Button: Exactly same size as mic, stacked above mic during navigation */}
      {currentRoute && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenScanner();
          }}
          className="btn-cyberpunk btn-gold floating-scanner-btn"
          title="Ladesäule scannen / Foto hochladen"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(12px)',
            border: '2px solid var(--accent-gold)',
            boxShadow: 'var(--glow-gold)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'all 0.3s ease',
          }}
        >
          <Camera size={22} className="glow-text-gold" />
        </button>
      )}

      {/* Main Glowing Floating Mic Button */}
      <button
        onClick={startListening}
        className={`floating-mic-button ${isListening ? 'listening-pulse' : ''}`}
        title="Sprachassistent aktivieren (Hands-free Co-Pilot)"
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: isListening ? 'var(--accent-pink)' : 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(12px)',
          border: isListening ? '2px solid var(--accent-pink)' : '2px solid var(--accent-cyan)',
          boxShadow: isListening ? '0 0 25px var(--accent-pink)' : 'var(--glow-cyan)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#ffffff',
          position: 'relative',
          padding: 0,
          transition: 'all 0.3s ease',
        }}
      >
        {isListening ? (
          <div className="waveform-container">
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
            <span className="wave-bar" />
          </div>
        ) : (
          <Mic size={22} className="glow-text-cyan" />
        )}
      </button>
    </div>
  );
};
