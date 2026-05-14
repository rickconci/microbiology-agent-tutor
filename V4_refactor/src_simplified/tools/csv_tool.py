"""Lookup of "crucial factors" for an organism, backed by a CSV.

The CSV must exist and have a ``concept`` column. Anything else raises.
"""

from __future__ import annotations

import difflib
import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

V4_ROOT = Path(__file__).resolve().parents[2]


class CSVTool:
    def __init__(self, csv_path: str | Path = "data/pathogen_history_domains_complete.csv") -> None:
        path = Path(csv_path)
        self.csv_path = path if path.is_absolute() else V4_ROOT / path
        if not self.csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {self.csv_path}")
        self.df = pd.read_csv(self.csv_path)
        self.df.columns = [c.strip() for c in self.df.columns]
        if "concept" not in self.df.columns:
            raise ValueError(f"CSV missing required 'concept' column: {self.csv_path}")
        self.df["concept_normalized"] = (
            self.df["concept"].astype(str).str.lower().str.replace(" ", "_").str.strip()
        )
        logger.info("Loaded CSV from %s (%s rows)", self.csv_path, len(self.df))

    def get_crucial_factors(self, organism_name: str) -> list[str]:
        """Return list of factor column names that are flagged ``1.0`` for ``organism_name``.

        Empty list if no row matches (looks up exact, then fuzzy with cutoff 0.6).
        """
        target = organism_name.lower().replace(" ", "_").strip()
        concepts = self.df["concept_normalized"].tolist()

        if target in concepts:
            match_idx = concepts.index(target)
        else:
            matches = difflib.get_close_matches(target, concepts, n=1, cutoff=0.6)
            if not matches:
                return []
            match_idx = concepts.index(matches[0])

        row = self.df.iloc[match_idx]
        crucial: list[str] = []
        for col in self.df.columns:
            if col in {"concept", "comments", "concept_normalized"}:
                continue
            val = row[col]
            if not pd.notna(val):
                continue
            try:
                if float(val) == 1.0:
                    crucial.append(col)
            except (TypeError, ValueError):
                continue
        return crucial
