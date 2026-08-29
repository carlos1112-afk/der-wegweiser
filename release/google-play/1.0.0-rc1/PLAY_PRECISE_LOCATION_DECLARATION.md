# GOOGLE PLAY PRECISE LOCATION DECLARATION — ACCESS_FINE_LOCATION

Dieses Dokument begründet die Notwendigkeit der Berechtigung `ACCESS_FINE_LOCATION` (Präziser Standort) für **Der Wegweiser 1.0** gemäß den Google Play Standort-Richtlinien.

---

## 🛰️ 1. Verwendungszweck für präzisen Standort

* **Berechtigung**: `android.permission.ACCESS_FINE_LOCATION`
* **Nutzungskontext**: Ausschließlich während einer vom Nutzer aktiv gestarteten Navigationssitzung.

---

## 🎯 2. Begründung gegenüber Google Play

### 1. Warum ist der präzise Standort (ACCESS_FINE_LOCATION) zwingend erforderlich?
> **Begründung**:  
> *Der Wegweiser* ist eine Navigations-App speziell für Fahrrad- und E-Bike-Fahrer. Radwege, Fahrradstraßen und Straßenkreuzungen liegen im städtischen und ländlichen Raum oft nur wenige Meter voneinander entfernt.  
> Präzise GPS-Koordinaten werden benötigt für:
> * **Exakte Positionsbestimmung auf dem Radweg**: Bestimmung, ob sich der Fahrer auf der Fahrradspur oder der Hauptstraße befindet.
> * **Sekundengenaue Turn-by-Turn-Ansagen**: Rechtzeitiges Ansagen von Abbiegemanövern kurz vor einer Kreuzung.
> * **Sofortige Abweichungserkennung & Re-Routing**: Erkennen, wenn der Fahrer eine Ausfahrt verpasst hat.
> * **Höhenprofil- & Steigungsberechnung**: Exakte Zuordnung der Geländehöhe zur Berechnung der verbleibenden E-Bike-Akkukapazität.

### 2. Warum reicht der grobe Standort (ACCESS_COARSE_LOCATION) technisch nicht aus?
> **Begründung**:  
> Ein grober Standort mit einer Ungenauigkeit von mehreren hundert Metern oder gar Kilometern macht eine straßengenaue Fahrrad-Navigation unmöglich. Abbiegehinweise würden viel zu spät oder auf falschen Parallelstraßen ausgelöst werden.

### 3. Keine verdeckte Hintergrundverfolgung
> **Zusicherung**:  
> *Der Wegweiser* erfasst präzise Standortdaten **ausschließlich während einer aktiven, vom Nutzer gestarteten Fahrt** (über einen sichtbaren Location Foreground Service). Es findet **keine permanente Hintergrundverfolgung** im Ruhezustand der App statt (`ACCESS_BACKGROUND_LOCATION` ist nicht im Manifest enthalten).
