# UAT checklist — asli team ke saath (go-live se pehle)

**Kaise:** staging / production server pe (real data se pehle), har role ka ek banda.
Har line ✅ / ❌ + note. Koi ❌ → issue banao, fix, us line ko dobara test karo.
Load test aur security checks automated hain (CI + `ops/load-test`), ye checklist **business flow** ke liye hai.

## 0. Setup (Super Admin)

- [ ] Pehla login → password badalna zaroori (forced screen) → dashboard
- [ ] Manager account banao → manager ko pehle login pe password badalna pada
- [ ] Teams + Team Leaders + Assistants banao (asli naam)
- [ ] Settings: call outcomes, next actions, mandatory fields, categories (rating thresholds), follow-up timing — business ke final decisions ke hisaab se
- [ ] Import: asli Excel (ya uska ek hissa) → preview me invalid / duplicate rows samajh aaye → import

## 1. Calling Assistant (har assistant 15–20 asli calls)

- [ ] Login → status Available; Start Calling → ek customer, profile + history dikhe
- [ ] 📞 dial (tel: link / provider) → phone lagta hai
- [ ] Form khaali chhod ke Save & Next → error, agla customer NAHI milta
- [ ] "Call me at 4 PM" → follow-up bana; 4 PM pe reminder 🔔 aur wahi customer sabse pehle
- [ ] Break pe jao → due follow-up kisi aur available assistant ko jaata hai (escalation)
- [ ] Campaign customer → script + campaign fields dikhte hain, required field zaroori
- [ ] Rating 9–10 → customer High / VIP category me
- [ ] Dashboard "Mera performance" numbers sahi lagte hain
- [ ] Logout → doosre tab / back button se app nahi khulta

## 2. Team Leader

- [ ] Sirf apni team ke customers / assignments / follow-ups / reports dikhte hain
- [ ] Customer assign / reassign (team member ko)
- [ ] Overdue follow-up alert 🔔 aata hai
- [ ] Reports → team ka CSV export Excel me sahi khulta hai (Hindi naam / ₹ theek)

## 3. Manager

- [ ] Campaign: banao → filter se customers → members → script / fields → Activate → assistants ko campaign customers pehle milte hain → Pause → band
- [ ] Customers: search, category / tag filter, highest-interest sort
- [ ] Staff password reset → us staff ke saare sessions logout + pehle login pe naya password
- [ ] Staff deactivate → wo turant login nahi kar sakta
- [ ] Dashboard + Reports: aaj / 7 din / custom range, team / assistant / campaign filter — numbers manual count se match
- [ ] Audit logs: kisne kya kiya (export bhi audit me)

## 4. Operations (IT / owner)

- [ ] HTTPS sahi (browser lock icon), `http://` → `https://` redirect
- [ ] Backup file roz ban rahi hai (`backups/`), **ek baar restore drill** (docs/RUNBOOK.md) — staging pe
- [ ] Monitoring alert test: API band karo → 5 min me alert aaya
- [ ] Deploy pipeline: chhota change → GitHub "Deploy" → naya version `/api/health` me dikha
- [ ] Rollback drill: purana commit deploy → sab chalta hai

## Sign-off

| Role        | Naam | Date | Result |
| ----------- | ---- | ---- | ------ |
| Manager     |      |      |        |
| Team Leader |      |      |        |
| Assistant   |      |      |        |
| IT / Owner  |      |      |        |
