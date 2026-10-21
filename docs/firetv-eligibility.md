# Fire TV track: why an Android TV emulator demo is eligible

Collected 2026-10-21 from the official hackathon site (saved copies in the Hackathon HQ
`evidence/devpost/` folder: `rules.txt`, `details_faqs.txt`, `forum_all.txt`).

## Official rule text

Official Rules, "Project Requirements" (https://amazonappdev2026.devpost.com/rules):

> Fire TV: Any framework or language is acceptable (React Native, Android/Kotlin/Java, web
> technologies, etc.). The requirement is that the project runs on Fire OS or Vega OS. The demo video
> must show the project running on an actual Fire TV device or the Fire TV/Vega simulator.

## Official FAQ (same site, "Details & FAQs" page)

> **Question: Do I need physical hardware for my track, or can I use a simulator/emulator instead?**
> Answer: It depends on the track.
> **Fire TV: an emulator (Android TV Emulator or the Fire TV/Vega simulator) is fine — a physical
> device isn't required at any stage of submission or judging.**

## Amazon staff confirmations in the hackathon forum

1. https://amazonappdev2026.devpost.com/forum_topics/45507-is-an-android-studio-tv-emulator-android-11-matching-fire-os-8-acceptable-for-the-demo
   Question (participant, ~2026-10-12): "Is an Android Studio TV emulator (Android 11, matching Fire OS 8) acceptable for the demo?"
   Answer (Emerson Sklar, Amazon, ~2026-10-12): **"Yes"**.
2. Forum topic "about fire-tv" (participant asked whether "a demo recorded on the Vega Virtual
   Device or an emulator [is] accepted for the submission, or is a physical Fire TV required?").
   Answer (Emerson Sklar): "Yes, virtual device demo is sufficient." He also confirmed the Vega
   Virtual Device "is only supported on native mac or ubuntu".

## How FormCast complies

- FormCast is a native Android TV app (Kotlin, Compose for TV, Leanback launcher intent, D-pad
  navigation, `minSdk 28`). Fire OS 8 is Android 11 (API 30), so the app targets the Fire OS runtime
  directly; nothing in the app depends on Google Play services or Google TV.
- The demo video is recorded on the Android TV emulator (`system-images;android-34;android-tv;arm64-v8a`,
  1080p TV profile) via `adb` screen recording, which the FAQ names explicitly as acceptable.
- The FAQ answer is the official hackathon FAQ, not a forum opinion; the forum answers come from the
  Amazon staff member who runs the forum.

## Why not the Vega Virtual Device

The Vega SDK and virtual device require several GB of disk; the development machine had under 5 GB
free during the hackathon window. Since the FAQ explicitly accepts the Android TV Emulator, the Vega
path was not required for eligibility. Porting to Vega (React Native for Vega) is a natural next
step and would reuse the relay and phone camera page unchanged.
