1. Add `isBafangSafeToWrite(deviceName?: string): boolean` to `src/services/ble/parsers/bafangParser.ts`.
   - The function should return true only for known-safe Bafang models and false for risky models (e.g. M560, M820, C245) or unknown models.
   - If we look at the warning: "SICHERHEIT: Bafang Schreibzugriffe sind riskant (z.B. M560/C245 Settings Wipe)."
   - "TODO: In Zukunft striktes Read-Only fuer unbekannte Modelle erzwingen."
   - "console.warn('BAFANG WRITE: Sende Command an BAFANG_RX_CHAR. Vorsicht bei M560/M820!');"
   - What are the known models that are safe to write? We should likely allow ones that are explicitly verified or at least block the ones that are unverified. Let's create an explicit allowlist based on the models in `BAFANG_NAME_PREFIXES` that aren't the risky ones, or just block unknown and risky ones.
   - Wait, if it says "strict read-only for unknown models", we should check if it's one of the known safe ones. E.g., `m400`, `m420`, `m500`, `m510`, `m600`, `8fun`, `aeg`, `prophete`, `fischer`. But we should block `m560`, `m820`, `c245` explicitly, and anything not known.
2. Update `src/services/ble/bleManager.ts`:
   - Import `isBafangSafeToWrite` from `./parsers/bafangParser`.
   - Before `await BleClient.write(...)` or `char.writeValue(...)` for Bafang, check `if (!isBafangSafeToWrite(this.lastKnownTelemetry.deviceName)) { console.warn('...'); return false; }`.
3. Pre-commit check.
4. Submit.
