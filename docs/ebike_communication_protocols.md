# 🚲 E-Bike & Display Communication Protocols — Developer Reference & Integration Guide

Dieses Referenzhandbuch dokumentiert die technischen Kommunikationsprotokolle, Bluetooth Low Energy (BLE) GATT-Strukturen, ANT+ LEV Standards und CAN-Bus Protokolle für die Anbindung moderner E-Bike Antriebe und Bordcomputer an die **Der Wegweiser** Plattform.

---

## 📑 Übersicht der Hersteller-Matrix

| Hersteller | Marktanteil EU | Primäre Schnittstelle | Offenheit / Lesezugriff | Schreibzugriff (Befehle) |
|---|---|---|---|---|
| **Bosch eBike Systems** (Smart System / BES3) | ~45-50% | BLE (LDI V1.0, offiziell, read-only, nur via Brücke) & Cloud API (Flow) | 🟢 LDI offen dokumentiert (Apache-2.0), aber nur über Brücke (BEStie u.ä.) | 🛡️ Nur via eBike Flow API, LDI ist read-only |
| **Shimano STEPS** (EP8, EP801, EP6, Di2) | ~20-25% | D-Fly BLE / Di2 CAN Bus | 🔒 E-TUBE Passkey erforderlich | 🚫 Gesperrt (Anti-Tamper) |
| **Specialized Turbo** (MasterMind TCU, Levo) | ~8-10% | Custom BLE GATT + ANT+ LEV | 🟢 Frei mit Geräte-PIN (abgedruckt) | 🟢 Assist-Modes schreibbar |
| **Mahle SmartBike** (X35, X20, Pulsar ONE) | ~6-8% | ANT+ LEV & BLE GATT | 🟢 Offener Standard | 🟢 Assist-Stufen schaltbar |
| **Fazua** (Ride 50, Ride 60, Porsche) | ~4-6% | Standard Bluetooth SIG (0x1818, 0x1816) | 🟢 Vollständig offen (Plug & Play) | 🛠️ Toolbox Desktop |
| **Giant SyncDrive** (RideControl Ergo/Dash) | ~5-7% | BLE GATT (CAN Tunnelling) | 🟡 Just-Works BLE Pairing | 🟡 Modus-Wahl per BLE |
| **Brose Drive** (Drive S/Mag, Marquardt, nur pre-2022) | ~4-5% | CAN-Bus / BLE Protobuf (Community-RE) | 🟡 Nur via locus-brose-adapter, niche | 🚫 Nur Händler-Tool |
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

> **[RISIKO, Quelle: Grok-Recherchebericht 2026-10, Referenzprojekt JamieMagee/specialized-turbo, MIT]**
> Nur die Rahmen TCU1/TCX1 sind unverschlüsselt und werden hier unterstützt. Ab TCX2 (neuere Räder, inkl.
> TCX3-Revisionen `0x25`/`0x26`) ist der Payload optional mit **AES-128-CTR** verschlüsselt; der dafür
> nötige Sitzungsschlüssel läuft über Specializeds Cloud-Key-Mechanismus und ist für diese App nicht
> beschaffbar. Für solche Räder liefert der Parser keine oder unbrauchbare Werte — das ist eine bekannte,
> akzeptierte Lücke, kein Bug.

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

## 3. Bosch eBike Systems (BES3 / Smart System, LDI V1.0 & Flow API)

> **[KORREKTUR, Stand 2026-10, Quelle: Grok-Recherchebericht]** Dieser Abschnitt beschrieb bis dahin
> einen "ESP32-LDI-Sniffer", der angeblich den "Protobuf BLE-Stream der Bosch LED Remote" mitschneidet.
> Das war unbelegt und ist durch die vorliegenden Recherchen widerlegt: Es gibt keinen "Bosch LED
> Remote"-Protobuf-Stream, der so mitgesnifft würde. Was tatsächlich existiert, ist die offizielle,
> dokumentierte **Live Data Interface (LDI) V1.0** — siehe unten.

Bosch eBike Systems schirmt den direkten BLE-Schreibzugriff stark ab, veröffentlicht aber seit 2026-05-01
eine offizielle, lesende GATT-Spec. Es gibt zwei saubere Integrationspfade — ein dritter (Diagnose-Kanal)
ist explizit tabu:

1. **Cloud-to-Cloud Integration (Offizieller Weg via Bosch eBike Flow Developer API):**
   - OAuth2 Flow mit User-Token
   - Abfrage von State of Health (SOH), Restreichweite in km je Unterstützungsstufe, Gesamtkilometer, Servicestatus
   - Range Control (reichweitenabhängige Modus-Empfehlung) läuft **nur** über diese Flow-App-Schiene
     bzw. die Connected-Biking-Partnerplattform (komoot, Papin, Tilia, allride/AMAG, Connected Cycle,
     Friiway, Joyride, OKGO, Velo de Ville u.a.) — **nicht** über die LDI.
   - Push von GPX- und KI-Routen direkt auf Kiox 300 / Kiox 500 / Nyon Displays

2. **BLE Live Data Interface (LDI) V1.0 — offizielle, dokumentierte Spec:**
   - Lizenz: Apache-2.0, kein Partnervertrag nötig, Zugriff ist **read-only**.
   - Service-UUID `0000eb20-eaa2-11e9-81b4-2a2ae2dbcce4`, Characteristic (Telemetrie)
     `0000eb21-eaa2-11e9-81b4-2a2ae2dbcce4`. (Nicht zu verwechseln mit den vorher hier fälschlich
     eingetragenen UUIDs, die auf die generische Bluetooth-SIG-Base-UUID zeigten.)
   - Spec verlangt Firmware v19+; Service Solicitation 0x15; Bonding via LE Secure Connections "Just Works".
   - Neben den bekannten Telemetriefeldern (Akku, Geschwindigkeit, Trittfrequenz, Leistung, Modus) definiert
     V1.0 drei zusätzliche Bool-Felder: `light_reserve_state`, `diagnosis_program_active`,
     `bike_not_driving` (Standstill-Erkennung). **[NICHT GEPRÜFT]** Deren genaue Bit-Position in der
     Notification ist aus den vorliegenden Berichten nicht entnehmbar und wird im Parser aktuell nicht
     dekodiert, um keine erfundenen Byte-Offsets zu verbauen.
   - **[RISIKO] Architektur-Falle für eine Handy-App:** Laut Spec ist das Rad GAP-Central und GATT-Server,
     das Zubehör ist GAP-Peripheral und GATT-Client. Ein Smartphone, das wie bei allen anderen Herstellern
     in diesem Modul direkt per `requestDevice`/`BleClient.requestDevice` nach dem Rad scannt, widerspricht
     damit der Spec und wird gegen echte Bosch-Smart-System-Hardware voraussichtlich **nicht** funktionieren.
   - Produktiv nutzbar wird die LDI nur über eine Brücke, die selbst als spec-konformes LDI-Peripheral
     auftritt und nach außen ein Standardprofil exponiert, z.B. **BEStie** (v0.2.2, GPL-3.0, nRF-Firmware,
     exponiert FTMS Indoor Bike) oder **Xunil99/ha-bosch-ebike** (Apache-2.0, ESPHome). Ohne eine solche
     Hardware-Brücke bleibt eine direkte App-Verbindung experimentell.

> **Nicht verwenden:** Die Community-Projekte `radiohound/bosch-smart-system-ble` und
> `rweijnen/bosch-bes3-reader` reverse-engineeren einen separaten **Diagnose-Kanal (0x0011)**, nicht die
> LDI. Sie sind nicht von Bosch sanktioniert und werden für Der Wegweiser bewusst nicht angefasst.

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

> **[FAKT, Quelle: Grok-Recherchebericht 2026-10, Referenzprojekt ReneNulschDE/ha-mysmartbike_ble, MIT]**
> In der Beworbung erscheinen die Geräte nicht als "Mahle"/"ebikemotion", sondern unter den Namen
> **`iWoc`** bzw. mit **`HUS`**-Präfix (getestet an Orbea Vibe, Schindelhauer Arthur IX). Das
> Community-Projekt läuft komplett cloud-frei und deckt zusätzlich ab: Batterietemperatur, Restenergie
> (Wh), Motortemperatur, Trip A, Kilometerstand, Licht-Status, EBM-Status (~14 Sensoren insgesamt). Im
> Der-Wegweiser-Parser ist davon bislang nur eine Teilmenge dekodiert (siehe `mahleParser.ts`).

---

## 5. Bafang M-Serie CAN-Bus Protokoll

Für Bafang-Systeme (M400, M500, M600) kann über einen BLE-to-CAN Adapter (Bafang Go) oder USB-CAN Interface (CANable) direkt mit dem Motor kommuniziert werden:
- **Baudrate:** 250 kbit/s (Standard 29-bit Extended CAN IDs)
- **ID `0x00000032` (Batteriestatus):** Byte 0-1 = Spannung in mV, Byte 2-3 = Strom in mA, Byte 4 = Ladestand %.
- **ID `0x00000011` (Motorsteuerung):** Byte 0 = Target Assist Level (0-5), Byte 1 = Walk Assist (0/1).

---

## 6. Brose Drive (nur pre-2022 / "Universal Display") — niedrige Priorität

> **[FAKT, Quelle: Grok-Recherchebericht 2026-10, Referenzprojekt hoschilo/locus-brose-adapter v1.0.0,
> MIT, Nachfolger des archivierten hoschilo/EBikeLocus]** Kein offizieller Bosch/Brose-Standard, sondern
> Community-Reverse-Engineering, und laut den Berichten nur für **pre-2022-Räder mit "Universal Display"**
> gültig — explizit als Nische/niedrige Priorität eingestuft, nicht als eigene Stack-Pflicht für Der
> Wegweiser.

- **Service-UUID:** `31be2300-d927-11e9-8a34-2a2ae2dbcce4`
- **TEL-Characteristic (Telemetrie, Notify):** `31be23a6-...` (gleiche Basis wie Service-UUID)
- **SEC-Characteristic:** `31be32ba-...`
- **CMD-Characteristic:** `31be3634-...`
- **Encoding:** Protobuf. Felder laut Quellprojekt: Speed, Cadence, Battery/SoC, Assist, Motor Power,
  Estimated Range.
- **[NICHT GEPRÜFT]** Die TEL/SEC/CMD-UUIDs sind im Quellbericht nur mit führenden Ziffern und "..."
  angegeben (gleiche 128-Bit-Basis wie der Service wird angenommen, aber nicht Byte für Byte bestätigt).
  Vor einem Schreibzugriff (CMD) unbedingt gegen den Quellcode von `hoschilo/locus-brose-adapter`
  verifizieren. Da Protobuf-codiert, ist ohne das dortige `.proto`-Schema kein fester Byte-Offset-Parser
  seriös möglich — in diesem Modul daher (noch) nicht implementiert, um keine Byte-Layouts zu erfinden.

---

## 7. SRAM AXS / Eagle Powertrain — nur Schaltung, keine Antriebs-Telemetrie

> **[FAKT, Quelle: Grok-Recherchebericht 2026-10, Referenzprojekt GaborWnuk/sram-axs, MPL-2.0]**
> Reverse-engineerte Kommunikation mit SRAM AXS (SRAMBond + Protobuf), verifiziert nur gegen GX Eagle
> Rear Derailleur und AXS Controller. Liefert **Gang und Zustand**, aber **keine** Motor-/Akku-Telemetrie
> — für Der Wegweiser relevant nur, falls Gangwahl/-zustand künftig angezeigt werden soll, nicht als
> E-Bike-Antriebsschnittstelle.

---

## 8. Standard-Bluetooth-SIG-Profile als universeller Fallback

> **[FAKT, Quelle: Grok-Recherchebericht 2026-10]** Für Hersteller ohne offenen Stack (Fazua, TQ, Giant,
> Yamaha, Shimano, Ananda) bleibt nur der Rückgriff auf offiziell dokumentierte SIG-Standardprofile:
> Battery `0x180F`, Cycling Speed & Cadence `0x1816`, Cycling Power `0x1818`, Device Information `0x180A`,
> **Fitness Machine Service (FTMS) `0x1826`**, sowie ANT+ LEV. Der Wegweiser implementiert aktuell
> `0x180F`, `0x1816` und `0x1818` (siehe `standardSigParser.ts`). FTMS (`0x1826`, Characteristic
> "Indoor Bike Data" `0x2AD2`) ist ebenfalls offiziell spezifiziert und wird u.a. von Bosch-LDI-Brücken
> wie BEStie nach außen angeboten — als nächster sinnvoller Ausbauschritt vorgemerkt, hier aber noch
> nicht implementiert.

---

## Wichtiger Hinweis zu Bofang/sonstigen Protokollen ohne offenen Stack

Yamaha (`brose-ebike/bike-connector`, nur Platzhalter-Quellcode per Mail), Shimano STEPS (kein
öffentlicher GATT-Stack), DJI Avinox, TQ, Giant RideControl, Ananda: Für all diese existiert laut den
vorliegenden Recherchen **kein offener, von Herstellern sanktionierter BLE-Stack**. Jede Integration
dafür wäre reines Reverse-Engineering ohne Spec-Grundlage und wird hier bewusst nicht aufgenommen.
