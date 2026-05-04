---
applyTo: "**/crafting/README.md"
---

#codebase

Vergleiche `crafting/README.md` mit dem aktuellen Implementierungsstand des gesamten Crafting-Systems.

## Zu prüfende Code-Bereiche

- Architektur und Modulgrenzen
- Zentrale Klassen/Module und öffentliche APIs
- Datenfluss, Rezepte, States, Events
- UI-Anbindung, Services, Configs, DTOs, Stores

## Prüfschwerpunkte

Achte besonders auf Diskrepanzen bei:
- Einstiegspunkten und Orchestrierung
- Rezeptlogik und Inventar-/Ressourcenfluss
- Crafting-States und Erfolgs-/Fehlerfällen
- Events / Callbacks / Side Effects
- UI-Integration und Persistenz / Save-Load
- Tests (falls sie Verhalten klar belegen)

## Ausgabeformat

### Ergebnis
Gesamtfazit in 3–6 Sätzen: Ist das README aktuell? Welche Bereiche sind am stärksten veraltet?

### Detailprüfung
(Standard-Format aus `docs-review-base.instructions.md` verwenden, ergänzt um)
- **README-Stelle:** Abschnitt/Überschrift
- **Code-Referenz:** `pfad/zur/datei`
- **Betroffene Symbole:** `...`
- **Befund:** Übereinstimmung oder Abweichung

### Empfohlene README-Updates
Priorisierte To-do-Liste inkl. direkt verwendbarer Ersatztexte / neuer Markdown-Abschnitte für kritische 🔴/🟡 Punkte.
