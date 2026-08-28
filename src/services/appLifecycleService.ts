export type AppMode = 'plan' | 'ride' | 'charge';

export interface ModuleLifecycleState {
  currentMode: AppMode;
  isAiEnabled: boolean;
  isHighAccuracyGps: boolean;
  isBleStreaming: boolean;
  isWakeLockActive: boolean;
  isLoungeModulesActive: boolean;
}

export class AppLifecycleService {
  private static currentMode: AppMode = 'plan';
  private static listeners: ((state: ModuleLifecycleState) => void)[] = [];

  public static getMode(): AppMode {
    return this.currentMode;
  }

  public static getLifecycleState(): ModuleLifecycleState {
    return {
      currentMode: this.currentMode,
      isAiEnabled: this.currentMode !== 'ride', // AI generation only when stationary / planning
      isHighAccuracyGps: this.currentMode === 'ride', // High accuracy GPS only while riding
      isBleStreaming: this.currentMode === 'ride', // BLE telemetry streaming active during ride
      isWakeLockActive: this.currentMode === 'ride', // Keep screen on only while navigating
      isLoungeModulesActive: this.currentMode === 'charge', // Lounge & Gamification active when charging
    };
  }

  public static setMode(newMode: AppMode): void {
    if (this.currentMode === newMode) return;
    this.currentMode = newMode;
    const state = this.getLifecycleState();
    this.listeners.forEach((listener) => listener(state));
  }

  public static subscribe(listener: (state: ModuleLifecycleState) => void): () => void {
    this.listeners.push(listener);
    listener(this.getLifecycleState());
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
