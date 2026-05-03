---
name: factory-island-prompt
description: Prompt-Erstellung für Factory Island AI-Workflows. Aktivieren bei der Erstellung von Analyse-, Review- oder Feature-Prompts.
---

# Factory Island Prompt-Regeln
Diese Datei definiert verbindliche Regeln für das Erstellen von AI-Prompts für Factory Island.

## Pflichtbasis

`factory-island-space/rules.md` ist vor jedem Prompt Pflichtbasis. Jeder Prompt muss die Phaser/React-Grenze, `Grid.tsx` als Transform-Basis und die relevanten Hotspots ausreichend kontextualisieren.

## Pflichtbestandteile jedes Prompts

- [ ] Stack-Kontext nennen: Phaser 3 + React 18 + TypeScript.
- [ ] Betroffenes System oder Layer nennen: Phaser-Render, React-UI, Game-Logic, Tick, Save, Inventory, Drones, Energy, Crafting oder Grid.
- [ ] Konkretes Ziel formulieren, inklusive erwarteter Ausgabe oder Änderung.
- [ ] Einschränkungen nennen, z. B. keine neuen npm-Abhängigkeiten, keine großen Refactors, keine Spiellogik in UI-Komponenten.
- [ ] Phaser/React-Split ausdrücklich festhalten.
- [ ] `Grid.tsx` als Basis für World-/Grid-Transform nennen, wenn Koordinaten, Placement oder Weltinteraktion betroffen sind.
- [ ] Relevante State-Felder, Actions, Ticks oder Pfade nennen, sofern bekannt.
- [ ] Reproduzierbare Schritte oder Akzeptanzkriterien angeben.

## Template: Code-Analyse / Architektur-Review

```md
Du bist Entwicklungsassistent für Factory Island (Phaser 3 + React 18 + TypeScript).

Führe eine Code-Analyse und Architektur-Review für den im Auftrag genannten Codebereich durch. Der Auftrag nennt das betroffene System oder Layer, die relevanten Pfade und die konkrete Fragestellung.

Architekturkontext:
- Phaser rendert Sprites, Tilemaps, Kamera und Weltobjekte read-only.
- React hält `GameState` via `useReducer` und rendert UI/HUD/Panels.
- Phaser darf niemals `dispatch` aufrufen.
- `Grid.tsx` ist die Transform-Basis für Grid-/World-Interaktion im React-Layer.

Prüfe:
- ob die Phaser/React-Grenze eingehalten ist
- ob `Grid.tsx` als Transform-Basis erhalten bleibt
- ob Save-Migration, Tick-Reihenfolge oder Inventar-Hierarchie betroffen sind
- ob Hotspots aus `factory-island-space/rules.md` berührt werden

Gib Findings nach Schwere sortiert aus und schlage kleine lokale Änderungen vor.
```

## Template: Feature-Implementierung

```md
Du bist Entwicklungsassistent für Factory Island (Phaser 3 + React 18 + TypeScript).

Implementiere das im Auftrag beschriebene Feature. Der Auftrag nennt das konkrete Ziel, das betroffene System oder Layer, die relevanten Pfade und die Akzeptanzkriterien.

Architekturgrenzen:
- Phaser rendert nur und ruft nie `dispatch` auf.
- React/UI darf Actions dispatchen, aber keine Spiellogik enthalten.
- Reducer, Action-Handler, Tick-Handler und Selectors bleiben die Orte für Game-Logic.
- `Grid.tsx` bleibt die einzige Transform-Basis für Grid-/World-Interaktion.

Einschränkungen:
- keine neuen npm-Abhängigkeiten
- keine großen Refactors
- kleine lokale Änderungen
- Save-Migration bei jedem persistenten Schema-Wechsel

Arbeitsweise:
- lies zuerst `factory-island-space/rules.md`
- bestimme das owning system
- lies nur die direkt betroffenen Codepfade
- implementiere in separat prüfbaren Schritten
- verifiziere die Änderung mit dem passenden Build, Test oder Typecheck
```

## Template: Bug-Diagnose

```md
Du bist Entwicklungsassistent für Factory Island (Phaser 3 + React 18 + TypeScript).

Diagnostiziere den im Auftrag beschriebenen Bug. Der Auftrag nennt Layer, Reproduktionsschritte, erwartetes Verhalten, tatsächliches Verhalten und betroffene State-Felder.

Architekturkontext:
- Phaser ist read-only und dispatcht nicht.
- React/Reducer ist die Mutationsgrenze.
- `Grid.tsx` ist die Transform-Basis für Grid-/World-Interaktion.
- Tick-Reihenfolge ist nicht garantiert.
- Inventar besteht aus `state.inventory`, `warehouseInventories[id]` und `network.reservations`.

Vorgehen:
- identifiziere zuerst Layer und Hotspot
- reduziere die Reproduktion auf den kleinsten betroffenen Pfad
- prüfe Save-Hydration, Tick-Race und Inventar-Schicht, wenn sie berührt werden
- liefere die kleinste lokale Fix-Strategie mit Verifikationsschritt
```

## Template: Refactoring

```md
Du bist Entwicklungsassistent für Factory Island (Phaser 3 + React 18 + TypeScript).

Plane ein kleines lokales Refactoring für den im Auftrag genannten Bereich. Der Auftrag nennt Ziel, Nicht-Ziele, betroffene Pfade und Akzeptanzkriterien.

Grenzen:
- kein Big-Bang-Refactoring
- keine neuen Re-Export-Hubs ohne klaren Grund
- keine Spiellogik in UI-Komponenten
- Phaser ruft nie `dispatch` auf
- `Grid.tsx` bleibt die Transform-Basis für Grid-/World-Interaktion
- Save-Kompatibilität darf nicht brechen

Liefere:
1. Ist-Zustand in Phaser-Layer, React-Layer und Shared Grid
2. Problem/Motivation
3. Soll-Zustand
4. betroffene Pfade
5. Migrationsrisiken aus `factory-island-space/rules.md`
6. kleine, separat prüfbare Schritte
```

## Prompt-Regeln

- [ ] Prompts immer mit Phaser/React-Split kontextualisieren.
- [ ] Prompts immer mit `Grid.tsx` als Transform-Basis kontextualisieren, wenn Welt, Grid, Placement, Kamera oder Koordinaten betroffen sind.
- [ ] Reproduzierbar formulieren und keinen impliziten Kontext voraussetzen.
- [ ] Pfade, State-Felder, Actions, Ticks und Akzeptanzkriterien nennen, sobald sie bekannt sind.
- [ ] Keine vagen Aufträge wie "mach es besser" ohne Ziel, Layer und Grenzen formulieren.
