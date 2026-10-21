# Real-session fixtures

Each `*.json` here is a landmark recording made with the camera page's **⏺ rec** control on a real phone
(MediaPipe Pose on a real person). `replay.real.test.js` replays every fixture that has a sibling
`<name>.expected.json` through the same counters the phone uses and checks the result against what the
person actually did.

How to add one (owner, ~10 minutes):

1. Start the TV app paired to the production relay, open a program, scan the QR with your phone.
2. On the phone page tap **⏺ rec**, do the set (for example 8 squats at a steady pace, full depth), tap **⏹ stop**.
   The phone downloads `formcast-session-<time>.json`.
3. Copy it here as, for example, `squats-mo-2026-10-22.json` and run
   `node ../replay.js squats-mo-2026-10-22.json` to see what the counters made of it.
4. Write `squats-mo-2026-10-22.expected.json` with what you really did, for example
   `{"segments":[{"exercise":"squat","reps":8,"reps_tolerance":1,"min_avg_form":40}]}`.
   Do not tune `expected` to the output: it records the ground truth; if the counter disagrees, that is a bug
   to fix in `counters.js`, or a limitation to document.
5. `npm test` now includes the fixture.

No fixture is committed until a real recording exists. Synthetic data must never be placed here.
