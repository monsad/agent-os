---
title: "Architect report — defense notes"
type: defense-crib
badge: 10xArchitect (M4)
---

# Obrona raportu Architekta — ściąga

Każde twierdzenie w raporcie wynika z **git history** albo z **grafu importów**.
Jak czegoś nie wiesz → powiedz „to jest w limitacjach / tego nie weryfikowałam".
Świadome niewiadome to siła, nie słabość.

## §1 — Co to za repo
Lokalny dashboard Mission Control (Next.js 15) sterujący agentami (Claude, Codex,
OpenClaw, Ollama) z jednego UI. Kluczowe: **architektura jednokierunkowa** — UI nigdy
nie importuje `lib`, rozmawia z backendem tylko po HTTP.
- *„Skąd wiesz?"* → grep `@/lib` w `components/` = pusto. Dowód, nie założenie.

## §2 — Gdzie praca i tarcie
Git history: `components` (63) ≫ `app/api` (39) ≫ `lib` (31). Dwa choke pointy
(fan-in 5): `cliAgent.ts` i `runs.ts`. Najmocniejsze sprzężenie: `Sidebar` ⇄
`MissionControlLayout` (co-change 6/7).
- *„Czemu słaby sygnał terytorialny?"* → 8 dni, jeden autor → strukturę niosą graf
  importów i co-change, nie kontrybutorzy.

## §3 — Kluczowy ficzer + dług
Rdzeń = **multi-agent fan-out**: task → `Promise.all` po liście agentów →
`runCliAgent`. Dług **D1**: roster agentów zduplikowany 4× — usunięcie martwego Gemini
musiało ruszyć trzy miejsca (namacalny podatek). D2/D3: routy fan-outu + `runs.ts` bez
testów.

## §4 — Refaktor (ranking)
1. Wspólny **roster** (`lib/roster.ts`) — najwyższy dług driftu, najniższy koszt,
   odwracalny, blast radius = 3 routy.
2. **Rejestr widoków** sterowany danymi — dodanie widoku = jeden wpis.
- *„Czemu roster pierwszy?"* → mniejszy blast radius i pełna odwracalność; rejestr
  widoków ma przypadki specjalne (modal, landing) = większe ryzyko.

## §5 — Odkrycie domenowe (najważniejsze)
DDD ujawniło **drift model-vs-kod na Brain**: niezmiennik „źródła niemutowalne, no
source no note" jest w `house-rules.md`, ale **pilnuje go tylko prompt** — a refiner
odpala Claude w **trybie zapisu**. Nic w kodzie nie blokuje zepsucia źródła.
- *„Czemu najważniejsze?"* → to rdzeń obietnicy produktu = **zaufanie**. Dwa inne
  niezmienniki (Run ma status, fan-out read-only) są już w kodzie; ten jeden nie.
- Fix: strażnik w kodzie odmawiający zapisu poza `2-atoms/3-threads/briefings/` +
  weryfikacja, że każdy nowy atom cytuje źródło.

## §6 — Gdybym miała tydzień
D1 (wspólny roster) najpierw — mały, bezpieczny, usuwa udowodniony podatek. Potem
niezmiennik Brain z prozy → strażnik w kodzie. Oba odwracalne, oba z dowodami.

## Limitacje (mów o nich sama)
8 dni / jeden autor = słaby sygnał terytorialny; dependency-cruiser nie skonfigurowany
pod TS (couplingi z grafu importów + co-change); mapa opisuje aktywność i strukturę,
nie poprawność runtime.
