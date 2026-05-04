#codebase

Vergleiche die Datei `crafting/README.md` mit dem aktuellen Implementierungsstand im gesamten Crafting-Code.

Ziel:
Ich möchte prüfen, ob die Dokumentation noch aktuell ist.

Aufgaben:
1. Lies `crafting/README.md` vollständig.
2. Analysiere den relevanten aktuellen Code im Projekt, insbesondere alles, was das Crafting-System betrifft:
   - Architektur
   - zentrale Klassen/Module
   - öffentliche APIs
   - Datenfluss
   - Regeln, Rezepte, States, Events, UI-Anbindung, Services, Configs, DTOs, Stores oder sonstige beteiligte Dateien
3. Vergleiche Dokumentation und Code systematisch Abschnitt für Abschnitt.
4. Bewerte jede Aussage im README mit genau einem Status:
   - 🟢 korrekt = stimmt mit dem aktuellen Code überein
   - 🟡 abweichend = grundsätzlich vorhanden, aber im Detail anders umgesetzt, benannt oder strukturiert
   - 🔴 fehlt im Dok = im Code vorhanden, aber im README gar nicht oder nicht ausreichend dokumentiert
5. Nenne bei jedem Punkt die konkrete Codegrundlage:
   - Datei
   - Symbol/Klasse/Funktion, wenn erkennbar
   - kurze Begründung

Wichtige Regeln:
- Nicht allgemein formulieren, sondern nur konkrete Unterschiede nennen.
- Keine Vermutungen als Fakten darstellen; markiere Unsicherheiten ausdrücklich.
- Prüfe auch Umbenennungen, veraltete Dateinamen, nicht mehr existierende Module und geänderte Verantwortlichkeiten.
- Achte besonders auf Diskrepanzen bei:
  - Einstiegspunkten
  - Orchestrierung
  - Rezeptlogik
  - Inventar-/Ressourcenfluss
  - Crafting-States
  - Erfolgs-/Fehlerfällen
  - Events / Callbacks / Side Effects
  - UI-Integration
  - Persistenz / Save-Load
  - Tests, falls sie Verhalten klar belegen

Ausgabeformat:
## Ergebnis
Kurzes Gesamtfazit in 3–6 Sätzen:
- Ist das README insgesamt aktuell?
- Welche Bereiche sind am stärksten veraltet?
- Wo ist die Doku bereits zuverlässig?

## Detailprüfung
Für jeden gefundenen Punkt genau dieses Format verwenden:

### [🔴|🟡|🟢] Kurzer Titel
- README-Stelle: Abschnitt/Überschrift oder kurzer Verweis auf die relevante Passage
- Code-Referenz: `pfad/zur/datei`
- Betroffene Symbole: `...`
- Befund: klare Beschreibung der Übereinstimmung oder Abweichung
- Empfehlung:
  - Bei 🔴: konkreter Vorschlag, was im README neu ergänzt werden soll
  - Bei 🟡: konkreter Vorschlag, was im README ersetzt/angepasst werden soll
  - Bei 🟢: kurz begründen, warum der Abschnitt korrekt ist

## Empfohlene README-Updates
Erstelle zum Schluss eine priorisierte To-do-Liste:
1. Kritische inhaltliche Korrekturen
2. Fehlende Abschnitte
3. Optionale Verbesserungen bei Struktur oder Verständlichkeit

Wenn sinnvoll, formuliere für 🔴 und 🟡 Punkte direkt einen möglichen Ersatztext oder neue Markdown-Abschnitte für `crafting/README.md`.