"""Serves the built React app (production): one origin for the SPA and /api.

Enabled when FRONTEND_DIST_DIR points to the Vite build (the production
image sets it). Files are resolved strictly inside that folder; unknown paths
fall back to index.html so client-side routes work on refresh, while /api/*
keeps returning JSON 404s. Hashed assets are cached for a year, index.html
is never cached (a redeploy is picked up immediately).
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse

LONG_CACHE = "public, max-age=31536000, immutable"
NO_CACHE = "no-cache"


def mount_frontend(app: FastAPI, dist: Path) -> None:
    root = dist.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"FRONTEND_DIST_DIR has no index.html: {root}")

    @app.api_route("/{full_path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    async def frontend(full_path: str, request: Request) -> FileResponse:
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (root / full_path).resolve() if full_path else index
        inside = candidate == root or root in candidate.parents
        if inside and candidate.is_file():
            cache = LONG_CACHE if "/assets/" in f"/{full_path}" else "public, max-age=3600"
            return FileResponse(candidate, headers={"Cache-Control": cache})
        # Client-side route (or a missing file): the SPA decides what to show.
        return FileResponse(index, headers={"Cache-Control": NO_CACHE})
