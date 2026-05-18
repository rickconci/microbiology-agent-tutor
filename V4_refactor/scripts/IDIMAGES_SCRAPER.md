# ID Images Scraper

This script exports case studies from `idimages.org` into your existing manual-case format:

- `ID_Images/Case_#####/case_text.txt`
- `ID_Images/Case_#####/figure1.jpg`, `figure2.jpg`, ...

Script path: `scripts/idimages_scraper.py`

For keyword collections, save directly to:

- `ID_Images/Staphylococcus_aureus/Case_#####/...`
- `ID_Images/Nocardia/Case_#####/...`
- `ID_Images/Encephalitis/Case_#####/...`

## 1) Install dependencies

```bash
pip install playwright beautifulsoup4
python -m playwright install chromium
```

Optional image captions (open-source BLIP VLM):

```bash
pip install transformers pillow torch
```

## 2) Save authenticated session once

This opens a browser so you can log in manually with your MGB credentials.

```bash
python scripts/idimages_scraper.py \
  --auth-only \
  --interactive-login \
  --headed
```

Session state is saved by default to:

`~/.config/idimages_scraper/storage_state.json`

## 3) Scrape specific case IDs

```bash
python scripts/idimages_scraper.py --case-ids "12,7011,8003"
```

Or from a file (`case_ids.txt`, one per line):

```bash
python scripts/idimages_scraper.py --case-id-file case_ids.txt
```

Or a range:

```bash
python scripts/idimages_scraper.py --case-id-start 7000 --case-id-end 7050
```

## 3b) Scrape by organism/keyword search

This runs the site search (top nav) and scrapes all matching case links.

```bash
python scripts/idimages_scraper.py \
  --search-query "Staphylococcus aureus" \
  --search-type Cases \
  --output-dir "ID_Images/Staphylococcus_aureus" \
  --overwrite
```

Notes:
- `--search-type` can be `Cases`, `Images`, or `Atlas` (use `Cases` here).
- `--overwrite` is useful to refresh existing case folders you already have.
- Set `--output-dir` to the keyword folder you want (for example `ID_Images/Nocardia`).

Example for another keyword:

```bash
python scripts/idimages_scraper.py \
  --search-query "encephalitis" \
  --search-type Cases \
  --output-dir "ID_Images/Encephalitis" \
  --overwrite
```

## 3c) Scrape ALL cases (chunked + resumable)

For bulk-scraping every case in the site's `/idreview/browse/all/` listing into
a single folder, use the companion script `idimages_scrape_all.py`. It is
chunked and resumable so you can scrape ~100 cases at a time, commit/push, and
continue later.

Output layout:

```
data/cases/ID_Images/All_cases/
  _index.json        # master CaseID list (built once from browse/all/)
  _progress.json     # tracks {scraped: [...], failed: {cid: msg}}
  Case_#####/
    case_text.txt
    figure1.jpg
    ...
```

One-time index build (visits `https://www.idimages.org/idreview/browse/all/`):

```bash
python scripts/idimages_scrape_all.py --refresh-index --dry-run
```

Scrape the next 100 unscraped cases:

```bash
python scripts/idimages_scrape_all.py
```

Common flags:

- `--chunk-size 50` — change cases per invocation (default 100).
- `--start-from 7000` — skip CaseIDs below this number (resume hint).
- `--retry-failed` — re-attempt previously failed cases.
- `--overwrite` — re-scrape even if `case_text.txt` already exists.
- `--dry-run` — print the chunk plan but don't fetch.
- `--rebuild-progress` — repopulate `_progress.json` by scanning existing
  `Case_*` folders on disk (useful if you scraped some cases manually).

Progress is persisted after every case, so an interrupted run will resume
exactly where it stopped on the next invocation.

## 4) Add automatic figure descriptions (optional)

```bash
python scripts/idimages_scraper.py \
  --case-ids "7011" \
  --caption-model "Salesforce/blip-image-captioning-base"
```

This adds lines like `Image description: ...` under each `Figure N.` line.

## Notes

- Use `--overwrite` to replace existing files in a case folder.
- Use `--output-dir` if you want a different output root.
- Default folder naming is `--folder-id-mode display-number` (uses 5-digit case number shown on page).
- Use `--folder-id-mode case-id` if you prefer URL `CaseID` folder names instead.
- If your session expires, rerun step 2.
- Respect ID Images terms of use and avoid excessive request rates.
