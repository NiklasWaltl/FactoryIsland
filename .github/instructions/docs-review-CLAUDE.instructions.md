---
applyTo: "**/CLAUDE.md"
---

#codebase

Prüfe, ob `CLAUDE.md` noch zum aktuellen Stand der Codebasis, der Projektstruktur und der verwendeten Toolchain passt.

## Vorgehensweise

1. Lies `CLAUDE.md` vollständig: Projektstruktur, Build/Run/Test-Befehle, Konventionen, Architektur, Tool-Permissions, Arbeitsanweisungen.
2. Vergleiche jeden Punkt systematisch mit dem aktuellen Code.
3. Beziehe folgende Dateien explizit ein: `.claude/settings.local.json`, `AGENTS.md`, `package.json`, `tsconfig.json`, `vite.config.*`, `.github/workflows/`.
4. Bewerte nach der Status-Legende aus `docs-review-base.instructions.md`.

## Zusätzlicher Permission-Check

- Prüfe jeden in `CLAUDE.md` erwähnten Bash-Befehl gegen die erlaubten Tools in `.claude/settings.local.json`.
- **🔴 Konflikt:** Befehle, die in `CLAUDE.md` stehen, aber in `settings.local.json` nicht erlaubt sind.
- **🟡 Undokumentiert:** Befehle, die in `settings.local.json` erlaubt sind, aber in `CLAUDE.md` nicht dokumentiert sind.

Füge am Ende den Permission-Check als eigenen Abschnitt ein:

### Permission-Check
| Befehl | In CLAUDE.md | In settings.local.json | Status |
|--------|-------------|------------------------|--------|
