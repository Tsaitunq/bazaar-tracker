# Bazaar Flip Helper – rules for working in this repo

## Every feature update needs a version and a changelog entry

`changelog.json` is the single source for the app version and for the "What's new" window. The newest version is the first element of `versions`.

With every user-visible feature update:

The app is not 1.0 yet, so versions are `0.minor.patch`: a feature update raises `minor` (0.6.7 → 0.7.0), a fix raises `patch`. Up to 0.6.7 the app counted 6.7.0; `migrateState` in `onboarding.js` renames a stored old number. The two four-part versions (0.5.0.1, 0.6.5.1) are the old 5.0.1 and 6.5.1; do not add new ones.

1. Add a new object at the top of `versions` with a higher `version` (`0.minor.patch`), today's `date` and 1 to 4 `entries`.
2. Each entry has a short `title` and one sentence of `text`, in plain English for players, not for developers.
3. If the entry is about something visible, add `target` (a CSS selector) and, if it is on another tab, `route` (for example `"#/opps"`), so "Show me" can point at it.
4. Do not edit or remove older versions; users who skipped updates see every version since the one they last saw.

Bug fixes without a visible change get a higher patch version only if users should be told about them.

The Android build reads `versionName` and `versionCode` from the same file, so nothing else needs to change. `versionCode` is `100000 + major * 10000 + minor * 100 + patch`; the offset keeps it above the 60700 of the old 6.7.0. `tests/onboarding.test.js` checks the file's shape and order.

## Other rules that are easy to miss

- The flip maths exists twice and must stay identical: `flips.js` (web) and `android/app/src/main/java/com/tsaitunq/bazaarflip/AlertLogic.java` (background alerts). Same constants, same test cases.
- No personal names, old account names or absolute user paths in files, commits or the APK. Git identity is `Tsaitunq`.
- Every file the app loads must be listed in `SHELL` in `sw.js`; that list also decides what goes into the APK.
- Colours live as tokens in `:root` of `style.css`. `tests/contrast.test.js` enforces WCAG AA and fails on a colour written directly into a rule.
- Tests use fixtures only. Do not call the Hypixel API from tests.
