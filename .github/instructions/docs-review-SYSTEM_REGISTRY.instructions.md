---
applyTo: "**/SYSTEM_REGISTRY.md"
---

#codebase

Führe ein Self-Audit von `SYSTEM_REGISTRY.md` gegen die Änderungen des letzten Commits durch.

## Vorgehensweise

1. Extrahiere aus `SYSTEM_REGISTRY.md` alle dokumentierten Systeme, Subsysteme, Hotspots, Action-Cluster, Persistenz-Abschnitte, UI-Surfaces und Task-to-System-Mappings.
2. Ermittle die im letzten Commit geänderten Dateien (`git diff --name-only HEAD~1 HEAD`).
3. Gruppiere geänderte Dateien in Systeme (crafting, logistics, energy, drones, ship/dock, module lab, save/migrations, UI, dev scenes, conveyors).
4. Vergleiche gegen die entsprechenden Abschnitte in `SYSTEM_REGISTRY.md`.
5. Bewerte nach der Status-Legende aus `docs-review-base.instructions.md` (inkl. ⚪ für unberührte Systeme).

## Wichtige Regeln

- Das Dokument **nicht** umschreiben.
- Quellcode **nicht** ändern.
- Fokus auf **Delta-Awareness**: Was hat sich im Code verändert vs. was behauptet die Registry?
- Explizit angeben, wenn ein Commit nur intern refaktoriert ohne dokumentierte Architektur zu berühren.

## Ausgabeformat

### 1. Commit Coverage
| Changed File | System | Registry Section | Status |
|-------------|--------|------------------|---------|

### 2. Systems Not Touched
- ⚪ ...

### 3. Potential Registry Drift
(Für jeden 🟡 / 🔴 Punkt das Standard-Format aus `docs-review-base.instructions.md` verwenden.)

### 4. Final Verdict
Genau eine der folgenden Aussagen:
- `SYSTEM_REGISTRY.md is still current for the latest commit.`
- `SYSTEM_REGISTRY.md is mostly current, but has targeted drift.`
- `SYSTEM_REGISTRY.md is no longer current after the latest commit.`

### 5. Confidence
- `Confidence: High` – Changed files map clearly to documented systems
- `Confidence: Medium` – File-to-system mapping required interpretation
- `Confidence: Low` – Commit was too broad or ambiguous
