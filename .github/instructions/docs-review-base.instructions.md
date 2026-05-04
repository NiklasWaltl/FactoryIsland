---
applyTo: "**/*.md"
---

# Docs Review – Basis-Instruktion

Diese Datei definiert das gemeinsame Prüfformat und die allgemeinen Regeln für alle Dokumentations-Reviews.
Die dokumentenspezifischen Dateien (`docs-review-*.instructions.md`) ergänzen diese Basis mit konkreten Prüfpunkten und Kontext-Quellen.

---

## Allgemeine Regeln

- Vergleiche **nur** gegen den tatsächlichen aktuellen Code in der Codebasis, nicht gegen Vermutungen.
- Wenn etwas nicht eindeutig verifizierbar ist, markiere es als 🟡 statt als 🟢.
- Sei konkret: nenne Dateien, Symbole, Klassen, Funktionen, Commands oder Pfade als Beleg.
- Fasse ähnliche Punkte sinnvoll zusammen, aber lasse keine wichtigen Abweichungen weg.
- Antworte auf Deutsch.

## Status-Legende

| Symbol | Bedeutung |
|--------|-----------|
| 🟢 | Korrekt – stimmt mit dem aktuellen Code überein |
| 🟡 | Abweichend / unklar – teilweise veraltet, ungenau oder missverständlich |
| 🔴 | Fehlt / falsch – im Code vorhanden aber nicht dokumentiert, oder dokumentiert aber nicht mehr vorhanden |
| ⚪ | Nicht berührt – dieses System wurde durch den letzten Commit nicht verändert (nur für SYSTEM_REGISTRY) |

---

## Standard-Ausgabeformat

Verwende dieses Format, sofern die spezifische Override-Datei kein abweichendes Format vorschreibt:

### Gesamtstatus
Kurze Einschätzung (1–3 Sätze): Ist die Datei insgesamt aktuell, teilweise veraltet oder deutlich veraltet?

### Prüfergebnis

Für jeden gefundenen Punkt:

#### [Kategorie / Abschnitt]
- **Status:** 🟢 / 🟡 / 🔴
- **Doku-Aussage:** kurzes Zitat oder präzise Zusammenfassung
- **Code-Realität:** was der aktuelle Code tatsächlich zeigt
- **Belege im Code:** konkrete Dateien, Symbole, Commands, Pfade
- **Update-Empfehlung:**
  - Bei 🟢: „Keine Änderung nötig."
  - Bei 🟡: konkrete Formulierung, was angepasst werden sollte
  - Bei 🔴: konkrete Formulierung, was neu ergänzt, ersetzt oder entfernt werden sollte

### Fehlende Doku
Liste aller 🔴 Punkte, die ergänzt werden sollten.

### Abweichende Doku
Liste aller 🟡 Punkte, die präzisiert oder aktualisiert werden sollten.

### Vorschlag für Änderungen
Priorisierte To-do-Liste:
1. Kritische Korrekturen (z. B. Permission-Konflikte, falsche Commands, nicht mehr existierende Module)
2. Sinnvolle Präzisierungen
3. Optionale Verbesserungen
