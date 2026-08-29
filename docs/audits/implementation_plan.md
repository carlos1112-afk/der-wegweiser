# Implementierungsplan: Phase 2 — Store-Branding & Assets (Google Play & Apple App Store)

Dieser Plan definiert die Erstellung aller grafischen Assets, App-Icons, Splash-Screens und Marketing-Screenshots für den **Google Play Store** und den **Apple App Store**.

---

## 📱 Technische Spezifikationen beider Stores

```
┌──────────────────────────────────────────────┬──────────────────────────────────────────────┐
│            GOOGLE PLAY STORE (ANDROID)       │           APPLE APP STORE (iOS)              │
├──────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ • Adaptive Icon: 432x432 (Foreground + BG)   │ • App Store Icon: 1024x1024 px (ohne Alpha)  │
│ • Play Store Hi-Res Icon: 512x512 px PNG     │ • Asset Catalog: Single Universal 1024x1024  │
│ • Feature Graphic: 1024x500 px (Banner)      │ • 6.7" iPhone Screenshots: 1290x2796 px      │
│ • Phone Screenshots: 1080x2400 px            │ • 6.5" iPhone Screenshots: 1242x2688 px      │
│ • Android 12+ Splash Screen XML & Vector     │ • LaunchScreen.storyboard / Splash Asset Set │
└──────────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 🎨 Designentscheidungen zur Abstimmung

### 1. App-Icon Konzept
> [!IMPORTANT]
> Das App-Icon ist das Aushängeschild auf dem Homescreen und im Store. Welcher Stil gefällt dir am besten?

* **(Empfohlen) Option A: Cyberpunk Neon Glow**  
  Tiefdunkler Obsidian-Hintergrund (`#050a14`), leuchtender türkiser Wegweiser-Kompasspfeil (`#00f0ff`) mit einem feinen goldgelben Energieblitz (`#ffb700`) im Zentrum. Hohe Wiedererkennbarkeit bei Tag und Nacht.
* **Option B: Clean High-Contrast Vector**  
  Sehr scharfer, minimalistischer weiß-türkiser Kompassring auf sattem Navy-Blau (`#0a182c`), ohne starke Lichteffekte.
* **Option C: Tech-E-Bike Silhouette**  
  Kompasspfeil kombiniert mit stilisierten E-Bike-Fahrbahnlinien und Batterie-Spannungsbogen.

---

### 2. Marketing-Screenshots & Framing (5 Key Visuals)
Welche 5 Kern-Features sollen in den App Stores im Vordergrund stehen?

1. 🌟 **Screenshot 1 — KI-Antizipation**: *"Deine perfekte E-Bike Tour mit 0 Klicks"* (Heute-Tour Antizipation).
2. 🗺️ **Screenshot 2 — 3D Cyberpunk Cockpit**: *"Live-Höhenprofil & Steigungs-Farbwarnungen"* (HUD + Navigation).
3. ⚡ **Screenshot 3 — E-Bike Telemetrie**: *"Bosch, Shimano & Co. in Echtzeit"* (Watt, RPM, SoC %).
4. 🪙 **Screenshot 4 — Charge 'n' Earn**: *"Prämien & Tokens bei jeder Ladepause"* (Lounge + Offerwall).
5. 📶 **Screenshot 5 — 100 % Offline-Karten**: *"Verlässliche Navigation ohne Netz"* (Corridor Caching).

**Framing-Stil:**
* **Option 1**: Schwebendes modernes Smartphone mit dezentem Cyberpunk-Glow und großen deutschen Textbannern oben.
* **Option 2**: Reale Outdoor-Bilder im Hintergrund (Alpenpanorama / Badesee) mit eingebettetem Smartphone.

---

### 3. Splash-Screen Kaltstart-Verhalten
* **(Empfohlen) Option A: Fast Minimalist Fade**  
  Dunkler Hintergrund `#050a14`, das leuchtende Wegweiser-Logo pulsiert kurz und blendet nach max. 250 ms weich in die interaktive Karte über (Apple empfiehlt minimale Ladeverzögerungen).
* **Option B: Cyberpunk Boot Sequence**  
  Kurze Ladeanimation mit kleinem System-Status (*"Initialisiere Telemetrie..."*).

---

## 🛠️ Geplante Datei-Änderungen & Asset-Generierung

### Android Platform
- `android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- `android/app/src/main/res/values/styles.xml` (Android 12 Splash Theme)
- `android/app/src/main/res/drawable/splash_background.xml`

### iOS Platform
- `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024x1024 Universal)
- `ios/App/App/Assets.xcassets/Splash.imageset/` (Launch Screen Splash PNGs)
- `ios/App/App/Base.lproj/LaunchScreen.storyboard` (Dunkles Launch Theme)

### Marketing Assets (Play Store & App Store)
- `assets/store/feature_graphic_1024x500.png`
- `assets/store/ios_screenshot_1_anticipation.png` (1290x2796 px)
- `assets/store/ios_screenshot_2_cockpit.png`
- `assets/store/ios_screenshot_3_telemetry.png`
- `assets/store/ios_screenshot_4_rewards.png`
- `assets/store/ios_screenshot_5_offline.png`

---

## 🧪 Verifikationsplan
- Build-Test auf Android & iOS via `npx cap sync`.
- Überprüfung der Icon-Skalierung auf unterschiedlichen DPI-Dichten.
- Validierung der Bild-Abmessungen gegen die Google Play & Apple App Store Upload-Spezifikationen.
