@AGENTS.md

## SDK version — read before upgrading anything

This project is on **Expo SDK 58** (`expo: ^58.0.0`, upgraded from 54 on 2026-11-15).
The primary test device is now an **Android phone** running the Play Store build of
Expo Go, which supports SDK 58. (Earlier the project was pinned to SDK 54 because the
then-tester's iPhone could only run Expo Go 54.0.2.)
Expo Go enforces a hard SDK-version match — a project on a different SDK than the
installed Expo Go simply fails to load ("project is incompatible with this version of
Expo Go"). Before bumping the SDK again, confirm the tester's Expo Go supports it. The
Play Store Expo Go generally supports only the newest SDK; older builds are at
expo.dev/go.

Android is the primary test platform, but nothing in the code is Android-only.

Install packages with `--legacy-peer-deps` (the SDK 58 upgrade hit peer-dependency
conflicts). Don't add `eas-cli` as a project dependency (expo-doctor flags it) — use
`npx eas` instead.

Dev servers: backend `npm run dev` (port 4000), mobile `npx expo start --port 8090 --lan`.
`EXPO_PUBLIC_API_BASE_URL` in `.env` currently points at the deployed Render backend, so
no local backend is needed to see the feed. In Expo Go choose "Enter URL manually" and
use `exp://<this machine's LAN IP>:8090` (the phone must be on the same Wi-Fi; the LAN IP
changes if DHCP reassigns it). `--tunnel` needs `@expo/ngrok` installed globally. Note:
stopping these background dev processes has repeatedly left orphaned `node.exe` processes
still holding the port — if a restart hits `EADDRINUSE`, check
`Get-NetTCPConnection -LocalPort <port> -State Listen` and kill the PID directly rather
than assume the port is genuinely busy.
