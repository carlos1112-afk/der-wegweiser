import React, { useState, useEffect } from 'react';
import { Circle, Pause, Play, Square } from 'lucide-react';
import { GpxRecorderService } from '../../services/gpxRecorderService';
import { SoundFxService } from '../../services/soundFxService';
import type { LiveBikeTelemetry } from '../../types/navigation';

interface GpxRecorderHUDProps {
  userLocation: { lat: number; lng: number };
  telemetry: LiveBikeTelemetry;
  onFinishRide: () => void;
}

export const GpxRecorderHUD: React.FC<GpxRecorderHUDProps> = ({
  userLocation,
  telemetry,
  onFinishRide,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);

  // Periodic ticker & telemetry feeder
  useEffect(() => {
    const interval = setInterval(() => {
      const status = GpxRecorderService.getStatus();
      setIsRecording(status.isRecording);
      setIsPaused(status.isPaused);
      setElapsedSeconds(status.elapsedSeconds);
      setDistanceKm(status.distanceKm);

      if (status.isRecording) {
        GpxRecorderService.addPoint(userLocation, telemetry);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [userLocation, telemetry]);

  const handleStart = () => {
    SoundFxService.playTurnChime();
    GpxRecorderService.startRecording(telemetry.batteryPercent);
    setIsRecording(true);
    setIsPaused(false);
  };

  const handleTogglePause = () => {
    SoundFxService.playClick();
    const paused = GpxRecorderService.togglePause();
    setIsPaused(paused);
  };

  const handleStop = () => {
    SoundFxService.playSuccessChime();
    onFinishRide();
  };

  const formatTime = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!isRecording) {
    return (
      <button
        onClick={handleStart}
        className="btn-cyberpunk glass-panel"
        style={{
          padding: '8px 14px',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          borderColor: 'rgba(255, 50, 50, 0.4)',
        }}
        title="GPX Track-Aufzeichnung mit voller Telemetrie starten"
      >
        <Circle size={14} fill="#ff3333" color="#ff3333" />
        <span>REC Tour</span>
      </button>
    );
  }

  return (
    <div
      className="glass-panel"
      style={{
        padding: '6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid #ff3333',
        boxShadow: '0 0 15px rgba(255, 50, 50, 0.35)',
        backgroundColor: 'rgba(25, 10, 15, 0.9)',
        borderRadius: '9999px',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Blinking REC Dot & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <Circle
          size={12}
          fill="#ff3333"
          color="#ff3333"
          style={{
            animation: isPaused ? 'none' : 'micPulse 1.2s infinite ease-in-out',
            opacity: isPaused ? 0.5 : 1,
          }}
        />
        <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: isPaused ? 'var(--accent-gold)' : '#ff3333' }}>
          {isPaused ? 'PAUSE' : 'REC'}
        </span>
      </div>

      {/* Timer & Distance */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold', color: '#ffffff' }}>
        <span>{formatTime(elapsedSeconds)}</span>
        <span style={{ color: 'var(--accent-cyan)', fontSize: '0.75rem' }}>{distanceKm} km</span>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={handleTogglePause}
          style={{
            background: 'none',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title={isPaused ? 'Fortsetzen' : 'Pausieren'}
        >
          {isPaused ? <Play size={16} color="var(--accent-neon-green)" /> : <Pause size={16} color="var(--accent-gold)" />}
        </button>

        <button
          onClick={handleStop}
          style={{
            background: 'none',
            border: 'none',
            color: '#ff3333',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
          }}
          title="Aufzeichnung stoppen & GPX speichern"
        >
          <Square size={15} fill="#ff3333" color="#ff3333" />
        </button>
      </div>
    </div>
  );
};
