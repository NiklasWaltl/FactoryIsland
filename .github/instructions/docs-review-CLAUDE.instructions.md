---
applyTo: "**/CLAUDE.md"
---

#codebase

Prüfe, ob die Datei `CLAUDE.md` noch zum aktuellen Stand der Codebasis, der Projektstruktur und der verwendeten Toolchain passt.

Aufgabe:
1. Lies `CLAUDE.md` vollständig und erfasse alle enthaltenen Aussagen zu Projektstruktur, Build/Run/Test-Befehlen, Konventionen, Architektur, Tool-Permissions und Arbeitsanweisungen für Claude.
2. Vergleiche jeden Punkt systematisch mit dem aktuellen Code, den Config-Dateien und der tatsächlichen Ordnerstruktur.
3. Beziehe auch `.claude/settings.local.json`, `AGENTS.md`, `package.json`, `tsconfig.json`, `vite.config.*` sowie relevante Workflows unter `.github/workflows/` ein.
4. Prüfe für jeden Punkt, ob er:
   - 🟢 korrekt und durch den aktuellen Code bestätigt ist
   - 🟡 teilweise abweicht, veraltet, ungenau oder missverständlich ist
   - 🔴 im `CLAUDE.md` fehlt, obwohl es im Code relevant vorhanden ist, oder im `CLAUDE.md` behauptet wird, aber im Code nicht mehr so existiert

Wichtige Regeln:
- Vergleiche nur gegen den tatsächlichen aktuellen Code in der Codebasis, nicht gegen Vermutungen.
- Prüfe explizit, ob alle in `CLAUDE.md` genannten Bash-Befehle (build, test, lint, typecheck) mit den tatsächlich erlaubten Commands in `.claude/settings.local.json` übereinstimmen.
- Prüfe, ob Modulpfade, Ordnerstrukturen, Einstiegspunkte und Systemgrenzen noch korrekt beschrieben sind.
- Wenn etwas nicht eindeutig verifizierbar ist, markiere es als 🟡 statt als 🟢.
- Sei konkret: nenne Dateien, Symbole, Klassen, Funktionen, Commands oder Pfade als Beleg.
- Fasse ähnliche Punkte sinnvoll zusammen, aber lasse keine wichtigen Abweichungen weg.

Erwartetes Ausgabeformat:

# CLAUDE.md-Review

## Gesamtstatus
- Kurze Einschätzung, ob `CLAUDE.md` insgesamt aktuell, teilweise veraltet oder deutlich veraltet ist.

## Prüfergebnis
Für jeden gefundenen Punkt dieses Format verwenden:

### [Kategorie / Abschnitt]
- Status: 🟢 / 🟡 / 🔴
- CLAUDE.md-Aussage: <kurzes Zitat oder präzise Zusammenfassung>
- Code-Realität: <was der aktuelle Code tatsächlich zeigt>
- Belege im Code: <konkrete Dateien, Symbole, Commands, Pfade>
- Update-Empfehlung:
  - Bei 🟢: „Keine Änderung nötig."
  - Bei 🟡: konkrete Formulierung, was in `CLAUDE.md` angepasst werden sollte
  - Bei 🔴: konkrete Formulierung, was neu ergänzt, ersetzt oder entfernt werden sollte

## Permission-Check
- Prüfe explizit jeden in `CLAUDE.md` erwähnten Bash-Befehl gegen die erlaubten Tools in `.claude/settings.local.json`.
- Liste Befehle, die in `CLAUDE.md` vorkommen, aber in `settings.local.json` nicht erlaubt sind (🔴 Konflikt).
- Liste Befehle, die in `settings.local.json` erlaubt sind, aber in `CLAUDE.md` nicht dokumentiert sind (🟡 undokumentiert).

## Fehlende Doku
- Liste alle 🔴 Punkte gesammelt auf, die in `CLAUDE.md` ergänzt werden sollten.

## Abweichende Doku
- Liste alle 🟡 Punkte gesammelt auf, die präzisiert oder aktualisiert werden sollten.

## Vorschlag für Änderungen
- Erstelle am Ende eine priorisierte To-do-Liste:
  1. Kritische CLAUDE.md-Korrekturen (insbesondere Permission-Konflikte)
  2. Sinnvolle Präzisierungen
  3. Optionale Verbesserungen

Wichtig:
- Verwende die Emojis exakt so: 🔴 fehlt/falsch, 🟡 abweichend/unklar, 🟢 korrekt.
- Gib für jeden 🔴- und 🟡-Punkt eine konkrete, umsetzbare Update-Empfehlung.
- Formuliere die Empfehlungen so, dass sie direkt in eine `CLAUDE.md`-Überarbeitung übernommen werden können.
- Antworte auf Deutsch.
