# PWA lifecycle checks

These checks use an existing Node.js installation, Playwright package and Chromium executable. They do not install dependencies. First integrate the overlay and run the receiving game's `npm run build` so its `dist` includes `sw.js` and `pwa-build.json`.

From this handoff package's directory, set the paths for your machine and run:

```sh
export PWA_TEST_ROOT="$(mktemp -d /tmp/stillness-pwa-test.XXXXXX)"
export PLAYWRIGHT_MODULE="/absolute/path/to/node_modules/playwright/index.mjs"
export CHROME_PATH="/absolute/path/to/chromium"
export PWA_TEST_PORT=4255

node tests/prepare.mjs /absolute/path/to/halfsword/dist
node tests/server.mjs &
pwa_test_server_pid=$!
trap 'kill "$pwa_test_server_pid" 2>/dev/null || true' EXIT
node tests/lifecycle.mjs
```

The lifecycle runner allows up to five seconds for the fixture server to start. If the selected port is already occupied, use another `PWA_TEST_PORT` for both server and test. A loopback address lets Chromium use service workers without a local TLS certificate. The server exposes the fixtures only at `http://127.0.0.1:$PWA_TEST_PORT/halfsword/`.

`PWA_TEST_ROOT` must be empty when preparing fixtures and must be outside the original dist directory. Preparation copies the complete dist into `v1`, `v2` and `v3`. It adds only an HTML release marker to v2/v3, then rebuilds their generated service worker and build inventory. The original dist is read only. By default preparation uses the builder shipped in `overlay/tools/pwa/build.mjs`; to select another copy, pass its path as the second argument or set `PWA_BUILD_SCRIPT`:

```sh
node tests/prepare.mjs /absolute/path/to/halfsword/dist /absolute/path/to/halfsword/tools/pwa/build.mjs
```

Each lifecycle run creates a fresh persistent Chromium profile under `PWA_TEST_ROOT`, so a prior run cannot supply a service worker or cached game. The test writes `lifecycle-report.json` and menu screenshots there, or `failure.png` on a browser-test failure. Its exit status is nonzero if an assertion fails. The profile, fixtures and reports are disposable; retain them when diagnosing failures.

The harness preserves the checks for first-install activation without takeover, manifest scope and Chromium installability, landscape menu fit, real emulated touch input, an update waiting through combat and a second open tab, unchanged game settings, cache isolation, a new offline launch and audio asset response, offline combat and restart, whole-update rejection after a corrupted file, and verified online recovery when cache reads are denied. It intentionally seeds game settings and test caches inside its isolated browser profile.

The browser runs headless with a mobile touch viewport and software graphics. Its `--no-sandbox` flag accommodates disposable container environments; run the harness only against your trusted local fixture. These checks do not automate real iPhone “Add to Home Screen” or Android OS installation. Test those manually on the target devices.
