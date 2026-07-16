---
name: build-gesture-animation
description: >-
  Turn an existing or planned transformation video into a local, static,
  gesture-controlled frame animation website. Use when the user wants to
  prepare a video prompt, extract evenly spaced WebP frames, bind Palm, Pinch,
  Span, or Mouth controls, build a responsive multi-artwork site, validate the
  media and configuration, or install this workflow for Codex, Claude Code,
  Cursor, or GitHub Copilot.
---

# Build Gesture Animation

Build and verify a gesture-controlled animation website through a closed-loop
workflow: establish a valid input, transform it, measure the output, and fix or
rerun the failing stage until every delivery check passes.

## Step 0: Create Tasks And Memory

Before running commands, create one task for each active workflow stage and keep
only one implementation task in progress at a time. Use the client's native task
and memory tools when available. Always maintain portable project records too:

- `.agents/tasks/build-gesture-animation.md` for task status and gate evidence;
- `.agents/memory/build-gesture-animation.md` for durable facts, decisions,
  validation results, warnings, and unresolved issues.

Update both records after every completed or failed gate, not only at final
delivery. Never store credentials, camera images, user biometrics, large command
logs, or generated media in memory. Read
[task-memory.md](references/task-memory.md) for the required format.

If no project directory exists yet, begin with the client-native task list and
create the portable files immediately after the output path is chosen.

## Step 1: Check The Environment

Run:

```bash
python3 scripts/check_environment.py
```

Require Python 3.9+, FFmpeg, ffprobe, and FFmpeg WebP encoding. Do not install
missing system dependencies without the user's permission. Give the platform-
appropriate command printed by the script and wait when FFmpeg is unavailable.

## Step 2: Establish The Source

Ask whether the user already has a video or needs to generate one.

- For an existing video, confirm its path and inspect it before changing files.
  Use `ffprobe` or `prepare_media.py --inspect-only` to report duration,
  dimensions, rotation, and decoded frame count.
- For a video that does not exist yet, determine whether the current agent can
  generate video. If not, state that limitation plainly and prepare an English
  prompt, negative prompt, and explanation in the user's language. Read
  [video-prompting.md](references/video-prompting.md). Wait for the finished
  video before continuing.

Do not silently replace, delete, or modify the source video.

## Step 3: Define The Project

Collect only decisions that cannot be inferred safely:

1. Site title and subtitle.
2. Artwork ID and label for each source video.
3. Frame count, defaulting to 60 and constrained to 24-120.
4. Any combination of Palm, Pinch, Span, and Mouth controls.
5. `invert` for controls whose direction should be reversed.

Use Swipe only for cyclic artwork navigation. Do not add it as a primary
control tab. Read [gesture-controls.md](references/gesture-controls.md) for the
control semantics and calibration invariant.

## Step 4: Prepare Media

Create the destination project before extracting frames, then process each
source into `frames/<artwork-id>`:

```bash
python3 scripts/prepare_media.py \
  --input /absolute/path/source.mp4 \
  --output /absolute/path/project/frames/artwork-id \
  --frames 60
```

The script selects decoded source frame numbers uniformly, always includes the
first and last frame, center-crops to exact 4:3, limits output to 1280x960
without upscaling, and writes directly to numbered WebP files. If the source
contains fewer frames than requested, accept the smaller real frame count and
use it in project configuration. Never manufacture duplicate frames.

Read [media-pipeline.md](references/media-pipeline.md) before changing encoding
defaults or handling rotation and low-resolution inputs.

## Step 5: Scaffold The Site

Write one `project.config.json` with the exact output frame counts, then run:

```bash
python3 scripts/scaffold_site.py \
  --output /absolute/path/project \
  --config /absolute/path/project.config.json \
  --preserve-frames
```

The generated site is static HTML, CSS, and JavaScript. It reads title,
subtitle, artworks, tabs, instructions, inversion, and navigation from the
configuration. Keep MediaPipe thresholds and runtime performance settings in
the template rather than exposing them to ordinary users.

## Step 6: Validate And Close The Loop

Run validation after every media or configuration change:

```bash
python3 scripts/validate_project.py /absolute/path/project
```

Treat validation as a gate. Fix the reported stage and rerun until all checks
pass. Validation must confirm:

- valid configuration and allowed control types;
- safe, unique artwork IDs and usable frame paths;
- exact continuous numbering from `1.webp`;
- configuration counts matching actual files;
- decodable WebP frames with exact 4:3 dimensions;
- required template files and CDN model references.

Do not claim completion while validation fails.

## Step 7: Serve And Verify Visually

Start a localhost server so camera permission runs in a secure browser context:

```bash
python3 scripts/serve_site.py /absolute/path/project
```

Open the printed URL and verify desktop and mobile layouts. Confirm the main
visual remains 4:3, the desktop camera stays in the control column, the mobile
camera is draggable and above all content, tracking loss holds the last frame,
and artwork navigation loops when enabled.

Report the local URL, project directory, frame counts, total media size, and
any validation warnings. Finish by reconciling the native task list with the
portable task record and writing the final validation snapshot to memory.

## Installation

Use `scripts/install_skill.py` for Codex, Claude Code, Cursor, GitHub Copilot,
or a project-local `.agents/skills` installation. Read
[client-installation.md](references/client-installation.md) before installing
or replacing an existing copy.

## Boundaries

- Generate prompts, not video, when no video-generation capability is present.
- Do not deploy to Vercel or any external host.
- Do not add custom landmark formulas or pose models in this version.
- Do not embed user media, credentials, or absolute local paths in this Skill.
- Stop for user input when the source is missing, a destructive replacement is
  required, or validation exposes an ambiguous media problem.
