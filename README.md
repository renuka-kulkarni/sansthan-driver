# Sansthan Driver — phone-only APK build

All app files are in one flat folder so you can upload them from an Android phone
with no computer. GitHub then builds the installable APK for you.

**Do this:** create a GitHub repo → upload all the `.js` / `.json` files here to the
repo root → add the workflow file `.github/workflows/build-apk.yml` → the Actions tab
builds `app-debug.apk` → download it from Artifacts → install on your phone.

Login for testing: **DRV001 / driver123** (assigned bus MH-01-1234).

The GPS DEBUG screen shows real phone GPS (latitude, longitude, speed, accuracy,
last update) immediately — no backend needed for the GPS test. To send locations to
your Control Room, set `API_BASE_URL` in `config.js` to your deployed server URL
(never localhost) — backend + deploy steps are in the full package
(`sansthan-live-tracking.zip`).
