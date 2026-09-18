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

export function useGeolocation(enableHighAccuracy: boolean = true) {
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
    let watchCallbackId: string | null = null;
    let webWatchId: number | null = null;
    let isCancelled = false;

    setState((s) => ({ ...s, isTracking: true }));

    const startCapacitorTracking = async () => {
      try {
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          await Geolocation.requestPermissions();
        }

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
              setState({
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy,
                speed: position.coords.speed,
                heading: position.coords.heading,
                error: null,
                isTracking: true,
              });
            }
          }
        );
      } catch (nativeErr) {
        console.warn('[useGeolocation] Falling back to Web Geolocation API:', nativeErr);
        if ('geolocation' in navigator) {
          webWatchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (isCancelled) return;
              setState({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                speed: pos.coords.speed,
                heading: pos.coords.heading,
                error: null,
                isTracking: true,
              });
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
        }
      }
    };

    startCapacitorTracking();

    return () => {
      isCancelled = true;
      if (watchCallbackId) {
        Geolocation.clearWatch({ id: watchCallbackId }).catch(() => {});
      }
      if (webWatchId !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(webWatchId);
      }
      setState((s) => ({ ...s, isTracking: false }));
    };
  }, [enableHighAccuracy]);

  return state;
}
