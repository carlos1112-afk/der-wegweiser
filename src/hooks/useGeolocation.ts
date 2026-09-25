import { useState, useEffect } from 'react';
import { Geolocation } from '@capacitor/geolocation';

interface GeolocationState {
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  error: string | null;
  isTracking: boolean;
}

const DEFAULT_LOCATION = { lat: 52.52, lng: 13.405 }; // Berlin Alexanderplatz

/**
 * @param enableHighAccuracy Hochgenaue Ortung (Navigationsmodus)
 * @param enabled            false = keine Ortung, keine OS-Berechtigungsabfrage.
 *                           Steuert die Einwilligung (Art. 6 DSGVO).
 */
export function useGeolocation(enableHighAccuracy: boolean = true, enabled: boolean = true) {
  const [state, setState] = useState<GeolocationState>({
    lat: DEFAULT_LOCATION.lat,
    lng: DEFAULT_LOCATION.lng,
    accuracy: null,
    speed: null,
    heading: null,
    error: null,
    isTracking: false,
  });

  useEffect(() => {
    // Ohne Einwilligung wird weder die Berechtigung abgefragt noch der
    // Standortwatch gestartet.
    if (!enabled) {
      setState((s) => (s.isTracking ? { ...s, isTracking: false } : s));
      return;
    }

    let watchCallbackId: string | null = null;
    let webWatchId: number | null = null;
    let isCancelled = false;

    setState((s) => ({ ...s, isTracking: true }));

    const applyPosition = (lat: number, lng: number, accuracy: number | null, speed: number | null, heading: number | null) => {
      if (isCancelled) return;
      setState({
        lat,
        lng,
        accuracy,
        speed,
        heading,
        error: null,
        isTracking: true,
      });
    };

    const startCapacitorTracking = async () => {
      try {
        const permission = await Geolocation.checkPermissions();
        if (isCancelled) return;
        if (permission.location !== 'granted') {
          await Geolocation.requestPermissions();
          // Erneute Prüfung nach der Abfrage: der Nutzer kann ablehnen.
          const after = await Geolocation.checkPermissions();
          if (after.location !== 'granted') {
            if (isCancelled) return;
            setState((s) => ({ ...s, isTracking: false, error: 'Standortberechtigung nicht erteilt.' }));
            return;
          }
        }
        if (isCancelled) return;

        watchCallbackId = await Geolocation.watchPosition(
          {
            enableHighAccuracy,
            timeout: enableHighAccuracy ? 10000 : 25000,
            maximumAge: enableHighAccuracy ? 0 : 30000,
          },
          (position, err) => {
            if (isCancelled) return;
            if (err) {
              console.warn('[useGeolocation] Native GPS warning:', err);
              return;
            }
            if (position && position.coords) {
              applyPosition(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                position.coords.speed,
                position.coords.heading
              );
            }
          }
        );

        // Race-Condition-Fix: Wurde die Komponente während der asynchronen
        // watchPosition-Auflösung unmounted, wurde der Watch bereits bereinigt,
        // bevor die ID vorlag. Der Watch würde sonst bis zum Prozessende
        // weiterlaufen (Dauerentladung während der Fahrt).
        if (isCancelled && watchCallbackId) {
          Geolocation.clearWatch({ id: watchCallbackId }).catch(() => {});
          watchCallbackId = null;
        }
      } catch (nativeErr) {
        if (isCancelled) return;
        console.warn('[useGeolocation] Falling back to Web Geolocation API:', nativeErr);
        if ('geolocation' in navigator) {
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              applyPosition(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy, pos.coords.speed, pos.coords.heading);
            },
            (err) => {
              if (isCancelled) return;
              setState((s) => ({ ...s, error: err.message }));
            },
            {
              enableHighAccuracy,
              timeout: enableHighAccuracy ? 10000 : 25000,
              maximumAge: enableHighAccuracy ? 0 : 30000,
            }
          );

          if (isCancelled && webWatchId !== null) {
            navigator.geolocation.clearWatch(webWatchId);
            webWatchId = null;
          }
        }
      }
    };

    startCapacitorTracking();

    return () => {
      isCancelled = true;
      if (watchCallbackId) {
        Geolocation.clearWatch({ id: watchCallbackId }).catch(() => {});
        watchCallbackId = null;
      }
      if (webWatchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(webWatchId);
        webWatchId = null;
      }
      setState((s) => ({ ...s, isTracking: false }));
    };
  }, [enableHighAccuracy, enabled]);

  return state;
}
