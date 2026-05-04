#codebase

Führe ein Architektur-Dokumentations-Audit für `ARCHITECTURE.md` gegen die aktuelle Codebasis durch.

Arbeite in 4 Schritten:
1. Extrahiere zuerst die zentralen Architekturbehauptungen aus `ARCHITECTURE.md`.
2. Suche dann im Code nach den passenden Belegen oder Widersprüchen.
3. Bewerte jede Behauptung mit 🔴 / 🟡 / 🟢.
4. Formuliere für jede 🔴- oder 🟡-Abweichung eine konkrete Dokumentationsänderung.

Pflicht pro Befund:
- Status
- Thema
- Referenz in `ARCHITECTURE.md`
- Referenzen im Code (Dateien / Ordner / Symbole)
- Abweichung oder Bestätigung in 1–3 Sätzen
- konkrete Update-Empfehlung für `ARCHITECTURE.md` (bei 🔴/🟡)

Achte besonders auf:
- tatsächliche Entry-Points
- aktuelle Modulgrenzen
- zentrale Manager, Services, Stores, Systeme
- eventuelle neue Feature-Bereiche, die im Dokument fehlen
- veraltete Ordner-/Dateistrukturen
- Diskrepanzen zwischen dokumentierter und echter Verantwortungsverteilung

Schließe mit:
- `Top 5 veraltete oder fehlende Doku-Punkte`
- `Konkrete Textbausteine für die Aktualisierung von ARCHITECTURE.md`