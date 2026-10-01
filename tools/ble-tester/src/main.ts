/**
 * Wegweiser BLE-Tester
 *
 * Eigenstaendige Diagnose-App, die echte Bosch- und Bafang-E-Bike-Systeme per
 * Web Bluetooth anspricht. Importiert absichtlich die PRODUKTIONS-Parser aus
 * der Haupt-App (src/services/ble/parsers/*), statt sie zu kopieren — eine
 * hier erfolgreich dekodierte Telemetrie beweist, dass genau der Code, der
 * auch in "Der Wegweiser" laeuft, mit echter Hardware funktioniert. Kein
 * Simulations-/Mock-Modus: ohne echtes Geraet zeigt dieser Tester nichts an.
 */
import {
  parseBoschLdiTelemetry,
  BOSCH_DIAGNOSTIC_SERVICE_UUID,
  BOSCH_LDI_TELEMETRY_CHAR,
} from '../../../src/services/ble/parsers/boschLdiParser';
import {
  parseBafangPacket,
  BAFANG_UART_SERVICE_UUID,
  BAFANG_TX_CHAR,
} from '../../../src/services/ble/parsers/bafangParser';
import type { LiveBikeTelemetry } from '../../../src/types/navigation';

type Manufacturer = 'bosch' | 'bafang';

interface ManufacturerConfig {
  label: string;
  serviceUuid: string;
  telemetryChar: string;
  namePrefixes: string[];
  parse: (value: DataView) => Partial<LiveBikeTelemetry>;
}

const MANUFACTURERS: Record<Manufacturer, ManufacturerConfig> = {
  bosch: {
    label: 'Bosch',
    serviceUuid: BOSCH_DIAGNOSTIC_SERVICE_UUID,
    telemetryChar: BOSCH_LDI_TELEMETRY_CHAR,
    namePrefixes: ['bosch', 'kiox', 'nyon'],
    parse: parseBoschLdiTelemetry,
  },
  bafang: {
    label: 'Bafang',
    serviceUuid: BAFANG_UART_SERVICE_UUID,
    telemetryChar: BAFANG_TX_CHAR,
    namePrefixes: ['bafang', 'm400', 'm500', 'm600'],
    parse: parseBafangPacket,
  },
};

let activeServer: BluetoothRemoteGATTServer | null = null;
let activeDevice: BluetoothDevice | null = null;
let packetCount = 0;

const app = document.getElementById('app')!;
app.innerHTML = `
  <h1>🔧 Wegweiser BLE-Tester</h1>
  <p class="subtitle">Testet die echten Produktions-Parser gegen reale Bosch-/Bafang-Hardware. Kein Fake-Modus.</p>

  <div class="scan-row">
    <button class="scan-btn bosch" id="scan-bosch">🔵 Bosch verbinden</button>
    <button class="scan-btn bafang" id="scan-bafang">🟡 Bafang verbinden</button>
  </div>
  <div class="scan-row">
    <button class="scan-btn" id="disconnect-btn" disabled>⏏ Trennen</button>
  </div>

  <div class="status-panel">
    <div class="status-line"><span class="dot" id="status-dot"></span><span id="status-text">Nicht verbunden.</span></div>
    <div class="status-line" id="support-line"></div>
  </div>

  <div class="telemetry-grid" id="telemetry-grid"></div>

  <div class="log-panel" id="log"></div>
`;

const statusDot = document.getElementById('status-dot')!;
const statusText = document.getElementById('status-text')!;
const supportLine = document.getElementById('support-line')!;
const telemetryGrid = document.getElementById('telemetry-grid')!;
const logEl = document.getElementById('log')!;
const boschBtn = document.getElementById('scan-bosch') as HTMLButtonElement;
const bafangBtn = document.getElementById('scan-bafang') as HTMLButtonElement;
const disconnectBtn = document.getElementById('disconnect-btn') as HTMLButtonElement;

function log(message: string, kind: 'info' | 'ok' | 'err' | 'raw' = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${kind}`;
  const ts = new Date().toLocaleTimeString('de-DE');
  line.textContent = `[${ts}] ${message}`;
  logEl.prepend(line);
}

function setStatus(connected: boolean, text: string) {
  statusDot.className = `dot ${connected ? 'ok' : 'err'}`;
  statusText.textContent = text;
}

function bytesToHex(value: DataView): string {
  const bytes: string[] = [];
  for (let i = 0; i < value.byteLength; i++) {
    bytes.push(value.getUint8(i).toString(16).padStart(2, '0'));
  }
  return bytes.join(' ');
}

const TILE_DEFS: Array<{ key: keyof LiveBikeTelemetry; label: string; unit: string }> = [
  { key: 'batteryPercent', label: 'Akku', unit: '%' },
  { key: 'batteryWhRemaining', label: 'Akku Wh', unit: 'Wh' },
  { key: 'speedKmH', label: 'Geschwindigkeit', unit: 'km/h' },
  { key: 'cadenceRpm', label: 'Trittfrequenz', unit: 'RPM' },
  { key: 'riderPowerWatts', label: 'Fahrer-Watt', unit: 'W' },
  { key: 'motorPowerWatts', label: 'Motor-Watt', unit: 'W' },
  { key: 'motorAssistMode', label: 'Unterstuetzung', unit: '' },
  { key: 'motorTemperatureC', label: 'Motor-Temp.', unit: '°C' },
];

function renderTelemetry(t: Partial<LiveBikeTelemetry>) {
  telemetryGrid.innerHTML = TILE_DEFS.map(({ key, label, unit }) => {
    const raw = t[key];
    const hasValue = raw !== undefined && raw !== null;
    const display = hasValue ? `${raw}${unit}` : '—';
    return `
      <div class="tile">
        <div class="label">${label}</div>
        <div class="value ${hasValue ? '' : 'na'}">${display}</div>
      </div>
    `;
  }).join('');
}

async function connectTo(manufacturer: Manufacturer) {
  const config = MANUFACTURERS[manufacturer];

  if (!('bluetooth' in navigator)) {
    log('Web Bluetooth ist in dieser WebView/diesem Browser nicht verfuegbar (navigator.bluetooth fehlt).', 'err');
    setStatus(false, 'Web Bluetooth nicht verfuegbar');
    return;
  }

  boschBtn.disabled = true;
  bafangBtn.disabled = true;
  packetCount = 0;

  try {
    log(`Suche nach ${config.label}-Geraet (Service ${config.serviceUuid})...`);
    setStatus(false, `Suche ${config.label}-Geraet...`);

    const device = await navigator.bluetooth.requestDevice({
      filters: [
        { services: [config.serviceUuid] },
        ...config.namePrefixes.map((prefix) => ({ namePrefix: prefix })),
      ],
      optionalServices: [config.serviceUuid],
    });

    activeDevice = device;
    log(`Geraet gewaehlt: ${device.name ?? '(ohne Namen)'} [${device.id}]`, 'ok');

    device.addEventListener('gattserverdisconnected', () => {
      log('GATT-Verbindung getrennt.', 'err');
      setStatus(false, 'Verbindung getrennt.');
      activeServer = null;
      boschBtn.disabled = false;
      bafangBtn.disabled = false;
      disconnectBtn.disabled = true;
    });

    setStatus(false, `Verbinde mit ${device.name ?? config.label}...`);
    const server = await device.gatt!.connect();
    activeServer = server;
    log('GATT-Server verbunden.', 'ok');

    const service = await server.getPrimaryService(config.serviceUuid);
    const characteristic = await service.getCharacteristic(config.telemetryChar);
    await characteristic.startNotifications();
    log(`Notifications auf Characteristic ${config.telemetryChar} aktiv. Warte auf echte Telemetrie-Pakete...`, 'ok');

    setStatus(true, `Verbunden: ${device.name ?? config.label} — 0 Pakete empfangen`);
    disconnectBtn.disabled = false;

    characteristic.addEventListener('characteristicvaluechanged', (event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      const value = target.value;
      if (!value) return;

      packetCount += 1;
      setStatus(true, `Verbunden: ${device.name ?? config.label} — ${packetCount} Pakete empfangen`);
      log(`RAW (${value.byteLength} Byte): ${bytesToHex(value)}`, 'raw');

      try {
        const parsed = config.parse(value);
        if (Object.keys(parsed).length === 0) {
          log('Parser lieferte leeres Ergebnis (Paket zu kurz oder unbekanntes Format).', 'err');
        } else {
          log(`Geparst: ${JSON.stringify(parsed)}`, 'ok');
          renderTelemetry(parsed);
        }
      } catch (err) {
        log(`Parser-Fehler: ${err instanceof Error ? err.message : String(err)}`, 'err');
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`Fehler: ${message}`, 'err');
    setStatus(false, `Fehler: ${message}`);
  } finally {
    boschBtn.disabled = false;
    bafangBtn.disabled = false;
  }
}

boschBtn.addEventListener('click', () => connectTo('bosch'));
bafangBtn.addEventListener('click', () => connectTo('bafang'));
disconnectBtn.addEventListener('click', () => {
  if (activeServer?.connected) {
    activeServer.disconnect();
    log(`Manuell getrennt von ${activeDevice?.name ?? 'Geraet'}.`);
  }
  disconnectBtn.disabled = true;
});

if ('bluetooth' in navigator) {
  supportLine.textContent = '✓ navigator.bluetooth verfuegbar in dieser WebView.';
  (supportLine.previousElementSibling as HTMLElement)?.classList.add('ok');
} else {
  supportLine.textContent = '✗ navigator.bluetooth fehlt — Web Bluetooth wird von dieser WebView nicht unterstuetzt.';
  log('navigator.bluetooth ist beim Start nicht vorhanden. Das ist genau der Fall, den dieser Tester aufdecken soll: die Haupt-App verlaesst sich auf dieselbe API.', 'err');
}
