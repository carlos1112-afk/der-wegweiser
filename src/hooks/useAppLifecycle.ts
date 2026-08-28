import { useState, useEffect } from 'react';
import { AppLifecycleService, type ModuleLifecycleState, type AppMode } from '../services/appLifecycleService';

export function useAppLifecycle(activeModal: string | null, isNavigating: boolean, speedKmH: number) {
  const [lifecycle, setLifecycle] = useState<ModuleLifecycleState>(() => AppLifecycleService.getLifecycleState());

  useEffect(() => {
    // Determine target mode based on app state
    let targetMode: AppMode = 'plan';

    if (activeModal === 'lounge' || activeModal === 'scanner') {
      targetMode = 'charge';
    } else if (isNavigating || speedKmH > 3) {
      targetMode = 'ride';
    } else {
      targetMode = 'plan';
    }

    AppLifecycleService.setMode(targetMode);
  }, [activeModal, isNavigating, speedKmH]);

  useEffect(() => {
    const unsubscribe = AppLifecycleService.subscribe((state) => {
      setLifecycle(state);
    });
    return unsubscribe;
  }, []);

  return lifecycle;
}
