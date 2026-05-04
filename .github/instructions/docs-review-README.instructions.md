---
applyTo: "**/README.md"
---

#codebase

Prüfe, ob `README.md` noch zum aktuellen Stand der Codebasis passt.

## Vorgehensweise

1. Vergleiche den Inhalt von `README.md` systematisch mit dem aktuellen Code.
2. Identifiziere alle relevanten Aussagen: Features, Befehle, Konfigurationen, Dateipfade, Modulnamen, Architekturbeschreibungen, Setup-/Build-/Run-Hinweise.
3. Bewerte nach der Status-Legende aus `docs-review-base.instructions.md`.

## Zu prüfende Quellen

- `package.json` (Scripts, Dependencies)
- Config-Dateien (`tsconfig.json`, `vite.config.*`)
- Tatsächliche Ordnerstruktur und Einstiegspunkte
- Zentrale Imports und Modulgrenzen

## Ausgabeformat

### Gesamtstatus
Kurze Einschätzung (1–3 Sätze): Ist das README insgesamt aktuell, teilweise oder deutlich veraltet?

### Detailprüfung
(Standard-Format aus `docs-review-base.instructions.md` verwenden)

### Empfohlene README-Updates
Priorisierte To-do-Liste:
1. Kritische Korrekturen (falsche Commands, nicht mehr existierende Dateipfade, falsche Setup-Schritte)
2. Veraltete Feature-Beschreibungen
3. Optionale Ergänzungen
