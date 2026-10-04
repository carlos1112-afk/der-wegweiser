import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import type { LiveBikeTelemetry, BikeManufacturer } from '../../types/navigation';
import { parsePowerMeasurement, parseBatteryLevel, parseCscMeasurement, resetStandardSigState } from './parsers/standardSigParser';
import { parseSpecializedTelemetry, buildSpecializedAssistCommand, SPECIALIZED_SERVICE_UUID, SPECIALIZED_TELEMETRY_CHAR, SPECIALIZED_ASSIST_CHAR } from './parsers/specializedParser';
import { parseMahleTelemetry, buildMahleAssistCommand, MAHLE_SERVICE_UUID, MAHLE_TELEMETRY_CHAR, MAHLE_CONTROL_CHAR } from './parsers/mahleParser';
import { parseShimanoTelemetry, SHIMANO_DFLY_SERVICE_UUID, SHIMANO_TELEMETRY_CHAR } from './parsers/shimanoParser';
import { parseBafangPacket, buildBafangAssistCommand, BAFANG_UART_SERVICE_UUID, BAFANG_TX_CHAR, BAFANG_RX_CHAR } from './parsers/bafangParser';
import { parseBoschLdiTelemetry, BOSCH_DIAGNOSTIC_SERVICE_UUID, BOSCH_LDI_TELEMETRY_CHAR } from './parsers/boschLdiParser';

export class BleManager {
  private static activeGattServer: BluetoothRemoteGATTServer | null = null;
  private static activeBluetoothDevice: BluetoothDevice | null = null;
  private static activeManufacturer: BikeManufacturer = 'generic';
  private static reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private static reconnectAttempts = 0;
  private static telemetryCallback: ((telemetry: LiveBikeTelemetry) => void) | null = null;
  private static lastKnownTelemetry: LiveBikeTelemetry = {
    isConnected: false,
    batteryPercent: null,
    batteryWhRemaining: null,
    batteryKnown: false,
    speedKmH: 0,
    cadenceRpm: 0,
    riderPowerWatts: 0,
    motorAssistMode: 'off',
  };

  /**
   * Detects the manufacturer from BLE device name and advertisement data
   */
  public static detectManufacturer(deviceName?: string): BikeManufacturer {
    if (!deviceName) return 'generic';
    const name = deviceName.toLowerCase();
    if (name.includes('bosch') || name.includes('kiox') || name.includes('nyon')) return 'bosch';
    if (name.includes('specialized') || name.includes('levo') || name.includes('tcu') || name.includes('turbo')) return 'specialized';
    if (name.includes('shimano') || name.includes('steps') || name.includes('d-fly') || name.includes('ep8')) return 'shimano';
    if (name.includes('mahle') || name.includes('ebikemotion') || name.includes('x35') || name.includes('x20')) return 'mahle';
    if (name.includes('fazua') || name.includes('ride 50') || name.includes('ride 60')) return 'fazua';
    if (name.includes('bafang') || name.includes('can') || name.includes('m400') || name.includes('m500')) return 'bafang';
    return 'generic';
  }

  /**
   * Scans for and connects to a physical E-Bike or BLE sensor via Web Bluetooth API.
   * Attaches automatic disconnect listener with exponential backoff.
   */
  public static async connectToBike(targetManufacturer?: BikeManufacturer): Promise<LiveBikeTelemetry> {
    // Frische Referenzwerte: ein neuer Verbindungsversuch beginnt immer
    // mit der ersten Messung als Referenz (liefert 0 statt eines Ausreißers).
    resetStandardSigState();

    if (typeof navigator !== 'undefined' && 'bluetooth' in navigator) {
      try {
        const filters: BluetoothLEScanFilter[] = [];
        if (!targetManufacturer || targetManufacturer === 'bosch') {
          filters.push({ services: [BOSCH_DIAGNOSTIC_SERVICE_UUID] }, { namePrefix: 'Bosch' }, { namePrefix: 'Kiox' }, { namePrefix: 'SmartphoneGrip' });
        }
        if (!targetManufacturer || targetManufacturer === 'specialized') {
          filters.push({ services: [SPECIALIZED_SERVICE_UUID] }, { namePrefix: 'Specialized' }, { namePrefix: 'Levo' }, { namePrefix: 'TCU' });
        }
        if (!targetManufacturer || targetManufacturer === 'shimano') {
          filters.push({ services: [SHIMANO_DFLY_SERVICE_UUID] }, { namePrefix: 'Shimano' }, { namePrefix: 'STEPS' }, { namePrefix: 'D-Fly' });
        }
        if (!targetManufacturer || targetManufacturer === 'mahle') {
          filters.push({ services: [MAHLE_SERVICE_UUID] }, { namePrefix: 'Mahle' }, { namePrefix: 'ebikemotion' }, { namePrefix: 'X35' });
        }
        if (!targetManufacturer || targetManufacturer === 'bafang') {
          filters.push({ services: [BAFANG_UART_SERVICE_UUID] }, { namePrefix: 'Bafang' });
        }
        if (!targetManufacturer || targetManufacturer === 'fazua') {
          filters.push({ namePrefix: 'Fazua' }, { services: ['battery_service'] });
        }
        if (!targetManufacturer || targetManufacturer === 'generic') {
          filters.push({ services: ['battery_service'] }, { services: ['cycling_power'] }, { services: ['cycling_speed_and_cadence'] });
        }

        const device = await navigator.bluetooth.requestDevice({
          filters,
          optionalServices: [
            'cycling_power',
            'cycling_speed_and_cadence',
            'fitness_machine',
            'battery_service',
            'device_information',
            SPECIALIZED_SERVICE_UUID,
            MAHLE_SERVICE_UUID,
            SHIMANO_DFLY_SERVICE_UUID,
            BAFANG_UART_SERVICE_UUID,
            BOSCH_DIAGNOSTIC_SERVICE_UUID,
          ],
        });

        this.activeBluetoothDevice = device;
        device.addEventListener('gattserverdisconnected', this.onDisconnected.bind(this));

        return await this.setupGattConnection(device);
      } catch (err) {
        console.warn('[BleManager] Web-Bluetooth pairing cancelled or unavailable:', err);
        throw new Error('[BleManager] Echte Bluetooth-Verbindung nicht verfügbar oder abgebrochen; keine Simulation erlaubt.');
      }
    }

    throw new Error('[BleManager] Web-Bluetooth wird in dieser Umgebung nicht unterstützt; echte Hardware erforderlich.');
  }

  private static async setupGattConnection(device: BluetoothDevice): Promise<LiveBikeTelemetry> {
    if (!device.gatt) {
      throw new Error('[BleManager] Device does not support GATT.');
    }
    const server = await device.gatt.connect();
    this.activeGattServer = server;
    const manufacturer = this.detectManufacturer(device.name);
    this.activeManufacturer = manufacturer;
    this.reconnectAttempts = 0;

    console.log(`[BleManager] GATT Connected to ${manufacturer.toUpperCase()} Bike:`, device.name);

    let liveState: LiveBikeTelemetry = {
      isConnected: true,
      deviceName: device.name || 'Smart E-Bike',
      manufacturer,
      batteryPercent: null,
      batteryWhRemaining: null,
      batteryKnown: false,
      speedKmH: 0,
      cadenceRpm: 0,
      riderPowerWatts: 0,
      motorPowerWatts: 0,
      motorAssistMode: 'auto',
    };

    // 1. Standard Battery Service (0x180F)
    try {
      const batteryService = await server.getPrimaryService('battery_service');
      const batteryChar = await batteryService.getCharacteristic('battery_level');
      const val = await batteryChar.readValue();
      liveState = { ...liveState, ...parseBatteryLevel(val) };
      await batteryChar.startNotifications();
      batteryChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseBatteryLevel(target.value) });
        }
      });
    } catch {
      // Optional
    }

    // 2. Standard Cycling Power Service (0x1818)
    try {
      const powerService = await server.getPrimaryService('cycling_power');
      const powerChar = await powerService.getCharacteristic('cycling_power_measurement');
      await powerChar.startNotifications();
      powerChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parsePowerMeasurement(target.value) });
        }
      });
    } catch {
      // Optional
    }

    // 3. Standard Cycling Speed & Cadence (0x1816)
    try {
      const cscService = await server.getPrimaryService('cycling_speed_and_cadence');
      const cscChar = await cscService.getCharacteristic('csc_measurement');
      await cscChar.startNotifications();
      cscChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseCscMeasurement(target.value) });
        }
      });
    } catch {
      // Optional
    }

    // 4. Specialized Turbo Service
    try {
      const specService = await server.getPrimaryService(SPECIALIZED_SERVICE_UUID);
      const specChar = await specService.getCharacteristic(SPECIALIZED_TELEMETRY_CHAR);
      await specChar.startNotifications();
      specChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseSpecializedTelemetry(target.value), manufacturer: 'specialized' });
        }
      });
    } catch {
      // Optional
    }

    // 5. Mahle SmartBike Service
    try {
      const mahleService = await server.getPrimaryService(MAHLE_SERVICE_UUID);
      const mahleChar = await mahleService.getCharacteristic(MAHLE_TELEMETRY_CHAR);
      await mahleChar.startNotifications();
      mahleChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseMahleTelemetry(target.value), manufacturer: 'mahle' });
        }
      });
    } catch {
      // Optional
    }

    // 6. Shimano D-Fly Service
    try {
      const shimanoService = await server.getPrimaryService(SHIMANO_DFLY_SERVICE_UUID);
      const shimanoChar = await shimanoService.getCharacteristic(SHIMANO_TELEMETRY_CHAR);
      await shimanoChar.startNotifications();
      shimanoChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseShimanoTelemetry(target.value), manufacturer: 'shimano' });
        }
      });
    } catch {
      // Optional
    }

    // 7. Bafang CAN-over-BLE Service
    try {
      const bafangService = await server.getPrimaryService(BAFANG_UART_SERVICE_UUID);
      const bafangChar = await bafangService.getCharacteristic(BAFANG_TX_CHAR);
      await bafangChar.startNotifications();
      bafangChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          const parsed = parseBafangPacket(target.value);
          this.updateState({ ...parsed, manufacturer: 'bafang' });
          
          // Capacitor File Logger for Test Drive
          try {
            const rawStr = Array.from(new Uint8Array(target.value.buffer)).map(b => b.toString(16).padStart(2,"0")).join(" ");
            const logLine = `[${new Date().toISOString()}] RAW: ${rawStr} | PARSED: ${JSON.stringify(parsed)}
`;
            Filesystem.appendFile({
              path: 'bafang_testfahrt.txt',
              data: logLine,
              directory: Directory.Documents,
              encoding: Encoding.UTF8
            }).catch(() => {});
          } catch(e) {}
        }
      });
    } catch {
      // Optional
    }

    // 8. Bosch Diagnostic Service
    try {
      const boschService = await server.getPrimaryService(BOSCH_DIAGNOSTIC_SERVICE_UUID);
      const boschChar = await boschService.getCharacteristic(BOSCH_LDI_TELEMETRY_CHAR);
      await boschChar.startNotifications();
      boschChar.addEventListener('characteristicvaluechanged', (e: Event) => {
        const target = e.target as BluetoothRemoteGATTCharacteristic;
        if (target.value) {
          this.updateState({ ...parseBoschLdiTelemetry(target.value), manufacturer: 'bosch' });
        }
      });
    } catch {
      // Optional
    }

    this.lastKnownTelemetry = liveState;
    return liveState;
  }

  private static updateState(partial: Partial<LiveBikeTelemetry>) {
    this.lastKnownTelemetry = { ...this.lastKnownTelemetry, ...partial };
    if (this.telemetryCallback) {
      this.telemetryCallback(this.lastKnownTelemetry);
    }
  }

  /**
   * Automatic background reconnection with exponential backoff on signal loss
   */
  private static onDisconnected() {
    console.warn('[BleManager] Bluetooth connection lost! Initiating auto-reconnect backoff...');
    this.activeGattServer = null;
    // Referenzwerte der Standard-SIG-Parser verwerfen: die Rad-/Kurbel-
    // Zähler des Sensors laufen während der Trennung weiter, sodass die
    // Differenz über die Verbindungszeit sonst zu unrealistischen
    // Geschwindigkeits- und Trittfrequenzwerten führt.
    resetStandardSigState();
    this.updateState({ isConnected: false });

    if (!this.activeBluetoothDevice) return;

    const delay = Math.min(30000, Math.pow(1.8, this.reconnectAttempts) * 1500);
    this.reconnectAttempts += 1;

    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
    }
    this.reconnectTimer = setTimeout(async () => {
      if (this.activeBluetoothDevice && !this.activeGattServer) {
        console.log(`[BleManager] Auto-reconnect attempt #${this.reconnectAttempts}...`);
        try {
          await this.setupGattConnection(this.activeBluetoothDevice);
          console.log('[BleManager] Successfully reconnected to E-Bike!');
        } catch (e) {
          console.warn('[BleManager] Reconnection failed, scheduling next retry:', e);
          this.onDisconnected();
        }
      }
    }, delay);
  }

  /**
   * Changes the motor assist mode on connected hardware
   */
  public static async setAssistMode(mode: 'off' | 'eco' | 'tour' | 'turbo'): Promise<boolean> {
    if (!this.activeGattServer) {
      console.warn(`[BleManager] Kann Unterstützungsstufe nicht ändern: Keine echte BLE-Hardware verbunden.`);
      return false;
    }

    try {
      if (this.activeManufacturer === 'specialized') {
        const service = await this.activeGattServer.getPrimaryService(SPECIALIZED_SERVICE_UUID);
        const char = await service.getCharacteristic(SPECIALIZED_ASSIST_CHAR);
        const payload = buildSpecializedAssistCommand(mode === 'tour' ? 'trail' : mode);
        await char.writeValue(payload);
        return true;
      } else if (this.activeManufacturer === 'mahle') {
        const service = await this.activeGattServer.getPrimaryService(MAHLE_SERVICE_UUID);
        const char = await service.getCharacteristic(MAHLE_CONTROL_CHAR);
        const payload = buildMahleAssistCommand(mode);
        await char.writeValue(payload);
        return true;
      } else if (this.activeManufacturer === 'bafang') {
        // SICHERHEIT: Bafang Schreibzugriffe sind riskant (z.B. M560/C245 Settings Wipe).
        // TODO: In Zukunft striktes Read-Only fuer unbekannte Modelle erzwingen.
        console.warn("BAFANG WRITE: Sende Command an BAFANG_RX_CHAR. Vorsicht bei M560/M820!");
        const service = await this.activeGattServer.getPrimaryService(BAFANG_UART_SERVICE_UUID);
        const char = await service.getCharacteristic(BAFANG_RX_CHAR);
        const bafangLevel = mode === 'off' ? 0 : mode === 'eco' ? 2 : mode === 'tour' ? 4 : 5;
        const payload = buildBafangAssistCommand(bafangLevel as any);
        await char.writeValue(payload);
        return true;
      }
    } catch (e) {
      console.error('[BleManager] Failed to write assist mode to BLE hardware:', e);
    }
    return false;
  }

  /**
   * Subscribes to continuous live telemetry updates
   */
  public static subscribeTelemetry(
    initialState: LiveBikeTelemetry,
    onUpdate: (telemetry: LiveBikeTelemetry) => void
  ): () => void {
    this.telemetryCallback = onUpdate;
    this.lastKnownTelemetry = initialState;

    return () => {
      this.telemetryCallback = null;
    };
  }

  public static getConnectedDevice(): { deviceName: string; manufacturer: BikeManufacturer } | null {
    if (!this.lastKnownTelemetry.isConnected) return null;
    return {
      deviceName: this.lastKnownTelemetry.deviceName || 'Smart E-Bike',
      manufacturer: this.lastKnownTelemetry.manufacturer || this.activeManufacturer,
    };
  }
}
