"""Case library API endpoints — serves parsed MGH ID Images cases."""

import json
import logging
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter()

# Resolve paths relative to this file
# This file: src/microtutor/api/routes/cases.py
# Project root (V4_refactor): 4 levels up
_HERE = Path(__file__).resolve()
_V4_ROOT = _HERE.parent.parent.parent.parent.parent  # V4_refactor/
_CASE_LIBRARY_JSON = _V4_ROOT / "data" / "cases" / "case_library.json"
_ALL_CASES_DIR = _V4_ROOT / "data" / "cases" / "ID_Images" / "All_cases"

# Load and cache on first request
_case_cache: list | None = None


def _load_cases() -> list:
    global _case_cache
    if _case_cache is None:
        if not _CASE_LIBRARY_JSON.exists():
            logger.error(f"case_library.json not found at {_CASE_LIBRARY_JSON}")
            _case_cache = []
        else:
            with open(_CASE_LIBRARY_JSON) as f:
                _case_cache = json.load(f)
            logger.info(f"Loaded {len(_case_cache)} cases from {_CASE_LIBRARY_JSON}")
    return _case_cache


@router.get("/cases")
async def list_cases(
    search: Optional[str] = Query(None, description="Full-text search across title, history, diagnosis"),
    limit: int = Query(100, ge=1, le=592),
    offset: int = Query(0, ge=0),
):
    """Return a paginated list of all cases with summary fields only."""
    cases = _load_cases()

    if search:
        q = search.lower()
        cases = [
            c for c in cases
            if q in c.get("title", "").lower()
            or q in c.get("history", "").lower()
            or q in c.get("diagnosis", "").lower()
        ]

    total = len(cases)
    page = cases[offset: offset + limit]

    # Return summary only (no full text) for the list view
    summaries = [
        {
            "id": c["id"],
            "title": c["title"],
            "figures": c.get("figures", []),
        }
        for c in page
    ]

    return {"total": total, "offset": offset, "limit": limit, "cases": summaries}


@router.get("/cases/{case_id}")
async def get_case(case_id: str):
    """Return full case data for a single case."""
    cases = _load_cases()
    for c in cases:
        if c["id"] == case_id:
            return c
    raise HTTPException(status_code=404, detail=f"Case {case_id!r} not found")
