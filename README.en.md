# Build Gesture Animation · Gesture-Controlled Animation Website Skill

[![GitHub stars](https://img.shields.io/github/stars/senlindesign/build-gesture-animation?style=flat&color=111111)](https://github.com/senlindesign/build-gesture-animation/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-white.svg)](LICENSE.txt)
[![Agent Skill](https://img.shields.io/badge/Agent_Skill-compatible-111111.svg)](https://agentskills.io/)
[![Codex](https://img.shields.io/badge/OpenAI-Codex-111111.svg)](https://openai.com/codex/)
[![Claude Code](https://img.shields.io/badge/Anthropic-Claude_Code-111111.svg)](https://www.anthropic.com/claude-code)

[中文 README](README.md)

An Agent Skill for Codex, Claude Code, Cursor, and GitHub Copilot that turns a continuous transformation video into an interactive animation website controlled by a palm, pinch, two-hand span, or mouth movement.

It packages the full production process into a verifiable workflow:

```text
Video or prompt → video inspection → uniform frame selection → 4:3 WebP
→ gesture configuration → responsive website → validation → localhost preview
```

## Demo

https://github.com/user-attachments/assets/d9d79b90-3c65-4718-89aa-e9d92c6ad14f

## 30-second start

Install:

```bash
npx skills add https://github.com/senlindesign/build-gesture-animation \
  --skill build-gesture-animation
```

Then give your video and goal to the agent:

```text
Use build-gesture-animation to turn /absolute/path/transformation.mp4
into a website controlled by opening and closing my palm. Use 60 frames.
```

If you do not have a video yet, start with a production prompt:

```text
Use build-gesture-animation to write a locked-camera video prompt for a marble
statue continuously shattering from an intact form into debris. I will turn it
into a gesture-controlled animation afterward.
```

## What it does

- Inspects video paths, decoding, duration, dimensions, rotation, and real frame count
- Uniformly selects 60 source frames by default, configurable from 24 to 120
- Always includes both endpoints and never fabricates duplicates for short sources
- Center-crops to exact 4:3, up to 1280×960, without upscaling small media
- Writes directly to numbered WebP files at quality 84 and compression level 6
- Supports any combination of Palm, Pinch, Span, and Mouth with inversion
- Calibrates the first detected pose and holds the last frame when tracking is lost
- Uses Swipe only for cyclic artwork navigation, not as a primary control tab
- Supports one or many animation artworks in a looping visual stack
- Generates a responsive dark two-column site with a draggable mobile camera
- Validates numbering, dimensions, decoding, configuration, and MediaPipe references
- Creates project Tasks and Memory with decisions and gate evidence

## Four control modes

| Control | Input | Typical use |
| --- | --- | --- |
| Palm | Opening and closing one hand | Folding, unfolding, assembly, explosion |
| Pinch | Thumb-to-index distance | Fine changes, scale-like motion, local deformation |
| Span | Distance between both hands | Stretching, spreading, structural expansion |
| Mouth | Opening and closing the mouth | Hands-free and face-driven animation |

Every control supports `invert`, which determines how the body movement maps to the first and last animation frames.

## Why image sequences

Browser video seeking is affected by keyframe spacing, decoding latency, and device differences. This Skill converts the video into continuous WebP frames so the gesture value can address a specific visual state while retaining:

- directional preloading
- asynchronous image decoding and cache warmup
- progressive display of intermediate frames
- bounded Canvas resolution
- a small gesture dead zone and light signal filtering

It preserves the detail of 60 frames without adding artificial frame-following delay.

## Fits / Does not fit

**Fits:**

- origami, mechanical systems, product assembly and exploded views
- sculpture destruction, object growth, melting, or continuous transformation
- educational processes, art experiments, interactive portfolios, and exhibitions
- projects that bind one animation to multiple body inputs
- interactive collections containing several animation artworks

**Does not fit:**

- long-form video players or audio-dependent narratives
- multi-shot editing, frequent cuts, or continuously moving cameras
- real-time 3D physics simulation
- custom pose models or custom landmark formulas
- automatic Vercel or cloud deployment

## Requirements

- Python 3.9+
- FFmpeg and ffprobe
- FFmpeg `libwebp` encoder
- a modern browser with camera support
- `localhost` or HTTPS for camera permission

Check the environment:

```bash
python3 scripts/check_environment.py
```

On macOS, install FFmpeg when missing:

```bash
brew install ffmpeg
```

The Skill only detects missing system dependencies and provides guidance. It does not install them without permission.

## Install

### Option 1: Skills CLI

```bash
npx skills add https://github.com/senlindesign/build-gesture-animation \
  --skill build-gesture-animation
```

### Option 2: Paste this to an agent

```text
Install the build-gesture-animation Agent Skill from
https://github.com/senlindesign/build-gesture-animation.
Clone the repository, run scripts/install_skill.py for the current client,
and verify that SKILL.md, assets/, references/, and scripts/ exist.
```

### Option 3: Manual installation

```bash
git clone https://github.com/senlindesign/build-gesture-animation.git
cd build-gesture-animation
```

```bash
# OpenAI Codex
python3 scripts/install_skill.py --target codex

# Claude Code
python3 scripts/install_skill.py --target claude

# Cursor
python3 scripts/install_skill.py --target cursor

# GitHub Copilot
python3 scripts/install_skill.py --target copilot
```

Project-level installation:

```bash
# Generic Agent Skills path
python3 scripts/install_skill.py \
  --target agents-project \
  --project-root /absolute/path/project

# GitHub Copilot project path
python3 scripts/install_skill.py \
  --target copilot-project \
  --project-root /absolute/path/project
```

## Workflow

The agent follows these stages and updates Task and Memory after every gate:

1. **Task & Memory**: split the work and create portable project records
2. **Environment**: check Python, FFmpeg, ffprobe, and WebP encoding
3. **Source**: inspect an existing video or produce an English prompt and negative prompt
4. **Project**: confirm title, artworks, frame counts, controls, and `invert`
5. **Media**: sample, crop, encode, and verify the WebP sequence
6. **Scaffold**: write one configuration file and generate the static website
7. **Validate**: fix the failed stage and rerun until all gates pass
8. **Serve**: start localhost and inspect desktop, mobile, and camera layering

See [SKILL.md](SKILL.md) for the complete workflow.

## Configuration

Each generated project uses one `project.config.json`:

```json
{
  "site": {
    "title": "Kinetic Atlas",
    "subtitle": "Body-driven animations"
  },
  "artworks": [
    {
      "id": "earth",
      "label": "Earth",
      "framePath": "./frames/earth",
      "frameCount": 60
    }
  ],
  "controls": [
    {
      "type": "palm",
      "invert": false,
      "instruction": "Open and close your palm."
    }
  ],
  "navigation": {
    "verticalSwipe": true,
    "loop": true
  }
}
```

## Scripts

| Script | Purpose |
| --- | --- |
| `check_environment.py` | Check system dependencies and WebP support |
| `prepare_media.py` | Inspect video and output uniformly selected 4:3 WebP frames |
| `scaffold_site.py` | Copy the website template and validate configuration |
| `validate_project.py` | Validate media, configuration, decoding, and runtime references |
| `serve_site.py` | Start a localhost server suitable for camera permission |
| `install_skill.py` | Install for Codex, Claude Code, Cursor, or Copilot |

Common commands:

```bash
python3 scripts/prepare_media.py \
  --input /absolute/path/source.mp4 \
  --output /absolute/path/project/frames/artwork-id \
  --frames 60

python3 scripts/validate_project.py /absolute/path/project
python3 scripts/serve_site.py /absolute/path/project
```

## Platform support

| Platform | Status | Installation path |
| --- | --- | --- |
| OpenAI Codex | Verified | `~/.codex/skills/` |
| Claude Code | Verified | `~/.claude/skills/` |
| Cursor | Structure-compatible | `~/.cursor/skills/` or `.agents/skills/` |
| GitHub Copilot | Structure-compatible | `~/.copilot/skills/` or `.github/skills/` |

The core package follows the [open Agent Skills specification](https://agentskills.io/specification) and does not depend on client-specific prompt syntax.

## Directory

```text
build-gesture-animation/
├── SKILL.md
├── README.md
├── README.en.md
├── LICENSE.txt
├── agents/openai.yaml
├── scripts/
├── references/
└── assets/site-template/
```

The Skill contains no sample videos, user media, or generated frame sequences.

## Privacy and safety

- Hand and face landmarks are processed live in the browser
- Camera frames and biometric signals are never written to Task, Memory, or config
- MediaPipe and model files load from a CDN by default
- Source videos are never deleted or overwritten
- Replacing existing outputs or installed Skills requires explicit `--force`

## FAQ

**Why 60 frames by default?**  
Sixty frames preserve detailed intermediate states. Fast movement is handled through preloading and progressive display, not by permanently reducing the sequence to 36 frames.

**Can it generate the video itself?**  
Only when the active agent has a video-generation tool. Otherwise, the Skill creates an English prompt, negative prompt, and production guidance, then waits for a finished video.

**Can I use a 16:9 source?**  
Yes. Keep the subject and all action inside a centered 4:3 safe area because the extraction pipeline crops the sides.

**What happens when my hand leaves the camera?**  
The animation holds its last frame. Re-entry creates a new calibration baseline instead of jumping to an unrelated state.

**Does it deploy the website?**  
No. The first version generates and validates a local website only.

## License

[MIT License](LICENSE.txt)
