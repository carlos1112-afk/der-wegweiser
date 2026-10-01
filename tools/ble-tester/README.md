# Wegweiser BLE-Tester

Eigenständige, winzige Diagnose-APK (separat von der Hauptapp "Der Wegweiser").
Zweck: in wenigen Sekunden überprüfen, ob ein echtes Bosch- oder Bafang-System
sich per Bluetooth LE verbinden lässt und ob die **echten Produktions-Parser**
(`src/services/ble/parsers/boschLdiParser.ts`, `.../bafangParser.ts` aus der
Hauptapp) die ankommenden Telemetriepakete korrekt dekodieren.

Dieses Tool importiert die Parser-Funktionen **direkt aus der Hauptapp**
(relative Imports, kein kopierter/duplizierter Code). Eine hier erfolgreich
dekodierte Telemetrie beweist, dass genau der Code, der auch in der
Produktions-App läuft, mit echter Hardware funktioniert — nicht nur mit
synthetischen Test-Bytes.

**Kein Simulations-/Mock-Modus.** Ohne ein echtes, verbundenes Gerät zeigt der
Tester nichts an außer dem Verbindungsstatus. Wenn `navigator.bluetooth` in
der WebView nicht existiert, wird das offen als Fehler angezeigt statt
stillschweigend zu versagen — das ist eine bewusste Designentscheidung, kein
übersehener Fall.

## Build

```bash
cd tools/ble-tester
npm install
npm run build        # TS-Check + Vite-Build nach dist/
npx cap sync android  # einmalig, kopiert Web-Build in android/
npm run build:apk     # baut die Debug-APK lokal (braucht Android SDK + Java 21)
```

Fertige APK danach unter:
```
tools/ble-tester/android/app/build/outputs/apk/debug/app-debug.apk
```

Alternativ: jeder Push, der `tools/ble-tester/**` ändert, baut die APK
automatisch über `.github/workflows/ble-tester-ci.yml` und lädt sie als
GitHub-Actions-Artifact hoch — kein lokales Android-SDK nötig, um die APK zu
bekommen.

## Bedienung

1. App auf einem Android-Gerät installieren (Bluetooth-LE-fähig).
2. "Bosch verbinden" oder "Bafang verbinden" antippen.
3. Im System-Dialog das echte Gerät auswählen (muss eingeschaltet und in
   Reichweite sein).
4. Sobald Telemetrie-Pakete ankommen: Rohbytes (Hex) + geparste Werte laufen
   live im Log mit, die Kacheln oben zeigen den zuletzt dekodierten Stand.

## Scope-Grenze

Nur Bosch (BES3 Smart System / Diagnostic Service) und Bafang (CAN-over-BLE,
M-Serie) — die beiden in der Aufgabenstellung genannten Hersteller. Die
Hauptapp unterstützt zusätzlich Specialized/Shimano/Mahle/Standard-SIG; die
sind hier bewusst nicht verdrahtet, um das Tool klein zu halten. Soll bei
Bedarf erweitert werden, Pattern ist in `src/main.ts` (`MANUFACTURERS`-Map)
klar vorgegeben.
