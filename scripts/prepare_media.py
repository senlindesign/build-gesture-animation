#!/usr/bin/env python3
"""Inspect a video and extract uniformly selected, cropped WebP frames."""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path


def fail(message: str) -> "None":
    raise SystemExit(f"ERROR: {message}")


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        fail(f"{name} is required. Run check_environment.py for installation guidance.")
    return path


def run(command: list[str], *, capture: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, capture_output=capture, text=True, check=False)
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "command failed").strip()
        fail(f"Command failed: {' '.join(command[:3])}\n{detail}")
    return result


def parse_rotation(stream: dict[str, object]) -> int:
    candidates: list[object] = []
    tags = stream.get("tags")
    if isinstance(tags, dict):
        candidates.append(tags.get("rotate"))
    side_data = stream.get("side_data_list")
    if isinstance(side_data, list):
        for item in side_data:
            if isinstance(item, dict):
                candidates.append(item.get("rotation"))
    for value in candidates:
        try:
            return int(round(float(str(value)))) % 360
        except (TypeError, ValueError):
            continue
    return 0


def inspect_video(path: Path) -> dict[str, object]:
    ffprobe = require_binary("ffprobe")
    command = [
        ffprobe,
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,avg_frame_rate,r_frame_rate,nb_frames,nb_read_frames,duration:stream_tags=rotate:stream_side_data=rotation:format=duration",
        "-of",
        "json",
        str(path),
    ]
    data = json.loads(run(command).stdout)
    streams = data.get("streams", [])
    if not streams:
        fail("The input contains no decodable video stream.")
    stream = streams[0]
    width = int(stream.get("width") or 0)
    height = int(stream.get("height") or 0)
    rotation = parse_rotation(stream)
    if rotation in {90, 270}:
        display_width, display_height = height, width
    else:
        display_width, display_height = width, height

    frame_count = 0
    for key in ("nb_read_frames", "nb_frames"):
        value = stream.get(key)
        if value not in (None, "N/A"):
            try:
                frame_count = int(value)
                break
            except (TypeError, ValueError):
                pass
    if frame_count <= 0:
        packet_data = json.loads(
            run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-count_packets",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=nb_read_packets",
                    "-of",
                    "json",
                    str(path),
                ]
            ).stdout
        )
        packet_streams = packet_data.get("streams", [])
        if packet_streams:
            frame_count = int(packet_streams[0].get("nb_read_packets") or 0)
    if frame_count <= 0:
        fail("Could not determine the decoded source frame count.")

    format_data = data.get("format", {})
    duration_value = stream.get("duration") or format_data.get("duration") or 0
    try:
        duration = float(duration_value)
    except (TypeError, ValueError):
        duration = 0.0
    return {
        "path": str(path.resolve()),
        "width": width,
        "height": height,
        "displayWidth": display_width,
        "displayHeight": display_height,
        "rotation": rotation,
        "duration": duration,
        "frameCount": frame_count,
        "averageFrameRate": stream.get("avg_frame_rate") or stream.get("r_frame_rate"),
    }


def selected_indices(source_count: int, requested_count: int) -> list[int]:
    count = min(source_count, requested_count)
    if count <= 1:
        return [0]
    values = [round(i * (source_count - 1) / (count - 1)) for i in range(count)]
    return list(dict.fromkeys(values))


def output_geometry(width: int, height: int, max_width: int, max_height: int) -> tuple[int, int, int, int]:
    if width <= 0 or height <= 0:
        fail("Invalid video dimensions.")
    if width * 3 >= height * 4:
        crop_height = height - (height % 3)
        crop_width = crop_height * 4 // 3
    else:
        crop_width = width - (width % 4)
        crop_height = crop_width * 3 // 4
    if crop_width < 4 or crop_height < 3:
        fail("The source is too small to crop to 4:3.")
    scale = min(1.0, max_width / crop_width, max_height / crop_height)
    output_width = max(4, math.floor((crop_width * scale) / 4) * 4)
    output_height = output_width * 3 // 4
    return crop_width, crop_height, output_width, output_height


def verify_outputs(directory: Path, expected: int, width: int, height: int) -> None:
    ffprobe = require_binary("ffprobe")
    files = sorted(directory.glob("*.webp"), key=lambda item: int(item.stem))
    if len(files) != expected or [item.name for item in files] != [f"{i}.webp" for i in range(1, expected + 1)]:
        fail(f"Expected {expected} continuous WebP frames, found {len(files)}.")
    for sample in {files[0], files[len(files) // 2], files[-1]}:
        data = json.loads(
            run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-select_streams",
                    "v:0",
                    "-show_entries",
                    "stream=width,height",
                    "-of",
                    "json",
                    str(sample),
                ]
            ).stdout
        )
        streams = data.get("streams", [])
        if not streams or int(streams[0]["width"]) != width or int(streams[0]["height"]) != height:
            fail(f"Unexpected dimensions in {sample.name}.")


def atomic_publish(temp_output: Path, output: Path, force: bool) -> None:
    if output.exists() and any(output.iterdir()):
        if not force:
            fail(f"Destination is not empty: {output}. Use --force to replace it.")
        backup = output.with_name(f".{output.name}.backup-{int(time.time())}")
        output.rename(backup)
        try:
            temp_output.rename(output)
        except Exception:
            backup.rename(output)
            raise
        shutil.rmtree(backup)
    else:
        if output.exists():
            output.rmdir()
        temp_output.rename(output)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path, help="Source video")
    parser.add_argument("--output", type=Path, help="Destination frame directory")
    parser.add_argument("--frames", type=int, default=60, help="Requested frame count (24-120)")
    parser.add_argument("--max-width", type=int, default=1280)
    parser.add_argument("--max-height", type=int, default=960)
    parser.add_argument("--quality", type=int, default=84)
    parser.add_argument("--compression", type=int, default=6)
    parser.add_argument("--keep-png", action="store_true", help="Also keep PNG copies in output/png")
    parser.add_argument("--force", action="store_true", help="Replace a non-empty destination after successful extraction")
    parser.add_argument("--inspect-only", action="store_true", help="Probe and report without extracting")
    parser.add_argument("--json", action="store_true", help="Print JSON report")
    args = parser.parse_args()

    source = args.input.expanduser().resolve()
    if not source.is_file():
        fail(f"Input video does not exist: {source}")
    if not 24 <= args.frames <= 120:
        fail("--frames must be between 24 and 120.")
    if not 1 <= args.quality <= 100 or not 0 <= args.compression <= 6:
        fail("Quality must be 1-100 and compression must be 0-6.")
    require_binary("ffmpeg")
    metadata = inspect_video(source)
    if args.inspect_only:
        print(json.dumps(metadata, indent=2))
        return 0
    if args.output is None:
        fail("--output is required unless --inspect-only is used.")

    indices = selected_indices(int(metadata["frameCount"]), args.frames)
    crop_w, crop_h, out_w, out_h = output_geometry(
        int(metadata["displayWidth"]), int(metadata["displayHeight"]), args.max_width, args.max_height
    )
    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    temp_output = Path(tempfile.mkdtemp(prefix=f".{output.name}.extract-", dir=output.parent))
    ffmpeg = require_binary("ffmpeg")
    select_expression = "+".join(f"eq(n\\,{index})" for index in indices)
    filters = (
        f"select='{select_expression}',"
        f"crop={crop_w}:{crop_h}:(iw-{crop_w})/2:(ih-{crop_h})/2,"
        f"scale={out_w}:{out_h}:flags=lanczos,setpts=N/FRAME_RATE/TB"
    )
    try:
        run(
            [
                ffmpeg,
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                str(source),
                "-vf",
                filters,
                "-fps_mode",
                "vfr",
                "-start_number",
                "1",
                "-c:v",
                "libwebp",
                "-lossless",
                "0",
                "-quality",
                str(args.quality),
                "-compression_level",
                str(args.compression),
                str(temp_output / "%d.webp"),
            ]
        )
        verify_outputs(temp_output, len(indices), out_w, out_h)
        if args.keep_png:
            png_dir = temp_output / "png"
            png_dir.mkdir()
            run(
                [
                    ffmpeg,
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-start_number",
                    "1",
                    "-i",
                    str(temp_output / "%d.webp"),
                    str(png_dir / "%d.png"),
                ]
            )
        media_bytes = sum(item.stat().st_size for item in temp_output.glob("*.webp"))
        report = {
            "source": metadata,
            "requestedFrameCount": args.frames,
            "frameCount": len(indices),
            "selectedSourceFrames": indices,
            "width": out_w,
            "height": out_h,
            "format": "webp",
            "quality": args.quality,
            "compression": args.compression,
            "bytes": media_bytes,
        }
        (temp_output / "media.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        atomic_publish(temp_output, output, args.force)
    except BaseException:
        if temp_output.exists():
            shutil.rmtree(temp_output)
        raise

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"Prepared {report['frameCount']} frames at {out_w}x{out_h}")
        print(f"Output: {output}")
        print(f"Media size: {media_bytes / (1024 * 1024):.2f} MiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
