# 🚲 E-Bike & Display Communication Protocols — Developer Reference & Integration Guide

Dieses Referenzhandbuch dokumentiert die technischen Kommunikationsprotokolle, Bluetooth Low Energy (BLE) GATT-Strukturen, ANT+ LEV Standards und CAN-Bus Protokolle für die Anbindung moderner E-Bike Antriebe und Bordcomputer an die **Der Wegweiser** Plattform.

---

## 📑 Übersicht der Hersteller-Matrix

| Hersteller | Marktanteil EU | Primäre Schnittstelle | Offenheit / Lesezugriff | Schreibzugriff (Befehle) |
|---|---|---|---|---|
| **Bosch eBike Systems** (Smart System / BES3) | ~45-50% | BLE (LDI / MCSP Protobuf) & Cloud API | 🔒 Eingeschränkt (Pairing / Cloud OAuth2) | 🛡️ Nur via eBike Flow API |
| **Shimano STEPS** (EP8, EP801, EP6, Di2) | ~20-25% | D-Fly BLE / Di2 CAN Bus | 🔒 E-TUBE Passkey erforderlich | 🚫 Gesperrt (Anti-Tamper) |
| **Specialized Turbo** (MasterMind TCU, Levo) | ~8-10% | Custom BLE GATT + ANT+ LEV | 🟢 Frei mit Geräte-PIN (abgedruckt) | 🟢 Assist-Modes schreibbar |
| **Mahle SmartBike** (X35, X20, Pulsar ONE) | ~6-8% | ANT+ LEV & BLE GATT | 🟢 Offener Standard | 🟢 Assist-Stufen schaltbar |
| **Fazua** (Ride 50, Ride 60, Porsche) | ~4-6% | Standard Bluetooth SIG (0x1818, 0x1816) | 🟢 Vollständig offen (Plug & Play) | 🛠️ Toolbox Desktop |
| **Giant SyncDrive** (RideControl Ergo/Dash) | ~5-7% | BLE GATT (CAN Tunnelling) | 🟡 Just-Works BLE Pairing | 🟡 Modus-Wahl per BLE |
| **Brose Drive** (Drive S/Mag, Marquardt) | ~4-5% | CAN-Bus / BLE Protobuf | 🟡 Sniffing / BLE Pairing | 🚫 Nur Händler-Tool |
| **Yamaha Systems** (PW-X3, Display C) | ~4-6% | ANT+ LEV & BLE e-Sync | 🟢 ANT+ LEV Standard | 🚫 Gesperrt |
| **Bafang** (M400, M500, M600, Bafang Go) | ~5-7% | CAN-Bus (250 kbit/s) & BLE | 🟢 Vollständig offen & flashbar | 🟢 Parameter programmierbar |

---

## 1. Standard Bluetooth SIG Cycling Profile (Der universelle Web-Bluetooth Weg)

Für Systeme wie Fazua, Mahle (oder E-Bikes mit Garmin/Wahoo/SIG-kompatibler Sensorbrücke) verwendet **Der Wegweiser** native Browser Web Bluetooth APIs ohne externe native App.

### 1.1 Web Bluetooth Verbindungs- und Telemetrie-Handler
```typescript
import type { LiveBikeTelemetry } from '../types/navigation';

export async function connectStandardBluetoothCycling(): Promise<{
  device: BluetoothDevice;
  subscribe: (onUpdate: (data: Partial<LiveBikeTelemetry>) => void) => void;
}> {
  // 1. BLE Device Discovery
  const device = await navigator.bluetooth.requestDevice({
    filters: [
      { services: ['cycling_power'] },
      { services: ['cycling_speed_and_cadence'] },
      { services: ['battery_service'] },
    ],
    optionalServices: ['fitness_machine', 'device_information']
  });

  const server = await device.gatt?.connect();
  if (!server) throw new Error('GATT Server Verbindung fehlgeschlagen');

  console.log(`Verbunden mit E-Bike: ${device.name}`);

  const subscribe = async (onUpdate: (data: Partial<LiveBikeTelemetry>) => void) => {
    // 2. Battery Service (0x180F) -> Battery Level (0x2A19)
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const batteryChar = await batteryService.getCharacteristic('battery_level');
      await batteryChar.startNotifications();
      batteryChar.addEventListener('characteristicvaluechanged', (e: any) => {
        const value: DataView = e.target.value;
        const batteryPercent = value.getUint8(0);
        onUpdate({ batteryPercent });
      });
    } catch (err) {
      console.warn('Battery Service nicht verfügbar', err);
    }

    // 3. Cycling Power Service (0x1818) -> Power Measurement (0x2A63)
    try {
      const powerService = await server.getPrimaryService('cycling_power');
      const powerChar = await powerService.getCharacteristic('cycling_power_measurement');
      await powerChar.startNotifications();
      powerChar.addEventListener('characteristicvaluechanged', (e: any) => {
        const value: DataView = e.target.value;
        const flags = value.getUint16(0, true);
        const riderPowerWatts = value.getInt16(2, true);
        
        let cadenceRpm: number | undefined;
        // Bit 5 = Crank Revolution Data present
        if ((flags & 0x20) !== 0) {
          const crankRevs = value.getUint16(4, true);
          const crankEventTime = value.getUint16(6, true);
          // Cadence calculation from delta crank revs / delta time
          cadenceRpm = calculateCadence(crankRevs, crankEventTime);
        }

        onUpdate({ riderPowerWatts, cadenceRpm });
      });
    } catch (err) {
      console.warn('Cycling Power Service nicht verfügbar', err);
    }
  };

  return { device, subscribe };
}

let lastCrankRevs = 0;
let lastCrankTime = 0;
function calculateCadence(revs: number, time: number): number {
  if (lastCrankTime === 0) {
    lastCrankRevs = revs;
    lastCrankTime = time;
    return 0;
  }
  const deltaRevs = (revs - lastCrankRevs) & 0xFFFF;
  const deltaTime = ((time - lastCrankTime) & 0xFFFF) / 1024; // 1/1024th second resolution
  lastCrankRevs = revs;
  lastCrankTime = time;
  if (deltaTime <= 0) return 0;
  return Math.round((deltaRevs / deltaTime) * 60);
}
```

---

## 2. Specialized Turbo (MasterMind TCU & Levo) Integration

Specialized verwendet ein proprietäres BLE-GATT Protokoll, das durch die Eingabe des auf dem Rahmen aufgedruckten 6-stelligen Pairing-PINs ausgelesen und gesteuert werden kann.

### 2.1 Service- und Characteristic-UUIDs
* **Custom Turbo Service:** `00000000-3dd4-425e-8d3e-3ff16a611bda`
* **Telemetry Characteristic (Notify):** `00000001-3dd4-425e-8d3e-3ff16a611bda`
* **Assist Mode Characteristic (Read/Write):** `00000002-3dd4-425e-8d3e-3ff16a611bda`

### 2.2 Specialized Telemetrie-Parser
```typescript
export interface SpecializedTelemetry {
  batteryPercent: number;
  batteryWhRemaining: number;
  motorPowerWatts: number;
  riderPowerWatts: number;
  speedKmH: number;
  cadenceRpm: number;
  motorTemperatureC: number;
  assistMode: 'off' | 'eco' | 'trail' | 'turbo';
}

export function parseSpecializedTurboPacket(data: DataView): SpecializedTelemetry {
  // Byte Offset Mapping (Specialized Protocol Revision 3)
  const batteryPercent = data.getUint8(0);
  const batteryWhRemaining = data.getUint16(1, true);
  const speedRaw = data.getUint16(3, true);
  const speedKmH = +(speedRaw / 100).toFixed(1);
  const cadenceRpm = data.getUint8(5);
  const riderPowerWatts = data.getUint16(6, true);
  const motorPowerWatts = data.getUint16(8, true);
  const motorTemperatureC = data.getInt8(10);
  const rawMode = data.getUint8(11);

  const modeMap: Record<number, 'off' | 'eco' | 'trail' | 'turbo'> = {
    0: 'off',
    1: 'eco',
    2: 'trail',
    3: 'turbo',
  };

  return {
    batteryPercent,
    batteryWhRemaining,
    speedKmH,
    cadenceRpm,
    riderPowerWatts,
    motorPowerWatts,
    motorTemperatureC,
    assistMode: modeMap[rawMode] || 'eco',
  };
}

/**
 * Sendet einen Befehl zum Ändern der Unterstützungsstufe an das Specialized Turbo Display
 */
export async function setSpecializedAssistMode(
  characteristic: BluetoothRemoteGATTCharacteristic,
  mode: 'off' | 'eco' | 'trail' | 'turbo'
): Promise<void> {
  const modeValues = { off: 0x00, eco: 0x01, trail: 0x02, turbo: 0x03 };
  const payload = new Uint8Array([0x53, 0x01, modeValues[mode]]);
  await characteristic.writeValueWithResponse(payload);
  console.log(`Specialized Modus auf ${mode} gesetzt`);
}
```

---

## 3. Bosch eBike Systems (BES3 / Smart System & Flow API)

Bosch eBike Systems schirmt den direkten BLE-Schreibzugriff stark ab. Es gibt zwei Integrationspfade:
1. **Cloud-to-Cloud Integration (Offizieller Weg via Bosch eBike Flow Developer API):**
   - OAuth2 Flow mit User-Token
   - Abfrage von State of Health (SOH), Restreichweite in km je Unterstützungsstufe, Gesamtkilometer, Servicestatus
   - Push von GPX- und KI-Routen direkt auf Kiox 300 / Kiox 500 / Nyon Displays
2. **Lokale Hardware-Bridge (ESP32-LDI Sniffer):**
   - ESP32 empfängt den Protobuf BLE-Stream der Bosch LED Remote und leitet Sensordaten (Watt, Trittfrequenz, Akku) per WebSocket/Web-Bluetooth an Der Wegweiser weiter.

### 3.1 Bosch Flow Cloud Sync Adapter
```typescript
export async function syncBoschFlowRoute(userOAuthToken: string, gpxTrackData: string): Promise<boolean> {
  const response = await fetch('https://api.bosch-ebike.com/v1/routes/import', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${userOAuthToken}`,
      'Content-Type': 'application/gpx+xml',
    },
    body: gpxTrackData,
  });

  return response.ok;
}
```

---

## 4. Mahle SmartBike Systems (X35 / X20) & ANT+ LEV

Mahle E-Bikes senden standardisierte ANT+ LEV Frames (Page 16: E-Bike Status & Battery, Page 17: Speed, Page 18: Distance).
- **Batterie-Payload:** Byte 1 = State of Charge in % (0-100%).
- **Unterstützungsstufe:** Byte 3 = Current Assist Level (0-3).

---

## 5. Bafang M-Serie CAN-Bus Protokoll

Für Bafang-Systeme (M400, M500, M600) kann über einen BLE-to-CAN Adapter (Bafang Go) oder USB-CAN Interface (CANable) direkt mit dem Motor kommuniziert werden:
- **Baudrate:** 250 kbit/s (Standard 29-bit Extended CAN IDs)
- **ID `0x00000032` (Batteriestatus):** Byte 0-1 = Spannung in mV, Byte 2-3 = Strom in mA, Byte 4 = Ladestand %.
- **ID `0x00000011` (Motorsteuerung):** Byte 0 = Target Assist Level (0-5), Byte 1 = Walk Assist (0/1).
