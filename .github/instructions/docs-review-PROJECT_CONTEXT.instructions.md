---
applyTo: "**/project-context.md"
---

#codebase

Führe ein Dokumentations-Audit für `project-context.md` gegen die aktuelle Codebasis durch.

## Vorgehensweise

1. Extrahiere die zentralen Aussagen aus `project-context.md` (Projektziele, Feature-Beschreibungen, Spielmechaniken, Systemübersichten).
2. Suche im Code nach passenden Belegen oder Widersprüchen zu diesen Aussagen.
3. Bewerte jede Aussage nach der Status-Legende aus `docs-review-base.instructions.md`.
4. Formuliere für jede 🔴- oder 🟡-Abweichung eine konkrete Dokumentationsänderung.

## Prüfschwerpunkte

- Beschriebene Spielmechaniken vs. tatsächlich implementierte Systeme
- Genannte Features und ob sie im Code vorhanden, teilweise oder gar nicht umgesetzt sind
- Erwähnte Technologien, Engines und Bibliotheken (z. B. Phaser, React, TypeScript)
- Referenzierte Systeme (z. B. Crafting, Logistik, Simulation) und deren aktueller Implementierungsstand
- Veraltete oder fehlende Beschreibungen neuer Feature-Bereiche
- Konsistenz mit anderen Kerndokumenten (ARCHITECTURE.md, AGENTS.md, README.md)

## Zusätzliche Ausgabe

Schließe mit:
- `Top 5 veraltete oder fehlende Doku-Punkte`
- `Konkrete Textbausteine für die Aktualisierung von project-context.md`
