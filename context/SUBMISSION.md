---
title: "10xDevs 3.0 — submission package (agent-os)"
type: submission-guide
badges: [10xBuilder, 10xArchitect, 10xChampion]
deadline: "2026-07-05 (1. termin — z wyróżnieniem)"
---

# Zgłoszenie 10xDevs 3.0 — komplet

**Formularz:** https://baserow.io/form/fwnBioduXc90QTli6lsCVL_YgRdTECPTCmwiVhu8d-E
**Odznaki do zaznaczenia:** 10xBuilder + 10xArchitect + 10xChampion
**Repo:** https://github.com/monsad/agent-os (prywatne)
**Typ:** custom project, lokalny (bez publicznego URL — kwalifikuje się do wyróżnienia)

---

## 🚀 10xBuilder — 6/6 wymagań

| Wymóg | Dowód w repo |
|---|---|
| **Auth per-user** (loguje się user, widzi swoje zasoby) | `/login` (rejestracja+logowanie) → `src/app/api/auth/*` · sesja HMAC `src/lib/auth.ts` · hasła scrypt `src/lib/password.ts` · middleware `src/middleware.ts` · goals przypięte do `user_id` |
| **CRUD** (add/list/edit/delete) | `goals`: `src/app/api/goals/route.ts` (GET/POST/PATCH/DELETE) + `GoalsPanel.tsx` |
| **Logika biznesowa** (auto-priorytet z nazwy/opisu/terminu) | `src/lib/priority.ts` → `suggestPriority()`, wpięte w `POST /api/goals` |
| **Dokumenty kontekstowe** | `docs/prd.md`, `docs/roadmap.md`, `docs/infrastructure.md`, `docs/test-plan.md` |
| **Testy adresujące ryzyko z test-planu** | `docs/test-plan.md` (R1–R5) → 70 testów (`npm test`) + Playwright e2e |
| **CI/CD build + jakość** | `.github/workflows/ci.yml` — **zielony** (tsc + test + build) |

**Screeny do wgrania (Builder):**
1. Zielony CI: https://github.com/monsad/agent-os/actions (run „CI" na `main`, job „build + test" ✓)
2. Struktura projektu (drzewo plików: `docs/`, `src/`, `.github/workflows/`)
3. `/login` (logowanie/rejestracja) + lista goals **z priorytetem** (high/medium/low) i edycją/usuwaniem
4. `docs/test-plan.md` (tabela ryzyk R1–R5 → testy)

---

## 🏛️ 10xArchitect — raport + 4 artefakty

- **Raport (two-pager):** `context/architect-report.md`
- **L2 mapa repo:** `context/map/repo-map.md`
- **L3 research ficzera:** `context/changes/multi-agent-fanout/research.md`
- **L4 plan refaktoryzacji:** `context/changes/refactor-opportunities/research.md`
- **L5 notatki DDD:** `context/domain/01-domain-distillation.md`
- **Ściąga do obrony:** `context/architect-defense.md`

Do formularza: wgraj `context/architect-report.md` (lub PDF z niego).

---

## 🏆 10xChampion — pipeline CI/CD do code review

- **Agent:** `packages/code-reviewer/` (AI SDK + OpenRouter + zod, `/10x-impl-review`)
- **Pipeline:** `.github/workflows/code-review.yml` (composite action, `gh pr comment`)

**Screeny do wgrania (Champion):**
1. Widok pipeline'u z jobem: https://github.com/monsad/agent-os/actions
2. Logi joba podczas review: otwórz run „AI Code Review" → krok „Review the diff"
3. Komentarz agenta na PR: PR #1 lub #2 → komentarz „🤖 AI code review — /10x-impl-review"

---

## Przed wysłaniem — checklista
- [ ] Dodać collaboratorów do prywatnego repo: `przeprogramowani`, `psmyrdek`, `mkczarkowski`
      (Settings → Collaborators) — ALBO komplet screenów struktury.
- [ ] (Zalecane) Zmergować PR #2 do `main`, żeby `main` zawierał całość.
- [ ] Zrobić screeny z linków powyżej.
- [ ] Wypełnić formularz: Builder + Architect + Champion, wgrać raport + screeny.
- [ ] Wysłać do 5 lipca (1. termin = szansa na wyróżnienie + Demo Day).
