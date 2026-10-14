import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BleManager } from '../../../src/services/ble/bleManager.js';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';

describe('BleManager', () => {
  describe('detectManufacturer', () => {
    it('detects bosch from name', () => {
      expect(BleManager.detectManufacturer('Bosch Kiox')).toBe('bosch');
    });

    it('detects specialized from name', () => {
      expect(BleManager.detectManufacturer('Specialized Levo')).toBe('specialized');
    });

    it('detects shimano from name', () => {
      expect(BleManager.detectManufacturer('Shimano STEPS')).toBe('shimano');
    });

    it('detects mahle from name', () => {
      expect(BleManager.detectManufacturer('Mahle X35')).toBe('mahle');
    });

    it('detects bafang from name', () => {
      expect(BleManager.detectManufacturer('Bafang CAN')).toBe('bafang');
    });

    it('defaults to generic when name is unknown', () => {
      expect(BleManager.detectManufacturer('Unknown Bike')).toBe('generic');
    });
  });

  describe('Connection Paths', () => {
    beforeEach(() => {
      // Mock BleClient methods
      vi.spyOn(BleClient, 'initialize').mockResolvedValue();
      vi.spyOn(BleClient, 'requestDevice').mockResolvedValue({ deviceId: 'test-device', name: 'Test Bike' } as any);
      vi.spyOn(BleClient, 'connect').mockResolvedValue();
      vi.spyOn(BleClient, 'startNotifications').mockResolvedValue();
      vi.spyOn(BleClient, 'read').mockResolvedValue(new DataView(new ArrayBuffer(1)));

      // Mock Capacitor to return native platform for native tests
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('connects via Native BleClient when Capacitor is native platform', async () => {
      const telemetry = await BleManager.connectToBike('generic');

      expect(telemetry.isConnected).toBe(true);
      expect(telemetry.deviceName).toBe('Test Bike');
      expect(BleClient.initialize).toHaveBeenCalledTimes(1);
      expect(BleClient.requestDevice).toHaveBeenCalledTimes(1);
      expect(BleClient.connect).toHaveBeenCalledTimes(1);
    });

    it('connects via Web Bluetooth when Capacitor is not native platform', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

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

      expect(telemetry.isConnected).toBe(true);
      expect(telemetry.deviceName).toBe('Web Bike');

      // cleanup
      delete (globalThis as any).navigator;
    });

    it('throws error when Web Bluetooth is not available', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

      // Ensure navigator doesn't have bluetooth
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        configurable: true
      });

      await expect(BleManager.connectToBike('generic')).rejects.toThrow(
        /Web-Bluetooth wird in dieser Umgebung nicht unterstützt/
      );

      delete (globalThis as any).navigator;
    });
  });

  describe('Assist Mode', () => {
    beforeEach(() => {
      vi.spyOn(BleClient, 'write').mockResolvedValue();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('fails to set assist mode when not connected (Native)', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      // Force device ID to be null
      (BleManager as any).activeDeviceId = null;

      const result = await BleManager.setAssistMode('turbo');
      expect(result).toBe(false);
    });

    it('sets assist mode successfully for specialized (Native)', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      (BleManager as any).activeDeviceId = 'test-device';
      (BleManager as any).activeManufacturer = 'specialized';

      const result = await BleManager.setAssistMode('turbo');
      expect(result).toBe(true);
      expect(BleClient.write).toHaveBeenCalledTimes(1);
    });

    it('fails to set assist mode when not connected (Web)', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
      // Force gatt server to be null
      (BleManager as any).activeGattServer = null;

      const result = await BleManager.setAssistMode('turbo');
      expect(result).toBe(false);
    });

    it('sets assist mode successfully for specialized (Web)', async () => {
      vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);

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
      expect(result).toBe(true);
      expect(writtenValue).not.toBeNull();
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

      expect(receivedUpdates).toBe(1);

      unsubscribe();

      // Trigger another update
      (BleManager as any).updateState({ speedKmH: 20 });

      // Counter should not have incremented since we unsubscribed
      expect(receivedUpdates).toBe(1);
    });
  });
});
