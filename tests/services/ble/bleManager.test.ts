import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { BleManager } from '../../../src/services/ble/bleManager.js';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

describe('BleManager', () => {
  describe('detectManufacturer', () => {
    it('detects bosch from name', () => {
      assert.strictEqual(BleManager.detectManufacturer('Bosch Kiox'), 'bosch');
    });

    it('detects specialized from name', () => {
      assert.strictEqual(BleManager.detectManufacturer('Specialized Levo'), 'specialized');
    });

    it('detects shimano from name', () => {
      assert.strictEqual(BleManager.detectManufacturer('Shimano STEPS'), 'shimano');
    });

    it('detects mahle from name', () => {
      assert.strictEqual(BleManager.detectManufacturer('Mahle X35'), 'mahle');
    });

    it('detects bafang from name', () => {
      assert.strictEqual(BleManager.detectManufacturer('Bafang CAN'), 'bafang');
    });

    it('defaults to generic when name is unknown', () => {
      assert.strictEqual(BleManager.detectManufacturer('Unknown Bike'), 'generic');
    });
  });

  describe('Connection Paths', () => {
    let originalNavigator: any;

    beforeEach(() => {
      // Mock BleClient methods
      mock.method(BleClient, 'initialize', async () => {});
      mock.method(BleClient, 'requestDevice', async () => ({ deviceId: 'test-device', name: 'Test Bike' }));
      mock.method(BleClient, 'connect', async () => {});
      mock.method(BleClient, 'startNotifications', async () => {});
      mock.method(BleClient, 'read', async () => new DataView(new ArrayBuffer(1)));

      // Mock Capacitor to return native platform for native tests
      mock.method(Capacitor, 'isNativePlatform', () => true);
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('connects via Native BleClient when Capacitor is native platform', async () => {
      const telemetry = await BleManager.connectToBike('generic');

      assert.strictEqual(telemetry.isConnected, true);
      assert.strictEqual(telemetry.deviceName, 'Test Bike');
      // @ts-ignore
      assert.strictEqual(BleClient.initialize.mock.calls.length, 1);
      // @ts-ignore
      assert.strictEqual(BleClient.requestDevice.mock.calls.length, 1);
      // @ts-ignore
      assert.strictEqual(BleClient.connect.mock.calls.length, 1);
    });

    it('connects via Web Bluetooth when Capacitor is not native platform', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => false);

      const mockDevice = {
        name: 'Web Bike',
        gatt: {
          connect: async () => ({
            getPrimaryService: async () => ({
              getCharacteristic: async () => ({
                readValue: async () => new DataView(new ArrayBuffer(1)),
                startNotifications: async () => {},
                addEventListener: () => {}
              })
            })
          })
        },
        addEventListener: () => {}
      };

      // In tests environments without navigator, we use globalThis to simulate it
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          bluetooth: {
            requestDevice: async () => mockDevice
          }
        },
        configurable: true
      });

      const telemetry = await BleManager.connectToBike('generic');

      assert.strictEqual(telemetry.isConnected, true);
      assert.strictEqual(telemetry.deviceName, 'Web Bike');

      // cleanup
      delete (globalThis as any).navigator;
    });

    it('throws error when Web Bluetooth is not available', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => false);

      // Ensure navigator doesn't have bluetooth
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true
      });

      await assert.rejects(
        BleManager.connectToBike('generic'),
        /Web-Bluetooth wird in dieser Umgebung nicht unterstützt/
      );

      delete (globalThis as any).navigator;
    });
  });

  describe('Assist Mode', () => {
    beforeEach(() => {
      mock.method(BleClient, 'write', async () => {});
    });

    afterEach(() => {
      mock.restoreAll();
    });

    it('fails to set assist mode when not connected (Native)', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => true);
      // Force device ID to be null
      (BleManager as any).activeDeviceId = null;

      const result = await BleManager.setAssistMode('turbo');
      assert.strictEqual(result, false);
    });

    it('sets assist mode successfully for specialized (Native)', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => true);
      (BleManager as any).activeDeviceId = 'test-device';
      (BleManager as any).activeManufacturer = 'specialized';

      const result = await BleManager.setAssistMode('turbo');
      assert.strictEqual(result, true);

      // @ts-ignore
      assert.strictEqual(BleClient.write.mock.calls.length, 1);
    });

    it('fails to set assist mode when not connected (Web)', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => false);
      // Force gatt server to be null
      (BleManager as any).activeGattServer = null;

      const result = await BleManager.setAssistMode('turbo');
      assert.strictEqual(result, false);
    });

    it('sets assist mode successfully for specialized (Web)', async () => {
      mock.method(Capacitor, 'isNativePlatform', () => false);

      let writtenValue: any = null;
      const mockChar = {
        writeValue: async (val: any) => { writtenValue = val; }
      };
      const mockService = {
        getCharacteristic: async () => mockChar
      };

      (BleManager as any).activeGattServer = {
        getPrimaryService: async () => mockService
      };
      (BleManager as any).activeManufacturer = 'specialized';

      const result = await BleManager.setAssistMode('turbo');
      assert.strictEqual(result, true);
      assert.notStrictEqual(writtenValue, null);
    });
  });

  describe('subscribeTelemetry', () => {
    it('can subscribe and receive updates', () => {
      let receivedUpdates = 0;

      const unsubscribe = BleManager.subscribeTelemetry(
        { isConnected: true, speedKmH: 0, cadenceRpm: 0, riderPowerWatts: 0, motorAssistMode: 'off', batteryPercent: 100 },
        (update) => {
          receivedUpdates++;
        }
      );

      // Trigger an update internally
      (BleManager as any).updateState({ speedKmH: 25 });

      assert.strictEqual(receivedUpdates, 1);

      unsubscribe();

      // Trigger another update
      (BleManager as any).updateState({ speedKmH: 20 });

      // Counter should not have incremented since we unsubscribed
      assert.strictEqual(receivedUpdates, 1);
    });
  });
});
