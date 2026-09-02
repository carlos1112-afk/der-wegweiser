# 🚲 BLE-Sensorik & E-Bike Telemetrie (BLE Telemetry & Sensors)

**Der Wegweiser** bindet E-Bikes und Fahrradsensoren direkt über standardisierte Bluetooth-Low-Energy-(BLE)-GATT-Profile ein. Dadurch ist die Plattform herstellerunabhängig und benötigt keine proprietären Cloud-Dienste der Fahrradhersteller.

---

## 📡 Unterstützte Bluetooth GATT Profile

Die App scannt und verbindet sich mit standardisierten BLE-Diensten:

| Dienst (Service) | Standard UUID | Charakteristiken | Erfasste Messwerte |
| :--- | :--- | :--- | :--- |
| **Battery Service** | `0x180F` | Battery Level (`0x2A19`) | Ladestand des Akkus in Prozent (%) |
| **Cycling Power** | `0x1818` | Cycling Power Measurement (`0x2A63`) | Momentanleistung des Fahrers in Watt (W) |
| **Cycling Speed and Cadence (CSCS)** | `0x1816` | CSC Measurement (`0x2A5B`) | Radumdrehungen (Geschwindigkeit) und Kurbelumdrehungen (Trittfrequenz in RPM) |
| **Heart Rate** | `0x180D` | Heart Rate Measurement (`0x2A37`) | Herzfrequenz des Fahrers (BPM) |

---

## 🧠 Die „No-Coast“-Reichweiten-Heuristik

Klassische Bordcomputer schätzen die Restreichweite lediglich anhand des Durchschnittsverbrauchs der letzten Kilometer. Bei bevorstehenden Pässen, Gegenwind oder Kälteeinbrüchen führt dies zu fatalen Fehlschätzungen (*Range Anxiety*).

Die No-Coast-Engine von **Der Wegweiser** berechnet die voraussichtliche Reichweite physikalisch vorab:

$$\text{Restreichweite (km)} = \frac{E_{\text{Rest}} (\text{Wh})}{P_{\text{Basis}} + P_{\text{Steigung}} + P_{\text{Wind}}}$$

### Einflussfaktoren:
1. **Verbleibende Energie $E_{\text{Rest}}$:**
   * Ermittelt aus nominaler Akkukapazität (z. B. 625 Wh oder 750 Wh) multipliziert mit dem BLE-gemeldeten Ladestand ($SOC$).
2. **Steigungswiderstand $P_{\text{Steigung}}$:**
   * Berechnet anhand des SRTM-Höhenprofils der geplanten Route und des Gesamtgewichts (Fahrer + Fahrrad + Gepäck).
3. **Aerodynamischer Windwiderstand $P_{\text{Wind}}$:**
   * Live-Abgleich der Fahrtrichtung mit Windgeschwindigkeit und Windrichtung via Open-Meteo.
4. **Fahrer-Eigenleistung:**
   * Wenn ein BLE-Powermeter gekoppelt ist, fließt die durchschnittliche menschliche Tretleistung (z. B. 150 W) entlastend in die Energiebilanz des Motors ein.

---

## 🔗 Kopplungsanleitung

1. Schalte dein E-Bike bzw. deinen Sensor ein und aktiviere Bluetooth am Smartphone.
2. Öffne **Der Wegweiser** und tippe auf das **Batterie-/Sensor-HUD** in der Menüleiste.
3. Klicke auf **„Sensor verbinden“**.
4. Wähle dein Gerät aus der Liste der gefundenen Bluetooth-Geräte aus.
5. Nach erfolgreicher Kopplung werden Akkustand, Leistung und Trittfrequenz in Echtzeit aktualisiert.
