import React, { useState, useEffect } from 'react';
import { Mountain, TrendingUp, ChevronDown, ChevronUp, Zap, Battery } from 'lucide-react';
import type { Route, LiveBikeTelemetry } from '../../types/navigation';
import { ElevationService } from '../../services/elevationService';

interface ElevationRibbonProps {
  currentRoute: Route | null;
  userLocation: { lat: number; lng: number };
  telemetry?: LiveBikeTelemetry;
  isNavigating?: boolean;
}

export const ElevationRibbon: React.FC<ElevationRibbonProps> = ({
  currentRoute,
  userLocation,
  telemetry,
  isNavigating,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [elevationProfile, setElevationProfile] = useState<
    { distanceKm: number; elevationM: number; slopePercent: number }[]
  >([]);
  const [currentElevation, setCurrentElevation] = useState<number>(385);
  const [maxElevation, setMaxElevation] = useState<number>(420);
  const [currentSlope, setCurrentSlope] = useState<number>(1.2);

  // Load elevation data for planned route or live GPS location
  useEffect(() => {
    let isMounted = true;

    const loadElevation = async () => {
      if (currentRoute && currentRoute.pathCoordinates && currentRoute.pathCoordinates.length >= 2) {
        // Sample 25 points along planned route
        const coords = currentRoute.pathCoordinates;
        const step = Math.max(1, Math.floor(coords.length / 25));
        const sampledCoords: [number, number][] = [];
        for (let i = 0; i < coords.length; i += step) {
          sampledCoords.push(coords[i]);
        }
        if (sampledCoords[sampledCoords.length - 1] !== coords[coords.length - 1]) {
          sampledCoords.push(coords[coords.length - 1]);
        }

        try {
          const rawElevations: number[] = await ElevationService.getElevations(sampledCoords);
          if (!isMounted) return;

          const totalDist = currentRoute.distanceKm;
          const stepDist = totalDist / Math.max(1, rawElevations.length - 1);

          let maxElev = 0;
          const profile = rawElevations.map((elev: number, idx: number) => {
            if (elev > maxElev) maxElev = elev;
            const prevElev = idx > 0 ? rawElevations[idx - 1] : elev;
            const distDeltaM = stepDist * 1000;
            const slope = distDeltaM > 0 ? +(((elev - prevElev) / distDeltaM) * 100).toFixed(1) : 0;
            return {
              distanceKm: +(idx * stepDist).toFixed(1),
              elevationM: Math.round(elev),
              slopePercent: slope,
            };
          });

          setElevationProfile(profile);
          setMaxElevation(Math.max(Math.round(maxElev), currentRoute.elevationGainM || 100));
          if (profile.length > 0) {
            setCurrentElevation(profile[0].elevationM);
            setCurrentSlope(profile[0].slopePercent);
          }
        } catch (err) {
          console.warn('[ElevationRibbon] Route elevation error:', err);
        }
      } else if (userLocation.lat && userLocation.lng) {
        // Free-riding mode: fetch single point terrain elevation
        try {
          const singleElev = await ElevationService.getElevations([[userLocation.lat, userLocation.lng]]);
          if (!isMounted) return;

          if (singleElev && singleElev.length > 0) {
            const altM = Math.round(singleElev[0]);
            setCurrentElevation(altM);
            setMaxElevation((prev) => Math.max(prev, altM));
          }
        } catch {
          // Fallback static altitude indicator
        }
      }
    };

    loadElevation();
    return () => {
      isMounted = false;
    };
  }, [currentRoute, userLocation.lat, userLocation.lng]);

  const width = 320;
  const height = 40;
  const hasProfile = elevationProfile.length > 1;

  // Compute profile coordinates if route profile available
  const minElev = hasProfile ? Math.min(...elevationProfile.map((p) => p.elevationM)) - 5 : 300;
  const maxElev = hasProfile ? Math.max(...elevationProfile.map((p) => p.elevationM), minElev + 20) + 5 : 500;
  const elevRange = maxElev - minElev || 1;

  const points = hasProfile
    ? elevationProfile.map((p, idx) => {
        const x = (idx / (elevationProfile.length - 1)) * width;
        const y = height - ((p.elevationM - minElev) / elevRange) * (height - 8) - 4;
        return `${x},${y}`;
      })
    : [];

  const polylineStr = points.join(' ');
  const areaStr = hasProfile ? `${points[0]} ${polylineStr} ${width},${height} 0,${height}` : '';

  return (
    <div
      className="glass-panel elevation-ribbon-wrapper"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: '20px',
        left: '16px',
        zIndex: 1000,
        padding: isCollapsed ? '6px 12px' : '10px 14px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: 'rgba(22, 26, 32, 0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1.5px solid var(--accent-cyan)',
        boxShadow: 'var(--glow-cyan)',
        width: isCollapsed ? 'auto' : '300px',
        maxWidth: 'calc(100vw - 110px)',
        transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mountain size={15} className="glow-text-cyan" />
          <span style={{ fontSize: '0.88rem', fontWeight: '800', color: '#ffffff' }}>
            {currentElevation} m
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ü.NN</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              color: currentSlope > 4 ? 'var(--accent-gold)' : 'var(--accent-neon-green)',
            }}
          >
            <TrendingUp size={13} />
            <span>{currentSlope >= 0 ? `+${currentSlope}%` : `${currentSlope}%`} Anstieg</span>
          </div>

          <button
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: '2px',
            }}
            title={isCollapsed ? 'Höhenprofil ausklappen' : 'Höhenprofil einklappen'}
          >
            {isCollapsed ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details & Profile Chart */}
      {!isCollapsed && (
        <>
          {/* E-Bike & Ride Stats Header */}
          <div
            style={{
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              paddingTop: '4px',
              borderTop: '1px solid rgba(0, 230, 163, 0.18)',
            }}
          >
            <span>
              Höchstpunkt: <strong style={{ color: '#fff' }}>{maxElevation} m</strong>
            </span>
            {telemetry?.isConnected && typeof telemetry.batteryPercent === 'number' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-neon-green)' }}>
                <Battery size={12} /> {telemetry.batteryPercent}%
                {telemetry.motorPowerWatts !== undefined && (
                  <span style={{ color: 'var(--accent-cyan)', marginLeft: '4px' }}>
                    <Zap size={11} /> {telemetry.motorPowerWatts}W
                  </span>
                )}
              </span>
            )}
          </div>

          {/* SVG Route Profile Chart */}
          {hasProfile ? (
            <div style={{ position: 'relative', width: '100%', height: '38px', marginTop: '2px' }}>
              <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                <polygon points={areaStr} fill="url(#elevationGrad)" />
                <polyline
                  fill="none"
                  stroke="var(--accent-cyan)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={polylineStr}
                />
                <circle
                  cx="12"
                  cy={points[0] ? points[0].split(',')[1] : height / 2}
                  r="4"
                  fill="var(--accent-neon-green)"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.7rem',
                color: 'var(--text-muted)',
                fontStyle: 'italic',
                textAlign: 'center',
                padding: '4px 0',
              }}
            >
              Route planen für detaillierte Höhenprofil-Analyse
            </div>
          )}
        </>
      )}
    </div>
  );
};
