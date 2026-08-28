export type BikeType = 'ebike' | 'gravel' | 'city' | 'cargo' | 'racing';

export type SurfacePreference = 'asphalt' | 'gravel' | 'any' | 'forest';

export type PlugType = 'schuko_230v' | 'bosch' | 'bike_energy' | 'shimano' | 'yamaha' | 'unknown';

export interface Location {
  lat: number;
  lng: number;
  name?: string;
}

export interface Waypoint extends Location {
  id: string;
  elevation?: number; // meters
  description?: string;
  category?: 'start' | 'end' | 'charging' | 'scenic' | 'gastronomy' | 'repair';
}

export interface ChargingStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  plugType: PlugType;
  isWeatherproof: boolean;
  isFree: boolean;
  openingHours: string;
  nearbyAmenities: string[];
  photoUrl?: string;
  verifiedByCount: number;
  createdAt: string;
  createdByUserId: string;
  isVerifiedBikeInfrastructure: boolean;
}

export interface BikeRepairStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  hasAirPump: boolean;
  hasTools: boolean;
  hasTubeVending: boolean; // Schlauchautomat
}

export interface UserPreferences {
  userId: string;
  bikeType: BikeType;
  batteryCapacityWh: number; // e.g. 500 Wh
  batteryCurrentPercent: number; // e.g. 85 %
  preferredSurface: SurfacePreference;
  maxElevationSlopePercent: number; // e.g. 6 %
  favoriteThemes: string[]; // e.g. ['badesee', 'wald', 'panoramablick']
  avoidSteepHills: boolean;
  unlimitedDemandActive: boolean;
}

export interface UserMemoryPattern {
  frequentDestinations: string[]; // e.g. ['Badesee Biesdorf', 'Müggelsee']
  preferredDistanceKm: number; // e.g. 30
  avoidedGradientsCount: number;
  lastRideDate?: string;
  aiNotes: string[]; // e.g. "Bevorzugt flache Asphaltstrecken nachmittags"
}

export interface TokenAccount {
  userId: string;
  balance: number;
  lifetimeEarned: number;
  unlimitedOnDemand: boolean;
}

export interface Route {
  id: string;
  title: string;
  summary: string;
  aiStory: string;
  distanceKm: number;
  elevationGainM: number;
  estimatedTimeMin: number;
  estimatedBatteryConsumptionWh: number;
  isBatterySafe: boolean; // True if battery % is enough for elevation/distance
  surfaceBreakdown: {
    asphaltPercent: number;
    gravelPercent: number;
    unpavedPercent: number;
  };
  waypoints: Waypoint[];
  pathCoordinates: [number, number][]; // [lat, lng] array
  chargingStopsOnRoute: ChargingStation[];
  isScoutMission?: boolean;
  scoutBountyTokens?: number;
}

export type BikeManufacturer = 'bosch' | 'shimano' | 'specialized' | 'mahle' | 'fazua' | 'bafang' | 'generic';

export interface LiveBikeTelemetry {
  isConnected: boolean;
  deviceName?: string;
  manufacturer?: BikeManufacturer;
  batteryPercent: number;
  batteryWhRemaining?: number;
  batteryHealthPercent?: number; // SOH
  speedKmH: number;
  cadenceRpm: number;
  riderPowerWatts: number;
  motorPowerWatts?: number;
  motorTemperatureC?: number;
  currentGear?: number; // Di2 electronic shifting
  rangeRemainingKm?: number;
  motorAssistMode: 'eco' | 'tour' | 'auto' | 'turbo' | 'off';
}

export interface BoschDiagnosticProfile {
  isCloudSynced: boolean;
  batteryHealthPercent: number; // State of Health (SOH) e.g. 98%
  chargeCycles: number; // e.g. 42 cycles
  totalOdometerKm: number; // e.g. 1420 km
  driveUnitFirmware: string; // e.g. "v1.4.2 (Bosch Smart System)"
  displayType: 'Kiox 300' | 'Kiox 500' | 'Nyon' | 'SmartphoneGrip' | 'LED Remote';
}
