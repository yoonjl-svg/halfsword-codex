# Optional persistent growth trial

[progression.sql](progression.sql) adds a separate economy for `halfsword-codex-growth-trial`. It leaves the existing account/profile migration untouched. Wins, coins, points, inventory, equipped badge and the player's strength level belong to `(app_id, auth.uid())`. The existing anonymous Auth session permits play without a signup form; linking an email to that same user later preserves growth. Signing into a different account switches to that account's growth and does not merge balances.

These are temporary trial rules: a win grants 10 coins; every third lifetime win grants 1 stat point; one point raises `player.strength` by one level, capped at 5. The game may apply `1 + strength × 0.02`, up to +10%, only in its explicit growth trial. The SQL stores levels and publishes that rule; it does not run combat. The 30-coin `wayfarer_seal` (여행자의 인장) is an owned cosmetic badge with no combat effect. Each item is purchasable once.

Only the trial app is enabled by the migration. A newly inserted policy defaults to disabled; unknown or disabled app IDs receive `PT403`. Production rules and activation require a separate deliberate migration after the owner chooses them. App IDs isolate economies, but do not authenticate which browser app a user is running: an authenticated user can call the enabled trial RPC directly.

## Installation and identity

There is no live Supabase project configured or tested by this package. Follow the existing [account setup](README.md) for Supabase anonymous Auth and optional email recovery. Apply `progression.sql` once as the trusted migration owner after Auth exists. Name collisions fail and roll back instead of overwriting existing tables/functions. The growth migration does not require the profile table; the local runner applies both migrations to verify coexistence.

Clients use the project public key plus the signed-in user's bearer token; never provide a service-role key to the browser. Every RPC derives its user exclusively from `auth.uid()`. Pin the operation to the captured session/UID and discard a response after an account switch. Keep pending UUIDs with their original UID and app; never replay a former user's request under the new user's token. A lost anonymous session is not recoverable from its display name or growth data.

## RPC contract

All functions below return JSONB. Supabase parameter names must match exactly.

| Function | Parameters | Result |
| --- | --- | --- |
| `growth_snapshot` | `p_app_id text` | Current snapshot; absent state returns zeroes without writing |
| `growth_begin_round` | `p_app_id text, p_request_id uuid` | `{ "round_id": "server-generated UUID" }` |
| `growth_finish_round` | `p_app_id text, p_round_id uuid, p_win boolean` | Current snapshot |
| `growth_purchase` | `p_app_id text, p_request_id uuid, p_item_id text` | Current snapshot |
| `growth_allocate` | `p_app_id text, p_request_id uuid, p_character_id text, p_stat text` | Current snapshot; only `player` / `strength` |
| `growth_equip` | `p_app_id text, p_request_id uuid, p_item_id text` | Current snapshot; send JSON `null` to unequip |

An initial snapshot is:

```json
{
  "wins": 0,
  "coins": 0,
  "points": 0,
  "characters": { "player": { "strength": 0 } },
  "inventory": [],
  "equipped": null,
  "revision": 0,
  "rules": { "winCoins": 10, "milestone": 3, "pointsPerMilestone": 1, "strengthStep": 0.02, "strengthCap": 5 },
  "catalog": [{ "id": "wayfarer_seal", "name": "여행자의 인장", "price": 30 }]
}
```

Persist the server round ticket before starting rewarded combat. Only one round can be active for a user/app. A new begin request abandons the preceding active round without rewarding it; retrying the same begin UUID returns its original ticket without abandoning anything. Quitting without reporting a result awards nothing. The next begin abandons that unfinished ticket.

Finish accepts a ticket only for the signed-in UID and exact app. The server checks age ≥3 seconds and ≤24 hours on its own clock. A win or loss can finalize the ticket once. Replaying the same result returns the current snapshot without another reward; changing an already recorded outcome receives `PT409`. Loss awards no wins, coins or points. Both accepted wins and losses advance revision; begin does not. A completed ticket's exact replay remains valid after its original expiry window.

**The outcome is client-reported. These ticket, age and replay checks are not verified anti-cheat:** a modified client can begin a round, wait three seconds and report a fabricated win. Competitive rankings or valuable rewards need an independently trusted result verifier before production activation. Browser-local demo growth is not uploaded as trusted server growth.

Generate a new UUID for each new purchase, allocation, equip change or begin intent, and preserve it while retrying an uncertain network outcome. The ledger key is `(app_id, user_id, request_id)` across all four operations. Stored operation plus canonical JSON payload provide the fingerprint: reusing a successful UUID for different arguments or another operation receives `PT409`. Exact mutation retries return the latest snapshot without applying the operation again. Begin retries return the original ticket even if it has since completed or been abandoned; use a new UUID to start a new round. Rejected operations roll back all effects and do not reserve their UUID, so an unaffordable purchase may be retried after coins arrive. Successful request and round ledgers must be retained for replay protection; do not prune them without a separately designed replay horizon.

`PT400` means invalid arguments, `PT401` missing authenticated identity, `PT403` disabled economy, `PT404` unknown ticket for this user/app, `PT409` a conflicting outcome/payload, insufficient funds/points, ownership/cap limit or abandoned round, and `PT410` expired active ticket. `PT425` means the round finished before the server's minimum age: retry the same ticket and outcome after a bounded delay. Do not automatically retry permanent `PT409` conflicts as timing failures. PostgREST maps these to the corresponding HTTP status. Authentication can reject a request before SQL executes. Reload after conflicts and keep the original UUID only when retrying the same intent; do not turn a failed purchase into a different request silently.

## Data protection and validation

`growth_policies` and `growth_catalog` are server-owned and client-readable; clients cannot choose prices, rewards, limits or timing. `growth_players`, `growth_rounds` and `growth_requests` expose only the signed-in user's rows through RLS. There are no client write grants or write policies. Public RPCs run under a trusted owner with an empty `search_path`; their internal helper functions are not executable by clients. Deleting an Auth user as a trusted administrator cascades their growth state and ledgers. Deleting the separate display-name/settings profile does not delete growth.

Every mutation acquires the same player row lock before inspecting money, points, inventory, tickets or the request ledger. First-use insertion handles competing creates. This serializes spending, allocation, equip, begin and finish for that user/app. A purchase deducts the catalog price and grants inventory in the same transaction; no client-supplied balance or reward amount is accepted. Any raised error rolls back that operation, including its ledger writes. Database owners remain trusted and can administer the data directly.

Run the real SQL in a disposable local database with the existing external PGlite installation:

```sh
node integrations/stillness-account/backend/run-progression-tests.mjs /tmp/halfsword-account-dbtest
```

For dependency installation, use the pinned PGlite command in [README.md](README.md). On 2026-10-11 the growth runner passed **54 assertions and 38 expected rejection checks**, and verified fixture rollback. Checks cover read isolation, forbidden direct writes/private helpers, server rules, failed purchase rollback, successful and conflicting replays, replay of a completed ticket after the next round begins, wrong owner/app, losses, abandoned/expired/too-fast rounds, milestones, purchases, equip/unequip, points, strength cap and Auth deletion. Fixture-only clock helpers and accounts are rolled back. An independent SQL review found no actionable isolation or transaction defect.

PGlite uses one session. Hosted anonymous Auth/email linking, PostgREST token enforcement, real persistence across devices and simultaneous connections were **not exercised**. Before enabling a hosted trial, use two real signed-in sessions to verify identity boundaries and concurrent duplicate finish, duplicate request, competing spend/allocation and begin/finish races. The expected result is one reward for the same ticket, one application of the same UUID, no overspending, and a single active round. Choose production reward rules separately before enabling any production economy.
