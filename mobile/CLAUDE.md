@AGENTS.md

## SDK version — read before upgrading anything

This project is deliberately pinned to **Expo SDK 54** (`expo: ^54.0.0`), not the latest SDK,
because the tester's physical device only has **Expo Go 54.0.2** installed (iPhone; the
App Store shows no update available — likely capped by that device's iOS/App Store state).
Expo Go enforces a hard SDK-version match — a newer SDK project simply fails to load on an
older Expo Go client, with no useful in-app error.

**Do not run `npx expo install expo@latest` or otherwise bump the SDK version** without
first confirming the tester's Expo Go version can actually open it. If a future package
needs a newer SDK, ask first — this has already caused one full downgrade (57 → 54) mid-project.

Primary test device is an **iPhone via Expo Go**, not Android — despite "Android-first" in
the original tech stack decision (that was about feature/polish priority, not platform
exclusivity; nothing in the code is Android-only).

Dev servers: backend `npm run dev` (port 4000), mobile `npx expo start --port 8090`
(`EXPO_PUBLIC_API_BASE_URL` in `.env` must point at this machine's current LAN IP — it
changes if DHCP reassigns it). Note: stopping these background dev processes has
repeatedly left orphaned `node.exe` processes still holding the port — if a restart hits
`EADDRINUSE`, check `Get-NetTCPConnection -LocalPort <port> -State Listen` and kill the PID
directly rather than assume the port is genuinely busy.
