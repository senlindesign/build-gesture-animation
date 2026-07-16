#!/usr/bin/env python3
"""Validate a generated gesture animation project and its media."""

from __future__ import annotations

import argparse
import json
import shutil
import struct
import subprocess
from pathlib import Path


ALLOWED_CONTROLS = {"palm", "pinch", "span", "mouth"}
REQUIRED_FILES = ("index.html", "styles.css", "app.js", "project.config.json")


def webp_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("invalid RIFF WebP header")
    offset = 12
    while offset + 8 <= len(data):
        kind = data[offset : offset + 4]
        size = struct.unpack_from("<I", data, offset + 4)[0]
        payload = offset + 8
        if kind == b"VP8X" and size >= 10:
            width = 1 + int.from_bytes(data[payload + 4 : payload + 7], "little")
            height = 1 + int.from_bytes(data[payload + 7 : payload + 10], "little")
            return width, height
        if kind == b"VP8 " and size >= 10 and data[payload + 3 : payload + 6] == b"\x9d\x01\x2a":
            width = struct.unpack_from("<H", data, payload + 6)[0] & 0x3FFF
            height = struct.unpack_from("<H", data, payload + 8)[0] & 0x3FFF
            return width, height
        if kind == b"VP8L" and size >= 5 and data[payload] == 0x2F:
            b1, b2, b3, b4 = data[payload + 1 : payload + 5]
            width = 1 + b1 + ((b2 & 0x3F) << 8)
            height = 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0F) << 10)
            return width, height
        offset = payload + size + (size % 2)
    raise ValueError("unsupported or incomplete WebP")


def add_error(report: dict[str, object], message: str) -> None:
    report["errors"].append(message)


def safe_frame_directory(root: Path, value: str) -> Path | None:
    candidate = (root / value).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return candidate


def validate(root: Path) -> dict[str, object]:
    report: dict[str, object] = {"ok": False, "root": str(root), "errors": [], "warnings": [], "artworks": [], "totalBytes": 0}
    for filename in REQUIRED_FILES:
        if not (root / filename).is_file():
            add_error(report, f"Missing required file: {filename}")
    config_path = root / "project.config.json"
    if not config_path.is_file():
        return report
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as error:
        add_error(report, f"Invalid project.config.json: {error}")
        return report
    if not isinstance(config, dict):
        add_error(report, "Configuration root must be an object.")
        return report

    site = config.get("site")
    if not isinstance(site, dict) or not all(isinstance(site.get(key), str) and site[key].strip() for key in ("title", "subtitle")):
        add_error(report, "site.title and site.subtitle must be non-empty strings.")
    controls = config.get("controls")
    if not isinstance(controls, list) or not controls:
        add_error(report, "controls must contain at least one item.")
    else:
        seen: set[str] = set()
        for control in controls:
            if not isinstance(control, dict) or control.get("type") not in ALLOWED_CONTROLS:
                add_error(report, "Each control type must be palm, pinch, span, or mouth.")
                continue
            control_type = control["type"]
            if control_type in seen:
                add_error(report, f"Duplicate control type: {control_type}")
            seen.add(control_type)
            if not isinstance(control.get("invert"), bool):
                add_error(report, f"Control {control_type} invert must be boolean.")
            if not isinstance(control.get("instruction"), str) or not control["instruction"].strip():
                add_error(report, f"Control {control_type} needs an instruction.")
    navigation = config.get("navigation")
    if not isinstance(navigation, dict) or not isinstance(navigation.get("verticalSwipe"), bool) or not isinstance(navigation.get("loop"), bool):
        add_error(report, "navigation.verticalSwipe and navigation.loop must be booleans.")

    artworks = config.get("artworks")
    if not isinstance(artworks, list) or not artworks:
        add_error(report, "artworks must contain at least one item.")
        artworks = []
    seen_ids: set[str] = set()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        add_error(report, "FFmpeg is required for full WebP decode validation.")
    for artwork in artworks:
        if not isinstance(artwork, dict):
            add_error(report, "Artwork entries must be objects.")
            continue
        artwork_id = artwork.get("id")
        if not isinstance(artwork_id, str) or not artwork_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in artwork_id):
            add_error(report, f"Invalid artwork id: {artwork_id!r}")
            continue
        if artwork_id in seen_ids:
            add_error(report, f"Duplicate artwork id: {artwork_id}")
        seen_ids.add(artwork_id)
        label = artwork.get("label")
        if not isinstance(label, str) or not label.strip():
            add_error(report, f"Artwork {artwork_id} needs a label.")
        frame_count = artwork.get("frameCount")
        if not isinstance(frame_count, int) or not 1 <= frame_count <= 120:
            add_error(report, f"Artwork {artwork_id} frameCount must be 1-120.")
            continue
        frame_path = artwork.get("framePath")
        if not isinstance(frame_path, str):
            add_error(report, f"Artwork {artwork_id} framePath must be a string.")
            continue
        directory = safe_frame_directory(root, frame_path)
        if directory is None:
            add_error(report, f"Artwork {artwork_id} framePath leaves the project directory.")
            continue
        if not directory.is_dir():
            add_error(report, f"Artwork {artwork_id} frame directory is missing: {frame_path}")
            continue
        files = sorted(directory.glob("*.webp"), key=lambda item: int(item.stem) if item.stem.isdigit() else 10**9)
        expected_names = [f"{index}.webp" for index in range(1, frame_count + 1)]
        actual_names = [item.name for item in files]
        if actual_names != expected_names:
            add_error(report, f"Artwork {artwork_id} must contain exactly 1.webp through {frame_count}.webp.")
            continue
        dimensions: set[tuple[int, int]] = set()
        for frame in files:
            try:
                dimensions.add(webp_dimensions(frame))
            except (OSError, ValueError) as error:
                add_error(report, f"Artwork {artwork_id} has invalid {frame.name}: {error}")
                break
        if dimensions and (len(dimensions) != 1 or any(width * 3 != height * 4 for width, height in dimensions)):
            add_error(report, f"Artwork {artwork_id} frames must share one exact 4:3 size; found {sorted(dimensions)}")
        if ffmpeg and files:
            result = subprocess.run(
                [ffmpeg, "-hide_banner", "-loglevel", "error", "-framerate", "30", "-start_number", "1", "-i", str(directory / "%d.webp"), "-f", "null", "-"],
                capture_output=True,
                text=True,
                check=False,
            )
            if result.returncode != 0:
                add_error(report, f"Artwork {artwork_id} failed FFmpeg decode: {result.stderr.strip()}")
        media_bytes = sum(item.stat().st_size for item in files)
        report["totalBytes"] += media_bytes
        report["artworks"].append({"id": artwork_id, "frameCount": len(files), "dimensions": sorted(dimensions), "bytes": media_bytes})

    app_path = root / "app.js"
    if app_path.is_file():
        app_text = app_path.read_text(encoding="utf-8")
        for required in ("@mediapipe/tasks-vision", "hand_landmarker.task", "face_landmarker.task", "project.config.json"):
            if required not in app_text:
                add_error(report, f"app.js is missing required runtime reference: {required}")
    report["ok"] = not report["errors"]
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project", type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    root = args.project.expanduser().resolve()
    report = validate(root)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for error in report["errors"]:
            print(f"[ERROR] {error}")
        for warning in report["warnings"]:
            print(f"[WARN] {warning}")
        for artwork in report["artworks"]:
            dimensions = artwork["dimensions"][0] if artwork["dimensions"] else (0, 0)
            print(f"[OK] {artwork['id']}: {artwork['frameCount']} frames, {dimensions[0]}x{dimensions[1]}, {artwork['bytes'] / (1024 * 1024):.2f} MiB")
        print(f"[{'OK' if report['ok'] else 'FAILED'}] Total media: {report['totalBytes'] / (1024 * 1024):.2f} MiB")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
