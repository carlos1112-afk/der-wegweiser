# GOOGLE PLAY STANDORT- & FOREGROUND-SERVICE DOKUMENTATION

## 📌 Status: PERMISSION-MINIMIERUNG ERFOLGREICH DURCHGEFÜHRT

In Version 1.0 von **Der Wegweiser** wird **KEINE** `ACCESS_BACKGROUND_LOCATION` Berechtigung angefordert oder verwendet.

---

## 🧭 Reales Navigations- & Standortkonzept (Android 10 bis Android 16)

1. **Vordergrund-Start**: Der Nutzer startet die Navigation explizit in der sichtbaren Benutzeroberfläche der App (`AppLifecycleService.setMode('ride')`).
2. **Foreground Service mit `foregroundServiceType="location"`**:
   * Die App startet einen sichtbaren Android Foreground Service (`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION`).
   * In der Statusleiste wird eine permanente Notification angezeigt (*„Der Wegweiser — Navigation aktiv“*).
3. **Display-Off Navigation**:
   * Wenn der Radfahrer das Smartphone sperrt oder das Display ausschaltet, hält der Foreground Service die GPS-Standorterfassung und Audiosprachführung aktiv.
   * Gemäß Android-Spezifikation (Android 10 bis Android 16 / API 36) ist hierfür **keine** `ACCESS_BACKGROUND_LOCATION` Berechtigung erforderlich.
4. **Kein Google Play Background Location Sonderreview**:
   * Da `ACCESS_BACKGROUND_LOCATION` nicht im Manifest vorhanden ist, entfällt der gesonderte Google Play Background Location Review- und Video-Erklärungsprozess vollständig.
