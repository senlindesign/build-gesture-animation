# Gesture Controls

## Main Controls

| Type | Signal | Default instruction |
|---|---|---|
| `palm` | Finger extension relative to palm size | Open and close your palm. |
| `pinch` | Thumb-to-index distance relative to hand size | Pinch and release your fingers. |
| `span` | Distance between two hand centers | Move your hands together or apart. |
| `mouth` | Lip separation relative to face size | Open and close your mouth. |

Any subset may be configured. Keep configured order in the tab bar. Use
`invert: true` when the natural signal direction should map to the opposite end
of the animation.

## Calibration Invariant

The first detected pose is a baseline, not an absolute frame. Apply filtered
signal deltas to the existing absolute target progress:

```text
initial pose -> baseline
new signal - previous signal -> deadzone -> progress delta -> absolute target
```

This prevents a partly open hand from jumping directly to a middle frame. On
short tracking loss, retain the last baseline. On full loss, freeze the last
displayed frame and clear input memory. On reacquisition, establish a new
baseline while preserving the frame.

Use light low-pass filtering and a small deadzone to reduce jitter. Render the
new target directly; do not introduce an artificial frame-chasing delay.

## Navigation

Vertical hand swipe changes the active artwork and loops when configured. It
does not appear as a control tab. Buttons, pointer dragging, keyboard arrows,
and vertical wheel input provide equivalent artwork navigation.
