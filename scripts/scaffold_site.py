#!/usr/bin/env python3
"""Copy the static site template and a validated project configuration."""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


ALLOWED_CONTROLS = {"palm", "pinch", "span", "mouth"}
TEMPLATE_FILES = ("index.html", "styles.css", "app.js")


def fail(message: str) -> "None":
    raise SystemExit(f"ERROR: {message}")


def validate_config(data: object) -> dict[str, object]:
    if not isinstance(data, dict):
        fail("Configuration must be a JSON object.")
    site = data.get("site")
    artworks = data.get("artworks")
    controls = data.get("controls")
    navigation = data.get("navigation")
    if not isinstance(site, dict) or not all(isinstance(site.get(key), str) and site[key].strip() for key in ("title", "subtitle")):
        fail("site.title and site.subtitle must be non-empty strings.")
    if not isinstance(artworks, list) or not artworks:
        fail("artworks must contain at least one item.")
    ids: set[str] = set()
    for artwork in artworks:
        if not isinstance(artwork, dict):
            fail("Each artwork must be an object.")
        artwork_id = artwork.get("id")
        if not isinstance(artwork_id, str) or not artwork_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in artwork_id):
            fail(f"Invalid artwork id: {artwork_id!r}")
        if artwork_id in ids:
            fail(f"Duplicate artwork id: {artwork_id}")
        ids.add(artwork_id)
        if not isinstance(artwork.get("label"), str) or not artwork["label"].strip():
            fail(f"Artwork {artwork_id} needs a label.")
        if not isinstance(artwork.get("framePath"), str) or not artwork["framePath"].strip():
            fail(f"Artwork {artwork_id} needs a framePath.")
        if not isinstance(artwork.get("frameCount"), int) or not 1 <= artwork["frameCount"] <= 120:
            fail(f"Artwork {artwork_id} frameCount must be 1-120.")
    if not isinstance(controls, list) or not controls:
        fail("controls must contain at least one item.")
    seen_controls: set[str] = set()
    for control in controls:
        if not isinstance(control, dict) or control.get("type") not in ALLOWED_CONTROLS:
            fail("Control type must be palm, pinch, span, or mouth.")
        if control["type"] in seen_controls:
            fail(f"Duplicate control type: {control['type']}")
        seen_controls.add(control["type"])
        if not isinstance(control.get("invert"), bool):
            fail(f"Control {control['type']} invert must be boolean.")
        if not isinstance(control.get("instruction"), str) or not control["instruction"].strip():
            fail(f"Control {control['type']} needs an instruction.")
    if not isinstance(navigation, dict) or not isinstance(navigation.get("verticalSwipe"), bool) or not isinstance(navigation.get("loop"), bool):
        fail("navigation.verticalSwipe and navigation.loop must be booleans.")
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--config", required=True, type=Path)
    parser.add_argument("--force", action="store_true", help="Replace existing template files")
    parser.add_argument("--preserve-frames", action="store_true", help="Allow an existing frames directory and leave it untouched")
    args = parser.parse_args()

    config_path = args.config.expanduser().resolve()
    if not config_path.is_file():
        fail(f"Configuration does not exist: {config_path}")
    try:
        config = validate_config(json.loads(config_path.read_text(encoding="utf-8")))
    except json.JSONDecodeError as error:
        fail(f"Invalid JSON: {error}")

    output = args.output.expanduser().resolve()
    template = Path(__file__).resolve().parent.parent / "assets" / "site-template"
    output.mkdir(parents=True, exist_ok=True)
    frames_dir = output / "frames"
    if frames_dir.exists() and not args.preserve_frames:
        fail("Output already contains frames. Pass --preserve-frames to leave them untouched.")
    for filename in TEMPLATE_FILES:
        destination = output / filename
        if destination.exists() and not args.force:
            fail(f"Template file already exists: {destination}. Use --force to replace it.")
    for filename in TEMPLATE_FILES:
        shutil.copy2(template / filename, output / filename)
    destination_config = output / "project.config.json"
    destination_config.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
    print(f"Scaffolded site: {output}")
    print(f"Artworks: {len(config['artworks'])}; controls: {len(config['controls'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
