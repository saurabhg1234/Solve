# Demo walkthrough production

Produce a runnable domain demo before recording it. Use supplied proposal scope and verified brand assets. Match actual values and behavior; preserve explicit synthetic-data and simulated-integration labels. A demo is not a production app or formal workflow acceptance.

For each requested film:

1. Keep a private storyboard with a business narrative, exact scene durations, interaction schedule and narration. Reuse the pursuit's evidence and brand sources. Choose a clear generic voice unless the user supplies a preference.
2. Test happy paths and domain failures before recording: permissions, exceptions, approval invalidation, duplicate/retry handling and responsive layout.
3. Capture real browser interactions using Playwright/Chromium. Record at a documented viewport; animate cursor/callouts, transitions and the opening/closing. Keep actual source values visible. Use a production build with development controls absent.
4. Render narration locally when API use is disallowed. Retain model/voice licences, pinned versions and checksum provenance privately. A generic supplied voice is acceptable; never imply a named person narrated or clone a voice without authorization.
5. Align caption timing to the spoken sentences, reserve safe margins, and avoid callouts over evidence. Produce a standard H.264/AAC MP4 with fast-start metadata. Normalize voice and prevent clipping; keep any music below speech and use only licensed/original audio.
6. Verify duration, dimensions, audio presence/peaks, caption timing and full decode. Inspect scenes and transitions at relevant timestamps. Run a speech-transcription cross-check where available; it complements, and does not establish, subjective audio quality.
7. Deliver the actual movie, not just a script/storyboard. Retain exact file hashes. Check hosted app access, email recipients, visible owner copy and the saved Sent Items attachment bytes. Distinguish verified sending from recipient acceptance.

Private environment prerequisites currently include `/usr/bin/chromium`, FFmpeg/FFprobe and Playwright at `/opt/codex/cua_node/lib/node_modules/playwright`. Python lives in `/workspace/solve-environment/.venv`; `requirements.txt` pins the added media packages. The model files and generated client recordings must not be committed. Existing document tooling and service secrets stay unchanged.

Run `python scripts/media/check_video.py /private/path/walkthrough.mp4 --duration 120` to check dimensions, H.264/AAC streams, the full decode, duration and audible/unclipped levels. Save its JSON privately alongside the visual review and exact delivery hash. This does not claim human acceptance.

For Playwright recording, its separate FFmpeg helper must also be installed: `node /opt/codex/cua_node/lib/node_modules/playwright/cli.js install ffmpeg`. The system FFmpeg binary handles the final edit/encode.
