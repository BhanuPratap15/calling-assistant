# Calling CRM — User Guide

> English user guide for every role. Also available as a shared Claude Doc; keep both in sync when the UI changes. Last updated: 6 Oct 2026.

## 1. Introduction

Calling CRM replaces the Excel sheets the calling team used. Every customer, call, rating, follow-up and assignment lives in one system, and each assistant works on exactly one customer at a time.

The actual phone call and its recording happen in the calling provider (voice.telecalling.ai). The CRM decides who to call, records what happened and tracks what must happen next.

### Roles

| Role              | What they do                                                                | What they can see                                           |
| ----------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Super Admin       | Full system access, including creating managers                             | Everything                                                  |
| Manager           | Staff, teams, customers, imports, campaigns, assignments, settings, reports | Everything                                                  |
| Team Leader       | Calls like an assistant, plus assigns and monitors their own team           | Own team's customers, assignments, follow-ups and reports   |
| Calling Assistant | Calls customers, fills the call form, handles follow-ups                    | Only their current customer, own follow-ups and own numbers |

### The core rules

- An assistant works on one customer at a time. The next customer opens only after the call form is saved.
- Mandatory fields are set by the manager in Settings. The system blocks Save until they are filled.
- A follow-up ("call me at 4 PM") is a separate scheduled task. If its owner is unavailable, it moves to another available assistant.
- Two assistants can never get the same customer at the same time. The database guarantees this.
- Important actions are recorded in the Audit Logs.

## 2. Getting started

Every user signs in with an email and password given by their manager, and must choose their own password on first login.

### Sign in

1. Open the CRM address in a browser (Chrome or Edge recommended).
2. Enter your **Email** and **Password**, then click **Sign in**.
3. Five wrong passwords lock that email for 15 minutes on that network. Wait, or ask a manager to reset your password.

### First login: set your own password

1. After the first sign-in you see **Set a new password**. No other screen opens until you finish this step.
2. Enter the **Current password** (the one your manager gave you).
3. Enter a **New password**: at least 8 characters with at least 1 letter and 1 number. It must differ from the current one.
4. Repeat it in **Confirm new password** and click **Change password**.

The same screen appears again whenever a manager resets your password.

### Availability status

The status menu in the top bar tells the system whether you can take work.

| Status    | Meaning                                                           | Set by                                                 |
| --------- | ----------------------------------------------------------------- | ------------------------------------------------------ |
| Available | Ready to take customers and follow-ups                            | You, or automatically at login                         |
| On Call   | Working on a customer                                             | Automatic when a customer opens                        |
| Break     | Away for a short time; follow-ups due now may move to a colleague | You, or automatically after Save & Stop / Stop calling |
| Offline   | Not working                                                       | You                                                    |

If the browser is closed, the system also treats you as away after the **Away after** time in Settings (default 5 minutes).

### My account and logout

- Click your name in the top bar to open **My account**, where you can change your password at any time.
- Changing your password signs out all your other devices.
- Click **Logout** at the end of the day. After logout, an old browser tab or the Back button cannot reopen the CRM.

## 3. Staff and teams

Only a Super Admin can create a Manager; a Manager can create Team Leaders and Calling Assistants.

| You are                | You can create and manage                        |
| ---------------------- | ------------------------------------------------ |
| Super Admin            | Super Admins, Managers, Team Leaders, Assistants |
| Manager                | Team Leaders, Assistants                         |
| Team Leader, Assistant | Nobody                                           |

### Create a new Manager, Team Leader or Assistant

1. Go to **Staff** in the left menu and click **+ Add staff**.
2. Fill in **Name**, **Email** (this is the login and cannot be changed later) and **Phone (optional)**.
3. Choose the **Role**: Manager, Team Leader or Calling Assistant.
4. Choose a **Team** if the person belongs to one (see below).
5. Type an **Initial password**: 8+ characters with at least 1 letter and 1 number.
6. Click **Save**, then share the email and initial password with the person privately.
7. On first login they must set their own password, so you never know their final password.

### Create a team and add members

1. Create the Team Leader first (steps above, role **Team Leader**).
2. Go to **Teams**, click **+ New team**, enter the **Team name** and pick the **Team Leader**.
3. To add a member, go to **Staff**, click **Edit** on that person and choose the team in **Team**. Removing a member works the same way.
4. Open a team from **Teams** to see its leader and members.

### Reset a password

1. In **Staff**, click **Reset password** on the person.
2. Enter a new temporary password and save.
3. All of that person's sessions are signed out at once, and they must set their own password at the next login.

Use this when someone forgets their password or you suspect it has leaked.

### Deactivate someone who leaves

1. In **Staff**, click **Edit** and untick **Active**.
2. They are signed out immediately and cannot log in again. Their history (calls, notes, audit) stays.
3. Reassign their open customers and follow-ups (sections 7 and 9).

## 4. Settings (Manager)

Settings change how the call form and the automatic rules behave, with no code change; open **Settings** in the left menu.

| Section             | What it controls                                                                 | Default                                                                            |
| ------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Call outcomes       | Options in the **Call Outcome** dropdown, and whether each counts as "Connected" | Connected, Interested, Not Interested, No Answer, Busy, Switched Off, Wrong Number |
| Next actions        | Options in the **Next Action** dropdown, and which need a follow-up date/time    | No Further Action, Follow-up, Call Again, Send Information, Escalate               |
| Interest categories | Which rating range puts a customer in which category                             | 0–4 Low, 5–7 Medium, 8–9 High Interest, 10 VIP                                     |
| Tags                | Labels managers and assistants can stick on customers                            | none                                                                               |
| Follow-up timing    | Reminder minutes before due, grace period, "away after" time                     | 1 min, 10 min, 5 min                                                               |
| Calling workflow    | Form-pending reminder, auto-release when an assistant is away                    | 15 min, 30 min                                                                     |
| Mandatory fields    | Whether User Response, Notes and Interest Rating are required                    | Required when connected                                                            |

### Add or change a call outcome or next action

1. Click **+ Add outcome** or **+ Add next action** (or **Edit** on an existing row).
2. **Code**: a short UPPER\_SNAKE\_CASE name such as CALLBACK\_LATER. It cannot be changed later because reports use it.
3. **Label**: the words assistants see in the dropdown.
4. For an outcome, tick **Connected** if it means you spoke with the customer. For a next action, tick **Requires follow-up date/time** if it schedules a callback.
5. **Sort order**: a smaller number shows higher in the list.
6. To retire an option, untick **Active**. Old calls keep it; new forms no longer show it.

### Interest categories

1. Edit the **Min rating** and **Max rating** for each category so 0–10 is fully covered.
2. Optionally set the **Priority** a customer gets on entering a category (for example VIP = Urgent).
3. Click **Save categories**. All customers are recalculated at once, and the message shows how many changed category.

### Mandatory fields

Call Outcome and Next Action are always required. For User Response, Conversation Notes and Interest Rating choose **Always required**, **Required only when connected** or **Optional**. The follow-up date/time is required whenever the chosen Next Action needs it.

### Timing

- **Reminder (minutes before due)**: when the follow-up owner gets the reminder.
- **Grace period**: how long after the due time the system waits before escalating or alerting.
- **Away after**: minutes without activity after which an assistant counts as away.
- **Form pending reminder**: a customer open this long without a saved form triggers one reminder.
- **Auto-release when away**: a customer open this long, while the assistant is on Break, Offline or away, goes back to the queue. Set 0 to turn it off.

Every settings change is recorded in the Audit Logs.

## 5. Customers and bulk import

Customers are the people to call; add one at a time on the Customers page, or thousands at once with Import.

### Add or edit one customer (Manager)

1. Go to **Customers** and click **+ Add customer**.
2. Fill in **Name** and **Phone** (any format; +91 is added automatically). Optional: **Alternate phone**, **Email**, **External ID** (the casino platform user ID), **Priority**, **Notes**.
3. Click **Save**. A phone number that already exists is rejected as a duplicate.
4. To change details later, click **Edit** on the row. Set **Status** to **Do Not Call** or **Invalid** to stop the customer from ever being assigned.

### Find customers

- **Search** by name, phone or external ID.
- Filter by **category** (or "Not rated yet"), **tag**, **status** and **priority**.
- Sort by **Newest first** or **Highest interest first**.
- Click a name to open the customer profile: details, category, tags, campaigns, full call history and timeline.

Team Leaders can see and search customers but cannot add or edit them.

### Import customers from CSV or Excel (Manager)

1. Go to **Import** and click **+ New import**.
2. Click **Download template** to get a file with the right headers. Required columns: **name** and **phone**. Optional: alternate\_phone, email, external\_id, priority (LOW / NORMAL / HIGH / URGENT), notes. Common header names such as "Mobile" or "Full Name" are recognised; extra columns are ignored.
3. Choose your **CSV or Excel (.xlsx)** file (max 10 MB, 50,000 rows; only the first sheet is read) and click **Upload & preview**.
4. Check the preview counts: **Rows in file**, **Valid (will import)**, **Invalid**, **Duplicate**. Use the row filter to inspect problems, and **Download problem rows (CSV)** to fix them in Excel.
5. Optionally choose **Add to campaign** and a **Tag** so you can find this batch later.
6. Click **Import N customers**. The import runs in the background (20,000 rows take about 10 seconds); you can close the page.
7. When it finishes you get a notification, and the customers are immediately available through Start Calling.

If an import fails part-way, open it from **Import** and click **Retry**; it continues where it stopped without creating duplicates. **Cancel preview** discards a preview without importing anything.

## 6. Campaigns (Manager)

A campaign is a group of customers with its own script, extra form fields and callers; customers of an **Active** campaign are given out before the general pool.

Examples: "Casino New Users", "VIP Re-engagement", "Diwali Bonus". A campaign moves through Draft → Active ⇄ Paused → Completed. Team Leaders can view campaigns but not change them.

### Create a campaign

1. Go to **Campaigns** and click **+ New campaign**.
2. Enter the **Campaign name** and optional **Description**.
3. Set **Priority (0–100)**. When two campaigns are active, the higher number is called first.
4. Optional **Starts** and **Ends** dates limit when the campaign hands out customers.
5. Write the **Call script**: what the assistant should say. It shows on the calling screen.
6. Click **Create**. The campaign opens in **Draft**.

### Add customers (Customers tab)

1. Click **+ Add customers**.
2. Filter by **Name contains**, **Interest category**, **Tag**, **Priority**, and tick **Only fresh leads** to skip anyone already called. Only active customers are added.
3. Click **Add matching customers**. The result shows matched, added and skipped (already in the campaign).
4. You can also attach customers while importing (section 5).
5. To remove customers who have not been called yet, tick them and click **Remove**.

### Choose who calls (Who calls tab)

- Tick individual assistants and/or whole teams, then click **Save members**.
- If nobody is ticked, every assistant can call this campaign's customers.

### Add extra form fields (Custom fields tab)

1. Click **+ Add field** and type a **Label** such as "Deposit amount". The key is generated automatically.
2. Choose the **Type**: Text, Number, Yes/No or Dropdown (for Dropdown, type the options separated by commas).
3. Tick **Required** if the assistant must fill it.
4. Click **Save fields**. Key and type cannot change after saving; untick **Active** to retire a field.

### Run the campaign

| Button     | Effect                                             |
| ---------- | -------------------------------------------------- |
| ▶ Activate | Assistants start getting this campaign's customers |
| ⏸ Pause    | Stops handing out customers; nothing is lost       |
| ▶ Resume   | Continues a paused campaign                        |
| ✓ Complete | Ends the campaign for good; it cannot be restarted |
| Edit       | Change name, priority, dates or script at any time |

The progress bar shows called versus total customers. The **Results** tab shows calls by outcome. When every customer has been called, the creator and all managers get a "all customers called" notification once.

## 7. Assignments (Manager, Team Leader)

Most of the time no assignment is needed: assistants press Start Calling and the system hands them the right customer; assign manually only when a specific person must call a specific customer.

### What Start Calling gives an assistant, in order

1. Their current customer, if one is already open.
2. Their own follow-ups that are due now.
3. Customers a manager or team leader assigned to them.
4. Customers of active campaigns they are allowed to call (higher campaign priority first).
5. Fresh customers from the general pool (higher customer priority first).

### Assign one customer

1. Go to **Customers**, find the customer and click **Assign**.
2. In **Assign to**, pick the assistant (a Team Leader sees only their own team).
3. If the customer is in a campaign, optionally pick it so the assistant sees that campaign's script and fields.
4. Click **Assign**. The customer goes to the front of that assistant's queue, and the assistant gets a notification.

### Reassign or cancel

- Go to **Assignments**. The default view shows open ones (queued and in progress).
- **Reassign** moves the customer to another assistant; it works even while the first assistant has the customer open, and their screen refreshes.
- **Cancel** puts the customer back in the general pool.

### Distribute many customers at once

1. Go to **Assignments** and click **⇄ Distribute**.
2. Tick the assistants under **Assign to** (or **Select all assistants**).
3. Choose **How to distribute**:
   - **Load-based**: each customer goes to whoever currently has the fewest open customers, so everyone ends up even. Best for daily use.
   - **Round-robin**: customers are dealt in turn, so everyone gets the same number of new customers.
4. Pick which customers: a **Campaign** (its customers not yet called), or the general pool filtered by **Interest category**, **Tag**, **Priority** and **Only fresh leads**.
5. Set **How many customers** (up to 2,000 per run) and optionally **Max per assistant**.
6. Click **Preview**. A table shows each assistant's open customers now, how many they will get and the total after. Nothing is saved yet.
7. Click **Distribute N →**. Each assistant gets one notification such as "3 customers assigned to you".

A customer already held by someone, or with an open follow-up, is never distributed again. Changing any option clears the preview, so the numbers you confirm are always current.

## 8. Calling Assistant: daily workflow

Press **Start Calling**, call the one customer shown, fill the form, and press **Save & Next** to get the next customer.

### Start your shift

1. Sign in. Your status becomes **Available**.
2. Check **Follow-ups** and the bell for anything due today.
3. Click **Start Calling** in the left menu, then the **▶ Start Calling** button.

### Work on a customer

1. The screen shows one customer: name, phone, category, tags, campaigns and the full **Call history**. Badges tell you why you got them: **Assigned by manager**, **Follow-up**, or a campaign name.
2. If a campaign **Script** is shown, use it.
3. For a follow-up, the yellow box shows when it was promised, by whom, and what the customer said last time.
4. Click the green **📞 phone number** to call (or **📞 Alternate** for the second number). The attempt is recorded automatically.
5. You can add or remove **tags** on the profile while you talk.

### Fill the call form

| Field                    | What to enter                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| Call Outcome \*          | What happened: Connected, Interested, No Answer, Busy, Switched Off, Wrong Number…                        |
| Next Action \*           | What happens next: No Further Action, Follow-up, Call Again, Send Information, Escalate                   |
| Follow-up date & time \* | Only when the Next Action needs it, e.g. the customer said "call me at 4 PM". Must be in the future       |
| User Response            | What the customer said, in short                                                                          |
| Conversation Notes       | What was discussed                                                                                        |
| Interest Rating (0–10)   | How interested the customer is. It sets the category automatically (8–9 High Interest, 10 VIP by default) |
| Campaign fields          | Extra fields of the campaign, e.g. Deposit amount                                                         |

Fields marked \* are always required; others become required according to Settings (usually when connected). If something is missing, a red list explains it and the next customer does not open.

### Finish the customer: three choices

| Button             | When to use it                                            | What happens                                             |
| ------------------ | --------------------------------------------------------- | -------------------------------------------------------- |
| **Save & Next →**  | Normal case                                               | Call saved, next customer opens straight away            |
| **Save & Stop ⏸**  | Going on break or ending the shift after this call        | Call saved, no next customer, your status becomes Break  |
| **⏹ Stop calling** | You opened a customer but did not dial yet and must leave | Customer released without a call record, you go on Break |

Once you have dialled a customer, **Stop calling** is refused: fill the form instead (choose **No Answer** if nobody picked up). This keeps every attempt on record. A released customer goes back to the queue (or stays in your queue if a manager assigned it), so skipping is not possible.

### Breaks and end of day

- For a break, use **Save & Stop**, or set your status to **Break** when no customer is open.
- To continue, press **▶ Start Calling** again; your status changes to On Call automatically.
- At the end of the day, finish with **Save & Stop**, then **Logout**.
- If you leave a customer open, you get a "Call form pending" reminder after 15 minutes. If you are away for 30 minutes, the customer is released automatically and your team leader is told.

### Your follow-ups

Open **Follow-ups** to see yours by tab: **All open**, **Overdue**, **Due now**, **Upcoming**, **Completed**, **Cancelled**. Due follow-ups come to you first when you press Start Calling (section 9).

## 9. Follow-ups, reminders and escalation

A follow-up is created automatically when a call is saved with a Next Action that needs a date and time; nobody creates it by hand.

```
3:59 PM  Reminder to owner
4:00 PM  Due: owner notified
4:10 PM  Grace over → owner available?
           ├─ yes (not called yet) → Overdue alert to team leader
           └─ no (break / offline / away) → Escalated to another available assistant
                                              → they get it first on Start Calling
```

The owner gets a reminder just before the due time and the follow-up comes to them first on Start Calling. If the owner is still unavailable when the grace period ends, it moves to the available assistant with the fewest open follow-ups, who sees the original promise and the full history.

### For assistants

- Promise a callback by choosing a Next Action such as **Follow-up** and setting **Follow-up date & time**.
- When it is due, press **Start Calling**; the follow-up opens before any other customer, with a yellow box showing what was promised.
- Saving the call completes the follow-up. If you promise another callback, a new follow-up is created.
- If you go on Break when your follow-up is due, it may be escalated to a colleague; you get a notification that it moved.

### For managers and team leaders

- **Follow-ups** shows the whole team (Team Leader) or everyone (Manager), with the same tabs as for assistants.
- **Reschedule** changes the due time; reminders are sent again for the new time.
- **Reassign** gives the follow-up to another assistant.
- **Cancel** removes a follow-up that is no longer needed.
- An **Overdue** alert means the owner was available but has not called. Talk to them or reassign it.
- Reminder, grace period and away time are set in **Settings → Follow-up timing** (section 4).

## 10. Notifications

The bell in the top bar shows unread notifications and refreshes every 30 seconds; click one to open the related page and mark it read, or click **Mark all read**.

| Notification                                        | Who gets it                                              | What to do                                                           |
| --------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Follow-up soon                                      | Follow-up owner, 1 minute before due                     | Get ready; finish the current call                                   |
| Follow-up due now                                   | Follow-up owner                                          | Press Start Calling; the follow-up opens first                       |
| Escalated to you                                    | Assistant who receives an escalated follow-up            | Press Start Calling; read the promise in the yellow box              |
| Follow-up moved to someone else                     | Original owner who was unavailable                       | Nothing; a colleague is handling it                                  |
| Overdue follow-up                                   | Team Leader (or managers if no team leader)              | Ask the owner to call, or reassign it                                |
| Follow-up assigned to you                           | Assistant, when a manager reassigns a follow-up          | Handle it when due                                                   |
| New customer assigned / N customers assigned to you | Assistant, after Assign, Reassign or Distribute          | Press Start Calling; assigned customers come before the general pool |
| Call form pending                                   | Assistant with a customer open too long (default 15 min) | Save the call or use Stop calling                                    |
| Released (you were away)                            | Assistant and their Team Leader (or managers)            | Team Leader: check why the customer was left; reassign if needed     |
| Campaign: all customers called                      | Campaign creator and all managers                        | Add more customers, or mark the campaign Completed                   |
| Import complete / Import failed                     | The person who started the import                        | On failure, open the import and click Retry                          |

## 11. Team Leader guide

A Team Leader calls customers exactly like an assistant (section 8) and also watches and steers their own team; everything they see is limited to that team.

| Task                                  | Where                                         | How                                                          |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| See the team's numbers                | Dashboard, Reports                            | Team performance tiles; Reports → Assistants for each member |
| See who has which customer            | Assignments                                   | Open view shows queued and in-progress customers of the team |
| Give a customer to a member           | Customers → Assign                            | Only team members appear in the list                         |
| Hand out many customers               | Assignments → ⇄ Distribute                    | Same steps as a manager (section 7), team members only       |
| Move work from someone who left early | Assignments → Reassign; Follow-ups → Reassign | Pick another team member                                     |
| Watch follow-ups                      | Follow-ups                                    | Overdue tab first, then Due now                              |
| React to alerts                       | Bell                                          | Overdue follow-ups and "was away" releases for your team     |
| See campaigns                         | Campaigns                                     | Read-only: script, fields, progress, results                 |
| Export team data                      | Reports → ⬇ CSV buttons                       | Exports contain only your team                               |

### A good daily routine

1. Morning: check the bell and the **Overdue** follow-ups; make sure everyone is **Available**.
2. If someone has an empty queue, use **⇄ Distribute** (load-based) for the team.
3. During the day: handle overdue and "was away" alerts within minutes.
4. Evening: check **Reports** for today (connect rate, calls per assistant) and that nobody left a customer open.

## 12. Dashboard, reports and CSV export

The Dashboard gives every role its numbers at a glance, and Reports (Manager, Team Leader) adds per-assistant and per-campaign tables with CSV downloads.

### Choose the period and filters

- **Date range**: Today, Yesterday, This week (from Monday), This month (from the 1st), Last 7 days, Last 30 days, or Custom range (up to 366 days). Days follow India time.
- Filters: **team** (Manager only), **assistant** and **campaign**.
- Each tile compares with the previous period of the same length (▲ / ▼). "This week" compares with the same weekdays of last week.

### What the numbers mean

| Tile                                                    | Meaning                                              |
| ------------------------------------------------------- | ---------------------------------------------------- |
| Calls                                                   | Call forms saved in the period                       |
| Connect rate                                            | Share of calls whose outcome counts as Connected     |
| Avg interest rating                                     | Average 0–10 rating given                            |
| Talk time                                               | Total call duration reported by the calling provider |
| Customers reached                                       | Different customers called                           |
| Follow-ups promised                                     | Calls that scheduled a callback                      |
| Follow-ups due (period) / Completed on time / Escalated | How follow-ups due in the period were handled        |

Charts show calls per day, the best time to call (calls and connects by hour) and calls by outcome. The Dashboard also shows how many customers are in each interest category; click one to open that list.

### Reports tabs

- **Overview**: the same tiles and charts with filters.
- **Assistants**: one row per assistant with calls, connect rate, rating, talk time, follow-ups, overdue now and current availability. Tick the box to include staff with no calls.
- **Campaigns**: progress and results per campaign.

### Export to Excel

Click **⬇ calls CSV**, **⬇ assistants CSV** or **⬇ campaigns CSV**. The file uses the filters on screen and opens correctly in Excel, including Hindi names and the ₹ sign. Every export is recorded in the Audit Logs because it contains phone numbers. Assistants see only their own numbers; Team Leaders only their team.

## 13. Audit logs (Manager)

**Audit Logs** answer "who did what, and when", newest first; entries cannot be edited or deleted.

- Filter by **action** (for example `auth.login_failed`, `assignment.distributed`, `assignment.released`, `follow_up.escalated`, `report.exported`) and by **entity** (staff, customer, campaign, follow-up…).
- Each row shows the time, the person (or "System" for automatic actions such as escalation), the action and what changed (old → new value).

Common uses:

| Question                                       | Filter                                       |
| ---------------------------------------------- | -------------------------------------------- |
| Who changed a customer's phone?                | Entity: customer, action: `customer.updated` |
| Who keeps releasing customers without calling? | Action: `assignment.released`                |
| Why did a follow-up move to someone else?      | Action: `follow_up.escalated`                |
| Who downloaded customer data?                  | Action: `report.exported`                    |
| Is someone guessing passwords?                 | Action: `auth.login_failed`                  |

## 14. Troubleshooting and FAQ

Most problems come from status, permissions or a missing setup step; this table lists what users see and the fix.

| What you see                                                   | Why                                                             | Fix                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------- |
| "Incorrect email or password"                                  | Wrong email or password                                         | Check caps lock; ask a manager to reset the password                 |
| "Too many failed login attempts. Try again in N minutes"       | 5 wrong passwords                                               | Wait 15 minutes, or a manager resets the password                    |
| "Session expired — please log in again"                        | Password was changed or reset, or the account was deactivated   | Log in again with the new password                                   |
| "No customer is available right now"                           | Queue is empty, or campaign members exclude you                 | Manager: import or add customers, check the campaign's Who calls tab |
| "A manager gave this customer to someone else"                 | The customer was reassigned while you had it open               | Nothing; the screen refreshes. Press Start Calling                   |
| Save & Next shows a red list                                   | Required fields are empty, or the follow-up time is in the past | Fill the listed fields                                               |
| "You already dialled this customer" when pressing Stop calling | A call attempt exists                                           | Save the form, e.g. outcome No Answer                                |
| "Your role does not have permission to view this page"         | The page is for another role                                    | Ask a manager if you need access                                     |
| "Cannot reach the server"                                      | Internet or server problem                                      | Check your internet, refresh; tell the administrator if it continues |
| Import shows many duplicates                                   | Those phone numbers already exist                               | Expected; download problem rows to review                            |
| Assistant gets no follow-ups while on Break                    | By design: follow-ups go to available people                    | Set status to Available                                              |

### FAQ

**Can two assistants call the same customer by accident?** No. The database allows only one open assignment per customer, even when many people press Start Calling at the same second.

**What happens if my browser crashes mid-call?** Sign in again and press Start Calling; the same customer opens with the form empty. If you stay away for 30 minutes, the customer is released automatically.

**Can I skip a difficult customer?** Not after dialling: the form must be saved. Before dialling, Stop calling puts them back in the queue, and they usually come back to you next.

**How do I change the call form options?** A manager edits them in Settings (section 4). No developer is needed.

**Where is the call recording?** In the calling provider. When the provider integration is enabled, the recording link appears in the customer's call history.

## 15. Quick reference

These checklists cover a normal day for each role; the earlier sections explain each step.

### First-time setup (Super Admin / Manager, once)

- [ ] Sign in with the seed admin account and set a new password
- [ ] Create the Managers (Super Admin only)
- [ ] Create Team Leaders, then teams, then Assistants with their team
- [ ] Review Settings: call outcomes, next actions, categories, mandatory fields, timing
- [ ] Import the customer list (start with a small test file)
- [ ] Create the first campaign, add customers, choose who calls, Activate

### Calling Assistant, every day

- [ ] Sign in, check the bell and Follow-ups
- [ ] Start Calling → call → fill the form → Save & Next
- [ ] Use Save & Stop before every break
- [ ] Handle due follow-ups as soon as they appear
- [ ] End with Save & Stop, then Logout

### Team Leader, every day

- [ ] Check overdue follow-ups and "was away" alerts
- [ ] Make sure every member has work (Distribute if needed)
- [ ] Review today's team report before leaving

### Manager, every week

- [ ] Review Reports for the week: connect rate, calls per assistant, follow-ups on time
- [ ] Complete finished campaigns, start new ones
- [ ] Deactivate leavers and reassign their work
- [ ] Look at Audit Logs for failed logins and exports
