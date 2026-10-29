import React, { useState, useEffect, useRef } from 'react';
import { Circle, Pause, Play, Square } from 'lucide-react';
import { routeArchive, type ArchivedRide } from '../../services/routeArchiveService';
import { ConsentService } from '../../services/consentService';
import { GpxRecorderService, type RideSummary } from '../../services/gpxRecorderService';
import { SoundFxService } from '../../services/soundFxService';
import type { LiveBikeTelemetry, Route } from '../../types/navigation';

interface GpxRecorderHUDProps {
  userLocation: { lat: number; lng: number; accuracyM?: number | null; observedAt?: number | null };
  ownerId: string;
  route: Route | null;
  isSimulating?: boolean;
  telemetry: LiveBikeTelemetry;
  onFinishRide: (summary: RideSummary) => void;
}

export const GpxRecorderHUD: React.FC<GpxRecorderHUDProps> = ({
  userLocation,
  telemetry,
  onFinishRide, ownerId, route, isSimulating = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const starting = useRef(false), mounted = useRef(true);
  const ride = useRef<ArchivedRide | null>(null), pendingFinish = useRef<RideSummary | null>(null);
  const lastAutoRoute = useRef<Route | null>(null);
  const live = useRef({ userLocation, telemetry, isSimulating }); live.current = { userLocation, telemetry, isSimulating };

  const handleStart = async () => {
    if (starting.current || GpxRecorderService.getStatus().isRecording || pendingFinish.current) return;
    if (isSimulating) { setError('Demo-Fahrten werden nicht als echte Fahrten gespeichert.'); return; }
    if (routeArchive.hasPending(ownerId)) { setError('Bitte zuerst die offene Archiv-Sicherung abschließen.'); return; }
    starting.current = true; setBusy(true); setError(null);
    try {
      const created = await routeArchive.beginRide(ownerId, route);
      if (!mounted.current || !ConsentService.allowsEssential) return;
      ride.current = created;
      GpxRecorderService.startRecording(telemetry.batteryPercent);
      setIsRecording(true); setIsPaused(false); SoundFxService.playTurnChime();
    } catch (error: any) { if (mounted.current) setError(error?.message ?? 'Aufzeichnung konnte nicht gesichert gestartet werden.'); }
    finally { starting.current = false; if (mounted.current) setBusy(false); }
  };
  const startCurrent = useRef(handleStart); startCurrent.current = handleStart;
  useEffect(() => {
    if (route && route !== lastAutoRoute.current && !isSimulating) {
      lastAutoRoute.current = route; void startCurrent.current();
    }
  }, [route, ownerId, isSimulating]);

  useEffect(() => {
    mounted.current = true;
    let lastCheckpointAt = 0, lastPositionTime: number | null = null;
    const interval = setInterval(() => {
      const status = GpxRecorderService.getStatus();
      setIsRecording(status.isRecording); setIsPaused(status.isPaused);
      setElapsedSeconds(ride.current ? Math.max(0, Math.round((Date.now() - Date.parse(ride.current.startedAt)) / 1000)) : status.elapsedSeconds); setDistanceKm(status.distanceKm);
      const current = live.current, position = current.userLocation;
      if (status.isRecording && !current.isSimulating && position.observedAt != null && position.observedAt !== lastPositionTime
        && Date.now() >= position.observedAt && Date.now() - position.observedAt <= 10000 && position.accuracyM != null && position.accuracyM >= 0 && position.accuracyM <= 30
        && Number.isFinite(position.lat) && Number.isFinite(position.lng) && Math.abs(position.lat) <= 90 && Math.abs(position.lng) <= 180) {
        lastPositionTime = position.observedAt; GpxRecorderService.addPoint(position, current.telemetry);
        if (ride.current && (lastCheckpointAt === 0 || Date.now() - lastCheckpointAt >= 5000)) { lastCheckpointAt = Date.now(); void routeArchive.saveRide(ride.current, { ...GpxRecorderService.getSummary(), durationSeconds: Math.max(0, Math.round((Date.now() - Date.parse(ride.current.startedAt)) / 1000)) }, false)
          .catch((error: any) => { if (mounted.current) setError(error?.message ?? 'Zwischensicherung fehlgeschlagen.'); }); }
      }
    }, 1000);
    return () => {
      mounted.current = false; clearInterval(interval);
      if (ride.current) {
        if (ConsentService.allowsEssential) void routeArchive.saveRide(ride.current, pendingFinish.current ?? GpxRecorderService.getSummary(), !!pendingFinish.current).catch(() => { /* Retained in the archive retry queue. */ });
        GpxRecorderService.reset();
      }
    };
  }, []);

  const handleTogglePause = () => {
    SoundFxService.playClick();
    const paused = GpxRecorderService.togglePause();
    setIsPaused(paused);
  };

  const handleStop = async () => {
    if (!ride.current || busy) return;
    setBusy(true); setError(null);
    const summary = pendingFinish.current ?? { ...GpxRecorderService.stopRecording(), durationSeconds: Math.max(0, Math.round((Date.now() - Date.parse(ride.current.startedAt)) / 1000)) }; pendingFinish.current = summary;
    setIsRecording(false);
    try {
      await routeArchive.saveRide(ride.current, summary, true);
      ride.current = null; pendingFinish.current = null;
      if (mounted.current) { SoundFxService.playSuccessChime(); onFinishRide(summary); }
    } catch (error: any) { if (mounted.current) setError(error?.message ?? 'Fahrt noch nicht gesichert. Bitte Sicherung wiederholen.'); }
    finally { if (mounted.current) setBusy(false); }
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
      <div><button
        disabled={busy || !!pendingFinish.current}
        onClick={() => void handleStart()}
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
        <span>{busy ? 'Speichern …' : 'REC Tour'}</span>
      </button>
      {error && <p role="alert">{error}</p>}
      {pendingFinish.current && <button type="button" disabled={busy} onClick={() => void handleStop()}>Fahrt-Sicherung wiederholen</button>}
      </div>
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
      {error && <span role="alert">{error}</span>}
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
          disabled={busy}
          onClick={() => void handleStop()}
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
