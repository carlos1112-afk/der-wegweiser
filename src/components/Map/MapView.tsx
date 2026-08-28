import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import type { Route, ChargingStation } from '../../types/navigation';
import { Compass, Box } from 'lucide-react';

interface MapViewProps {
  userLocation: { lat: number; lng: number };
  accuracy?: number | null;
  heading?: number | null;
  currentRoute: Route | null;
  chargingStations: ChargingStation[];
  onSelectStation: (station: ChargingStation) => void;
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
  const arrowHtml = heading !== null && heading !== undefined
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

  // 1. Explicit waypoints from route
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

  // 2. Start waypoint fallback if pathCoordinates exists
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

  // 3. Finish/End waypoint fallback if pathCoordinates exists
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

  // 4. Charging stops on route
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

// Component to dynamically re-center map when location/route updates
const MapRecenter: React.FC<{ center: [number, number]; bounds?: [number, number][] }> = ({ center, bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [50, 50] });
    } else {
      map.setView(center, 14);
    }
  }, [center, bounds, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({
  userLocation,
  accuracy,
  heading,
  currentRoute,
  chargingStations,
  onSelectStation,
}) => {
  const mapRef = useRef<L.Map | null>(null);
  const [is3DMode, setIs3DMode] = useState(false);
  const center: [number, number] = [userLocation.lat, userLocation.lng];
  const routePolyline = currentRoute?.pathCoordinates || [];
  const routeWaypoints = getRouteWaypoints(currentRoute);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <div className={`map-perspective-wrapper ${is3DMode ? 'map-3d-perspective' : ''}`}>
        <MapContainer
          center={center}
          zoom={14}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          ref={mapRef}
        >
          {/* Dark CartoDB Matter Tile Layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          <MapRecenter center={center} bounds={routePolyline.length > 0 ? routePolyline : undefined} />

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
                className: 'pulse-circle-animation'
              }}
            />
          )}

          {/* User GPS Marker */}
          <Marker position={center} icon={createUserIcon(heading)}>
            <Popup>
              <div style={{ color: '#000', fontWeight: 'bold' }}>Dein Standort (GPS Active)</div>
            </Popup>
          </Marker>

          {/* Route Polyline with Cyberpunk Glow */}
          {routePolyline.length > 0 && (
            <Polyline
              positions={routePolyline}
              pathOptions={{
                color: '#00f0ff',
                weight: 6,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
                className: 'cyberpunk-polyline-pulse',
              }}
            />
          )}

          {/* Waypoints along route */}
          {routeWaypoints.map((wp) => (
            <Marker
              key={wp.id}
              position={[wp.lat, wp.lng]}
              icon={createCustomWaypointIcon(wp.category, wp.category === 'start' ? '🏁' : wp.category === 'end' ? '🎯' : undefined)}
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
                click: () => onSelectStation(station),
              }}
            >
              <Popup>
                <div style={{ color: '#000', padding: '4px' }}>
                  <strong>{station.name}</strong>
                  <p style={{ fontSize: '0.8rem', margin: '4px 0' }}>Stecker: {station.plugType.toUpperCase()}</p>
                  <button
                    onClick={() => onSelectStation(station)}
                    style={{
                      backgroundColor: '#00f0ff',
                      color: '#000',
                      border: 'none',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Details & Stopp
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Floating HUD Controls */}
      <div
        style={{
          position: 'absolute',
          bottom: '24px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '12px',
        }}
      >
        {/* 3D Cockpit Toggle Button */}
        <button
          className="btn-cyberpunk glass-panel"
          onClick={() => setIs3DMode(!is3DMode)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            padding: '10px 16px',
            borderRadius: '12px',
            boxShadow: is3DMode ? 'var(--glow-cyan)' : 'none',
            borderColor: is3DMode ? 'var(--accent-cyan)' : 'rgba(0, 240, 255, 0.3)',
          }}
          title="3D Cyberpunk Perspektive umschalten"
        >
          <Box size={20} className="glow-text-cyan" />
          <span>{is3DMode ? '2D Karte' : '3D Cockpit'}</span>
        </button>

        {/* Standort Zentrieren / Compass Button */}
        <button
          className="glass-panel"
          onClick={() => {
            if (mapRef.current) {
              mapRef.current.flyTo(center, 16, { animate: true, duration: 1.5 });
            }
          }}
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            border: '1px solid var(--accent-cyan)',
            pointerEvents: 'auto',
          }}
          title="Standort zentrieren"
        >
          <Compass size={24} />
        </button>
      </div>
    </div>
  );
};

