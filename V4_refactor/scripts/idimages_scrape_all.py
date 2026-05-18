#!/usr/bin/env python3
"""Chunked, resumable scraper for *all* cases from idimages.org.

Source listing page: https://www.idimages.org/idreview/browse/all/

Output (matches the per-organism folders under ID_Images/):

    data/cases/ID_Images/All_cases/
        _index.json           # full list of CaseIDs discovered (built once)
        _progress.json        # {"scraped": [...], "failed": {cid: msg, ...}}
        Case_#####/
            case_text.txt
            figure1.jpg
            figure2.jpg
            ...

Typical use:

    # 1) Build the master index of CaseIDs (one-time, cached)
    python scripts/idimages_scrape_all.py --refresh-index

    # 2) Scrape next 100 unscraped cases
    python scripts/idimages_scrape_all.py

    # 3) Repeat (git add/commit/push between runs as needed)
    python scripts/idimages_scrape_all.py

Other useful flags:

    --chunk-size N        Scrape N cases this invocation (default 100)
    --start-from CASEID   Skip cases below this CaseID (useful for resuming)
    --retry-failed        Re-attempt cases previously marked as failed
    --overwrite           Re-scrape cases already on disk
    --dry-run             Print what would be scraped, don't fetch
    --rebuild-progress    Rebuild progress.scraped from existing Case_* folders

This script reuses the scraping core in idimages_scraper.py (login, page
parsing, figure download).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import BrowserContext, Page, sync_playwright

# Reuse the core scraping logic.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from idimages_scraper import (  # type: ignore  # noqa: E402
    CASE_URL_TEMPLATE,
    DEFAULT_STORAGE_STATE,
    Captioner,
    click_single_page_if_present,
    download_figure,
    ensure_login,
    extract_case_id_from_href,
    extract_case_content_and_figures,
    inject_model_descriptions,
    is_probably_login_page,
)


BROWSE_ALL_URL = "https://www.idimages.org/idreview/browse/all/"
DEFAULT_OUTPUT_DIR = Path("data/cases/ID_Images/All_cases")


# ---------------------------------------------------------------------------
# Index + progress tracking
# ---------------------------------------------------------------------------


@dataclass
class Progress:
    scraped: set[int]
    failed: dict[int, str]

    @classmethod
    def load(cls, path: Path) -> "Progress":
        if not path.exists():
            return cls(scraped=set(), failed={})
        data = json.loads(path.read_text())
        scraped = set(int(x) for x in data.get("scraped", []))
        failed_raw = data.get("failed", {}) or {}
        failed = {int(k): str(v) for k, v in failed_raw.items()}
        return cls(scraped=scraped, failed=failed)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "scraped": sorted(self.scraped),
            "failed": {str(k): v for k, v in sorted(self.failed.items())},
        }
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2))
        tmp.replace(path)


def collect_all_case_ids(page: Page) -> list[int]:
    """Visit the browse/all/ page and collect every CaseID link."""
    page.goto(BROWSE_ALL_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    if is_probably_login_page(page):
        raise RuntimeError(
            "Browse-all page redirected to login. Refresh auth with "
            "`--interactive-login --headed --auth-only` via idimages_scraper.py."
        )

    # The site lists all cases on one page (no client-side pagination observed in
    # comparable browse views), but scroll to the bottom defensively in case any
    # links are lazy-rendered.
    last_height = 0
    for _ in range(10):
        height = page.evaluate("() => document.body.scrollHeight")
        if height == last_height:
            break
        page.evaluate("() => window.scrollTo(0, document.body.scrollHeight)")
        page.wait_for_timeout(500)
        last_height = height

    case_ids: set[int] = set()
    for href in page.eval_on_selector_all(
        "a[href*='CaseID=']", "els => els.map(e => e.getAttribute('href'))"
    ):
        cid = extract_case_id_from_href(href)
        if cid is not None:
            case_ids.add(cid)

    # Some pages render server-side links inside framesets; also check raw HTML
    # for safety.
    html = page.content()
    for match in re.finditer(r"CaseID=(\d+)", html, flags=re.IGNORECASE):
        case_ids.add(int(match.group(1)))

    return sorted(case_ids)


def build_or_load_index(
    page: Page,
    index_path: Path,
    refresh: bool,
) -> list[int]:
    if refresh or not index_path.exists():
        case_ids = collect_all_case_ids(page)
        if not case_ids:
            raise RuntimeError("No CaseIDs found on browse/all/ page.")
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text(json.dumps({"case_ids": case_ids}, indent=2))
        print(f"[index] Wrote {len(case_ids)} CaseIDs to {index_path}")
        return case_ids

    data = json.loads(index_path.read_text())
    case_ids = sorted(int(x) for x in data.get("case_ids", []))
    print(f"[index] Loaded {len(case_ids)} CaseIDs from {index_path}")
    return case_ids


def rebuild_progress_from_disk(output_root: Path, progress: Progress) -> None:
    """Repopulate `progress.scraped` from existing Case_##### folders on disk.

    Note: we can only recover the display-number/Case ID encoded in the folder
    name. If a folder exists, we treat it as scraped.
    """
    found = 0
    for child in output_root.iterdir():
        if not child.is_dir():
            continue
        m = re.match(r"Case_0*(\d+)$", child.name)
        if not m:
            continue
        cid = int(m.group(1))
        if (child / "case_text.txt").exists():
            progress.scraped.add(cid)
            found += 1
    print(f"[progress] Rebuilt scraped set from disk: {found} cases")


# ---------------------------------------------------------------------------
# Per-case scrape (close to scrape_case in idimages_scraper.py, but adapted to
# the chunked-progress workflow here)
# ---------------------------------------------------------------------------


def scrape_one_case(
    context: BrowserContext,
    page: Page,
    case_id: int,
    output_root: Path,
    overwrite: bool,
    captioner: Captioner | None,
    folder_id_mode: str,
) -> Path:
    case_url = CASE_URL_TEMPLATE.format(case_id=case_id)
    page.goto(case_url, wait_until="domcontentloaded")

    if is_probably_login_page(page):
        raise RuntimeError("Session is not authenticated for this case URL.")

    click_single_page_if_present(page)
    case_text, figures, display_case_number = extract_case_content_and_figures(page)

    if folder_id_mode == "display-number" and display_case_number:
        folder_suffix = display_case_number
    else:
        folder_suffix = f"{case_id:05d}"

    case_dir = output_root / f"Case_{folder_suffix}"
    case_dir.mkdir(parents=True, exist_ok=True)

    text_path = case_dir / "case_text.txt"
    if text_path.exists() and not overwrite:
        # Treat as already scraped.
        return case_dir

    for fig in figures:
        figure_path = case_dir / fig.local_name
        if figure_path.exists() and not overwrite:
            continue
        download_figure(context, fig, figure_path)
        if captioner is not None:
            try:
                fig.model_description = captioner.caption(figure_path)
            except Exception as exc:  # noqa: BLE001
                fig.model_description = f"Caption generation failed: {exc}"

    if captioner is not None:
        case_text = inject_model_descriptions(case_text, figures)

    text_path.write_text(case_text + "\n", encoding="utf-8")
    return case_dir


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Chunked / resumable scraper for all idimages.org cases.")
    p.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help=f"Output root (default: {DEFAULT_OUTPUT_DIR}).")
    p.add_argument("--storage-state", default=str(DEFAULT_STORAGE_STATE), help="Playwright storage_state.json path.")

    p.add_argument("--chunk-size", type=int, default=100, help="Cases to scrape this invocation (default: 100).")
    p.add_argument("--start-from", type=int, help="Skip CaseIDs strictly less than this value (resume hint).")

    p.add_argument("--refresh-index", action="store_true", help="Re-fetch browse/all/ and rewrite _index.json.")
    p.add_argument("--rebuild-progress", action="store_true", help="Rebuild progress.scraped from existing folders on disk.")
    p.add_argument("--retry-failed", action="store_true", help="Re-attempt previously failed CaseIDs (in addition to unscraped ones).")
    p.add_argument("--overwrite", action="store_true", help="Re-scrape cases even if case_text.txt already exists.")
    p.add_argument("--dry-run", action="store_true", help="Print the chunk plan but don't fetch.")
    p.add_argument("--inter-request-sleep", type=float, default=0.6, help="Seconds between case requests (default: 0.6).")

    p.add_argument("--headed", action="store_true", help="Run browser headed (useful for re-auth).")
    p.add_argument("--interactive-login", action="store_true", help="Allow manual login + save session state.")
    p.add_argument("--email", help="Login email (env: IDIMAGES_EMAIL).")
    p.add_argument("--password", help="Login password (env: IDIMAGES_PASSWORD).")
    p.add_argument("--caption-model", help="Optional BLIP captioning model name.")
    p.add_argument(
        "--folder-id-mode",
        choices=["case-id", "display-number"],
        default="display-number",
        help="Folder naming mode (default: display-number).",
    )
    return p


def plan_chunk(
    case_ids: list[int],
    progress: Progress,
    chunk_size: int,
    start_from: int | None,
    retry_failed: bool,
    overwrite: bool,
) -> list[int]:
    """Pick the next chunk of CaseIDs to scrape."""
    todo: list[int] = []
    for cid in case_ids:
        if start_from is not None and cid < start_from:
            continue
        if cid in progress.scraped and not overwrite:
            continue
        if cid in progress.failed and not retry_failed and not overwrite:
            continue
        todo.append(cid)
        if len(todo) >= chunk_size:
            break
    return todo


def main() -> int:
    import os

    args = build_parser().parse_args()
    output_root = Path(args.output_dir)
    output_root.mkdir(parents=True, exist_ok=True)

    index_path = output_root / "_index.json"
    progress_path = output_root / "_progress.json"
    progress = Progress.load(progress_path)

    if args.rebuild_progress:
        rebuild_progress_from_disk(output_root, progress)
        progress.save(progress_path)

    storage_state_path = Path(args.storage_state)
    email = args.email or os.environ.get("IDIMAGES_EMAIL")
    password = args.password or os.environ.get("IDIMAGES_PASSWORD")
    captioner = Captioner(args.caption_model) if args.caption_model else None

    headless = not args.headed

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context_kwargs = {}
        if storage_state_path.exists():
            context_kwargs["storage_state"] = str(storage_state_path)
        context = browser.new_context(**context_kwargs)
        page = context.new_page()

        ensure_login(
            page=page,
            context=context,
            storage_state_path=storage_state_path,
            email=email,
            password=password,
            interactive_login=args.interactive_login,
            headed=not headless,
            protected_check_url=BROWSE_ALL_URL,
        )

        case_ids = build_or_load_index(page, index_path, refresh=args.refresh_index)
        chunk = plan_chunk(
            case_ids=case_ids,
            progress=progress,
            chunk_size=args.chunk_size,
            start_from=args.start_from,
            retry_failed=args.retry_failed,
            overwrite=args.overwrite,
        )

        remaining = sum(
            1
            for cid in case_ids
            if cid not in progress.scraped
            and (args.retry_failed or cid not in progress.failed)
        )
        print(
            f"[plan] index_total={len(case_ids)} scraped={len(progress.scraped)} "
            f"failed={len(progress.failed)} remaining={remaining} this_chunk={len(chunk)}"
        )

        if args.dry_run:
            for cid in chunk:
                print(f"[dry-run] would scrape CaseID {cid}")
            context.storage_state(path=str(storage_state_path))
            context.close()
            browser.close()
            return 0

        if not chunk:
            print("[done] Nothing to scrape in this chunk.")
            context.storage_state(path=str(storage_state_path))
            context.close()
            browser.close()
            return 0

        try:
            for i, cid in enumerate(chunk, start=1):
                try:
                    case_dir = scrape_one_case(
                        context=context,
                        page=page,
                        case_id=cid,
                        output_root=output_root,
                        overwrite=args.overwrite,
                        captioner=captioner,
                        folder_id_mode=args.folder_id_mode,
                    )
                    progress.scraped.add(cid)
                    progress.failed.pop(cid, None)
                    print(f"[ok] ({i}/{len(chunk)}) CaseID {cid} -> {case_dir}")
                except Exception as exc:  # noqa: BLE001
                    progress.failed[cid] = str(exc)
                    progress.scraped.discard(cid)
                    print(f"[error] ({i}/{len(chunk)}) CaseID {cid}: {exc}")

                # Persist progress after every case so we never lose work.
                progress.save(progress_path)

                if i < len(chunk) and args.inter_request_sleep > 0:
                    time.sleep(args.inter_request_sleep)
        finally:
            storage_state_path.parent.mkdir(parents=True, exist_ok=True)
            context.storage_state(path=str(storage_state_path))
            context.close()
            browser.close()

    ok = sum(1 for cid in chunk if cid in progress.scraped)
    print(f"[summary] chunk_size={len(chunk)} ok={ok} failed={len(chunk) - ok}")
    print(f"[summary] total scraped so far: {len(progress.scraped)}/{len(case_ids)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
