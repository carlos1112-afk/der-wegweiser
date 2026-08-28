import React, { useState, useEffect } from 'react';
import { Mountain, TrendingUp } from 'lucide-react';
import type { Route } from '../../types/navigation';
import { ElevationService } from '../../services/elevationService';

interface ElevationRibbonProps {
  currentRoute: Route | null;
  userLocation: { lat: number; lng: number };
}

export const ElevationRibbon: React.FC<ElevationRibbonProps> = ({ currentRoute, userLocation }) => {
  const [elevationProfile, setElevationProfile] = useState<{ distanceKm: number; elevationM: number; slopePercent: number }[]>([]);
  const [currentElevation, setCurrentElevation] = useState<number>(45);
  const [maxElevation, setMaxElevation] = useState<number>(85);
  const [currentSlope, setCurrentSlope] = useState<number>(1.5);

  useEffect(() => {
    if (!currentRoute || !currentRoute.pathCoordinates || currentRoute.pathCoordinates.length < 2) {
      setElevationProfile([]);
      return;
    }

    const loadElevation = async () => {
      // Sample 25 points along route
      const coords = currentRoute.pathCoordinates;
      const step = Math.max(1, Math.floor(coords.length / 25));
      const sampledCoords: [number, number][] = [];
      for (let i = 0; i < coords.length; i += step) {
        sampledCoords.push(coords[i]);
      }
      if (sampledCoords[sampledCoords.length - 1] !== coords[coords.length - 1]) {
        sampledCoords.push(coords[coords.length - 1]);
      }

      const rawElevations: number[] = await ElevationService.getElevations(sampledCoords);
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
      setMaxElevation(Math.round(maxElev));
      if (profile.length > 0) {
        setCurrentElevation(profile[0].elevationM);
        setCurrentSlope(profile[0].slopePercent);
      }
    };

    loadElevation();
  }, [currentRoute, userLocation]);

  if (!currentRoute || elevationProfile.length === 0) {
    return null;
  }

  // SVG dimensions
  const width = 360;
  const height = 48;
  const minElev = Math.min(...elevationProfile.map((p) => p.elevationM)) - 5;
  const maxElev = Math.max(...elevationProfile.map((p) => p.elevationM), minElev + 20) + 5;
  const elevRange = maxElev - minElev || 1;

  const points = elevationProfile.map((p, idx) => {
    const x = (idx / (elevationProfile.length - 1)) * width;
    const y = height - ((p.elevationM - minElev) / elevRange) * (height - 8) - 4;
    return `${x},${y}`;
  });

  const polylineStr = points.join(' ');
  const areaStr = `${points[0]} ${polylineStr} ${width},${height} 0,${height}`;

  return (
    <div
      className="glass-panel"
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '20px',
        zIndex: 1000,
        padding: '10px 14px',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        backgroundColor: 'rgba(10, 18, 30, 0.82)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-glass)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        width: '380px',
        maxWidth: 'calc(100vw - 120px)',
      }}
    >
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: 'bold' }}>
          <Mountain size={14} />
          <span>Höhenprofil</span>
          <span style={{ color: '#ffffff' }}>{currentElevation} m ü. NN</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            <TrendingUp size={12} color={currentSlope > 5 ? 'var(--accent-pink)' : 'var(--accent-neon-green)'} />
            {currentSlope > 0 ? `+${currentSlope}%` : `${currentSlope}%`}
          </span>
          <span>Max: {maxElevation} m</span>
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <defs>
            <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area under curve */}
          <polygon points={areaStr} fill="url(#elevationGrad)" />

          {/* Elevation Stroke line */}
          <polyline
            fill="none"
            stroke="var(--accent-cyan)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylineStr}
          />

          {/* Current rider marker on curve */}
          <circle cx="12" cy={points[0].split(',')[1]} r="4" fill="var(--accent-neon-green)" stroke="#ffffff" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
};
