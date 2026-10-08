import fs from 'fs';

let content = fs.readFileSync('src/services/ble/parsers/bafangParser.ts', 'utf8');

// Update Characterstics
content = content.replace(
  /export const BAFANG_TX_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';/,
  "export const BAFANG_RX_CHAR = '0000ffe1-0000-1000-8000-00805f9b34fb';\nexport const BAFANG_TX_CHAR = '0000ffe2-0000-1000-8000-00805f9b34fb';"
);
content = content.replace(
  /export const BAFANG_RX_CHAR = '0000ffe2-0000-1000-8000-00805f9b34fb';/,
  "// Removed duplicate"
);

// Update Model detection
const oldDetection = `if (lower.includes('m500') || lower.includes('m510') || lower.includes('m600')) {
    return 'Bafang M-Serie High-Torque CAN';
  }`;
const newDetection = `if (lower.includes('m510rs') || lower.includes('m560rs')) {
    return 'Bafang M-Serie RS (Racing-Sport eMTB)';
  }
  if (lower.includes('m500') || lower.includes('m510') || lower.includes('m560') || lower.includes('m600') || lower.includes('m620') || lower.includes('m615')) {
    return 'Bafang M-Serie High-Torque CAN';
  }
  if (lower.includes('m800') || lower.includes('m820')) {
    return 'Bafang M-Serie Ultra-Light (eRoad/eGravel)';
  }
  if (lower.includes('h730') || lower.includes('g500a') || lower.includes('e510')) {
    return 'Bafang GVT Automatik Nabenmotor';
  }`;
content = content.replace(oldDetection, newDetection);

// Add the 0x55 0xAA parsing logic
const newParserBlock = `  // 5. Neuer Bafang CAN/UART Standard (Header 0x55 0xAA)
  if (header === 0x55 && value.byteLength >= 2 && value.getUint8(1) === 0xAA) {
    if (value.byteLength >= 3) {
      const cmdId = value.getUint8(2);
      // Command 0x20: Status (20 Byte Payload)
      if (cmdId === 0x20 && value.byteLength >= 18) {
        result.speedKmH = value.getUint8(3); 
        const torqueRaw = value.getUint16(4, true); 
        const powerRaw = value.getUint16(6, true);
        const pasLevel = value.getUint8(8);
        const battSoc = value.getUint8(9);
        const voltage = value.getUint16(10, true) / 10;
        const current = value.getUint16(12, true) / 10;
        const temp = value.getUint8(14) - 20;

        result.motorPowerWatts = powerRaw;
        result.batteryPercent = Math.min(100, Math.max(0, battSoc));
        result.batteryKnown = true;
        result.motorTemperatureC = temp;
        mapAssistMode(result, pasLevel);
        return result;
      }
    }
  }

  // 4. AEG / Prophete`;

content = content.replace('  // 4. AEG / Prophete', newParserBlock);

fs.writeFileSync('src/services/ble/parsers/bafangParser.ts', content);
console.log("Updated bafangParser.ts");
