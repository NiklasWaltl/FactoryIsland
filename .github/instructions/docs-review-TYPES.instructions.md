---
applyTo: "**/TYPES.md"
---

#codebase

Analysiere `TYPES.md` und vergleiche jeden dokumentierten Typ mit dem aktuellen TypeScript-Code.

## Prüfpunkte pro Typ

Für **jeden** dokumentierten Typ, Interface, Enum und Type Alias:
- Existiert er noch im Code?
- Stimmen Name, Properties, Typen und optionale Felder (`?`) exakt überein?
- Gibt es neue Typen im Code, die noch nicht dokumentiert sind?

## Kategorien

1. **🟢 Korrekt** – Typ stimmt exakt überein
2. **🟡 Abweichend** – Typ existiert, aber Properties/Typen/Namen haben sich geändert
3. **🔴 Fehlt in TYPES.md** – Typ ist im Code vorhanden, aber nicht dokumentiert
4. **⚫ Veraltet** – Typ ist in TYPES.md dokumentiert, existiert aber nicht mehr im Code

## Ausgabeformat pro Typ

```
<TypName>
Status: 🟢 | 🟡 | 🔴 | ⚫
[Nur bei 🟡/🔴/⚫]
Problem: <Was genau weicht ab oder fehlt?>
Empfehlung: <Konkreter Vorschlag für die Aktualisierung von TYPES.md>
```

## Abschließende Zusammenfassung

- Anzahl pro Kategorie
- Priorisierte Update-Reihenfolge (kritische Abweichungen zuerst)
