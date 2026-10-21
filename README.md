# FormCast — your phone is the camera, your TV is the coach

A Fire TV / Android TV fitness app with real computer-vision form coaching. Fire TVs have no camera, so FormCast turns the phone you already own into one: scan the QR code on the TV, prop the phone up, and the TV shows a live skeleton mirror, counts your reps, calls out form cues, and adapts each person's targets session by session.

Built for the **Build, Ship, Shape: Amazon Developer Hackathon 2026**, Fire TV track (priority categories: fitness, computer vision, multi-modal UX).

## How it works

```
 Phone (any browser, HTTPS)          Relay (Node, ws)            Fire TV app (Kotlin, Compose for TV)
 ┌────────────────────────┐   wss   ┌────────────────┐   wss    ┌──────────────────────────────────┐
 │ camera → MediaPipe Pose│ ──────▶ │ room "K7PX"    │ ───────▶ │ live skeleton mirror             │
 │ 33 landmarks @ ~30 fps │  pose   │ phone ⇄ tv     │  pose    │ reps / target, form cue, timer   │
 │ rep state machines     │ ◀────── │ (no video, no  │ ◀─────── │ D-pad-first UI, QR pairing       │
 │ form cues              │exercise │  storage)      │ exercise │ per-person adaptive targets      │
 └────────────────────────┘         └────────────────┘          └──────────────────────────────────┘
```

- **Video never leaves the phone.** Only 13 joint coordinates (x, y, visibility) and rep events cross the relay, ~15 messages/s, a few KB/s.
- **Why a relay**: phone browsers only allow camera access on HTTPS, and an HTTPS page may only open secure WebSockets. A TV cannot present a trusted certificate on the LAN, so both ends connect outward to a tiny relay with a 4-letter room code.
- **Rep counting** is explainable: joint-angle state machines (knee angle for squats/lunges, elbow angle for push-ups, wrist-above-nose + ankle spread for jumping jacks) with cues for depth, knee cave, and hip sag.
- **Adaptive targets**: hit the target → next time +10 %; miss badly → −10 %; stored per household member on the TV (DataStore).
- **Multi-modal**: D-pad for everything on the TV, phone camera as the sensor, visual feedback on the big screen. No touch required on the TV.
- **Demo mode** ("Try without camera") runs the same session with synthesized reps so the TV flow can be shown on an emulator or a TV without a paired phone. The video and README say which is which.

## Run it

### Fire TV / Android TV app
Requirements: Android Studio Ladybug+ or command-line SDK with platform 36 and build-tools 35, JDK 17+.

```bash
cd tv
./gradlew assembleDebug -PRELAY_URL=ws://10.0.2.2:8787 -PCAM_URL=http://10.0.2.2:8787/cam/
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n dev.gohary.formcast/.MainActivity
```
`10.0.2.2` reaches the host machine from the Android emulator. On a real Fire TV (Developer options → ADB debugging, `adb connect <tv-ip>`), pass your relay's public `wss://…` and `https://…/cam/` URLs.

Emulator used for the demo: Android TV (API 34, arm64), 1080p, created with `avdmanager create avd -n firetv_api34 -k "system-images;android-34;android-tv;arm64-v8a" -d tv_1080p` (Fire OS 8 is Android 11; the app targets minSdk 28).

### Relay + phone page
```bash
cd relay && npm install && npm start      # http://localhost:8787  (ws /tv, /phone; camera page /cam/)
npm test
```
For a phone to use its camera the page must be served over **HTTPS**: deploy the relay (Render/Fly/any Node host with TLS) or expose it with a tunnel. On a desktop browser, `http://localhost:8787/cam/?room=XXXX` works directly (localhost is a secure context), which is how the end-to-end path was tested with a laptop webcam.

## Testing
- `relay`: `npm test` (room isolation, bidirectional forwarding, rejection of bad rooms/roles).
- TV: D-pad walkthrough on the emulator (home → profile → program → pair → session → summary → back), both camera and demo modes.
- Phone page: squat/push-up/jumping-jack counting with a laptop webcam; cues verified by deliberately shallow squats.

## What is real and what is simulated
Real: the Fire OS app, D-pad navigation, QR pairing, the relay, MediaPipe pose detection and rep counting, the skeleton mirror, adaptive persistence. Simulated: nothing, except the explicitly labelled **demo mode** that synthesizes reps when no phone is paired.

## License
MIT © 2026 Mohamed Gohary
