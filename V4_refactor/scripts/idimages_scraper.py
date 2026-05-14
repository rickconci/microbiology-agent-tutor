#!/usr/bin/env python3
"""Scrape ID Images case pages into local folders.

Output format (matching existing manual cases):
  ID_Images/Case_07011/
    - case_text.txt
    - figure1.jpg
    - figure2.jpg
    - ...

The script supports two authentication patterns:
1) Reuse previously-saved Playwright storage state (recommended).
2) Perform login with email/password from flags or env vars.

Optional: Use an open-source VLM (BLIP) to auto-caption figures and include
those captions in the generated case_text.txt.
"""

from __future__ import annotations

import argparse
import dataclasses
import os
import re
import sys
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup, Tag
from playwright.sync_api import BrowserContext, Page, TimeoutError as PlaywrightTimeoutError, sync_playwright


BASE_URL = "https://www.idimages.org"
CASE_URL_TEMPLATE = "https://www.idimages.org/idreview/case/?CaseID={case_id}"
SEARCH_URL = "https://www.idimages.org/search/"
DEFAULT_STORAGE_STATE = Path.home() / ".config" / "idimages_scraper" / "storage_state.json"

NAV_FRAGMENTS = {
    "home",
    "cases",
    "images",
    "atlas",
    "my id images",
    "search",
    "register",
    "about",
    "help",
    "contact",
    "privacy",
    "disclaimer",
    "twitter",
    "facebook",
    "follow us",
}

CASE_SECTION_KEYWORDS = [
    "history of present illness",
    "past medical history",
    "physical examination",
    "clinical course prior to diagnosis",
    "diagnostic procedure",
    "treatment and followup",
    "discussion",
    "final diagnosis",
]

IMAGE_SKIP_PATTERNS = [
    "/images/layout/",
    "partnerslogo",
    "facebookicon",
    "twittericon",
    "helpicon",
    "purplebar",
    "spacer",
    "transparent",
    "logo",
]


@dataclasses.dataclass
class Figure:
    index: int
    url: str
    local_name: str
    caption: str
    model_description: str | None = None


@dataclasses.dataclass
class CaseContent:
    text: str
    figures: list[Figure]
    display_case_number: str | None = None


class Captioner:
    """Optional BLIP captioner loaded lazily when requested."""

    def __init__(self, model_name: str) -> None:
        try:
            from PIL import Image  # noqa: F401
            from transformers import BlipForConditionalGeneration, BlipProcessor
        except ImportError as exc:
            raise RuntimeError(
                "Captioning requested but dependencies are missing. "
                "Install: pip install transformers pillow torch"
            ) from exc

        from transformers import BlipForConditionalGeneration, BlipProcessor

        self._Image = __import__("PIL.Image", fromlist=["Image"]).Image
        self.processor = BlipProcessor.from_pretrained(model_name)
        self.model = BlipForConditionalGeneration.from_pretrained(model_name)

    def caption(self, image_path: Path) -> str:
        image = self._Image.open(image_path).convert("RGB")
        inputs = self.processor(image, return_tensors="pt")
        out = self.model.generate(**inputs, max_new_tokens=32)
        text = self.processor.decode(out[0], skip_special_tokens=True)
        return normalize_whitespace(text)


def normalize_whitespace(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def looks_like_nav_line(line: str) -> bool:
    cleaned = line.strip().lower()
    if not cleaned:
        return True
    if cleaned in NAV_FRAGMENTS:
        return True
    return False


def is_probably_login_page(page: Page) -> bool:
    url = page.url.lower()
    if "login" in url:
        return True
    text = page.locator("body").inner_text(timeout=4000).lower()
    return "log in" in text and "email" in text and "password" in text


def parse_case_ids(args: argparse.Namespace) -> list[int]:
    case_ids: set[int] = set()

    def _parse_case_id_token(token: str) -> int:
        token = token.strip()
        if token.lower().startswith("case_"):
            token = token.split("_", 1)[1]
        match = re.search(r"\d+", token)
        if not match:
            raise ValueError(f"Invalid case ID token: {token!r}")
        return int(match.group(0))

    if args.case_ids:
        for token in re.split(r"[\s,]+", args.case_ids.strip()):
            if token:
                case_ids.add(_parse_case_id_token(token))

    if args.case_id_file:
        lines = Path(args.case_id_file).read_text(encoding="utf-8").splitlines()
        for line in lines:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            case_ids.add(_parse_case_id_token(line))

    if args.case_id_start is not None and args.case_id_end is not None:
        start, end = sorted((args.case_id_start, args.case_id_end))
        for cid in range(start, end + 1):
            case_ids.add(cid)

    if not case_ids:
        raise ValueError(
            "No case IDs specified. Use one of: --case-ids, --case-id-file, or --case-id-start/--case-id-end"
        )

    return sorted(case_ids)


def extract_case_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    match = re.search(r"CaseID=(\d+)", href, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def collect_case_ids_from_search(page: Page, search_query: str, search_type: str = "Cases") -> list[int]:
    """Run top-nav site search and collect all CaseID values from results."""
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    if is_probably_login_page(page):
        raise RuntimeError("Session is not authenticated; cannot run search.")

    # Top-nav search controls.
    search_type_locator = page.locator("#ctl00_SearchType, select[id$='SearchType'], select[name$='SearchType']")
    query_input = page.locator("#ctl00_tbNavSearch, input[id$='tbNavSearch'], input[name$='tbNavSearch']")
    submit_button = page.locator("#ctl00_btnNavSearch, input[id$='btnNavSearch'], input[name$='btnNavSearch']")

    if query_input.count() == 0 or submit_button.count() == 0:
        # Fallback to dedicated search page where controls are always present.
        page.goto(SEARCH_URL, wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        search_type_locator = page.locator("#ctl00_SearchType, select[id$='SearchType'], select[name$='SearchType']")
        query_input = page.locator("#ctl00_tbNavSearch, input[id$='tbNavSearch'], input[name$='tbNavSearch']")
        submit_button = page.locator("#ctl00_btnNavSearch, input[id$='btnNavSearch'], input[name$='btnNavSearch']")

    if query_input.count() == 0:
        raise RuntimeError(f"Could not find site search input on {page.url}")
    if submit_button.count() == 0:
        raise RuntimeError(f"Could not find site search submit button on {page.url}")
    if search_type_locator.count() > 0:
        search_type_locator.first.select_option(label=search_type)

    query_input.first.fill(search_query)
    submit_button.first.click()
    page.wait_for_load_state("networkidle")

    case_ids: set[int] = set()
    # First pass: primary result links.
    links = page.locator("a[href*='CaseID=']").all()
    for link in links:
        cid = extract_case_id_from_href(link.get_attribute("href"))
        if cid is not None:
            case_ids.add(cid)

    print(f"[search] Query={search_query!r}, type={search_type}, found {len(case_ids)} case link(s)")
    return sorted(case_ids)


def ensure_login(
    page: Page,
    context: BrowserContext,
    storage_state_path: Path,
    email: str | None,
    password: str | None,
    interactive_login: bool,
    headed: bool,
    protected_check_url: str,
) -> None:
    page.goto(protected_check_url, wait_until="domcontentloaded")

    if not is_probably_login_page(page):
        return

    if interactive_login:
        if headed:
            print("[auth] Please complete login in the opened browser window, then press Enter here.")
            input()
        else:
            raise RuntimeError("Interactive login requires headed mode (set --headed).")
    else:
        if not email or not password:
            raise RuntimeError(
                "Not authenticated and no credentials provided. "
                "Pass --interactive-login (recommended) or --email/--password."
            )
        perform_login(page, email=email, password=password)

    page.goto(protected_check_url, wait_until="domcontentloaded")
    if is_probably_login_page(page):
        raise RuntimeError("Login failed; still on login page after authentication attempt.")

    storage_state_path.parent.mkdir(parents=True, exist_ok=True)
    context.storage_state(path=str(storage_state_path))
    print(f"[auth] Saved session state to {storage_state_path}")


def perform_login(page: Page, email: str, password: str) -> None:
    candidate_urls = [
        f"{BASE_URL}/login.aspx",
        f"{BASE_URL}/login/",
        BASE_URL,
    ]

    for candidate in candidate_urls:
        page.goto(candidate, wait_until="domcontentloaded")
        if is_probably_login_page(page):
            break

    email_locators = [
        page.get_by_label(re.compile("email", re.I)),
        page.locator("input[type='email']"),
        page.locator("input[name*='email' i]"),
    ]
    password_locators = [
        page.get_by_label(re.compile("password", re.I)),
        page.locator("input[type='password']"),
    ]

    filled = False
    for locator in email_locators:
        if locator.count() > 0:
            locator.first.fill(email)
            filled = True
            break
    if not filled:
        raise RuntimeError("Could not find email input on login page.")

    filled = False
    for locator in password_locators:
        if locator.count() > 0:
            locator.first.fill(password)
            filled = True
            break
    if not filled:
        raise RuntimeError("Could not find password input on login page.")

    clicked = False
    submit_candidates = [
        page.get_by_role("button", name=re.compile(r"log\s*in|sign\s*in", re.I)),
        page.locator("input[type='submit']"),
        page.locator("button[type='submit']"),
    ]
    for locator in submit_candidates:
        if locator.count() > 0:
            locator.first.click()
            clicked = True
            break

    if not clicked:
        raise RuntimeError("Could not find a login submit button.")

    page.wait_for_load_state("networkidle")


def click_single_page_if_present(page: Page) -> None:
    selectors = [
        "a[href*='lbShowAll']",
        "a[href*='lbShowAll2']",
        "a:has-text('Single Page')",
        "a:has-text('single page')",
        "a:has-text('Single-Page')",
        "a:has-text('Print')",
    ]
    for selector in selectors:
        locator = page.locator(selector)
        if locator.count() > 0:
            try:
                locator.first.click()
                page.wait_for_load_state("networkidle")
                page.wait_for_timeout(1000)
                return
            except PlaywrightTimeoutError:
                pass


def find_case_container(soup: BeautifulSoup) -> Tag:
    case_detail = soup.find(id="CaseDetail")
    if isinstance(case_detail, Tag):
        return case_detail

    candidate_tags = []

    for tag in soup.find_all(["div", "section", "article", "td", "main", "form"]):
        text = normalize_whitespace(tag.get_text("\n", strip=True)).lower()
        if not text:
            continue
        score = sum(1 for kw in CASE_SECTION_KEYWORDS if kw in text)
        if score > 0:
            candidate_tags.append((score, len(text), tag))

    if candidate_tags:
        # Prioritize highest keyword match, then longest content.
        candidate_tags.sort(key=lambda x: (x[0], x[1]), reverse=True)
        return candidate_tags[0][2]

    return soup.body or soup


def build_clean_case_container(raw_container: Tag) -> Tag:
    """Return a narrowed container with only clinical single-page sections."""
    cleaned = BeautifulSoup(str(raw_container), "html.parser")
    container = cleaned.find(id=raw_container.get("id")) if raw_container.get("id") else cleaned
    if not isinstance(container, Tag):
        container = cleaned

    if container.get("id") == "CaseDetail":
        # Keep only sections that correspond to the narrative case body.
        desired_ids = {"History", "ExamStudies", "Diagnosis"}
        for child in list(container.find_all(recursive=False)):
            cid = (child.get("id") or "").strip()
            if cid and cid not in desired_ids:
                child.decompose()
        return container

    # Generic fallback: drop known non-clinical blocks when ID structure differs.
    for junk_id in ["CaseNav", "Differential", "MoreInfo", "Tools", "Related", "FeaturedCase"]:
        for tag in container.find_all(id=junk_id):
            tag.decompose()
    return container


def is_probably_case_image(img: Tag) -> bool:
    src = (img.get("src") or "").lower().strip()
    if not src:
        return False

    for pattern in IMAGE_SKIP_PATTERNS:
        if pattern in src:
            return False

    if not re.search(r"\.(jpg|jpeg|png|gif)(\?|$)", src):
        return False

    width = img.get("width")
    height = img.get("height")
    try:
        if width and int(str(width)) <= 80:
            return False
        if height and int(str(height)) <= 80:
            return False
    except ValueError:
        pass

    return True


def infer_caption(img: Tag) -> str:
    # Primary source for this site: gallery caption text near each image.
    gallery = img.find_parent("dl", class_="gallery")
    if gallery:
        caption_span = gallery.find("span", class_="imgcaption")
        if isinstance(caption_span, Tag):
            caption_text = normalize_whitespace(caption_span.get_text(" ", strip=True))
            caption_text = re.sub(r"view\s+larger\s*/\s*more\s+info", "", caption_text, flags=re.IGNORECASE).strip()
            match = re.match(r"^Figure\s*\d+\.\s*(.+)$", caption_text, flags=re.IGNORECASE)
            if match:
                cleaned = normalize_whitespace(match.group(1))
                if cleaned:
                    return cleaned
            if caption_text:
                return caption_text

    alt = normalize_whitespace(img.get("alt") or "")
    title = normalize_whitespace(img.get("title") or "")

    if alt and len(alt) > 2:
        return alt
    if title and len(title) > 2:
        return title

    parent = img.parent if isinstance(img.parent, Tag) else None
    if parent:
        parent_text = normalize_whitespace(parent.get_text(" ", strip=True))
        if parent_text and len(parent_text) <= 120:
            return parent_text

    return "Image"


def extract_case_content_and_figures(page: Page) -> tuple[str, list[Figure], str | None]:
    html = page.content()
    soup = BeautifulSoup(html, "html.parser")
    raw_container = find_case_container(soup)
    container = build_clean_case_container(raw_container)

    for junk in container.find_all(["script", "style", "noscript"]):
        junk.decompose()

    figure_map: dict[str, Figure] = {}
    figures: list[Figure] = []
    figure_counter = 1

    for img in container.find_all("img"):
        if not is_probably_case_image(img):
            continue
        src = img.get("src")
        if not src:
            continue
        abs_url = urljoin(page.url, src)
        if abs_url in figure_map:
            continue

        path = urlparse(abs_url).path
        suffix = Path(path).suffix.lower() or ".jpg"
        if suffix not in {".jpg", ".jpeg", ".png", ".gif"}:
            suffix = ".jpg"

        fig = Figure(
            index=figure_counter,
            url=abs_url,
            local_name=f"figure{figure_counter}{suffix}",
            caption=infer_caption(img),
        )
        figure_map[abs_url] = fig
        figures.append(fig)
        figure_counter += 1

    lines: list[str] = []
    emitted_figure_urls: set[str] = set()

    block_tags = {"h1", "h2", "h3", "h4", "h5", "p", "li", "dt", "dd"}

    for node in container.descendants:
        if not isinstance(node, Tag):
            continue

        if node.name == "img":
            src = node.get("src")
            if not src:
                continue
            abs_url = urljoin(page.url, src)
            fig = figure_map.get(abs_url)
            if not fig or abs_url in emitted_figure_urls:
                continue
            emitted_figure_urls.add(abs_url)
            lines.append("")
            lines.append(f"Figure {fig.index}. {fig.caption}")
            lines.append("")
            continue

        if node.name not in block_tags:
            continue

        if node.name == "dd":
            # For this site, section body text often lives as direct DD text,
            # while nested P tags are captured separately.
            direct_parts = [normalize_whitespace(str(s)) for s in node.find_all(string=True, recursive=False)]
            direct_parts = [part for part in direct_parts if part]
            text = normalize_whitespace(" ".join(direct_parts))
        else:
            text = normalize_whitespace(node.get_text(" ", strip=True))
        if not text:
            continue
        if re.search(r"view\s+larger\s*/\s*more\s+info", text, flags=re.IGNORECASE):
            continue
        if looks_like_nav_line(text):
            continue
        if len(text) <= 18 and text.lower() in NAV_FRAGMENTS:
            continue
        lines.append(text)

    cleaned_lines: list[str] = []
    previous = None
    for line in lines:
        line = normalize_whitespace(line)
        if not line:
            if cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
            continue
        if line == previous:
            continue
        cleaned_lines.append(line)
        previous = line

    text = "\n".join(cleaned_lines)
    text = normalize_whitespace(text)
    text = clean_case_text_window(text)

    body_text = normalize_whitespace(soup.get_text("\n", strip=True))
    display_case_number = infer_display_case_number(body_text)
    return text, figures, display_case_number


def clean_case_text_window(text: str) -> str:
    lines = [normalize_whitespace(ln) for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]

    # Drop inline quiz/poll blocks if they leak in.
    quiz_start = re.compile(r"^what is (the )?diagnosis\??$", re.IGNORECASE)
    quiz_noise = re.compile(
        r"(check answer|select one|correct answer|incorrect|submit answer|choice\s*[a-f])",
        re.IGNORECASE,
    )
    section_heading = re.compile(
        r"^(history of present illness|past medical history|medications|allergies|social history|"
        r"epidemiological history|physical examination|studies|clinical course prior to diagnosis|"
        r"diagnostic procedure\(s\) and result\(s\)|treatment and followup|discussion|final diagnosis|references)$",
        re.IGNORECASE,
    )

    filtered: list[str] = []
    skipping_quiz = False
    for ln in lines:
        if quiz_start.match(ln):
            skipping_quiz = True
            continue
        if skipping_quiz:
            if section_heading.match(ln):
                skipping_quiz = False
                filtered.append(ln)
            elif quiz_noise.search(ln):
                continue
            elif ln.startswith("Figure "):
                continue
            else:
                continue
            continue
        filtered.append(ln)

    lines = filtered

    # Trim strictly to the clinical narrative window.
    start_idx = None
    for i, ln in enumerate(lines):
        if re.match(r"^history of present illness$", ln, re.IGNORECASE):
            start_idx = i
            break
    if start_idx is not None:
        lines = lines[start_idx:]

    end_idx = None
    for i, ln in enumerate(lines):
        if re.match(r"^references$", ln, re.IGNORECASE):
            end_idx = i
            break
    if end_idx is not None:
        kept = lines[: end_idx + 1]
        stop_patterns = [
            r"^view related articles in pubmed$",
            r"^healthcare professionals are advised",
            r"^about this case$",
            r"^tools$",
            r"^related$",
            r"^featured case$",
        ]
        for ln in lines[end_idx + 1 :]:
            if any(re.match(pat, ln, re.IGNORECASE) for pat in stop_patterns):
                break
            kept.append(ln)
        lines = kept

    return normalize_whitespace("\n".join(lines))


def infer_display_case_number(page_text: str) -> str | None:
    patterns = [
        r"\bcase\s*(?:number|no\.?|#)?\s*[:\-]?\s*(\d{5})\b",
        r"\bfeatured\s*case\s*[:\-]?\s*(\d{5})\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, page_text, flags=re.IGNORECASE)
        if match:
            return match.group(1)
    return None


def download_figure(context: BrowserContext, fig: Figure, output_path: Path) -> None:
    response = context.request.get(fig.url)
    if not response.ok:
        raise RuntimeError(f"Failed to download {fig.url} (HTTP {response.status})")
    output_path.write_bytes(response.body())


def inject_model_descriptions(case_text: str, figures: Iterable[Figure]) -> str:
    lines = case_text.splitlines()
    by_index = {fig.index: fig for fig in figures}
    updated_lines: list[str] = []
    fig_line_pattern = re.compile(r"^Figure\s+(\d+)\.", flags=re.IGNORECASE)

    for line in lines:
        updated_lines.append(line)
        match = fig_line_pattern.match(line.strip())
        if not match:
            continue
        idx = int(match.group(1))
        fig = by_index.get(idx)
        if fig and fig.model_description:
            updated_lines.append(f"Image description: {fig.model_description}")

    return normalize_whitespace("\n".join(updated_lines))


def scrape_case(
    context: BrowserContext,
    page: Page,
    case_id: int,
    output_root: Path,
    overwrite: bool,
    captioner: Captioner | None,
    folder_id_mode: str,
) -> None:
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
        raise FileExistsError(f"{text_path} already exists. Use --overwrite to replace.")

    for fig in figures:
        figure_path = case_dir / fig.local_name
        if figure_path.exists() and not overwrite:
            continue
        download_figure(context, fig, figure_path)

        if captioner is not None:
            try:
                fig.model_description = captioner.caption(figure_path)
            except Exception as exc:
                fig.model_description = f"Caption generation failed: {exc}"

    if captioner is not None:
        case_text = inject_model_descriptions(case_text, figures)

    text_path.write_text(case_text + "\n", encoding="utf-8")

    mapped = f" (display case {display_case_number})" if display_case_number else ""
    print(f"[ok] CaseID {case_id}{mapped}: wrote {text_path} and {len(figures)} figure(s)")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Scrape ID Images case studies into local case folders.")

    parser.add_argument("--case-ids", help="Comma or whitespace-separated list of case IDs (e.g. '12,7011,8003').")
    parser.add_argument("--case-id-file", help="Text file with one case ID per line.")
    parser.add_argument("--case-id-start", type=int, help="Start of inclusive case ID range.")
    parser.add_argument("--case-id-end", type=int, help="End of inclusive case ID range.")
    parser.add_argument("--search-query", help="Keyword/organism search query (e.g. 'Staphylococcus aureus').")
    parser.add_argument(
        "--search-type",
        choices=["Cases", "Images", "Atlas"],
        default="Cases",
        help="Top-nav search type for --search-query (default: Cases).",
    )

    parser.add_argument("--output-dir", default="data/cases/ID_Images", help="Output root directory (default: data/cases/ID_Images).")
    parser.add_argument(
        "--storage-state",
        default=str(DEFAULT_STORAGE_STATE),
        help=f"Path to Playwright storage state JSON (default: {DEFAULT_STORAGE_STATE}).",
    )

    parser.add_argument("--headless", action="store_true", help="Run browser headless.")
    parser.add_argument("--headed", action="store_true", help="Force headed browser.")
    parser.add_argument("--interactive-login", action="store_true", help="Login manually in browser and save state.")

    parser.add_argument("--email", help="Login email (if not using interactive login).")
    parser.add_argument("--password", help="Login password (if not using interactive login).")

    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing case_text/image files.")
    parser.add_argument("--caption-model", help="Optional BLIP model name for open-source image captions.")
    parser.add_argument("--auth-only", action="store_true", help="Authenticate and save session state, then exit.")
    parser.add_argument(
        "--folder-id-mode",
        choices=["case-id", "display-number"],
        default="display-number",
        help="Folder naming mode: use URL CaseID or detected 5-digit display case number (default: display-number).",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    explicit_case_args_used = any(
        [
            bool(args.case_ids),
            bool(args.case_id_file),
            args.case_id_start is not None,
            args.case_id_end is not None,
        ]
    )

    case_ids: list[int] = []
    if not args.auth_only and explicit_case_args_used:
        try:
            case_ids = parse_case_ids(args)
        except Exception as exc:
            parser.error(str(exc))

    if not args.auth_only and not case_ids and not args.search_query:
        parser.error("No scraping target provided. Use case IDs/range/file or --search-query.")

    output_root = Path(args.output_dir)
    storage_state_path = Path(args.storage_state)
    email = args.email or os.environ.get("IDIMAGES_EMAIL")
    password = args.password or os.environ.get("IDIMAGES_PASSWORD")

    if args.headed:
        headless = False
    elif args.headless:
        headless = True
    else:
        headless = True
    captioner = Captioner(args.caption_model) if args.caption_model else None

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
            protected_check_url=CASE_URL_TEMPLATE.format(case_id=(case_ids[0] if case_ids else 12)),
        )

        if args.auth_only:
            print("[ok] Authentication complete. No scraping requested (--auth-only).")
            failures: list[tuple[int, str]] = []
        else:
            target_case_ids: set[int] = set(case_ids)
            if args.search_query:
                searched = collect_case_ids_from_search(page, search_query=args.search_query, search_type=args.search_type)
                target_case_ids.update(searched)

            if not target_case_ids:
                raise RuntimeError("No case IDs resolved from inputs/search.")

            failures = []
            for case_id in sorted(target_case_ids):
                try:
                    scrape_case(
                        context=context,
                        page=page,
                        case_id=case_id,
                        output_root=output_root,
                        overwrite=args.overwrite,
                        captioner=captioner,
                        folder_id_mode=args.folder_id_mode,
                    )
                except Exception as exc:
                    failures.append((case_id, str(exc)))
                    print(f"[error] Case {case_id}: {exc}")

        storage_state_path.parent.mkdir(parents=True, exist_ok=True)
        context.storage_state(path=str(storage_state_path))
        context.close()
        browser.close()

    if failures:
        print("\nFinished with errors:")
        for case_id, err in failures:
            print(f"  - Case {case_id}: {err}")
        return 1

    print("\nFinished successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
