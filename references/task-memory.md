# Task And Memory Tracking

Use project-local Markdown so Codex, Claude Code, Cursor, GitHub Copilot, and
other agents can resume the workflow without depending on proprietary memory.
Also mirror status to native task or memory features when the active client has
them.

## Task File

Create `.agents/tasks/build-gesture-animation.md` as soon as the project output
directory is known. Start with the stages that apply to the request:

```markdown
# Build Gesture Animation Tasks

- [ ] Confirm or generate the source video
- [ ] Check Python, FFmpeg, ffprobe, and WebP support
- [ ] Inspect source duration, dimensions, rotation, and frame count
- [ ] Confirm artworks, frame counts, controls, and inversion
- [ ] Extract and verify WebP frames
- [ ] Write configuration and scaffold the site
- [ ] Run project validation and resolve every failure
- [ ] Verify desktop and mobile behavior locally
- [ ] Record final evidence and delivery details
```

Remove inapplicable tasks rather than marking work complete without doing it.
Add one line of evidence beneath a task when a gate passes, including the output
path or concise measured result. Mark a task blocked only with a concrete reason
and the exact input needed to continue.

## Memory File

Create `.agents/memory/build-gesture-animation.md` with these sections:

```markdown
# Build Gesture Animation Memory

## Project Facts
- Output directory:
- Source videos:
- Artworks:
- Controls:

## Decisions
- YYYY-MM-DD: Decision and reason.

## Validation Snapshot
- Environment:
- Media:
- Configuration:
- Desktop:
- Mobile:

## Warnings And Open Issues
- None.

## Last Handoff
- YYYY-MM-DD: Current state and exact next action.
```

Record stable facts and decisions, not conversational narration. Replace stale
validation snapshots rather than appending repeated logs. Preserve earlier
decisions when they explain the current configuration.

## Update Rules

Update task status and memory immediately after each gate:

1. Environment check: record missing dependencies or versions.
2. Source inspection: record decoded properties and suitability issues.
3. Media extraction: record actual frame count, dimensions, and total bytes.
4. Scaffold: record configuration path and enabled controls.
5. Validation: record pass/fail and unresolved errors.
6. Browser verification: record tested viewports and interaction limitations.
7. Delivery: record local URL, output directory, warnings, and next action.

Do not store credentials, access tokens, raw webcam frames, facial or hand
landmarks, personal biometric data, full command output, source media, or frame
files in task or memory documents.
