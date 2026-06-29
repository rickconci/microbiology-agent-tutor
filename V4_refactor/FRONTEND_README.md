# docent.ID — Frontend Overhaul (`optimization/frontend` branch)

This branch replaces the original Jinja2/HTMX frontend with a React (Vite) single-page application. The backend (FastAPI, V4_refactor) is unchanged except for two additions: a static case library API and graceful startup without API credentials.

---

## What changed in this branch

### New React frontend (`V4_refactor/frontend/`)

A complete rewrite of the UI in React 19 + Vite. All styling is done with inline CSS variables (no external CSS framework) supporting full light/dark mode.

**Pages and features:**
- **Login** — username/password (hardcoded `admin`/`admin` for now; replace with real auth)
- **Setup screen** — type-ahead organism search, module selection (History Taking, Differential Diagnosis, Management, Pathophys & Epidemiology)
- **Chat screen** — 3-column layout: Case Summary + Curbside Consult | Chat | Electronic Medical Record
  - Per-module progress bars, module switching mid-case
  - Random case mode with organism name hidden until revealed
  - Curbside Consult hits `/api/v1/clarify` for quick questions without disrupting the case
- **Case Library** — all 592 scraped MGH ID Images cases, searchable by title/history/diagnosis
  - Sticky search bar, sticky column headers
  - Click any row to open a tabbed case detail page (History, Exam/Studies, Diagnosis, More Info, Single Page)
  - Collapsible figure images inline with text
  - Loads entirely from static files — **no API key required**
- **About** pages — Overview, Architecture, The Team (content TBD)
- **How it works** modal

### Backend changes (`V4_refactor/src/`)

| File | Change |
|------|--------|
| `api/app.py` | Registers `cases` router; mounts `/case-images` as static files |
| `api/routes/cases.py` | **New.** Serves `case_library.json` via `/api/v1/cases` and `/api/v1/cases/{id}` |
| `services/case/case_loader.py` | Wraps `CaseGeneratorRAGAgent()` instantiation in try/except so the server starts without API credentials |

### Static data files

| File | Location |
|------|----------|
| `case_library.json` | `V4_refactor/data/cases/` and `V4_refactor/frontend/public/` |
| Case images (2,123 JPGs) | `V4_refactor/data/cases/ID_Images/All_cases/` and `V4_refactor/frontend/public/case-images/` |

The `case_library.json` has the following structure per case:

```json
{
  "id": "Case_01001",
  "title": "An HIV-positive male with fever, cough, and skin lesions.",
  "history": "...",
  "exam_studies": "...",
  "diagnosis": "...",
  "more_info": "...",
  "figures": ["figure1.jpg", "figure2.jpg"],
  "tags": []
}
```

The `tags` field is intentionally empty — see **Adding tags** below.

---

## Running locally

### Prerequisites

- Python 3.11 (via conda recommended)
- Node.js 18+ and npm (`brew install node` on Mac)

### 1. Create the conda environment

```bash
conda create -n docent python=3.11
conda activate docent
cd microbiology-agent-tutor/V4_refactor
pip install -r requirements.txt
```

### 2. Start the backend

```bash
cd microbiology-agent-tutor/V4_refactor
conda activate docent
python run.py
```

The backend starts at **http://localhost:5001**. It will print warnings about missing credentials — this is expected. The case library and all static routes work without credentials. Only the LLM-powered chat (`/api/v1/start_case`, `/api/v1/chat`) requires an API key.

### 3. Install frontend dependencies (first time only)

```bash
cd microbiology-agent-tutor/V4_refactor/frontend
npm install
```

### 4. Copy static assets (first time only)

The case images and JSON need to be in the Vite `public` folder:

```bash
# From the repo root
cp V4_refactor/data/cases/case_library.json V4_refactor/frontend/public/case_library.json
cp -r V4_refactor/data/cases/ID_Images/All_cases V4_refactor/frontend/public/case-images
```

> **Note:** The `case-images` folder is ~127 MB and is gitignored. This copy step is required after a fresh clone.

### 5. Start the frontend dev server

```bash
cd microbiology-agent-tutor/V4_refactor/frontend
npm run dev
```

The app is available at **http://localhost:5173**

During development, Vite proxies all `/api/...` requests to the backend at `localhost:5001` (configured in `vite.config.js`). No CORS issues.

### VS Code shortcut

Open the repo root in VS Code and press `Cmd+Shift+B`. This runs the default build task **"Start docent.ID (backend + frontend)"**, launching both servers in parallel terminal panels. F5 launches the backend in debug mode.

---

## Connecting the LLM (OpenAI / Azure OpenAI)

Create a file called `dot_env_microtutor.txt` in `V4_refactor/` — this file is gitignored, never commit it.

**Standard OpenAI:**
```
USE_AZURE_OPENAI=false
OPENAI_API_KEY=sk-...
```

**Azure OpenAI:**
```
USE_AZURE_OPENAI=true
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
```

Restart the backend after creating this file. The chat screen will then be fully functional.

---

## Adding tags to cases (for the NLP team)

The `case_library.json` has a `tags` field (currently `[]`) on every case. Tags will be used to:

1. Filter the Case Library by organism, infectious syndrome, and host characteristics
2. Power the organism search on the Setup screen

### Tag schema

Tags are stored as a flat array of prefixed strings:

```json
"tags": [
  "organism:Staphylococcus aureus",
  "syndrome:skin and soft tissue infection",
  "host:immunocompetent adult",
  "host:healthcare worker"
]
```

Using a `type:value` prefix keeps tags queryable without needing a separate schema. Multiple tags of the same type are allowed.

### Workflow

1. Run your NLP tagging pipeline against `V4_refactor/data/cases/case_library.json`
2. Populate the `tags` array for each case and save
3. Copy the updated file to the frontend public folder:
   ```bash
   cp V4_refactor/data/cases/case_library.json V4_refactor/frontend/public/case_library.json
   ```
4. The frontend picks up the new tags on next page load — no code changes needed until the filter UI is wired up

### Suggested NLP approach

- **Organism tags** — extract from the `diagnosis` field (contains Final Diagnosis + Discussion); the organism name is almost always in the first sentence
- **Syndrome tags** — extract from `diagnosis` and `title`; look for the clinical presentation pattern
- **Host tags** — extract from `history`; look for age descriptors, comorbidities, immunosuppression, travel, occupation, exposures

A few-shot GPT extraction prompt on these fields works well given the highly structured nature of the MGH case text.

---

## Building for production

```bash
cd V4_refactor/frontend
npm run build
```

Compiles the React app into `V4_refactor/src/microtutor/api/static/react/`. FastAPI serves it at the root URL when deployed to Render.

---

## Branch status

| Feature | Status |
|---------|--------|
| React frontend | ✅ Complete |
| Case library — 592 MGH cases, all figures | ✅ Complete |
| Chat screen — 3-column layout, module tabs | ✅ Complete |
| Curbside consult | ✅ Complete |
| Light / dark mode | ✅ Complete |
| Random case (organism hidden) | ✅ Complete |
| About / How it works / Case library pages | ✅ Complete |
| LLM chat (start_case, chat) | ⏳ Requires API key |
| Case tags and library filters | ⏳ NLP tagging pending |
| My history page | ⏳ Requires backend session tracking |
| About — team bios and architecture docs | ⏳ Content TBD |
| Real authentication | ⏳ Hardcoded admin/admin for now |
