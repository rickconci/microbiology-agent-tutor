import json
import logging
from pathlib import Path
import os

logger = logging.getLogger(__name__)

class CaseLoader:
    _instance = None
    _initialized = False

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(CaseLoader, cls).__new__(cls)
        return cls._instance

    def __init__(self, cache_path: str = "data/cases/cached/HPI_per_organism.json", manual_cases_dir: str = "data/cases/ID_Images"):
        if self._initialized:
            return
        
        self.v4_root = Path(__file__).resolve().parents[2]
        self.cache_path = self.v4_root / cache_path
        self.manual_cases_dir = self.v4_root / manual_cases_dir
        self.cases = {}
        self.manual_cases = {}
        self.load_cases()
        self.load_manual_cases()
        
        # Mark as initialized to avoid reloading if __init__ is called again
        self.__class__._initialized = True

    def load_cases(self):
        try:
            if self.cache_path.exists():
                with open(self.cache_path, 'r', encoding='utf-8') as f:
                    self.cases = json.load(f)
                logger.info("Loaded %s cases from %s", len(self.cases), self.cache_path)
            else:
                logger.warning("Case cache file not found: %s", self.cache_path)
        except Exception as e:
            logger.error("Failed to load case cache: %s", e)

    def load_manual_cases(self) -> None:
        """Load folders containing case_text.txt under ID_Images (any depth).

        Keys are posix paths relative to the images root, e.g. ``Case_07011`` or
        ``Staphylococcus_aureus/Case_08024``, matching nested scraper output.
        """
        try:
            if not self.manual_cases_dir.exists():
                logger.warning("Manual cases directory not found: %s", self.manual_cases_dir)
                return

            resolved = self.manual_cases_dir.resolve()
            for case_text_path in sorted(resolved.rglob("case_text.txt")):
                case_dir = case_text_path.parent
                if not case_dir.is_dir() or not case_dir.name.startswith("Case_"):
                    continue
                try:
                    rel = case_dir.relative_to(resolved)
                except ValueError:
                    continue
                key = rel.as_posix()
                with open(case_text_path, "r", encoding="utf-8") as f:
                    content = f.read()
                images = sorted(
                    [p.name for p in case_dir.glob("*.jpg")]
                    + [p.name for p in case_dir.glob("*.jpeg")]
                    + [p.name for p in case_dir.glob("*.png")]
                )
                self.manual_cases[key] = {
                    "content": content,
                    "images": images,
                    "path": str(case_dir),
                }
            logger.info("Loaded %s manual cases from %s", len(self.manual_cases), resolved)
        except Exception as e:
            logger.error(f"Failed to load manual cases: {e}")

    def get_case(self, key: str) -> str:
        if key in self.manual_cases:
            return self.manual_cases[key]["content"]
        return self.cases.get(key, f"Case for {key} not found.")

    def get_case_data(self, key: str) -> dict:
        if key in self.manual_cases:
            return self.manual_cases[key]
        return {"content": self.cases.get(key, ""), "images": []}

    def list_available_organisms(self) -> list[str]:
        """Unique sorted keys: JSON cache cases plus manual ID_Images folders."""
        seen: set[str] = set()
        ordered: list[str] = []
        for k in list(self.cases.keys()) + list(self.manual_cases.keys()):
            if k not in seen:
                seen.add(k)
                ordered.append(k)
        return sorted(ordered, key=str.lower)
