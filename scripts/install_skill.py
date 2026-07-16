#!/usr/bin/env python3
"""Install this skill for a supported agent client or into a project."""

from __future__ import annotations

import argparse
import shutil
import tempfile
import time
from pathlib import Path


PERSONAL_TARGETS = {
    "codex": Path.home() / ".codex" / "skills",
    "claude": Path.home() / ".claude" / "skills",
    "cursor": Path.home() / ".cursor" / "skills",
    "copilot": Path.home() / ".copilot" / "skills",
}


def ignored(_: str, names: list[str]) -> set[str]:
    return {name for name in names if name == "__pycache__" or name.endswith((".pyc", ".pyo"))}


def destination_for(target: str, project_root: Path | None) -> Path:
    if target in PERSONAL_TARGETS:
        if project_root is not None:
            raise SystemExit("ERROR: --project-root is only valid for project targets.")
        return PERSONAL_TARGETS[target] / "build-gesture-animation"
    if project_root is None:
        raise SystemExit("ERROR: --project-root is required for project targets.")
    root = project_root.expanduser().resolve()
    if target == "copilot-project":
        return root / ".github" / "skills" / "build-gesture-animation"
    return root / ".agents" / "skills" / "build-gesture-animation"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=[*PERSONAL_TARGETS, "agents-project", "copilot-project"])
    parser.add_argument("--project-root", type=Path)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    source = Path(__file__).resolve().parent.parent
    destination = destination_for(args.target, args.project_root)
    if source == destination:
        raise SystemExit("ERROR: Source and destination are the same directory.")
    print(f"Source: {source}")
    print(f"Destination: {destination}")
    if args.dry_run:
        if destination.exists() and not args.force:
            print("Status: destination exists; a real install would require --force")
        return 0
    if destination.exists() and not args.force:
        raise SystemExit(f"ERROR: Skill already exists at {destination}. Use --force to replace it.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp_parent = Path(tempfile.mkdtemp(prefix=".build-gesture-animation-install-", dir=destination.parent))
    staged = temp_parent / destination.name
    backup: Path | None = None
    try:
        shutil.copytree(source, staged, ignore=ignored)
        if destination.exists():
            backup = destination.with_name(f".{destination.name}.backup-{int(time.time())}")
            destination.rename(backup)
        staged.rename(destination)
        if backup:
            shutil.rmtree(backup)
    except BaseException:
        if backup and backup.exists() and not destination.exists():
            backup.rename(destination)
        raise
    finally:
        if temp_parent.exists():
            shutil.rmtree(temp_parent)
    print(f"Installed: {destination}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
