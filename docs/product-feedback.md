# Product feedback — FormCast (Fire TV track)

## Tools, APIs and SDKs used, and for what
| Tool | Version | Used for |
|---|---|---|
| Android TV emulator (Android 14 TV, arm64) via command-line SDK | emulator 36.2.12 | demo target (Fire OS 8 = Android 11; app minSdk 28) |
| Compose for TV `androidx.tv:tv-material` / `tv-foundation` | 1.1.0 / 1.0.0 | all TV UI, focus/D-pad behaviour, cards and buttons |
| Jetpack Compose BOM, activity-compose, lifecycle-compose, DataStore | 2025.12.01 / 1.11.0 / 2.9.4 / 1.2.1 | UI runtime, ViewModel, adaptive-target persistence |
| OkHttp WebSocket, kotlinx-serialization, ZXing | 4.12.0 / 1.9.0 / 3.5.4 | relay client, messages, QR pairing |
| MediaPipe Tasks Vision `PoseLandmarker` (web) | 0.10.35 + `pose_landmarker_lite` | pose detection on the phone |
| Node `ws` | 8.18 | relay |
| Amazon Devices Builder Tools MCP, Fire TV docs | 1.0.17 | read for guidance; not wired into the agent (Fire OS support "limited", Vega SDK out of disk budget) |

## What worked well
- Compose for TV: focus handling, `Card` focus states and `Button` worked with D-pad out of the box; `FocusRequester` for initial focus was enough. No Leanback XML needed.
- The emulator accepted the standard Leanback launcher intent and `adb shell input keyevent` makes D-pad walkthroughs scriptable.
- `10.0.2.2` host alias made local relay testing trivial.
- Amazon staff confirmation that an Android TV emulator demo is acceptable removed the biggest uncertainty.

## What needs work
1. **Disk and size guidance**: the API 34 TV image unpacks to 8 GB and the emulator insists on a 6 GB data partition (and rewrites `config.ini`); neither number is documented on the Fire TV pages.
2. **A known-good dependency matrix for Fire TV + Compose**: AGP 8.13 + the newest Compose BOM fail with a cryptic "requires AGP 9.1"; Fire TV docs could pin a matrix for the current `tv-material`.
3. **Companion-phone pattern**: Fire TV has no camera and the browser security model makes a LAN-only phone camera impossible; a documented QR + relay sample (or a Fire TV API for a trusted LAN pairing) would unblock every CV fitness idea the judges asked for.
4. **Builder Tools MCP on Fire OS**: the tool is Vega-first; a Fire OS-only install path without the Vega SDK would make it usable on small machines.
5. **Voice**: third-party apps cannot use the remote's microphone for in-app speech; a simple "voice intent" hook would make true voice + D-pad + visual flows possible.

## Onboarding
Zero → APK: ~25 minutes of writing Gradle files plus 8 minutes of downloads, then 2 hours lost to the BOM/AGP mismatch and the emulator disk check. Zero → app on the emulator with D-pad: about 3 hours total.

## Would I build with these again?
**Yes.** Compose for TV is the fastest way I know to build a polished 10-foot UI, and the emulator is a faithful enough stand-in for a Fire TV Stick. The friction was all in setup, not in the platform.
