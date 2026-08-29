# GOOGLE PLAY FOREGROUND SERVICE DECLARATION — LOCATION

Dieses Dokument enthält die verbindlichen Antworten für die **Google Play Console Foreground Service (FGS) Deklaration** für den Typ `location` (`FOREGROUND_SERVICE_LOCATION`) in **Der Wegweiser 1.0**.

---

## 📋 1. Zweck & Kernfunktion des Foreground Service

* **Deklarierter FGS-Typ**: `location` (`android:foregroundServiceType="location"`)
* **Berechtigungen**: `android.permission.FOREGROUND_SERVICE`, `android.permission.FOREGROUND_SERVICE_LOCATION`
* **Kernfunktion**: Aktive Turn-by-Turn-Navigation und Reichweitenprognose für Fahrrad- und E-Bike-Fahrer während der Fahrt.

---

## 🎯 2. Konkrete Beantwortung der Google Play Console Fragen

### Frage 1: Welche Hauptfunktion der App erfordert einen Foreground Service?
> **Antwort**:  
> Die aktive Turn-by-Turn-Fahrrad- und E-Bike-Navigation. Während einer vom Nutzer gestarteten Fahrt müssen GPS-Positionen kontinuierlich erfasst werden, um akustische Abbiegehinweise, Routenabweichungen und Live-Akkureichweitenberechnungen auch dann auszuführen, wenn das Display zur Energieeinsparung gesperrt oder die App minimiert ist.

### Frage 2: Wie wird der Foreground Service gestartet?
> **Antwort**:  
> Ausschließlich durch eine bewusste, ausdrückliche Nutzeraktion innerhalb der geöffneten und sichtbaren App (Antippen von **„Navigation starten“** nach Auswahl einer Route). Ein automatischer oder unbemerkter Hintergrundstart existiert nicht.

### Frage 3: Wie wird der Nutzer über den laufenden Dienst informiert?
> **Antwort**:  
> Sobald die Navigation startet, wird eine dauerhafte System-Benachrichtigung in der Android-Statusleiste angezeigt (*„Der Wegweiser — Navigation aktiv: Nächste Abbiegung...“*). Der Nutzer sieht jederzeit, dass der Dienst aktiv ist.

### Frage 4: Warum ist eine sofortige und unterbrechungsfreie Ausführung zwingend erforderlich?
> **Antwort**:  
> Beim Fahrradfahren bewegen sich Nutzer im Straßenverkehr. Eine Verzögerung oder ein Einfrieren der Positionsdaten durch Android-Doze-Modi würde dazu führen, dass Abbiegehinweise zu spät oder gar nicht angesagt werden, was ein direktes Sicherheitsrisiko für den Radfahrer darstellt.

### Frage 5: Was passiert, wenn der Dienst unterbrochen oder beendet wird?
> **Antwort**:  
> Die akustische Navigation bricht ab, Routenabweichungen werden nicht mehr erkannt und der Fahrer verliert die Orientierung auf der geplanten Fahrradstrecke.

### Frage 6: Wie und wann wird der Foreground Service beendet?
> **Antwort**:  
> Der Dienst wird unmittelbar gestoppt, sobald der Nutzer die Fahrt durch Antippen von **„Navigation beenden“** (oder **„Stop“** in der Benachrichtigung) beendet oder das Ziel erreicht hat.

---

## 🔒 3. Lifecycle-Invariante (Store-Compliance)

```
Sichtbare App (Nutzer wählt Route)
  ⬇
Nutzer tippt „Navigation starten“
  ⬇
Location Foreground Service startet + permanente Notification sichtbar
  ⬇
Aktive Fahrt (Bildschirm gesperrt / App minimiert zulässig)
  ⬇
Nutzer tippt „Navigation beenden“ (oder Ziel erreicht)
  ⬇
Location Foreground Service stoppt sofort & gibt GPS-Ressourcen frei
```
