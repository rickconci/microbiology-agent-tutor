"""FAISS-backed feedback storage. Failures propagate; only opt-in features
(FAISS import, search) degrade gracefully.
"""

from __future__ import annotations

import importlib
import json
import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


class FeedbackTool:
    def __init__(self, index_dir: str | Path = "data/feedback_auto", enabled: bool = False) -> None:
        self.index_dir = Path(index_dir)
        self.enabled = enabled
        self.index = None
        self.texts: list[str] = []
        self.entries: list[dict[str, Any]] = []
        self.faiss = None
        self.faiss_available = False
        if not self.enabled:
            logger.info("Feedback indexing is disabled by configuration.")
            return
        self._init_faiss()
        if self.faiss_available:
            self._load_index()

    def _init_faiss(self) -> None:
        try:
            self.faiss = importlib.import_module("faiss")
            self.faiss_available = True
        except ImportError:
            logger.warning("FAISS is not installed; indexing/search is unavailable.")

    def _load_index(self) -> None:
        index_path = self.index_dir / "feedback_index.faiss"
        texts_path = self.index_dir / "feedback_texts.pkl"
        entries_path = self.index_dir / "feedback_entries.pkl"
        if not (index_path.exists() and texts_path.exists() and entries_path.exists()):
            logger.warning("Feedback index files not found in %s", self.index_dir)
            return
        self.index = self.faiss.read_index(str(index_path))
        with open(texts_path, "rb") as f:
            self.texts = pickle.load(f)  # noqa: S301 — internal trusted file
        with open(entries_path, "rb") as f:
            self.entries = pickle.load(f)  # noqa: S301
        logger.info("Loaded feedback index with %s entries.", self.index.ntotal)

    def search_feedback(self, query_embedding: list[float], k: int = 3) -> list[dict[str, Any]]:
        """Returns at most ``k`` nearest matches; empty list if FAISS is disabled."""
        if not (self.enabled and self.faiss_available and self.index is not None):
            return []
        query = np.array([query_embedding], dtype="float32")
        self.faiss.normalize_L2(query)
        distances, indices = self.index.search(query, k)
        results: list[dict[str, Any]] = []
        for i, idx in enumerate(indices[0]):
            if 0 <= idx < len(self.entries):
                results.append({"text": self.texts[idx], "entry": self.entries[idx], "score": float(distances[0][i])})
        return results

    def save_feedback(self, feedback_data: dict[str, Any]) -> None:
        """Append ``feedback_data`` to ``new_feedback.json``. Errors propagate."""
        self.index_dir.mkdir(parents=True, exist_ok=True)
        feedback_file = self.index_dir / "new_feedback.json"
        existing: list[dict[str, Any]] = []
        if feedback_file.exists():
            with open(feedback_file, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            if not isinstance(loaded, list):
                raise ValueError(f"{feedback_file} must contain a JSON list, got {type(loaded).__name__}")
            existing = loaded
        existing.append(feedback_data)
        with open(feedback_file, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
        logger.info("Saved feedback to %s (now %s entries)", feedback_file, len(existing))
