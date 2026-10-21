# Real phone-camera footage: capture guide (owner) and re-cut plan

Goal: replace the synthetic-feed scenes in the demo video with a real person → phone camera → relay → TV
session, and commit the landmark recording as a reproducible test fixture. Nothing here invents results: the
counters report what they report, and the fixture's `expected.json` records what the person actually did.

## A. Capture (about 15 minutes)

Setup once:
1. Emulator window open (`emulator -avd firetv_api34 -gpu host`), TV app installed with the production relay
   (`output/FormCast-debug-production-relay.apk` in Hackathon HQ, or build with
   `-PRELAY_URL=wss://formcast.strongkit.workers.dev -PCAM_URL=https://formcast.strongkit.workers.dev/cam/`).
2. Phone on a chair or shelf about 2–3 m away, landscape or portrait, hips-to-ankles visible, decent light.
3. Phone screen recording ON (iOS: Control Centre → Screen Recording; Android: Quick Settings → Screen record),
   so the phone-side page (skeleton overlay, rep counter, form pill) is captured too.

Take (say the take name out loud so the two recordings can be aligned):
4. Start the in-guest TV recording from a terminal (it keeps real timestamps, unlike the host-side recorder):
   `adb shell screenrecord --time-limit 170 --bit-rate 8000000 /sdcard/real-take1.mp4 &`
5. Reset the app state for a clean history: `adb shell pm clear dev.gohary.formcast` then
   `adb shell am start -n dev.gohary.formcast/.MainActivity --es room REAL1` (pins the room code to REAL1).
6. On the TV: pick a profile, press ▶ on **Quick Start**. On the phone open
   `https://formcast.strongkit.workers.dev/cam/?room=REAL1`, tap **Start camera**, allow the camera, tap **⏺ rec**.
7. Stand still ~1 s (calibration), then do the sets as the TV asks: squats (full depth, steady), push-ups
   (if the camera can see shoulders/elbows/wrists from the side; otherwise press **Finish set** on the TV),
   jumping jacks. Voice cues will play from the emulator if the Mac's sound is on.
8. After the summary screen, tap **⏹ stop** on the phone (downloads `formcast-session-<time>.json`), stop the
   phone screen recording, then `adb shell pkill -INT screenrecord` and
   `adb pull /sdcard/real-take1.mp4 ~/Desktop/real-take1.mp4`.

Send: `real-take1.mp4` (TV), the phone screen recording, the JSON, and a one-line ground truth per set
("squats 8, push-ups skipped, jacks 10").

## B. Verify (automated, honest)

```bash
cp ~/Downloads/formcast-session-*.json relay/fixtures/squats-<name>-<date>.json
node relay/replay.js relay/fixtures/squats-<name>-<date>.json      # what the counters made of it
# write relay/fixtures/squats-<name>-<date>.expected.json from the ground truth, then:
npm --prefix relay test                                            # replay.real.test.js now runs on it
```
If the counted reps differ from the ground truth by more than one, that is reported as-is in the Devpost text and
the friction log; thresholds are only changed if a real cause is found, and the change is re-verified on the same
recording.

## C. Re-cut the video (about 1 hour, pipeline already exists)

Scratch pipeline (`fc-plan2.py`, `assemble.py`, `labels.js`, Piper narration) in the session scratchpad; if it is
gone, `docs/recording-guide.md` and the Hackathon HQ memory notes describe it. Changes:
- Replace the pairing/set-1/set-2/set-3 segments (plan segments 3–6) with windows from `real-take1.mp4`;
  keep home, summary and demo-mode scenes.
- Picture-in-picture: the phone screen recording in the lower-right during the live set (ffmpeg `overlay`),
  so the person, the skeleton and the TV count are in one frame.
- Narration f4 becomes: "The phone is a real camera here: MediaPipe runs on the phone, only landmarks reach the TV."
  Drop the two "synthetic" labels; keep the "Android TV emulator" label; add
  "Recorded with a real phone camera through the production relay".
- Re-run loudness normalisation, regenerate the SRT, re-check < 3:00, upload as a new YouTube video (keep the old
  one unlisted, do not delete), update the Devpost video link, gallery (add a frame with the real person) and the
  "About the demo video" paragraph, then the final eligibility audit.
