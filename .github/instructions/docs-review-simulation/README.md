Prüfe, ob die Datei simulation/README.md noch zum aktuellen Stand der Codebasis passt. Nutze #codebase als primäre Quelle und beziehe die geöffnete README-Datei als Referenz mit ein.

Aufgabe:
1. Vergleiche die Aussagen, Beschreibungen, Anleitungen, Architekturhinweise, API-/Funktionsbeschreibungen, Konfigurationsangaben und Beispiele in simulation/README.md mit dem aktuellen Code.
2. Identifiziere alle relevanten Abweichungen zwischen Dokumentation und Implementierung.
3. Bewerte jeden gefundenen Punkt mit genau einem Status:
   - 🔴 fehlt im Dok = im Code vorhanden, aber in simulation/README.md nicht dokumentiert
   - 🟡 abweichend = in simulation/README.md vorhanden, aber ungenau, veraltet oder im Code anders umgesetzt
   - 🟢 korrekt = Dokumentation und Code stimmen überein
4. Gib für jeden 🔴 und 🟡 Punkt eine konkrete Update-Empfehlung für die README.

Wichtige Regeln:
- Vergleiche nur gegen tatsächlich vorhandenen Code, keine Vermutungen.
- Nenne immer die betroffenen Dateien, Klassen, Funktionen, Typen, Interfaces, Konfigurationen oder Commands.
- Zitiere möglichst präzise, worauf du dich stützt, z. B. Dateipfade und relevante Symbole.
- Wenn ein README-Abschnitt nur teilweise korrekt ist, markiere ihn als 🟡 und erkläre genau, was stimmt und was nicht.
- Wenn mehrere Code-Stellen denselben Doku-Punkt betreffen, fasse sie sinnvoll zusammen.
- Achte besonders auf:
  - öffentliche APIs und Export-Namen
  - Initialisierung und Startfluss
  - Konfiguration, Umgebungsvariablen und Defaults
  - Dateistruktur und wichtige Module
  - Datenflüsse, Events, Zustände und Simulation-Logik
  - Build-, Run- und Test-Anweisungen
  - Codebeispiele in der README

Ausgabeformat:
## Ergebnis
Kurze Einschätzung, ob simulation/README.md insgesamt aktuell ist.

## Prüfpunkte
Für jeden Punkt dieses Format verwenden:

### [🔴/🟡/🟢] Kurzer Titel
- README: Abschnitt / Aussage / fehlender Punkt
- Code: betroffene Datei(en) und relevante Symbole
- Befund: klare Erklärung der Übereinstimmung oder Abweichung
- Empfehlung: nur bei 🔴 oder 🟡, mit konkretem Formulierungsvorschlag oder präziser Änderungsanweisung

## Priorisierte Updates
Am Ende eine kurze Liste der wichtigsten README-Änderungen in sinnvoller Reihenfolge, beginnend mit den kritischsten Inkonsistenzen.

Wenn die README weitgehend korrekt ist, suche trotzdem aktiv nach stillen Lücken, also wichtigen Code-Aspekten, die gar nicht dokumentiert sind.