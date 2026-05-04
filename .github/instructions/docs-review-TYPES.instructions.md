---
applyTo: "**/TYPES.md"
---

#codebase

Analysiere die Dokumentationsdatei `TYPES.md` und vergleiche ihren Inhalt mit dem aktuellen TypeScript-Code im gesamten Projekt.

## Aufgabe

Prüfe für **jeden dokumentierten Typ, Interface, Enum und Type Alias** in `TYPES.md`:
- Existiert er noch im Code?
- Stimmen Name, Properties, Typen und optionale Felder (`?`) exakt überein?
- Gibt es neue Typen im Code, die noch nicht dokumentiert sind?

## Ausgabeformat

Erstelle eine gegliederte Liste nach folgendem Schema:
<TypName>
Status: 🟢 korrekt | 🟡 abweichend | 🔴 fehlt im Dok

[Nur bei 🟡 oder 🔴]
Problem: <Was genau weicht ab oder fehlt?>
Empfehlung: <Konkreter Vorschlag, wie TYPES.md aktualisiert werden soll>

text

## Kategorien

Gruppiere die Ergebnisse in:
1. **🟢 Korrekt** – Typ stimmt exakt überein
2. **🟡 Abweichend** – Typ existiert, aber Properties/Typen/Namen haben sich geändert
3. **🔴 Fehlt in TYPES.md** – Typ ist im Code vorhanden, aber nicht dokumentiert
4. **⚫ Veraltet** – Typ ist in TYPES.md dokumentiert, existiert aber nicht mehr im Code

## Abschließende Zusammenfassung

Zeige am Ende:
- Anzahl pro Kategorie
- Priorisierte Update-Reihenfolge (kritische Abweichungen zuerst)
