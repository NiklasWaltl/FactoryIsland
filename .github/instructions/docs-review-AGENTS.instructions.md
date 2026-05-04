---
applyTo: "**/AGENTS.md"
---

#codebase

Prüfe, ob `AGENTS.md` noch zum aktuellen Stand der Codebasis, der Projektstruktur und der verwendeten Toolchain passt.

## Vorgehensweise

1. Lies `AGENTS.md` vollständig: Aktiver Scope, Read-Order, Arbeitsmodus, Architektur- und Boundary-Regeln, Build-/Check-Standards, Stolperfallen, Guardrails.
2. Vergleiche jeden Punkt systematisch mit dem aktuellen Code.
3. Beziehe folgende Dateien explizit ein: `package.json`, `tsconfig.factory.json`, `vite.factory.config.ts`, `SYSTEM_REGISTRY.md`, `src/game/ARCHITECTURE.md`, `src/game/TYPES.md`, `.github/workflows/`, `CLAUDE.md`.
4. Bewerte nach der Status-Legende aus `docs-review-base.instructions.md`.

## Prüfschwerpunkte

- **Aktiver Scope:** Stimmen die aufgelisteten Pfade (`src/game/**`, Configs, Workflows) mit der tatsächlichen Verzeichnisstruktur überein?
- **Read-Order:** Existieren alle verlinkten Dokumente noch unter dem angegebenen Pfad?
- **Boundary-Regeln:** Sind die Regeln (z. B. kein Dispatch in Phaser, Rezepte nur unter `recipes/`, UI-Elemente unter `src/game/ui/**`) im Code tatsächlich eingehalten?
- **Build-/Check-Standards:** Sind alle genannten Skripte (`yarn dev`, `yarn build`, `yarn tsc`, `yarn test`, `yarn lint`) in `package.json` vorhanden und korrekt konfiguriert?
- **Stolperfallen:** Sind die dokumentierten Stolperfallen (z. B. `normalizeLoadedState()`, `direction`-Logik, `rg`-Verfügbarkeit) noch relevant und aktuell?
- **Guardrails:** Gibt es neue implizite Guardrails im Code, die in `AGENTS.md` nicht dokumentiert sind?
- **Neue Feature-Bereiche:** Gibt es Subsysteme oder Module im Code, die in `AGENTS.md` nicht erwähnt werden?

## Zusätzlicher Konsistenz-Check

Vergleiche `AGENTS.md` mit `CLAUDE.md` auf inhaltliche Überschneidungen und Widersprüche:

- **🔴 Widerspruch:** Eine Regel in `AGENTS.md` widerspricht explizit einer Regel in `CLAUDE.md`.
- **🟡 Inkonsistenz:** Gleiche Sachverhalte werden unterschiedlich beschrieben oder nur in einem der Dokumente erwähnt.
- **🟢 Konsistent:** Beide Dokumente stimmen überein oder ergänzen sich sinnvoll.

Füge am Ende den Konsistenz-Check als eigenen Abschnitt ein:

### Konsistenz-Check: AGENTS.md vs. CLAUDE.md
| Thema | AGENTS.md | CLAUDE.md | Status |
|-------|-----------|-----------|--------|

## Zusätzliche Ausgabe

Schließe mit:
- `Top 5 veraltete oder fehlende Punkte in AGENTS.md`
- `Konkrete Textbausteine für die Aktualisierung von AGENTS.md`
