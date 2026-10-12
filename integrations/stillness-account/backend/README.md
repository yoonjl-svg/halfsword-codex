# Private account saves (Supabase)

This backend stores one private display name and settings object per `(app_id, user_id)`. Supabase Auth supplies the identity. First-time players can receive an anonymous Auth session automatically, without a signup screen. They may attach an email later for recovery. An anonymous Auth user has the `authenticated` database role and a real `auth.uid()`; the unauthenticated `anon` database role cannot read or write these saves.

An unlinked guest is recoverable only while its local session credentials remain available. Clearing browser storage, signing out, losing the device, or using another browser can lose access. Linking and confirming email on the existing user preserves its user ID and save. Signing in to an existing email account is an account switch; it does not merge the guest's save automatically.

The optional [growth backend](PROGRESSION.md) also stores wins, coins, points, inventory, an equipped cosmetic badge and player strength. Apply its separate `progression.sql` migration to enable only `halfsword-codex-growth-trial`. Trial rules are 10 coins per win, one point per three lifetime wins, strength +2% per level up to five levels, and a 30-coin cosmetic `wayfarer_seal`. Production economies remain disabled. Outcomes are client-reported; server tickets, timing checks and idempotent transactions do not verify that combat was won legitimately.

The game enables this optional trial only with `?account=1&growth=1`, each parameter exactly once and without other query parameters. With empty public configuration it is a device-only practice mode. Our optional trial now uses hosted Supabase; email delivery/recovery is still unverified. The transferable ZIP keeps its configuration empty. Practice balances and items cannot be imported into a server account. The owner-facing setup page is [`public/growth-setup.html`](../../../public/growth-setup.html) in this repository, or `public/growth-setup.html` in the handoff ZIP. Its combined `account-growth-setup.sql` is for a fresh project only; projects with the existing account schema should apply just the growth migration. A completed local SQL test does not mean the hosted server exists or account recovery works.

## Project setup

1. Create a Supabase project under the owner's account. This integration does not create one or supply credentials.
2. In Authentication, enable anonymous sign-ins, manual identity linking, and the Email provider. Allow email confirmation/OTP delivery. Configure the project's Site URL and allowed redirect URLs for the actual deployed app and intended local development origins. For code entry, make the relevant email templates display `{{ .Token }}`; guest email attachment uses the email-change confirmation flow, while returning email users use sign-in OTP. Check both templates and flows. Configure a production mail sender before relying on public delivery; the default sender and Auth rate limits can restrict recipients or delivery.
3. Run [schema.sql](schema.sql) once in the project's SQL editor as the trusted migration owner. It uses `public.player_profiles`, `public.player_settings_valid`, `public.save_player_profile`, and `public.delete_player_profile`. Existing names cause a rollback instead of silently replacing another schema. The migration owner must remain a trusted role: the write RPCs deliberately run as that owner, with an empty `search_path` and explicit caller identity checks.
   For the growth trial, additionally apply [progression.sql](progression.sql), or use the setup page's combined SQL once in a fresh project instead of running both paths. Keep the six growth RPC signatures and separate trial app ID in [PROGRESSION.md](PROGRESSION.md) when wiring the adapter.
4. Configure the app with its project URL, public publishable key (or legacy `anon` key), and a stable app ID such as `halfsword-codex`. Use a different app ID for each fork. Never put a `service_role` key, database password, or secret API key in the browser, source, saved setup instructions, or service-worker cache. The public key alone does not authorize saves; a valid user's bearer token is also required.
5. Run [test.sql](test.sql) in a disposable project's SQL editor. It inserts two Auth user fixtures, changes the local database role to exercise RLS, then rolls back all fixtures. It requires the trusted migration owner and fails on the first incorrect behavior. If execution is interrupted, roll back the open transaction before continuing. It is not a production account-creation workflow.
6. Complete the live checks below before enabling account storage publicly. Monitor anonymous signup rate limits and project usage. If CAPTCHA is enabled, the client needs the corresponding challenge/token flow; enabling it without client support blocks automatic guest creation.

For `psql`, use an already configured, securely stored connection and `-v ON_ERROR_STOP=1 -f schema.sql`, then `-v ON_ERROR_STOP=1 -f test.sql` in the disposable project. Do not paste a database password into commands or chat. Ordinary PostgreSQL can exercise the SQL with a small `auth.users`/`auth.uid()`/role fixture, but that does not validate the hosted Auth, email, or HTTP API.

## Client contract

Read `public.player_profiles` filtered by `app_id`. RLS makes another user's rows invisible even if the request omits or forges a `user_id` filter. App IDs separate save namespaces; they are not access-control boundaries between apps for the same user. Browser credential storage should also use an app-specific key when several forks share an origin. Same-origin apps still share the browser's security boundary.

Call `save_player_profile(p_app_id text, p_expected_revision bigint, p_display_name text, p_settings jsonb)`. It returns a JSON object:

```json
{
  "app_id": "halfsword-codex",
  "user_id": "<authenticated user UUID>",
  "display_name": "Player",
  "settings": { "sound": true, "moveMode": "stick" },
  "schema_version": 1,
  "revision": 1,
  "updated_at": "<server timestamp>"
}
```

Use expected revision `0` only when creating an absent row. Updates require the current server revision and advance it by one atomically. PostgreSQL protects this comparison when requests arrive concurrently. Revisions are bounded to JavaScript's safe integer range. The client must retain its unsaved edits on failure. A `PT409` response maps to HTTP 409: fetch the current save, show the conflict, and let the user decide; do not blindly retry with the newer revision. `PT400` means invalid input, and `PT401` means no authenticated identity reached the RPC. Session failures may also be rejected by Auth/PostgREST before the RPC.

Names must be 1–24 Unicode code points, without leading/trailing ASCII spaces or control characters. The client should trim before sending and render names as text. Settings can be a subset, including `{}`; the game merges missing keys with its current defaults. Unknown keys, JSON nulls, wrong types, and objects larger than 2,048 serialized bytes are rejected.

| Key | Allowed JSON values |
| --- | --- |
| `difficulty` | `"easy"`, `"normal"`, `"hard"` |
| `moveMode` | `"stick"`, `"tilt"` |
| `skill` | `"0"`, `"0.4"`, `"0.7"`, `"1"` (strings) |
| `pixel`, `blood`, `sound`, `invertTilt`, `guardNames`, `trail`, `fpsCap` | `true`, `false` |

The whitelist matches this repository's `src/main.js` defaults and `index.html` setting controls. Extend the validator and its tests deliberately when the game adds settings. The client cannot choose the user ID, schema version, revision increment, or update time. Direct table INSERT/UPDATE/DELETE/TRUNCATE and unauthenticated access are revoked; authenticated table access is SELECT only.

Call `delete_player_profile(p_app_id text)` to delete the current user's save for that app. It returns whether a row existed, and repeating it is safe. This does **not** delete the Auth account, its session, or another app's save. Account removal needs a separate trusted server/admin operation; deleting an Auth user cascades their saves. Deletion is intentional and does not perform a revision comparison. Stop pending autosaves before deleting, coordinate open tabs, and discard cached revisions afterwards; a save recreated after deletion starts again at revision 1.

## Manual live checks

- Open a fresh browser profile online. Automatic anonymous sign-in produces one user and an own-only save. Reload and reconnect after an offline period: the same credentials load that save, without creating another user. Confirm unauthenticated REST reads and RPC calls fail.
- In a separate browser profile create guest B. B cannot read A's row, overwrite it using A's revision, or delete it. B can save under the same app ID into its own row. Under A, another app ID creates an independent row.
- Open two tabs using A. Load the same revision in both; save different settings in tab 1, then save in tab 2. The second write must return 409 and preserve tab 1's data and tab 2's local edits. Repeat with two simultaneous create requests: exactly one creates revision 1.
- Link an email to A, enter the delivered email-change OTP, and confirm the user ID and settings remain the same. On another device sign in with the email OTP and load the same save. Exercise wrong/expired codes, delivery limits, and an email already linked to another account. This project does not provide an automatic guest-to-existing-account merge.
- Try malformed settings and an invalid name through the RPC, and direct table writes through the REST API. They must fail. Inspect timestamps and revisions after a valid save; they must come from the server.
- Delete A's save after stopping queued saves. A's Auth account and B's save must remain; reloading shows no saved row. Separately verify trusted account deletion cascades all that user's app saves in the disposable project.

SQL tests cover database permissions, owner isolation, revision conflicts, validation, and deletion. They do not cover real email delivery, token refresh, browser session/cache behavior, two-connection concurrency, or the hosted gateway. No live Supabase project has been provisioned or verified by this backend package alone.

For an isolated local SQL check without changing project dependencies:

```sh
npm --cache /tmp/halfsword-account-npm-cache --prefix /tmp/halfsword-account-dbtest install --no-audit --no-fund --save-exact @electric-sql/pglite@0.5.8
node integrations/stillness-account/backend/run-tests.mjs /tmp/halfsword-account-dbtest
node integrations/stillness-account/backend/run-progression-tests.mjs /tmp/halfsword-account-dbtest
```

The runner creates an in-memory PostgreSQL database with a minimal Auth UID/role fixture, applies the real schema, and executes the real SQL tests. It reports executed assertions and expected rejection checks; this fixture does not reproduce Supabase Auth internals or its HTTP gateway.

Local validation on 2026-10-11 with PGlite 0.5.8 passed 23 assertions and 28 expected rejection checks, and confirmed that fixture data rolled back.
