# SkullSpace Bar Menu (skullmenu)

The public menu board: a full-screen React page that runs on the TV facing the room during
SkullSpace socials and events. Live at <https://skullmenu.shotty.tech>.

It is read-only. It never writes to Appwrite, takes no payment, and has no admin screen — prices,
categories and the member discount are all edited elsewhere (the admin app) and appear here within
seconds. The one thing it decides for itself is **whether alcohol may be shown**, and that logic is
the part of this README worth reading before an event.

Clicking anywhere on the board calls `requestFullscreen()`, which is how you get the TV out of
browser chrome. The dark theme is forced on at mount; there is no light mode.

---

## Where the data comes from

Appwrite, endpoint `https://api.cloud.shotty.tech/v1`, project `68f2ac7b00002e7563a8`. These are
hardcoded in `src/API/api.js` — there is no `.env`, and no `process.env` reads anywhere in `src/`.

| What | Database | Collection | Read by the board as |
| --- | --- | --- | --- |
| Categories | `67c9ffd9003d68236514` | `67c9ffdd0039c4e09c9a` | anonymous (`read("any")`) |
| Items | `67c9ffd9003d68236514` | `pos_items` | anonymous (`read("any")`) |
| Bar config | `barData` | `config` | anonymous (`read("any")`) |
| Active event | — | — | `ticketing-active-event` function, **not** a collection read |

Those three collections are fetched once at load and then kept current by an Appwrite Realtime
subscription on all three. The active event has no usable realtime channel here (Realtime only
delivers rows the session can read, and this session cannot read `Events` at all), so it is polled
every 60 seconds and re-fetched on any realtime event.

The board also creates an **anonymous session** at startup. It needs one only because
`ticketing-active-event` is `execute: ["users"]`. The three collection reads deliberately do not
wait on the session — a hung `account.get()` must not keep prices off the screen.

The old items collection `67c9ffe6001c17071bb7` (`Items_old`) is retired and still holds
cost-of-goods columns. Nothing here reads it; do not point it back.

---

## What it puts on screen

One column per category, left to right, each column a list of items.

**A category is shown** when it has at least one visible item. Empty categories are dropped
entirely (the remaining columns grow to fill the space) — so "alcohol outside bar hours" reads as a
board with fewer columns, not as an empty box. With one or two columns on screen, each spreads its
items into two balanced sub-columns.

**An item is shown** when all of these hold:

- its category is shown (see the alcohol gate below),
- `enabled_menu` is true,
- `enabled_pos` is true — the board will not advertise something the bartender cannot ring up,
- its name does not end in `DBL` (those rows exist for the register; see below).

**Per item:** `name_menu` if set, otherwise `name`; a maple leaf if `canadian` is true; the `image`
URL if set, otherwise a vector `CategoryIcon`; `size` rendered as mL except in the Food category,
where a mL figure is meaningless.

**Prices** are cents, from `sale_price` — the same number the register charges, and the only one.
`self_pricing` is never displayed (it used to be shown in place of the real price whenever alcohol
was off, which quietly advertised a price the till would not honour).

Two categories get a two-line price stack instead of a single price:

- **Mixed Drinks** → `Single` / `Double`
- **Food** → `1 Slice` / `2 Slices`, when a double price exists

The **double price comes from the register's own `<name> DBL` item row** (`sale_price` on that row,
only if it is `enabled_pos`), falling back to the single row's `dbl_price` field when no DBL twin
exists. This matters: `dbl_price` is free text nobody rings up, and four of the six spirits had it
a dollar under the DBL row's real price. If the board and the till disagree on a double, fix the
`DBL` item.

**Footer:** "SkullSpace members receive N% discount", from `barData/config` key `member_discount`
(live value: `25`). It is shown only while alcohol is on the board.

### Category names

Layout decisions (`utils/categoryLayout.js`) match on a *normalised* name: leading emoji and their
modifiers stripped, whitespace collapsed, case folded. `🥃 Mixed Drinks/Shots`, `🥃 Mixed Drinks`
and `Mixed` all keep their Single/Double stack; `Food` is matched exactly; `Non-Alcoholic` matches
with or without the hyphen. Renaming a category in the admin app will not silently switch a price
stack off.

Two things are still name-sensitive, and are worth knowing before you rename anything:

- `components/CategoryIcon.js` matches the raw name for `Non-Alcoholic`, `Mixed` and `Alcohol`. A
  rename that drops those words falls back to the generic glyph. Cosmetic only.
- While alcohol is off, the Non-Alcoholic column's heading is softened to **"Beverages"** — there
  is nothing alcoholic on screen for it to be the "non" of.

---

## The alcohol gate

Three checks, in this order. **Every one of them fails closed: anything unknown hides alcohol.**

1. **Kill switch.** `barData/config` row `alcohol_override_disabled` (live value: `false`). The
   string `"true"` hides all alcohol immediately. *If the config fetch has not resolved or failed,
   this reads as engaged* — no Appwrite function enforces this switch, the clients are the only
   place it is honoured, so an unknown answer must not leave a board selling.
2. **Active event.** Fetched through the `ticketing-active-event` function (below). No active event
   → no alcohol.
3. **Bar hours.** The event's `sellsAlcohol` must be true, and the current time must fall inside
   `barOpenTime`–`barCloseTime`. A close time earlier than the open time is treated as an overnight
   window (`18:00`–`02:00` works). **On this board** both `"HH:mm"` and bare `"1800"`/`"200"`
   parse — the admin field has no validation at entry, and Verify-Pin's parser
   (`Verify-Pin/src/eventWindow.js`) accepts both forms too. The staff POS does **not**; see
   "Where the board and the register differ" below before assuming a stored value reads the same
   way everywhere.

The gate is re-evaluated once a minute, so the window opens and closes on its own mid-shift without
a reload.

The board and the staff POS read the **same data** — the same `barData/config` row and the same
active event — but they are **not** running the same gate. See below before concluding that a
disagreement between the TV and the till means one of them is on stale code.

**The gate keys on the category's `alcohol` boolean, not on the item's `contains_alcohol`.** The
board never reads `contains_alcohol`. An alcoholic item filed under a non-alcohol category will sit
on the board at every hour of the day.

### Where the board and the register differ

The two `isWithinBarHours` bodies — `skullmenu/src/utils/barHours.js` and
`POS/src/utils/barHours.js` — are still identical line for line. Everything around that one
function has diverged, in two independent ways, and both surfaces are on current code. A board and
a register that disagree about whether the bar is open are far more likely to be hitting one of
these than a bad deploy.

- **Colon-less bar times.** This board's `parseTimeToMinutes` strips the colon and accepts 3–4
  digits, so `"1800"` and `"200"` parse. The POS's copy is module-private and still strict —
  `value.match(/^(\d{1,2}):(\d{2})$/)`, and anything else returns `null`, which
  `isWithinBarHours` fails closed on. So an event saved with `barOpenTime` `"1800"` opens the bar
  on this board, and keeps bartender PINs working (Verify-Pin is lenient too), while the register
  silently hides every alcohol item for the whole event. All three event rows in the project
  currently store `"HH:mm"` (`18:00`/`22:00` open, `02:00` close), so this is latent, not live —
  typing a bar time without the colon is what arms it. Until the POS parser is relaxed, enter bar
  times with the colon.
- **The kill switch.** This board's `isAlcoholOverrideDisabled` engages only on the exact string
  `"true"`. The POS's `readAlcoholOverride` — which lives in `POS/src/components/pos/pos.js`, not
  in its `barHours.js` — inverts the test: any value that is present and *not* in
  `{"", "false", "0", "no", "off"}` engages the switch. `alcohol_override_disabled` set to
  `"TRUE"`, `"1"` or `"yes"` therefore stops the register selling while this board keeps
  advertising. Only the exact lowercase `"true"` stops both. The POS's switch is also four-state
  (`on` / `off` / `unknown` / `pending`, distinguishing "we could not read the config" from "the
  admin never set it"); this board's is two-state, with any unresolved or failed config read
  treated as engaged. Both fail closed on an unknown answer; they differ on which *known* values
  count as engaged.

### Header states

| On screen | Means |
| --- | --- |
| `Bar Open · Until 2:00 AM` | gate open; the time is the event's `barCloseTime` |
| `Bar Closed` | we asked, and alcohol is genuinely not being served right now |
| `Bar Status Unavailable · Ask Staff` + red banner | **we could not ask.** Alcohol is hidden anyway |

The third state exists because the board is the only place either claim is said out loud. A failed
lookup used to render as a confident "Bar Closed", which is a statement about the bar made on no
information.

### `ticketing-active-event`

- Function id `ticketing-active-event` (name `Ticketing-ActiveEvent`), execute
  `["users"]`, scopes `documents.read`, timeout 15s.
- Source: `AppwriteFunctions/functions/Ticketing-ActiveEvent/`. That repo is the only source of
  Appwrite Functions — the fork that used to live under ShottyTicketing is gone.
- It returns `{ "event": {...} }` or `{ "event": null }`; among the door-facing fields it projects
  `sellsAlcohol`, `barOpenTime` and `barCloseTime`, which is the whole reason this board calls it.

It exists because the board's anonymous session cannot read the `Events` collection
(`68e400210008d19bb5c9`) at all — that collection is admin-team-only, and widening it is not an
option, because the same rows carry `revenue`, `cogs`, `profit`, `tips_earned`, `cash_sales` and
`card_sales`. Appwrite permissions are per-collection, never per-field; the function is the field
filter. Do not "fix" a blank bar status by granting the board read on `Events`.

### Vestigial config rows

`barData/config` still contains `bar_start` and `bar_end` (both live at `2200`). **Nothing reads
them.** They are left over from the static schedule the board used before the gate moved to the
active event. Editing them does nothing; bar hours are set per-event in the admin app.

---

## When something looks wrong

| Symptom | Check |
| --- | --- |
| Alcohol columns missing, bar should be open | In this order: `alcohol_override_disabled` is not `"true"`; an event has `isActive` true; that event has `sellsAlcohol` true; its `barOpenTime`/`barCloseTime` bracket right now. |
| `Bar Status Unavailable · Ask Staff` | The function call failed. `appwrite functions get --function-id ticketing-active-event` — is it enabled, is the latest deployment `ready`, is execute still `users`? Then: is anonymous auth still on for the project? The board's browser console logs the underlying error. |
| One item missing | `enabled_menu` **and** `enabled_pos` both true; the item is assigned to a category; its name does not end in `DBL`. |
| Board's double price ≠ what the till charges | The board quotes the `<name> DBL` row's `sale_price`. Fix that row, not `dbl_price`. |
| An alcoholic item shows after close | It is filed under a category whose `alcohol` flag is false. |
| Whole board blank / stale | Nothing here caches beyond the page: reload the TV. Prices and categories otherwise update live over Realtime. |

---

## Develop, build, deploy

```
npm install
npm start                         # dev server on :3000
CI=true npx react-scripts test --watchAll=false   # 7 suites, 69 tests green at dba5aec
npm run build                     # static output in build/, gitignored
```

Create React App (`react-scripts` 5.0.1), React 18, `appwrite` web SDK 17. Prettier config in
`.prettierrc` (4 spaces, single quotes, no trailing commas).

Deployment is Cloudflare Pages, built from a push to `master` on
<https://github.com/skullspace/skullmenu>. There is no CI config, no `wrangler.toml` and no deploy
script in this repo — the build settings live in the Cloudflare dashboard. Verified as of
2026-09-13: <https://skullmenu.shotty.tech> is served by Cloudflare and the deployed bundle
(`/static/js/main.51a91217.js`) is byte-identical to a local `npm run build` of `master` at
`dba5aec`.

### Source map

```
src/API/api.js               Appwrite client, the three collection reads, realtime + event poll
src/App.js                   column/item filtering, alcohol gate wiring
src/utils/activeEvent.js     calls ticketing-active-event; ok / unavailable / pending states
src/utils/barHours.js        the alcohol gate itself (kill switch + bar-hours window)
src/utils/doublePrice.js     DBL-row lookup for the posted double price
src/utils/categoryLayout.js  emoji-insensitive category name matching, column headings
src/components/             Header (bar status), Footer (member discount), BarItem, CategoryIcon, Grain
```

`src/dark.css` is not imported by anything; `src/theme.css` is the live stylesheet.

There is a second checkout of this repository at `../MEnu`. It is stale and not authoritative — see
its README before touching it.

---

License: AGPL-3.0+ (see `COPYING`). Originally by Zorian Medwid.
