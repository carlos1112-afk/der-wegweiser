import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import type { Route, ChargingStation } from '../../types/navigation';
import { Compass, Box, Layers, Plus, Minus, Crosshair, MapPin, Zap, X, Play, Pause } from 'lucide-react';
import { TurnByTurnBanner } from './TurnByTurnBanner';
import { ElevationRibbon } from './ElevationRibbon';
import { useRouteTracker } from '../../hooks/useRouteTracker';

export type MapTileTheme = 'dark' | 'cycle' | 'topo' | 'satellite';

interface MapViewProps {
  userLocation: { lat: number; lng: number };
  accuracy?: number | null;
  heading?: number | null;
  currentRoute: Route | null;
  chargingStations: ChargingStation[];
  onSelectStation?: (station: ChargingStation) => void;
  onAutoReroute?: () => void;
  onOpenReviewModal?: (station: ChargingStation) => void;
  onPlanRouteToPoint?: (lat: number, lng: number) => void;
  onPlanRouteToStation?: (station: ChargingStation) => void;
  isSimulating?: boolean;
  onToggleSimulation?: () => void;
  onCardOpenChange?: (open: boolean) => void;
  telemetry?: any;
}

const TILE_SERVERS: Record<MapTileTheme, { name: string; url: string; attribution: string; maxZoom: number; className?: string }> = {
  dark: {
    name: 'Cyberpunk Dark',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, Humanitarian Team',
    maxZoom: 19,
    className: 'cyberpunk-dark-tiles',
  },
  cycle: {
    name: 'CyclOSM (Fahrrad & Trails)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, CyclOSM',
    maxZoom: 18,
    className: 'cyclosm-tiles',
  },
  topo: {
    name: 'OpenTopoMap (Höhenlinien)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM',
    maxZoom: 17,
  },
  satellite: {
    name: 'Satellit / Luftbild',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri &mdash; World Imagery',
    maxZoom: 19,
    className: 'satellite-tiles',
  },
};

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

// Custom Leaflet Icons using glowing cyberpunk CSS classes
const createCustomWaypointIcon = (category: string, label?: string) => {
  let markerClass = 'marker-scenic';
  let iconHtml = label || '📍';

  switch (category) {
    case 'start':
      markerClass = 'marker-start';
      iconHtml = label || '🏁';
      break;
    case 'end':
      markerClass = 'marker-end';
      iconHtml = label || '🎯';
      break;
    case 'target':
      markerClass = 'marker-end';
      iconHtml = '🎯';
      break;
    case 'charging':
      markerClass = 'marker-charging';
      iconHtml = '⚡';
      break;
    case 'gastronomy':
      markerClass = 'marker-gastro';
      iconHtml = '🍽️';
      break;
    case 'scenic':
      markerClass = 'marker-scenic';
      iconHtml = '📸';
      break;
    default:
      markerClass = 'marker-charging';
      iconHtml = '📍';
  }

  return L.divIcon({
    className: 'custom-waypoint-marker-container',
    html: `<div class="cyberpunk-marker-pin ${markerClass}">${iconHtml}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const createUserIcon = (heading?: number | null) => {
  const rotation = heading !== null && heading !== undefined ? `transform: rotate(${heading}deg);` : '';
  const arrowHtml =
    heading !== null && heading !== undefined
      ? `<div style="position: absolute; top: -10px; left: 5px; width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 10px solid var(--accent-cyan); ${rotation} transform-origin: 5px 20px;"></div>`
      : '';

  return L.divIcon({
    className: 'user-location-wrapper',
    html: `<div class="user-location-marker" style="position: relative;">${arrowHtml}</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const chargingStationIcon = L.divIcon({
  className: 'custom-leaflet-marker',
  html: `<div class="cyberpunk-marker-pin marker-charging">⚡</div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

// Helper to derive waypoints to render
const getRouteWaypoints = (route: Route | null) => {
  if (!route) return [];

  const waypoints: {
    id: string;
    lat: number;
    lng: number;
    title: string;
    category: string;
    description?: string;
  }[] = [];

  const existingCategories = new Set<string>();

  if (route.waypoints && route.waypoints.length > 0) {
    route.waypoints.forEach((wp) => {
      const category = wp.category || 'scenic';
      waypoints.push({
        id: wp.id || `wp-${wp.lat}-${wp.lng}`,
        lat: wp.lat,
        lng: wp.lng,
        title: wp.name || (category === 'start' ? 'Start' : category === 'end' ? 'Ziel' : 'Wegpunkt'),
        category,
        description: wp.description,
      });
      existingCategories.add(category);
    });
  }

  if (!existingCategories.has('start') && route.pathCoordinates && route.pathCoordinates.length > 0) {
    waypoints.push({
      id: 'route-start-point',
      lat: route.pathCoordinates[0][0],
      lng: route.pathCoordinates[0][1],
      title: 'Startpunkt',
      category: 'start',
      description: 'Start der geplanten Route',
    });
  }

  if (!existingCategories.has('end') && route.pathCoordinates && route.pathCoordinates.length > 1) {
    const lastCoord = route.pathCoordinates[route.pathCoordinates.length - 1];
    waypoints.push({
      id: 'route-end-point',
      lat: lastCoord[0],
      lng: lastCoord[1],
      title: 'Zielort',
      category: 'end',
      description: 'Ziel der geplanten Route',
    });
  }

  if (route.chargingStopsOnRoute && route.chargingStopsOnRoute.length > 0) {
    route.chargingStopsOnRoute.forEach((station) => {
      const alreadyPresent = waypoints.some(
        (wp) => Math.abs(wp.lat - station.lat) < 0.0001 && Math.abs(wp.lng - station.lng) < 0.0001
      );
      if (!alreadyPresent) {
        waypoints.push({
          id: `route-charge-${station.id}`,
          lat: station.lat,
          lng: station.lng,
          title: station.name,
          category: 'charging',
          description: `Lade-Stopp (${station.plugType.toUpperCase()})`,
        });
      }
    });
  }

  return waypoints;
};

// Component to dynamically re-center map when location/route updates without overriding user zoom
const MapRecenter: React.FC<{
  center: [number, number];
  bounds?: [number, number][];
  isCourseUp?: boolean;
  heading?: number | null;
  isAutoFollow?: boolean;
  onUserInteraction?: () => void;
}> = ({ center, bounds, isCourseUp, isAutoFollow = true, onUserInteraction }) => {
  const map = useMap();
  const fittedBoundsKeyRef = useRef<string | null>(null);

  // Pause auto-follow if user manually drags or zooms the map
  useMapEvents({
    dragstart() {
      if (onUserInteraction) onUserInteraction();
    },
    zoomstart() {
      if (onUserInteraction) onUserInteraction();
    },
  });

  // Fit bounds ONLY ONCE when a new route is set
  useEffect(() => {
    if (bounds && bounds.length > 0 && !isCourseUp) {
      const boundsKey = JSON.stringify(bounds.slice(0, 3));
      if (fittedBoundsKeyRef.current !== boundsKey) {
        map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
        fittedBoundsKeyRef.current = boundsKey;
      }
    } else {
      fittedBoundsKeyRef.current = null;
    }
  }, [bounds, map, isCourseUp]);

  // Recenter map during GPS updates ONLY if auto-follow is active, preserving user's zoom!
  useEffect(() => {
    if (!isAutoFollow) return;
    map.panTo(center, { animate: true, duration: 0.5 });
  }, [center, isAutoFollow, map]);

  return null;
};

// Map Click and Resize Handler
const MapEventHandler: React.FC<{
  onMapClick: (lat: number, lng: number) => void;
}> = ({ onMapClick }) => {
  const map = useMap();

  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);

  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  userLocation,
  accuracy,
  heading,
  currentRoute,
  chargingStations,
  onSelectStation,
  onAutoReroute,
  onOpenReviewModal,
  onPlanRouteToPoint,
  onPlanRouteToStation,
  isSimulating,
  onToggleSimulation,
  onCardOpenChange,
  telemetry,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const [isCourseUp, setIsCourseUp] = useState(false);
  const [isAutoFollow, setIsAutoFollow] = useState(true);
  const [tileTheme, setTileTheme] = useState<MapTileTheme>('dark');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [selectedDestination, setSelectedDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedStationState, setSelectedStationState] = useState<ChargingStation | null>(null);

  const isCardOpen = Boolean(selectedDestination || selectedStationState);

  useEffect(() => {
    if (onCardOpenChange) {
      onCardOpenChange(isCardOpen);
    }
  }, [isCardOpen, onCardOpenChange]);

  const center: [number, number] = [userLocation.lat, userLocation.lng];
  const routePolyline = currentRoute?.pathCoordinates || [];
  const routeWaypoints = getRouteWaypoints(currentRoute);

  // Turn-by-turn tracking & Off-route auto reroute
  const { currentManeuver, isOffRoute, offRouteDistanceM } = useRouteTracker(
    userLocation,
    currentRoute,
    () => {
      if (onAutoReroute) {
        onAutoReroute();
      }
    }
  );

  const currentHeadingDeg = heading !== null && heading !== undefined ? heading : 0;
  const rotationAngle = isCourseUp ? -currentHeadingDeg : 0;

  const handleMapClick = (lat: number, lng: number) => {
    setSelectedStationState(null);
    setSelectedDestination({ lat, lng });
  };

  const handleStationClick = (station: ChargingStation) => {
    setSelectedDestination(null);
    setSelectedStationState(station);
    if (onSelectStation) {
      onSelectStation(station);
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const handleRecenter = () => {
    setIsAutoFollow(true);
    if (mapRef.current) {
      mapRef.current.flyTo(center, 16, { animate: true, duration: 1.0 });
    }
    if (isCourseUp) {
      setIsCourseUp(false);
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Turn-by-Turn Head-Up Navigation Banner */}
      <TurnByTurnBanner
        maneuver={currentManeuver}
        isOffRoute={isOffRoute}
        offRouteDistanceM={offRouteDistanceM}
        onManualReroute={onAutoReroute}
      />

      {/* Map Container with Course-Up Rotation & 3D Perspective */}
      <div
        className={`map-perspective-wrapper ${is3DMode ? 'map-3d-perspective' : ''}`}
        style={{
          transform: is3DMode
            ? `perspective(900px) rotateX(55deg) rotate(${rotationAngle}deg) scale(1.15)`
            : isCourseUp
            ? `rotate(${rotationAngle}deg) scale(1.05)`
            : 'none',
          transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
        }}
      >
        <MapContainer
          center={center}
          zoom={15}
          zoomControl={false}
          style={{ width: '100%', height: '100%', backgroundColor: '#090d16' }}
          ref={mapRef}
        >
          {/* Tile Layer (Theme Switcher) */}
          <TileLayer
            key={tileTheme}
            attribution={TILE_SERVERS[tileTheme].attribution}
            url={TILE_SERVERS[tileTheme].url}
            maxZoom={TILE_SERVERS[tileTheme].maxZoom}
          />

          <MapRecenter
            center={center}
            bounds={routePolyline.length > 0 ? routePolyline : undefined}
            isCourseUp={isCourseUp}
            heading={heading}
            isAutoFollow={isAutoFollow}
            onUserInteraction={() => setIsAutoFollow(false)}
          />

          <MapEventHandler onMapClick={handleMapClick} />

          {/* Accuracy Circle */}
          {accuracy && (
            <Circle
              center={center}
              radius={accuracy}
              pathOptions={{
                color: '#00f0ff',
                weight: 1,
                fillColor: '#00f0ff',
                fillOpacity: 0.15,
                className: 'pulse-circle-animation',
              }}
            />
          )}

          {/* User GPS Marker */}
          <Marker position={center} icon={createUserIcon(isCourseUp ? 0 : heading)}>
            <Popup>
              <div style={{ color: '#000', fontWeight: 'bold' }}>Dein Standort (GPS Aktiv)</div>
            </Popup>
          </Marker>

          {/* User Selected Destination Marker (Click-to-Route) */}
          {selectedDestination && (
            <Marker
              position={[selectedDestination.lat, selectedDestination.lng]}
              icon={createCustomWaypointIcon('target', '🎯')}
            >
              <Popup>
                <div style={{ color: '#000', fontWeight: 'bold' }}>Gewählter Zielort</div>
              </Popup>
            </Marker>
          )}

          {/* Dynamic Slope-Colored Route Segments */}
          {routePolyline.length > 1 && (
            <>
              {/* Base Glowing Underlay */}
              <Polyline
                positions={routePolyline}
                pathOptions={{
                  color: '#00f0ff',
                  weight: 8,
                  opacity: 0.4,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />

              {/* Segmented Slope Overlays */}
              {routePolyline.map((pt, idx) => {
                if (idx >= routePolyline.length - 1) return null;
                const nextPt = routePolyline[idx + 1];
                const progress = idx / routePolyline.length;
                const isClimb =
                  (progress > 0.35 && progress < 0.5) ||
                  (currentRoute && currentRoute.elevationGainM > 180 && idx % 7 === 2);
                const isDownhill = (progress > 0.75 && progress < 0.9) || idx % 7 === 5;
                const segmentColor = isClimb ? '#ff3333' : isDownhill ? '#00ff66' : '#00f0ff';

                return (
                  <Polyline
                    key={`seg-${idx}`}
                    positions={[pt, nextPt]}
                    pathOptions={{
                      color: segmentColor,
                      weight: isClimb ? 6 : 5,
                      opacity: 0.95,
                      lineCap: 'round',
                    }}
                  />
                );
              })}
            </>
          )}

          {/* Waypoints along route */}
          {routeWaypoints.map((wp) => (
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={createCustomWaypointIcon(
                wp.category,
                wp.category === 'start' ? '🏁' : wp.category === 'end' ? '🎯' : undefined
              )}
            >
              <Popup>
                <div style={{ color: '#000', padding: '4px' }}>
                  <strong>{wp.title}</strong>
                  {wp.description && <p style={{ fontSize: '0.8rem', margin: '4px 0' }}>{wp.description}</p>}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Charging Station Markers */}
          {chargingStations.map((station) => (
            <Marker
              key={station.id}
              position={[station.lat, station.lng]}
              icon={chargingStationIcon}
              eventHandlers={{
                click: () => handleStationClick(station),
              }}
            />
          ))}
        </MapContainer>
      </div>

      {/* Elevation Mini-Ribbon (hidden when interactive action card is active) */}
      {!selectedDestination && !selectedStationState && (
        <ElevationRibbon
          currentRoute={currentRoute}
          userLocation={userLocation}
          telemetry={telemetry}
          isNavigating={Boolean(currentRoute)}
        />
      )}

      {/* ── Interactive Destination Action Card ─────────────────────────── */}
      {selectedDestination && (
        <div
          className="glass-panel action-bottom-card"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '12px',
            right: '12px',
            maxWidth: '520px',
            margin: '0 auto',
            zIndex: 2200,
            padding: '12px 16px',
            borderRadius: '16px',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            backgroundColor: 'rgba(5, 10, 20, 0.96)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'rgba(0, 240, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <MapPin size={18} className="glow-text-cyan" />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                Neues Ziel gewählt
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ~{calculateDistanceKm(userLocation.lat, userLocation.lng, selectedDestination.lat, selectedDestination.lng).toFixed(1)} km Luftlinie
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              className="btn-cyberpunk btn-gold"
              onClick={(e) => {
                e.stopPropagation();
                if (onPlanRouteToPoint) {
                  onPlanRouteToPoint(selectedDestination.lat, selectedDestination.lng);
                }
                setSelectedDestination(null);
              }}
              style={{ padding: '6px 12px', fontSize: '0.75rem', fontWeight: 'bold' }}
            >
              Route planen
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDestination(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Interactive Charging Station Action Card ─────────────────────────── */}
      {selectedStationState && (
        <div
          className="glass-panel action-bottom-card"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '12px',
            right: '12px',
            maxWidth: '520px',
            margin: '0 auto',
            zIndex: 2200,
            padding: '12px 16px',
            borderRadius: '16px',
            border: '1px solid var(--accent-gold)',
            boxShadow: 'var(--glow-gold)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(5, 10, 20, 0.96)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 183, 0, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Zap size={18} className="glow-text-gold" />
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {selectedStationState.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {selectedStationState.plugType.toUpperCase()} · ~{calculateDistanceKm(userLocation.lat, userLocation.lng, selectedStationState.lat, selectedStationState.lng).toFixed(1)} km
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStationState(null);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
            <button
              className="btn-cyberpunk btn-gold"
              onClick={(e) => {
                e.stopPropagation();
                if (onPlanRouteToStation) {
                  onPlanRouteToStation(selectedStationState);
                }
                setSelectedStationState(null);
              }}
              style={{ flex: 1, padding: '7px 12px', fontSize: '0.75rem', fontWeight: 'bold' }}
            >
              Hierher navigieren
            </button>
            {onOpenReviewModal && (
              <button
                className="btn-cyberpunk"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenReviewModal(selectedStationState);
                  setSelectedStationState(null);
                }}
                style={{ padding: '7px 12px', fontSize: '0.75rem' }}
                title="Bewertung abgeben (+10 Tokens)"
              >
                ⭐ Bewerten
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating HUD Controls (Right Edge) */}
      <div
        className={`floating-controls-right ${isCardOpen ? 'card-open' : ''}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          bottom: isCardOpen ? '106px' : '20px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          transition: 'bottom 0.25s ease',
        }}
      >
        {/* Layer Selector Popup Menu */}
        {showLayerMenu && (
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              bottom: '130px',
              right: '48px',
              padding: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              minWidth: '190px',
              backgroundColor: 'rgba(10, 18, 30, 0.98)',
              border: '1px solid var(--accent-cyan)',
              boxShadow: 'var(--glow-cyan)',
              zIndex: 2500,
            }}
          >
            {(Object.keys(TILE_SERVERS) as MapTileTheme[]).map((themeKey) => (
              <button
                key={themeKey}
                onClick={() => {
                  setTileTheme(themeKey);
                  setShowLayerMenu(false);
                }}
                className={`btn-cyberpunk ${tileTheme === themeKey ? 'btn-gold' : ''}`}
                style={{ fontSize: '0.75rem', padding: '6px 10px', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>{TILE_SERVERS[themeKey].name}</span>
                {tileTheme === themeKey && <span style={{ color: 'var(--accent-gold)' }}>✓</span>}
              </button>
            ))}
          </div>
        )}

        {/* GPS Simulation Toggle Button */}
        {onToggleSimulation && (
          <button
            className="glass-panel"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSimulation();
            }}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isSimulating ? 'var(--accent-neon-green)' : 'var(--accent-cyan)',
              cursor: 'pointer',
              border: `1px solid ${isSimulating ? 'var(--accent-neon-green)' : 'rgba(0, 240, 255, 0.4)'}`,
              boxShadow: isSimulating ? 'var(--glow-neon-green)' : '0 0 10px rgba(0, 240, 255, 0.2)',
            }}
            title={isSimulating ? 'GPS-Simulation pausieren' : 'GPS-Simulation starten (Demo-Fahrt)'}
          >
            {isSimulating ? <Pause size={16} className="glow-text-green" /> : <Play size={16} />}
          </button>
        )}

        {/* Zoom In/Out Grouped Pill */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid rgba(0, 240, 255, 0.35)',
            boxShadow: '0 0 10px rgba(0, 240, 255, 0.15)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomIn();
            }}
            style={{
              width: '36px',
              height: '32px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
            }}
            title="Vergrößern (Zoom In)"
          >
            <Plus size={16} />
          </button>
          <div style={{ height: '1px', backgroundColor: 'rgba(0, 240, 255, 0.25)' }} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleZoomOut();
            }}
            style={{
              width: '36px',
              height: '32px',
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)',
              cursor: 'pointer',
            }}
            title="Verkleinern (Zoom Out)"
          >
            <Minus size={16} />
          </button>
        </div>

        {/* Recenter GPS Button */}
        <button
          className="glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
          }}
          title="Auf aktuellen GPS-Standort zentrieren"
        >
          <Crosshair size={17} />
        </button>

        {/* Layer Selector Button */}
        <button
          className="glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            setShowLayerMenu(!showLayerMenu);
          }}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            boxShadow: showLayerMenu ? 'var(--glow-cyan)' : 'none',
          }}
          title="Karten-Ebene wechseln"
        >
          <Layers size={16} />
        </button>

        {/* 3D Cockpit Toggle Button */}
        <button
          className="glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            setIs3DMode(!is3DMode);
          }}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            border: '1px solid rgba(0, 240, 255, 0.4)',
            boxShadow: is3DMode ? 'var(--glow-cyan)' : 'none',
          }}
          title="3D Cyberpunk Perspektive umschalten"
        >
          <Box size={16} />
        </button>

        {/* Course-Up / Dynamic Compass Button */}
        <button
          className="glass-panel"
          onClick={(e) => {
            e.stopPropagation();
            setIsCourseUp(!isCourseUp);
          }}
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)',
            cursor: 'pointer',
            border: `1px solid ${isCourseUp ? 'var(--accent-neon-green)' : 'var(--accent-cyan)'}`,
            boxShadow: isCourseUp ? 'var(--glow-neon-green)' : '0 0 12px rgba(0, 240, 255, 0.25)',
          }}
          title={isCourseUp ? 'Auf Norden fixieren (North-Up)' : 'In Fahrtrichtung rotieren (Course-Up)'}
        >
          <Compass
            size={18}
            style={{
              transform: isCourseUp ? `rotate(${currentHeadingDeg}deg)` : 'none',
              transition: 'transform 0.3s ease',
            }}
          />
        </button>
      </div>
    </div>
  );
};
