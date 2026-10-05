# ADR 0013 — Dashboard & reports

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

Design doc section 15: management ko live visibility — calls, connected / no answer, calls per assistant,
pending / due / overdue follow-ups, average rating, category distribution, campaign performance, assistant workload,
escalation history; today / week / month / custom filters; CSV export.

## Decisions

| Topic            | Decision                                                                                                                                                 | Reason                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Computation      | Har request pe **SQL aggregates** (`count(*) FILTER (WHERE …)`, `GROUP BY`) — koi pre-computed table nahi                                                | Data hamesha fresh; 2.6k calls + 20k customers pe ~40ms. Lakhs calls pe materialized view (Phase 9) |
| Time zone        | `REPORT_TIMEZONE` (default `Asia/Kolkata`); "aaj", din / ghante ke buckets isi zone me (`AT TIME ZONE`)                                                  | Server UTC me chalta hai — India ka raat 1 baje wala call "kal" me na gine                          |
| Ranges           | Presets `today / yesterday / 7d / 30d` + `custom` (from–to, inclusive, max 366 din); pure `resolveRange()` (unit tests)                                  | Common choices ek click me; galat range → 400                                                       |
| Comparison       | Har KPI ke saath **pichhla barabar period** (7d vs usse pehle ke 7d) → ▲/▼                                                                               | "Achha ja raha hai ya bura?" turant                                                                 |
| Scope            | `staffScope`: ASSISTANT = khud, TEAM_LEADER = apni team, MANAGER = sab; team / staff / campaign filters scope ke andar                                   | Ek hi rule saare modules me; TL doosri team nahi dekh sakta (403)                                   |
| Talk time        | `call_sessions` (Phase 7) se: completed calls ka `duration_sec`                                                                                          | Provider data; manual provider me 0                                                                 |
| Follow-up health | Period me due: done, **on time** (grace ke andar), escalated; plus **abhi overdue**                                                                      | Design doc ka main problem: follow-ups miss hona                                                    |
| Charts           | Plain HTML/CSS (koi chart library nahi), dataviz specs: ≤24px bars, 4px round top, 2px gaps, hairline grid, hover + keyboard tooltip, legend, table view | Bundle chhota; accessible; ek hi look                                                               |
| Colors           | Connected = accent blue, not connected = de-emphasis gray (emphasis form); outcomes = ek hi rang (magnitude)                                             | Kahani "kitne connect hue" hai — rainbow nahi                                                       |
| CSV export       | `calls / assistants / campaigns .csv` same filters, max 50,000 rows, UTF-8 BOM, formula-injection safe                                                   | Excel me seedha khule; bada export → "range chhoti karo"                                            |
| Export audit     | Har export `report.exported` (type, rows, filters) audit log me                                                                                          | Customer phone numbers wala data bahar ja raha hai — kisne, kab                                     |
| Assistant view   | Dashboard pe "Mera performance" (sirf apne numbers); `/reports` page nahi                                                                                | Motivation + privacy                                                                                |

## Future

- Bahut data pe: daily rollup table / materialized view (Phase 9 load test ke baad decide)
- Scheduled email report (manager ko roz subah)
- Escalation history report, category movement over time
- Custom-field (campaign) reports — e.g. "Deposit amount" ka total
