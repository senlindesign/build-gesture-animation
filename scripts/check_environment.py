#!/usr/bin/env python3
"""Check the system prerequisites for build-gesture-animation."""

from __future__ import annotations

import argparse
import json
import platform
import shutil
import subprocess
import sys
from pathlib import Path


MIN_PYTHON = (3, 9)


def command_version(command: str) -> str | None:
    path = shutil.which(command)
    if not path:
        return None
    result = subprocess.run(
        [path, "-version"], capture_output=True, text=True, check=False
    )
    first_line = (result.stdout or result.stderr).splitlines()
    return first_line[0].strip() if first_line else path


def has_webp_encoder() -> bool:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        return False
    result = subprocess.run(
        [ffmpeg, "-hide_banner", "-encoders"],
        capture_output=True,
        text=True,
        check=False,
    )
    return result.returncode == 0 and "libwebp" in result.stdout


def install_guidance() -> str:
    system = platform.system()
    if system == "Darwin":
        return "Install FFmpeg with Homebrew: brew install ffmpeg"
    if system == "Windows":
        return "Install FFmpeg with winget: winget install Gyan.FFmpeg"
    return "Install FFmpeg with your package manager, for example: sudo apt install ffmpeg"


def build_report() -> dict[str, object]:
    python_ok = sys.version_info >= MIN_PYTHON
    ffmpeg_version = command_version("ffmpeg")
    ffprobe_version = command_version("ffprobe")
    webp_ok = has_webp_encoder()
    agents = {
        "codex": shutil.which("codex"),
        "claude": shutil.which("claude"),
        "cursor-agent": shutil.which("cursor-agent"),
        "copilot": shutil.which("copilot"),
    }
    required_ok = bool(python_ok and ffmpeg_version and ffprobe_version and webp_ok)
    return {
        "ok": required_ok,
        "python": {
            "ok": python_ok,
            "version": platform.python_version(),
            "minimum": ".".join(map(str, MIN_PYTHON)),
        },
        "ffmpeg": {"ok": bool(ffmpeg_version), "version": ffmpeg_version},
        "ffprobe": {"ok": bool(ffprobe_version), "version": ffprobe_version},
        "webpEncoder": {"ok": webp_ok, "name": "libwebp"},
        "optionalAgents": agents,
        "guidance": None if required_ok else install_guidance(),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print JSON output")
    args = parser.parse_args()
    report = build_report()

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        marks = {True: "OK", False: "MISSING"}
        print(f"[{marks[report['python']['ok']]}] Python {report['python']['version']}")
        print(f"[{marks[report['ffmpeg']['ok']]}] FFmpeg")
        print(f"[{marks[report['ffprobe']['ok']]}] ffprobe")
        print(f"[{marks[report['webpEncoder']['ok']]}] FFmpeg libwebp encoder")
        installed = [name for name, path in report["optionalAgents"].items() if path]
        print("[INFO] Agent CLIs: " + (", ".join(installed) if installed else "none detected"))
        if report["guidance"]:
            print(f"[ACTION] {report['guidance']}")
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
