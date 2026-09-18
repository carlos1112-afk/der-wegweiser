import { useEffect, useState } from 'react';
import { Wind, Thermometer, Sun, CloudRain, AlertTriangle, CloudOff } from 'lucide-react';
import { WeatherService, type WeatherData } from '../../services/weatherService';

interface WeatherHUDProps {
  userLocation: { lat: number; lng: number };
}

export const WeatherHUD: React.FC<WeatherHUDProps> = ({ userLocation }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      const data = await WeatherService.getWeatherForLocation(userLocation.lat, userLocation.lng);
      setWeather(data);
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 300000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [userLocation]);

  if (!weather) return null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Compact Weather Pill */}
      <div
        className="glass-panel hud-weather-pill"
        onClick={() => setShowTooltip(!showTooltip)}
        style={{
          padding: '5px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          fontSize: '0.78rem',
          cursor: 'pointer',
        }}
        title="Wetter- und Winddaten anzeigen"
      >
        {weather.weatherStatus === 'unavailable' ? (
          <CloudOff size={15} style={{ color: 'var(--accent-gold)' }} />
        ) : weather.weatherCondition === 'rain' ? (
          <CloudRain size={15} className="glow-text-cyan" />
        ) : (
          <Sun size={15} style={{ color: '#ffb700' }} />
        )}

        {weather.temperatureC !== undefined && (
          <span style={{ color: '#fff', fontWeight: 'bold' }}>{weather.temperatureC}°</span>
        )}

        {weather.windSpeedKmH !== undefined && (
          <div className="mobile-hide-wind" style={{ display: 'flex', alignItems: 'center', gap: '2px', color: 'var(--accent-cyan)' }}>
            <Wind size={12} />
            <span style={{ fontSize: '0.72rem', fontWeight: 'bold' }}>{weather.windSpeedKmH}k</span>
          </div>
        )}

        {weather.batteryPenaltyPercent > 0 && (
          <AlertTriangle size={12} style={{ color: 'var(--accent-gold)' }} />
        )}
      </div>

      {/* Expanded Weather Tooltip Dropdown */}
      {showTooltip && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute',
            top: '120%',
            right: 0,
            zIndex: 2500,
            padding: '12px',
            minWidth: '220px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(10, 16, 28, 0.96)',
            border: '1px solid var(--accent-cyan)',
            boxShadow: 'var(--glow-cyan)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sun size={16} style={{ color: '#ffb700' }} />
            {weather.weatherDescription}
          </div>

          {weather.temperatureC !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Thermometer size={14} />
              <span>Temperatur: <strong style={{ color: '#fff' }}>{weather.temperatureC}°C</strong></span>
            </div>
          )}

          {weather.windSpeedKmH !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Wind size={14} />
              <span>Wind: <strong style={{ color: '#fff' }}>{weather.windSpeedKmH} km/h ({weather.windDirectionCompass || 'Wind'})</strong></span>
            </div>
          )}

          {weather.batteryPenaltyPercent > 0 && (
            <div
              style={{
                marginTop: '4px',
                padding: '6px',
                borderRadius: '6px',
                backgroundColor: 'rgba(255, 183, 0, 0.15)',
                border: '1px solid var(--accent-gold)',
                color: 'var(--accent-gold)',
                fontSize: '0.75rem',
                fontWeight: 'bold',
              }}
            >
              +{weather.batteryPenaltyPercent}% Akku-Reserve ({weather.weatherStatus === 'unavailable' ? 'Offline' : 'Gegenwind'})
            </div>
          )}
        </div>
      )}
    </div>
  );
};
