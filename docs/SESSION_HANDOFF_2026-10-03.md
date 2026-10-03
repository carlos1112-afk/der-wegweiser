# Sitzungs-Handoff — 2026-10-03

Kurze Zusammenfassung des Claude-Sitzungsstands bei Sitzungsende, damit nichts verloren geht.

## Gemerged in dieser Sitzung
- PR #5 — Node-Version-Alignment (deploy.yml 20→22)
- PR #6 — GUI/UX-Audit (Doku, kein Code)
- PR #7 — CI-Actions auf Commit-SHA gepinnt (behob repo-weiten CI-Blocker)
- PR #8 — POI-Schema, Firestore-Rules, Seed-Daten
- PR #9 — GUI Phase 1 (Burger-Menü, Bottom-Bar, Consent-Modal-Fix, Ambient-Confetti)
- PR #11 — `claude-v2-finalization.yml`: Autor-Check ergänzt (verhinderte, dass jeder PR-Kommentator den Workflow mit Repo-Secrets auslösen konnte)

## Noch offen

### PR #10 — BLE-Tester & Bafang/Bosch Flow-API
Formal verifiziert (CI grün, `mergeable_state: clean`), aber funktional **nicht** end-to-end bestätigt. Wartet auf einen echten Logcat-Trace einer Probefahrt mit dem 800ms-Heartbeat-Polling, bevor es als wirklich funktionsfähig gilt. **Nicht ohne diesen Nachweis mergen.**

### Play Console / Store-Readiness
- ✅ App-Metadaten, Store-Listing, Icons, Screenshots, Play-Data-Safety-Doku, Permissions+Begründungen sind vollständig.
- ❌ Kein echter Release-Keystore im Repo (korrekt, da gitignored — aber auch nicht an anderer Stelle hinterlegt/erzeugt).
- ❌ Keine CI-Pipeline, die eine signierte `.aab` baut (`ci.yml` baut nur `assembleDebug`).
- ⚠️ **Widerspruch zu klären:** `docs/audits/final_release_readiness_audit.md` sagt Signing sei noch offen; `release/google-play/1.0.0-rc2/RELEASE_RECORD.md` behauptet, die App liefe bereits in Google Play Closed Testing mit 12+ Testern. Beide Dateien stammen aus demselben Commit (`1301ad9`), kein CI-Artefakt oder Build-Log im Repo stützt die "bereits live"-Behauptung. Menschliche Klärung nötig: ist die App tatsächlich schon in Closed Testing, oder ist das aspirative Dokumentation?

### `kepler/code-review-blocker-analysis` (disjunkter Branch, 67 Commits)
- Security-/Privacy-Fix (`d03ccf3`) ist bereits byte-identisch in `main` — nichts zu tun, Branch kann geschlossen werden.
- Die zwei älteren UI-Commits (`37e2b36`, `0146861`) basieren auf dem durch PR #9 abgelösten alten Layout — kein Mehrwert, nicht re-importieren.

### Charge & Earn — neue Jules-Issues
Großteil des Belohnungssystems in `LoungeModal.tsx` ist hartkodierte Platzhalter-Daten, kein echtes Backend:
- #12 — Quiz-Fragenpool (aktuell nur 5 statische Fragen)
- #13 — Shop-Redemption-Codes sind statisch/geteilt, kein Pro-User-Tracking
- #14 — Leaderboard ist komplett erfundene Fake-Daten (inkl. eincodiertem Fake-Eintrag für den Nutzer selbst)
- #15 — nur ein echtes Minigame (Watt-Catcher), zweites fehlt

## Standing Rule
Kein Merge auf `main`/`master` in beiden Repos ohne explizite Freigabe des Nutzers — gilt unverändert weiter.
