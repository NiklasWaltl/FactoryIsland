---
name: Analyze Code
description: Analysiert den markierten Code im Kontext der Factory-Island-Architektur und gibt strukturiertes Feedback.
invokable: true
---

# Code-Analyse: Factory Island

## Kontext

Du analysierst Code aus dem Projekt **Factory Island** — einem browserbasiertem 2D-Fabrik-Aufbauspiel.
Architektur: React (`useReducer`) als Single-Source-of-Truth + Phaser für das World-Rendering.
Alle Mutationen laufen über `dispatch(GameAction)`. Phaser ist read-only.

**Kanonische Quellen (lies diese, bevor du urteilst):**
- Architektur-Überblick: `src/game/ARCHITECTURE.md`
- Type-Index: `src/game/TYPES.md`
- Agenten-Regeln: `AGENTS.md`
- Zentraler State: `store/types.ts` ab Zeile 316
- Action-Union: `store/game-actions.ts` ab Zeile 20

---

## Aufgabe

Analysiere den folgenden Code und beantworte **alle** der untenstehenden Punkte.
Halte dich kurz — maximal 2–3 Sätze pro Punkt. Überspringe Punkte, die nicht relevant sind.

---

### 1. Zweck & Verantwortlichkeit
- Was macht dieser Code in einem Satz?
- Welchem Architektur-Layer gehört er an? (`simulation` / `store` / `ui` / `renderer` / `persistence`)
- Hält er die Goldene Regel ein? (UI dispatcht nur, Phaser schreibt nie)

### 2. State-Zugriff
- Welche `GameState`-Felder liest / schreibt dieser Code?
- Werden die richtigen Inventar-Schichten genutzt? (`inventory` global vs. `warehouseInventories` vs. `network`-Reservierungen)
- Falls Drones involviert: Wird `starterDrone` ↔ `drones[id]` konsistent über `syncDrones` behandelt?

### 3. Action-Konventionen
- Importiert der Code `GameAction` korrekt von `store/game-actions`?
- Gibt es Action-Types, die nicht in `game-actions.ts` definiert sind (Fehler)?
- Wird ein neuer Handler korrekt mit `HANDLED_ACTION_TYPES`-Set registriert?

### 4. Tick-Verhalten
- Ist dieser Code Teil eines Tick-Handlers? Wenn ja: welcher Tick (Intervall, Action-Type)?
- Gibt es teure Operationen (z.B. Array-Iterationen über alle Assets), die in einem 100 ms-Tick problematisch werden könnten?
- Ist die Tick-Reihenfolge-Unabhängigkeit eingehalten? (Kein Annahmen über andere Ticks)

### 5. Fehler & Risiken
- Gibt es Magic Numbers? (Stattdessen: Konstanten aus `store/constants/` verwenden)
- Gibt es stille Fallbacks für fehlende Logik? (Verboten laut AGENTS.md)
- Gibt es potenzielle Race-Conditions zwischen parallelen Ticks?
- Ist Debug-Code hinter `import.meta.env.DEV` geguarded?

### 6. Typsicherheit
- Gibt es `any`-Typen oder unsichere Casts (`as X`)?
- Sind alle neuen Typen in der richtigen Datei (`store/types.ts`, `crafting/types.ts`, `items/types.ts`, `inventory/reservationTypes.ts`)?
- Sind discriminated Unions vollständig (alle Cases behandelt)?

### 7. Testbarkeit
- Ist die Logik ohne Browser/Phaser testbar (reine Funktionen)?
- Welche Edge-Cases fehlen wahrscheinlich in bestehenden Tests?

### 8. Empfehlungen
Maximal 3 priorisierte Verbesserungen, Format:
- 🔴 KRITISCH: …
- 🟡 WICHTIG: …
- 🟢 NICE-TO-HAVE: …

---

## Code

```
{{{ input }}}
```
