# MicroTutor (`src_simplified`)

A FastAPI app that runs a microbiology case as a **set of tutoring modules**, each backed by its own LLM agent. Sessions live in memory; cases are loaded from disk.

---

## Quick start

```bash
cd V4_refactor
./run_simplified.sh                     # loads dot_env_microtutor.txt if present
# or, manually:
PYTHONPATH=. uvicorn src_simplified.app:app --reload --port 5001
```

Open <http://localhost:5001>. Required env: `OPENAI_API_KEY` (see `config/config.py` for the rest).

---

## Layout

```
src_simplified/
├── app.py                  # FastAPI: routes + in-memory session dict
├── prompts.py              # Every system prompt used by orchestrator/agents
├── config/config.py        # Env-var-driven config (model, paths, feedback flags)
├── agents/
│   ├── orchestrator.py     # Module pipeline, routing, EMR/checklist threads
│   ├── base_agent.py       # Shared chat() helper around chat_complete()
│   ├── patient_agent.py    # → history_taking
│   ├── ddx_agent.py        # → ddx_deep_dive
│   ├── tx_agent.py         # → tx_deep_dive
│   ├── pathophys_epi_agent.py  # → pathophys_epi
│   ├── quiz_agent.py       # MCQs after each deep-dive (when enabled)
│   └── feedback_agent.py   # → feedback (always last)
├── tools/
│   ├── csv_tool.py         # "Crucial factors" lookup per organism
│   └── feedback_tool.py    # Append feedback to JSON; optional FAISS index
├── utils/
│   ├── llm.py              # chat_complete() — thin OpenAI wrapper
│   └── case_loader.py      # Singleton: loads cached HPI + ID_Images tree
└── api/
    ├── static/             # CSS + JS (vanilla, no build step)
    └── templates/          # Jinja2 partials
```

Cases come from two sources, both under `V4_refactor/data/cases/`:

- `cached/HPI_per_organism.json` — short text-only HPIs keyed by organism name.
- `ID_Images/<Organism>/Case_<id>/case_text.txt` (+ `figureN.jpg`) — full scraped cases with images.

`CaseLoader` is a singleton: the disk scan runs once at first import, and every later `CaseLoader()` call returns the same instance.

---

## End-to-end flow

### 1. `POST /api/v1/start_case`

Creates an `Orchestrator(organism, selected_modules, ...)` and stores it in `sessions[case_id]`. The orchestrator picks the case from `CaseLoader`, builds the module queue (always followed by `feedback`), and instantiates only the agents it needs.

### 2. `POST /api/v1/chat`

Each turn:

1. Look up `sessions[case_id]` (or rebuild from `organism_key` + history if expired).
2. Append the user message to `orchestrator.conversation_history`.
3. Decide whether to advance the module (explicit "move to ddx" requests are parsed; otherwise the active agent stays).
4. Route to the active agent's `chat()`, or to `_manager_phase_chat()` for orchestrator-only modules.
5. Optionally attach an image, update the EMR-notes / findings-checklist snapshots (background thread), and return the response with metadata.

### 3. Module pipeline

```
history_taking → ddx_deep_dive → tx_deep_dive → pathophys_epi → feedback
```

The user picks any subset; `feedback` is always appended. Order is canonical (`MODULE_ORDER` in `orchestrator.py`).

If MCQs are enabled, `QuizAgent.generate_quiz()` runs once at the end of each deep-dive module before moving on.

### 4. Other routes

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/api/v1/organisms` | List of cached + manual case keys (powers the dropdown) |
| `GET`  | `/api/v1/emr_notes/{case_id}` | Snapshot of EMR notes + findings checklist (poll target) |
| `POST` | `/api/v1/emr_refresh/{case_id}` | Force a full EMR rebuild from the conversation |
| `POST` | `/api/v1/feedback`, `/api/v1/case_feedback` | Append feedback to `data/feedback_auto/new_feedback.json` |
| `POST` | `/api/v1/clarify` | One-off clarifying question (no session needed) |
| `GET`  | `/api/v1/analytics/feedback/stats`, `…/trends` | Dashboard data |
| `GET`  | `/api/v1/faiss/reindex-status`, `POST /api/v1/faiss/update` | FAISS feedback index admin (no-op when disabled) |
| `GET`  | `/api/v1/guidelines/{health,sources}` | Stubs (guidelines feature not implemented here) |

---

## Error handling

Errors are **not swallowed** anywhere in the core. Specifically:

- `CaseLoader`: missing files raise `FileNotFoundError`, malformed JSON raises `json.JSONDecodeError`, unknown case keys raise `KeyError`.
- `CSVTool`: missing CSV → `FileNotFoundError`; missing `concept` column → `ValueError`.
- `FeedbackTool`: malformed `new_feedback.json` raises `ValueError`; FAISS unavailability degrades gracefully (with a warning).
- `chat_complete`: OpenAI errors are logged with full traceback and re-raised; agents do **not** wrap them in fake responses.
- `app.py` route handlers convert known errors to HTTP responses (`KeyError` → 404, LLM failure in `/clarify` → 502, anything else → 500 with the traceback in logs).

---

## Tests

```bash
cd V4_refactor
pip install -r requirements-dev.txt
pytest tests/ -v
```

Covers the pure-Python core (`case_loader`, `csv_tool`, `feedback_tool`) and the no-LLM endpoints (`/organisms`, `/start_case` 404 path, `/feedback`, `/guidelines/health`). LLM-dependent paths are mocked via `monkeypatch` rather than hit live.

---

## Known limitations (vs full `src/`)

- **No voice backend** — `/api/v1/voice/*` is not mounted; the frontend voice button will 404.
- **No guidelines RAG** — `POST /guidelines/fetch` is not implemented; only the health/sources stubs exist.
- **No feedback retrieval** — feedback is saved to JSON but never fed back into prompts.
- **No hint or Socratic tool** — agents reply directly; there's no separate hint pipeline.
- **In-memory sessions only** — restarting the process clears `sessions`. The chat endpoint can rebuild a session from `organism_key + history` if needed.
