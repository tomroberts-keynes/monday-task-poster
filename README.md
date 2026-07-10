# Monday Task Poster

Pick **Client** → **Item** (Optimizations / Client Tasks / Creative Changes / Budgets)
→ **Template** (matched to that item, pulled from your real ticket templates) → fill in
the template's fields → **Assignee** + **Due Date** → it creates a subitem on the
**Live Clients** board and posts the filled-in template as an update on that subitem,
formatted the same way your Google Doc templates specify.

## How it works

- `public/index.html` — the form. Client and Item dropdowns are always live from Monday.
  Once you pick an Item, the Template dropdown and its fields appear, matched by
  category (detected from the item's name — e.g. anything with "Budgets" in it gets
  the Budgets templates).
- `netlify/functions/get-metadata.js` — clients, assignees, and the full template
  library (from `templates.json`).
- `netlify/functions/get-client-items.js` — the specific client's actual items.
- `netlify/functions/create-task.js` — on submit: creates a **subitem** under the
  chosen item, posts an update on it with the filled-in template fields, formatted as
  `**Label:** value` per line (same structure as the source docs), plus any assignee
  routing note (e.g. "AM to assign to PA and Ren") — **and** sets the **parent item's**
  own Assignee, Submission Date (today), Due Date, and Status columns, every time.
- `templates.json` — the templates themselves, pulled from:
  - Budgets: New Client (first ticket), Monthly Budget, Monthly Budget (multiple
    invoices), Incremental Budget, Invoice Credit (bug impact)
  - Client Tasks: Relaunch or New Campaign, Client Pause
  - Creative Changes: New Launch / Relaunch, Creative Pause Request
  - Optimizations: no template — Custom ticket only
  - Every item also has a **Custom ticket** option (a single free-text field) for
    anything that doesn't fit a template.
- `config.json` — board ID and subitem column IDs.

Your Monday API token never touches the browser — it's only used server-side inside
the Netlify functions, via an environment variable.

## 1. Get a Monday API token

Monday.com → your avatar → **Admin** → **API** (or **Developers** → **My access tokens**).
Copy a token with access to the Live Clients board.

## 2. Deploy to Netlify

1. Push this folder to a new GitHub repo.
2. In Netlify: **Add new site → Import an existing project**, connect the repo.
   Build settings are already defined in `netlify.toml` — leave the build command
   blank and publish directory as `public`.
3. In **Site settings → Environment variables**, add:
   - `MONDAY_API_TOKEN` = the token from step 1
4. Deploy. Netlify picks up the functions automatically.

## 3. Try it

Pick a client, pick an item, pick a template, fill it in, choose an assignee and due
date, submit. The subitem appears immediately with the filled template posted as its
first update — and the parent item itself (e.g. `DIBS Beauty | Budgets | PREPAY ARN`)
gets its Assignee, Submission Date, Due Date, and Status updated too, every time.

## One thing that still needs a manual step

The **New Client — First Budget Ticket** template says (per your doc) to paste the
info into both the item's Updates *and* its Info Box. This tool posts to Updates
automatically — the Info Box itself isn't reachable through Monday's API (it's a
custom item view, not a column), so that one still needs a quick manual copy-paste
into the Info Box after submitting.

## Notes / things worth deciding later

- New subitems get status **Backlog** by default (set in `config.json`).
- The assignee list pulls everyone on the account (`kind: non_guests`) — happy to
  filter to a specific team if that list is unwieldy.
- If any of the template fields, wording, or assignee-routing notes are off, they're
  all just plain data in `templates.json` — easy to tweak without touching any of the
  function code.
- No authentication on the form itself — anyone with the URL can post a task. Fine for
  an internal tool behind a private link, but say the word if you want a password gate
  or Netlify Identity in front of it.
