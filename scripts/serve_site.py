#!/usr/bin/env python3
"""Serve a generated site on localhost for camera-safe local testing."""

from __future__ import annotations

import argparse
import functools
import http.server
import mimetypes
from pathlib import Path


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".webp": "image/webp", ".json": "application/json"}

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().end_headers()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    directory = args.directory.expanduser().resolve()
    if not (directory / "index.html").is_file():
        raise SystemExit(f"ERROR: No index.html in {directory}")
    mimetypes.add_type("image/webp", ".webp")
    handler = functools.partial(QuietHandler, directory=str(directory))
    with http.server.ThreadingHTTPServer((args.host, args.port), handler) as server:
        host, port = server.server_address
        print(f"Serving {directory}", flush=True)
        print(f"Local URL: http://{host}:{port}/", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
