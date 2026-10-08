# Bibel der Schande v2.1 — Vollstrecker-Regeln & Governance

**Geltungsbereich:** Vollstrecker des Fürsten / Alle Agenten im Repository `Der WEGWEISER`.  
**Autoritative Quelle:** `http://bibel.local/api/wiki/search` (POST /api/wiki/search). Bei Widersprüchen hat die Wiki v2.1 stets Vorrang vor lokalen Annahmen.

---

## 1. Die sechs Säulen der Prüfung (Entry / Exit Criteria)

1. **Prüfbare Behauptung:** Jede Code- oder Architekturänderung muss in genau einem Satz überprüfbar formuliert sein.
2. **Negativtest vor dem Fix:** Vor jedem Bugfix oder neuem Feature muss ein aussagekräftiger Negativtest existieren, der den Fehlerfall sichtbar reproduziert.
3. **Echte Baseline:** Keine ungemessenen Vorher-Nachher-Vergleiche. Bestehender Zustand wird vorab getestet und protokolliert.
4. **Keine Blindabnahmen:** „Es läuft“ oder „Build ist grün“ ohne konkreten Testbeleg ist eine Schande und verboten.
5. **Vollständige Fehlerpfade & Honest Degradation:** Alle Fehlerszenarien (Offline, 4xx, 5xx, Timeouts) müssen mit Graceful/Honest Fallbacks abgefangen werden. Keine erfundenen Telemetrie- oder Routendaten!
6. **Zustandsklassifikation im Abschluss:** Jeder Bericht muss explizit gekennzeichnet sein:
   - `[FAKT]`: Vollständig getestet, reproduzierbar und durch Terminal-/Testoutput belegt.
   - `[VERMUTUNG]`: Hypothesen vor Testverifikation (müssen belegt oder verworfen werden).
   - `[COMPLIANCE]`: Vorgaben gemäß DSGVO, EU AI Act, IEC 62443.
   - `[RISIKO]`: Restrisiken und technische Schulden.

---

## 2. Schandliste v2.1 (Auszug kritischer Verbote)

1. **Niemals kaputten Code committen (`npm run build` / Tests müssen grün sein).**
2. **Keine ungetesteten Annahmen oder erfundenen Messwerte/Mocks in Produktion.**
3. **Keine stillschweigenden Datenverluste oder Destruktivbefehle ohne Benutzerfreigabe.**
4. **Kein Shadow-AI-Bypass der definierten Befehlskette.**

---

## 3. Wiki-Konsultation bei Unsicherheit

Wenn Unklarheit über Regeln, Schnittstellen oder Teststandards besteht:
Führe eine semantische Suche über den Projekt-Skill `bibel-suche` (`http://bibel.local/api/wiki/search`) aus. Niemals raten!
