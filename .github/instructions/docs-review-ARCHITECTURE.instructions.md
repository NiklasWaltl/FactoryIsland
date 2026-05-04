---
applyTo: "**/ARCHITECTURE.md"
---

#codebase

Führe ein Architektur-Dokumentations-Audit für `ARCHITECTURE.md` gegen die aktuelle Codebasis durch.

## Vorgehensweise

1. Extrahiere die zentralen Architekturbehauptungen aus `ARCHITECTURE.md`.
2. Suche im Code nach passenden Belegen oder Widersprüchen.
3. Bewerte jede Behauptung nach der Status-Legende aus `docs-review-base.instructions.md`.
4. Formuliere für jede 🔴- oder 🟡-Abweichung eine konkrete Dokumentationsänderung.

## Prüfschwerpunkte

- Tatsächliche Entry-Points
- Aktuelle Modulgrenzen
- Zentrale Manager, Services, Stores, Systeme
- Neue Feature-Bereiche, die im Dokument fehlen
- Veraltete Ordner-/Dateistrukturen
- Diskrepanzen zwischen dokumentierter und echter Verantwortungsverteilung

## Zusätzliche Ausgabe

Schließe mit:
- `Top 5 veraltete oder fehlende Doku-Punkte`
- `Konkrete Textbausteine für die Aktualisierung von ARCHITECTURE.md`
