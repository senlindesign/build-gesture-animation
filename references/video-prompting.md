# Video Prompting

Use this reference only when the user does not already have a suitable video.
Write the production prompt in English and explain important choices in the
user's language.

## Build The Prompt In Layers

Describe the shot in this order so the video model receives clear priorities:

1. **Shot and duration**: one locked-off continuous shot, usually 2-5 seconds.
2. **Subject**: form, scale, material, surface detail, orientation, and position.
3. **Environment**: background, floor, lighting direction, and depth cues.
4. **Start state**: a clear initial pose held briefly before movement begins.
5. **Transformation**: onset, intermediate stages, physical behavior, and pace.
6. **End state**: a readable final form held briefly before the shot ends.
7. **Rendering**: texture, lighting, depth of field, realism, and resolution.
8. **Exclusions**: subject-specific failures followed by the common negative
   constraints below.

Make material and motion language specific. For example, describe whether a
surface folds, fractures, stretches, dissolves, rotates, collides, or falls, and
state the physical behavior expected at intermediate stages. Avoid vague phrases
such as "transforms beautifully."

## Interaction-Safe Constraints

Every prompt must require:

- a fully locked camera, unchanged focal length, and no impact shake;
- one continuous transformation from a clear start state to a clear end state;
- no cuts, transitions, reframing, zooms, or unrelated secondary actions;
- the complete subject centered inside a 4:3 safe area for the entire shot;
- stable background, lighting, scale, and object orientation;
- no text, captions, watermarks, branding, or logos;
- visible, physically coherent intermediate states that remain readable when
  scrubbed in either direction;
- a brief stable hold at both endpoints for reliable first and last frames;
- controlled motion blur so extracted frames remain sharp.

The generated file may be 16:9 if the chosen platform requires it, but all
essential action must remain inside the centered 4:3 safe area because the media
pipeline will crop the sides.

## Prompt Template

```text
A [DURATION]-second cinematic, locked-off shot of [SUBJECT AND MATERIAL], alone
and fully visible at the center of the frame, viewed from [VIEWPOINT]. The full
subject and every part of the action remain inside a centered 4:3 safe area.

The environment is [BACKGROUND, FLOOR, AND LIGHTING]. The background, lighting,
subject scale, orientation, focal length, and camera position remain unchanged.

The shot begins with [START STATE], held completely still for a brief moment.
[ONSET OF ACTION]. The subject then progresses continuously through [DETAILED
INTERMEDIATE STAGES] until it reaches [END STATE]. The movement is [PACE] with
clear, distinct intermediate forms and physically accurate [MATERIAL-SPECIFIC
BEHAVIOR]. Hold the final state briefly.

[TEXTURE AND RENDERING DETAILS], high detail, sharp extracted frames, single
continuous shot, no camera movement, no cuts. [OPTIONAL SOUND DESIGN; omit when
audio is not needed.]
```

## Negative Prompt Template

Start with failures specific to the subject and material, then append:

```text
camera movement, camera shake, zoom, pan, tilt, focal-length change, reframing,
cuts, edit, transition, jump cut, duplicated subject, disappearing subject,
changing background, changing lighting, flicker, excessive motion blur, cropped
subject, off-center subject, action outside the centered 4:3 safe area, missing
intermediate states, abrupt teleporting transformation, unrelated secondary
objects, people, text, subtitle, caption, watermark, logo, brand mark
```

## Sound

Sound is optional. If requested, describe concrete material sounds, impacts, and
ambient tone separately, and explicitly exclude music or voices when appropriate.
The generated website uses image frames and does not preserve the source video's
audio track.

## Delivery Gate

Google Flow and Kling are examples, not requirements. Do not promise that a
specific platform will obey every constraint. Before frame extraction, ask the
user to inspect the finished clip for camera movement, cuts, logos, cropped
action, unstable lighting, missing intermediate states, and weak endpoint holds.
