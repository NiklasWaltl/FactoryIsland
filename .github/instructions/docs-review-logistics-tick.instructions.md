---
applyTo: "logistics-tick/**"
---

# Documentation Review: logistics-tick/README.md

Wenn du gebeten wirst, die Dokumentation von `logistics-tick/README.md` zu prüfen
oder zu aktualisieren, vergleiche den Inhalt immer mit dem aktuellen Quellcode
in `logistics-tick/` und präsentiere das Ergebnis im folgenden Format:

## Abgleich: README.md vs. Code

- [Status] Abschnitt / Funktion: Kurze Beschreibung des Befunds
  - 💡 Empfehlung: Konkreter Vorschlag, wie die README.md angepasst werden soll

Status-Legende:
- 🔴 Fehlt in der Dokumentation – Funktion/Verhalten existiert im Code, fehlt in der README
- 🟡 Abweichend – README beschreibt etwas, das im Code anders implementiert ist
- 🟢 Korrekt – README und Code stimmen überein

Prüfe dabei immer:
1. Exportierte Funktionen, Klassen und deren Parameter-Signaturen
2. Konfigurations-Optionen und Umgebungsvariablen (z. B. in config-Dateien oder .env.example)
3. Beispiel-Code-Blöcke (Pfade, Imports, Argumente noch aktuell?)
4. Beschriebene Tick-Logik / Ablauf-Diagramme (stimmen sie mit dem tatsächlichen Ablauf überein?)
5. Abhängigkeiten (sind alle in README erwähnten Packages noch in package.json?)

Wenn du fertig bist, liste am Ende alle 🔴 und 🟡 Punkte nochmals zusammen
als priorisierte To-do-Liste für das nächste README-Update.
