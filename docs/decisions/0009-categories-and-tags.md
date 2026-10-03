# ADR 0009 — Rating, Categories & Tags

- **Status:** Accepted
- **Date:** 2026-10-03

## Context

Design doc section 10: V1 me VIP / High Interest sirf **assistant ki rating (0–10)** se.
"Category thresholds are data/configuration, not hard-coded" — admin 8+ ko 7+ kare to app rewrite nahi.

## Decisions

| Topic            | Decision                                                                                       | Reason                                               |
| ---------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Storage          | `categories` table (code, label, min/max rating, color, priority, active)                      | Configurable; reports `code` se                      |
| Defaults         | 0–4 Low · 5–7 Medium · 8–9 High · 10 VIP (data migration)                                      | Design doc example                                   |
| Customer fields  | `interest_rating` (latest) + `category_id`                                                     | List / filter / sort fast — har baar calls scan nahi |
| Engine           | Save & Next transaction me `applyRating()`; rating nahi (No Answer) → category same            | Ek hi jagah logic; partial update nahi               |
| Rule logic       | Pure `categoryForRating` / `validateCategoryRanges`                                            | Unit-testable, predictable                           |
| Validation       | Overlap / bounds / duplicate code = **error**; uncovered ratings = **warning**                 | Galat config save na ho; gaps jaan-boojh ke ho sakte |
| Save             | Poora set ek saath (`PUT /categories`)                                                         | Ranges ek doosre pe depend karti hain                |
| Threshold change | Saare customers **ek set-based SQL** (CTE) me recalculate + history                            | 20k customers bhi milliseconds me; loop nahi         |
| History          | `customer_category_changes` (from, to, rating, reason: `call_rating` / `threshold_change`, by) | Design doc 12: "Category Changes" timeline           |
| Priority link    | Category ka optional `priority` → category me aate hi customer priority (VIP → URGENT)         | Design doc 9: priority-aware assignment              |
| Tags             | `tags` + `customer_tags` (many-to-many), delete nahi — deactivate                              | Free labels; history safe                            |
| Tag permission   | Manager / TL koi bhi customer; assistant sirf apna current                                     | Calling screen se tag lagana                         |
| Audit            | `category.updated`, `customer.category_changed`, `tag.*`, `customer.tags_updated`              | Traceable                                            |

## Future

- Deposit / activity based rules (design doc: "room for additional rules later")
- Manual category override (with reason)
- Category-based campaigns (Phase 5)
