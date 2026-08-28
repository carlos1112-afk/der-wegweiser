import { useEffect, useState } from 'react';
import { Wind, Thermometer, Sun, CloudRain, AlertTriangle } from 'lucide-react';
import { WeatherService, type WeatherData } from '../../services/weatherService';

interface WeatherHUDProps {
  userLocation: { lat: number; lng: number };
}

export const WeatherHUD: React.FC<WeatherHUDProps> = ({ userLocation }) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);

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
    <div
      className="glass-panel"
      style={{
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        fontSize: '0.85rem',
      }}
    >
      {/* Condition Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {weather.weatherCondition === 'rain' ? (
          <CloudRain size={18} className="glow-text-cyan" />
        ) : (
          <Sun size={18} style={{ color: '#ffb700' }} />
        )}
        <span style={{ fontWeight: 'bold' }}>{weather.weatherDescription}</span>
      </div>

      {/* Temperature */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
        <Thermometer size={14} />
        <span style={{ color: '#fff', fontWeight: 'bold' }}>{weather.temperatureC}°C</span>
      </div>

      {/* Wind */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
        <Wind size={14} />
        <span style={{ color: '#fff', fontWeight: 'bold' }}>
          {weather.windSpeedKmH} km/h ({weather.windDirectionCompass})
        </span>
      </div>

      {/* Headwind Battery Penalty Warning */}
      {weather.batteryPenaltyPercent > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            color: 'var(--accent-gold)',
            backgroundColor: 'rgba(255, 183, 0, 0.15)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '0.75rem',
          }}
        >
          <AlertTriangle size={12} />
          <span>+{weather.batteryPenaltyPercent}% Akku-Korrektur (Wind)</span>
        </div>
      )}
    </div>
  );
};
