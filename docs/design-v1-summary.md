# Calling CRM — Design V1 Summary

Source: `Calling_CRM_System_Design_v1.docx` (v1.0)

## Context

- 6 calling assistants (badh sakte hain), ~20,000 users initially
- Calling + recording: existing third-party tool (voice.telecalling.ai)
- CRM = control layer: users, calls, outcomes, follow-ups, assignment, ratings, categories, reports

## Core V1 rules

1. Assistant ek time pe sirf ONE user pe kaam karta hai.
2. Mandatory fields (admin-configurable) complete hue bina next user release nahi hota.
3. Follow-ups alag scheduled records hain — reminder, due, grace period, escalation.
4. Assignment backend pe lock ke saath hota hai (duplicate assignment nahi).
5. Interest rating 0–10; VIP/High Interest category sirf rating se (thresholds configurable).
6. Roles: Super Admin, Manager/Admin, Team Leader, Calling Assistant.
7. Campaigns, bulk import (CSV/Excel, background job), audit trail.

## Development phases

1. Foundation (auth, roles, users, assistants, teams, DB, base admin)
2. Calling workflow (queue, assignment, profile, call form, validation)
3. Follow-ups
4. Rating & categories
5. Campaigns
6. Import
7. Calling integration (provider API/webhook — docs confirm karne baaki)
8. Analytics
9. Production hardening

## Open items (doc section 27)

- Final call outcome list, mandatory fields, category thresholds
- Reminder time / grace period, availability definition
- Assignment algorithm (round-robin / load-based / hybrid)
- Third-party calling API/webhook capabilities
- Final stack, hosting, backup, monitoring
