# The Gem — Android APK & Release Build Checklist

Use this checklist before generating a new Android APK or EAS build so no icon, naming, native plugin, or environment settings are left out.

## 1. App Identity & Adaptive Icon
- [x] **App Name:** `"name": "The Gem"` in [frontend/app.json](frontend/app.json) and `<string name="app_name">The Gem</string>` in [frontend/android/app/src/main/res/values/strings.xml](frontend/android/app/src/main/res/values/strings.xml).
- [x] **Adaptive Icon Safe Zone:** `frontend/assets/android-icon-foreground.png` must keep the logo centered within ~56–60% of a square canvas (`1024x1024`) so Android's circular/squircle launcher mask does not clip the edges.
- [ ] **Regenerate Android Native Resources:** Run `npx expo prebuild --platform android --clean` inside `frontend/` whenever `app.json`, `assets/*icon*`, or `plugins/*` change so `mipmap-*/ic_launcher_foreground.webp`, `strings.xml`, `AndroidManifest.xml`, and Kotlin modules are synced.

## 2. Native Android Config Plugins
Ensure both plugins are listed in `frontend/app.json` under `expo.plugins`:
1. `./plugins/withMpesaSmsListener` — `RECEIVE_SMS` & `READ_SMS` + `MpesaSmsModule.kt` for incoming M-Pesa/Pochi la Biashara auto-fill.
2. `./plugins/withSimSmsGateway` — `SEND_SMS` + `SmsGatewayModule.kt` (`SmsManager` single/multipart dispatch) for Master's SIM SMS Gateway.
3. `expo-splash-screen` — Configured with light (`#F0FDFA`) and dark (`#1D575D`) backgrounds matching the app theme.

## 3. Theme & Animated Startup Splash
- `userInterfaceStyle` in `frontend/app.json` is set to `"automatic"` so `Appearance.getColorScheme()` reflects the phone's system Dark/Light mode on launch.
- [frontend/src/store/useAppStore.ts](frontend/src/store/useAppStore.ts) defaults `isDarkMode` to the system theme and listens for OS theme changes unless the user manually toggles the theme button.
- [frontend/src/components/StartupSplashGate.tsx](frontend/src/components/StartupSplashGate.tsx) animates the faceted logo on `#F0FDFA` (light) or `#1D575D` (dark) while polling `GET /health` to wake the Render backend.

## 4. Environment Variables (`frontend/.env.local` / EAS Secrets)
- **Production / Render APK:**
  - `EXPO_PUBLIC_API_URL=https://the-gem.onrender.com`
  - `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...`
- **Local Emulator / LAN Testing:**
  - `EXPO_PUBLIC_API_URL=http://localhost:3001` (with `adb reverse tcp:3001 tcp:3001`) or `http://<LAN_IP>:3001`

## 5. Build & Verify Commands
```bash
# 1. Typecheck server & frontend
cd server && npm run typecheck
cd ../frontend && npx tsc --noEmit

# 2. Sync native Android project (icons, splash, SMS plugins)
npx expo prebuild --platform android --clean

# 3. Build Release APK locally (or use `npx eas-cli build -p android --profile preview`)
cd android && ./gradlew assembleRelease
```

### Post-Install Verification on Device / Emulator
1. Verify launcher icon displays **The Gem** with the logo centered inside the icon frame.
2. Test cold start in both System Light Mode (`#F0FDFA`) and System Dark Mode (`#1D575D`).
3. Log in as Master, enable **SIM SMS Gateway**, grant `SEND_SMS`, and test `POST /sms-gateway/send` → verify `GET /sms-gateway/status` shows `sent` incremented.
