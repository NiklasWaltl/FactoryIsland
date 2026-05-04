---
applyTo: "**/simulation/README.md"
---

#codebase

Prüfe, ob die Datei `simulation/README.md` noch zum aktuellen Stand der Codebasis passt.

Aufgabe:
1. Lies `simulation/README.md` vollständig und erfasse alle enthaltenen Aussagen zu Projektstruktur, Architekturhinweisen, öffentlichen APIs, Funktionsbeschreibungen, Konfigurationsangaben, Datenflüssen, Events, Zuständen und Simulationslogik.
2. Vergleiche jeden Punkt systematisch mit dem aktuellen Code in der Codebasis.
3. Prüfe für jeden Punkt, ob er:
   - 🟢 korrekt und durch den aktuellen Code bestätigt ist
   - 🟡 teilweise abweicht, veraltet, ungenau oder missverständlich ist
   - 🔴 im README fehlt, obwohl es im Code relevant vorhanden ist, oder im README behauptet wird, aber im Code nicht mehr so existiert

Wichtige Regeln:
- Vergleiche nur gegen den tatsächlichen aktuellen Code in der Codebasis, nicht gegen Vermutungen.
- Nenne immer die betroffenen Dateien, Klassen, Funktionen, Typen, Interfaces, Konfigurationen oder Commands.
- Wenn etwas nicht eindeutig verifizierbar ist, markiere es als 🟡 statt als 🟢.
- Sei konkret: nenne Dateien, Symbole, Klassen, Funktionen, Commands oder Pfade als Beleg.
- Fasse ähnliche Punkte sinnvoll zusammen, aber lasse keine wichtigen Abweichungen weg.
- Achte besonders auf:
  - öffentliche APIs und Export-Namen
  - Initialisierung und Startfluss
  - Konfiguration, Umgebungsvariablen und Defaults
  - Dateistruktur und wichtige Module
  - Datenflüsse, Events, Zustände und Simulation-Logik
  - Build-, Run- und Test-Anweisungen
  - Codebeispiele in der README

Erwartetes Ausgabeformat:

# simulation/README-Review

## Gesamtstatus
- Kurze Einschätzung, ob `simulation/README.md` insgesamt aktuell, teilweise veraltet oder deutlich veraltet ist.

## Prüfergebnis
Für jeden gefundenen Punkt dieses Format verwenden:

### [Kategorie / Abschnitt]
- Status: 🟢 / 🟡 / 🔴
- README-Aussage: <kurzes Zitat oder präzise Zusammenfassung aus README>
- Code-Realität: <was der aktuelle Code tatsächlich zeigt>
- Belege im Code: <konkrete Dateien, Symbole, Commands, Pfade>
- Update-Empfehlung:
  - Bei 🟢: „Keine Änderung nötig."
  - Bei 🟡: konkrete Formulierung, was im README angepasst werden sollte
  - Bei 🔴: konkrete Formulierung, was neu ergänzt, ersetzt oder entfernt werden sollte

## Fehlende Doku
- Liste alle 🔴 Punkte gesammelt auf, die im README ergänzt werden sollten.

## Abweichende Doku
- Liste alle 🟡 Punkte gesammelt auf, die präzisiert oder aktualisiert werden sollten.

## Vorschlag für Änderungen
- Erstelle am Ende eine priorisierte To-do-Liste:
  1. Kritische README-Korrekturen
  2. Sinnvolle Präzisierungen
  3. Optionale Verbesserungen

Wichtig:
- Verwende die Emojis exakt so: 🔴 fehlt/falsch, 🟡 abweichend/unklar, 🟢 korrekt.
- Gib für jeden 🔴- und 🟡-Punkt eine konkrete, umsetzbare Update-Empfehlung.
- Formuliere die Empfehlungen so, dass sie direkt in eine README-Überarbeitung übernommen werden können.
- Antworte auf Deutsch.
