# Media Pipeline

## Invariants

- Preserve the source video.
- Decode with FFmpeg and inspect with ffprobe.
- Select source frame numbers uniformly, including source indices 0 and N-1.
- Produce between 24 and 120 real frames. Use fewer only when the source has
  fewer decodable frames than requested.
- Never duplicate a source frame to satisfy a requested count.
- Apply display rotation before cropping.
- Center-crop to exact 4:3.
- Limit to 1280x960 and never upscale.
- Keep output dimensions even for codec compatibility.
- Write `1.webp` through `<frameCount>.webp` directly at quality 84 and WebP
  compression level 6.

## Selection Formula

For requested output count `K` and decoded source count `N`, use:

```text
source_index(i) = round(i * (N - 1) / (K - 1)), i = 0..K-1
```

Set `K = min(requested_count, N)`. Deduplicate defensively and retain increasing
order. This guarantees true endpoints without relying on timestamps or a
nominal frame rate.

## Crop And Scale

After rotation, compare `width / height` with `4 / 3`:

- wider: crop width to `floor(height * 4 / 3)` centered;
- taller: crop height to `floor(width * 3 / 4)` centered.

Then scale down only when either cropped dimension exceeds 1280x960. Preserve
4:3 and use even dimensions. Low-resolution inputs stay at their cropped native
size.

## Failure Handling

Stop without replacing a valid destination when probing, extraction, decoding,
or frame-count verification fails. Temporary output may be discarded. Require
`--force` to replace an existing non-empty destination.
