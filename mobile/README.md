# Fitresh Android app (Capacitor shell)

A thin native shell that loads https://fitresh.com in a WebView. All app code stays in `public/` and `api/`;
deploying the site updates the app. Offline support (service worker, local data, outbox) is the website's own
(see `docs/handoff.md`), so it works the same inside the app. Open the app online once to let it cache itself.

## Build a sideloadable APK (needs Android Studio: SDK + JDK)
```
cd mobile
npm install
npx cap sync android
cd android
gradlew.bat assembleDebug            # Windows; ./gradlew on macOS/Linux
```
The APK is `mobile/android/app/build/outputs/apk/debug/app-debug.apk`. Copy it to the phone and open it
(allow "install unknown apps" for your file manager/browser). Or open `mobile/android` in Android Studio and press Run.

## Change the icon
Edit/replace `public/icon-512.png` (or pass a better source) and run `python tools/make_icons.py`, then
`cd mobile && npm run icons && npm run sync`. Source images live in `/resources`.

## Things to test on a real phone
Session survives closing/reopening the app; back button behaviour; airplane-mode launch after one online open;
"Copy prompt" in AI Assist (clipboard); logging a meal offline then reconnecting.
