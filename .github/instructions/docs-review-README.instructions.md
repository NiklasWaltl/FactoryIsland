#codebase

Prüfe, ob die Datei `README.md` noch zum aktuellen Stand der Codebasis passt.

Aufgabe:
1. Vergleiche den Inhalt von `README.md` systematisch mit dem aktuellen Code.
2. Identifiziere alle relevanten Aussagen, Anleitungen, Features, Befehle, Konfigurationen, Dateipfade, Modulnamen, Architekturbeschreibungen und Setup-/Build-/Run-Hinweise im README.
3. Prüfe für jeden Punkt, ob er:
   - 🟢 korrekt und durch den aktuellen Code bestätigt ist
   - 🟡 teilweise abweicht, veraltet, ungenau oder missverständlich ist
   - 🔴 im README fehlt, obwohl es im Code relevant vorhanden ist, oder im README behauptet wird, aber im Code nicht mehr so existiert

Wichtige Regeln:
- Vergleiche nur gegen den tatsächlichen aktuellen Code in der Codebasis, nicht gegen Vermutungen.
- Beziehe auch package/config-Dateien, Scripts, Ordnerstruktur, Imports, zentrale Einstiegspunkte und relevante Dokumentationsquellen im Repo mit ein.
- Wenn etwas nicht eindeutig verifizierbar ist, markiere es als 🟡 statt als 🟢.
- Sei konkret: nenne Dateien, Symbole, Klassen, Funktionen, Commands oder Pfade als Beleg.
- Fasse ähnliche Punkte sinnvoll zusammen, aber lasse keine wichtigen Abweichungen weg.

Erwartetes Ausgabeformat:

# README-Review

## Gesamtstatus
- Kurze Einschätzung, ob `README.md` insgesamt aktuell, teilweise veraltet oder deutlich veraltet ist.

## Prüfergebnis
Für jeden gefundenen Punkt dieses Format verwenden:

### [Kategorie / Abschnitt]
- Status: 🟢 / 🟡 / 🔴
- README-Aussage: <kurzes Zitat oder präzise Zusammenfassung aus README>
- Code-Realität: <was der aktuelle Code tatsächlich zeigt>
- Belege im Code: <konkrete Dateien, Symbole, Commands, Pfade>
- Update-Empfehlung:
  - Bei 🟢: „Keine Änderung nötig.“
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