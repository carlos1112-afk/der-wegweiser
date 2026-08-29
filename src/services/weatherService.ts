export interface WeatherData {
  temperatureC?: number;
  windSpeedKmH?: number;
  windDirectionDeg?: number;
  windDirectionCompass?: string;
  isHeadwindRisk: boolean;
  weatherCondition: 'clear' | 'cloudy' | 'rain' | 'thunderstorm' | 'unknown';
  weatherDescription: string;
  batteryPenaltyPercent: number; // e.g. +12% Wh consumption due to headwind/cold OR +10% conservative safety reserve
  weatherStatus: 'live_station' | 'unavailable';
  rangeConfidence: 'high' | 'reduced_conservative';
}

export class WeatherService {
  /**
   * Fetches real-time weather and wind vector data for the given coordinates.
   * ZERO CLIENT SECRETS: Commercial API keys reside exclusively on the server backend.
   * Client calls backend proxy (/api/weather) or direct standard/custom endpoint.
   */
  public static async getWeatherForLocation(lat: number, lng: number): Promise<WeatherData> {
    const customEndpoint = import.meta.env.VITE_WEATHER_PROVIDER_URL;
    
    // Priority: Custom Endpoint -> Backend Weather Proxy -> Standard Direct Fallback
    const proxyUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/weather?latitude=${lat}&longitude=${lng}` : '';
    const directUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`;
    
    const urlToTry = customEndpoint ? `${customEndpoint}?latitude=${lat}&longitude=${lng}` : (proxyUrl || directUrl);

    try {
      let res = await fetch(urlToTry).catch(() => null);
      
      // If backend proxy is not deployed locally, gracefully fallback to direct public endpoint
      if (!res || !res.ok) {
        res = await fetch(directUrl);
      }

      if (res && res.ok) {
        const data = await res.json();
        const current = data.current_weather || (data.weather ? {
          temperature: data.weather.temperature,
          windspeed: data.weather.wind_speed,
          winddirection: data.weather.wind_direction,
          weathercode: data.weather.condition === 'rain' ? 61 : 0
        } : null);
        
        if (current && typeof current.temperature === 'number') {
          const temp = current.temperature;
          const windSpeed = current.windspeed || 0;
          const windDir = current.winddirection || 0;

          const compass = this.degreesToCompass(windDir);
          const isHeadwindRisk = windSpeed > 18;
          
          // Cold (< 10°C) or strong headwind (> 20 km/h) increases battery Wh penalty
          let penalty = 0;
          if (temp < 10) penalty += 10;
          if (windSpeed > 20) penalty += 12;

          return {
            temperatureC: Math.round(temp),
            windSpeedKmH: Math.round(windSpeed),
            windDirectionDeg: windDir,
            windDirectionCompass: compass,
            isHeadwindRisk,
            weatherCondition: current.weathercode > 50 ? 'rain' : 'clear',
            weatherDescription: current.weathercode > 50 ? 'Regenschauer' : 'Sonnig & Trocken',
            batteryPenaltyPercent: penalty,
            weatherStatus: 'live_station',
            rangeConfidence: 'high',
          };
        }
      }
    } catch (e) {
      console.warn('[WeatherService] Weather fetch failed, activating conservative safety fallback:', e);
    }

    // Conservative Safety Fallback: Transparently declare unavailable data and add reserve buffer
    return {
      isHeadwindRisk: false,
      weatherCondition: 'unknown',
      weatherDescription: '⚠️ Wetterdaten offline (+10% Sicherheitsreserve eingerechnet)',
      batteryPenaltyPercent: 10, // +10% conservative uncertainty reserve
      weatherStatus: 'unavailable',
      rangeConfidence: 'reduced_conservative',
    };
  }

  private static degreesToCompass(deg: number): string {
    const val = Math.floor((deg / 22.5) + 0.5);
    const arr = ["N", "NNO", "NO", "ONO", "O", "OSO", "SO", "SSO", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return arr[val % 16];
  }
}
