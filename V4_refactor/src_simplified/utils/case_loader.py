"""Loader for case data: JSON cache + ID_Images folder tree.

Failures are NOT swallowed:
  * Missing cache / dir → ``FileNotFoundError``
  * Malformed cache JSON → ``json.JSONDecodeError`` (raised by ``json.load``)
  * Unknown case key → ``KeyError`` (consistent with dict semantics)
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

V4_ROOT = Path(__file__).resolve().parents[2]


class CaseLoader:
    """Singleton loader for cached cases (JSON) + manual cases (ID_Images tree)."""

    _instance: "CaseLoader | None" = None

    def __new__(cls, *args: Any, **kwargs: Any) -> "CaseLoader":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self,
        cache_path: str | Path = "data/cases/cached/HPI_per_organism.json",
        manual_cases_dir: str | Path = "data/cases/ID_Images",
    ) -> None:
        if getattr(self, "_initialized", False):
            return
        self.cache_path = Path(cache_path) if Path(cache_path).is_absolute() else V4_ROOT / cache_path
        self.manual_cases_dir = Path(manual_cases_dir) if Path(manual_cases_dir).is_absolute() else V4_ROOT / manual_cases_dir
        self.cases: dict[str, str] = {}
        self.manual_cases: dict[str, dict[str, Any]] = {}
        self._load_cases()
        self._load_manual_cases()
        self._initialized = True

    @classmethod
    def reset(cls) -> None:
        """Drop the singleton (only for tests)."""
        cls._instance = None

    def _load_cases(self) -> None:
        if not self.cache_path.exists():
            raise FileNotFoundError(f"Case cache file not found: {self.cache_path}")
        with open(self.cache_path, "r", encoding="utf-8") as f:
            self.cases = json.load(f)
        if not isinstance(self.cases, dict):
            raise ValueError(f"Case cache must be a JSON object, got {type(self.cases).__name__}: {self.cache_path}")
        logger.info("Loaded %s cases from %s", len(self.cases), self.cache_path)

    def _load_manual_cases(self) -> None:
        """Recursively find folders containing ``case_text.txt`` under ``manual_cases_dir``.

        Keys are posix paths relative to the images root, e.g. ``Case_07011`` or
        ``Staphylococcus_aureus/Case_08024``.
        """
        if not self.manual_cases_dir.exists():
            raise FileNotFoundError(f"Manual cases directory not found: {self.manual_cases_dir}")

        resolved = self.manual_cases_dir.resolve()
        for case_text_path in sorted(resolved.rglob("case_text.txt")):
            case_dir = case_text_path.parent
            if not case_dir.is_dir() or not case_dir.name.startswith("Case_"):
                continue
            rel = case_dir.relative_to(resolved)
            key = rel.as_posix()
            with open(case_text_path, "r", encoding="utf-8") as f:
                content = f.read()
            images = sorted(
                [p.name for p in case_dir.glob("*.jpg")]
                + [p.name for p in case_dir.glob("*.jpeg")]
                + [p.name for p in case_dir.glob("*.png")]
            )
            self.manual_cases[key] = {"content": content, "images": images, "path": str(case_dir)}
        logger.info("Loaded %s manual cases from %s", len(self.manual_cases), resolved)

    def get_case(self, key: str) -> str:
        """Return the case text for ``key``. Raises ``KeyError`` if unknown."""
        if key in self.manual_cases:
            return self.manual_cases[key]["content"]
        if key in self.cases:
            return self.cases[key]
        raise KeyError(f"Unknown case key: {key!r}")

    def get_case_data(self, key: str) -> dict[str, Any]:
        """Return ``{content, images, path}`` for ``key``. Raises ``KeyError`` if unknown."""
        if key in self.manual_cases:
            return self.manual_cases[key]
        if key in self.cases:
            return {"content": self.cases[key], "images": [], "path": None}
        raise KeyError(f"Unknown case key: {key!r}")

    def list_available_organisms(self) -> list[str]:
        """Sorted, de-duplicated list of cached + manual case keys."""
        return sorted(set(self.cases) | set(self.manual_cases), key=str.lower)
