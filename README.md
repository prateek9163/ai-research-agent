#  AI Research Agent — Multi-Agent Research System

A full-stack, multi-agent AI system that takes a research topic, **searches the web, reads the most relevant source, writes a structured report, and then critiques its own work** — all from one request.

The backend is a **FastAPI + LangChain** pipeline powered by **Google Gemini 2.5 Flash** and **Tavily Search**. The frontend is a **React + Vite + Tailwind** dashboard that shows the agent pipeline, live activity logs, the final report, the sources and the critic's score.

---

## Features

- **Four specialised agents** working in sequence: Search → Reader → Writer → Critic
- **Real web research** through the Tavily Search API (top 5 results with titles, URLs and snippets)
- **Page scraping** with `requests` + BeautifulSoup (scripts, styles, nav and footers stripped out)
- **Structured reports** with Introduction, Key Findings (3+ points), Conclusion and Sources
- **Self-critique**: every report gets a score out of 10, strengths, areas to improve and a one-line verdict
- **Production-minded API**: input validation, a 120-second pipeline timeout, per-IP rate limiting (5 requests/min), CORS rules and structured logging
- **Dashboard UI**: pipeline graph, agent status cards with progress bars, a live log console, and tabs for Report / Sources / Critic / Raw JSON
- Collapsible sidebar and a responsive mobile layout (slide-in menu on small screens)


---

##  Architecture

```
┌──────────────┐  POST /api/research   ┌─────────────────────────────────────────────────┐
│   React UI   │ ────────────────────▶ │                 FastAPI (api.py)                │
│  (Vite, :5173)│ ◀──────────────────── │  validation · rate limit · timeout · CORS       │
└──────────────┘     JSON response     └────────────────────────┬────────────────────────┘
                                                                │ asyncio.to_thread
                                                                ▼
                                         ┌─────────────────────────────────────────┐
                                         │      run_research_pipeline (pipeline.py) │
                                         └─────────────────────────────────────────┘
   ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    ┌───────────────┐
   │ Search     │ ─▶ │   Reader     │ ─▶ │    Writer      │ ─▶ │   Critic     │
   │ Agent         │    │ Agent         │    │ Chain         │    │ Chain         │
   │ tool:         │    │ tool:         │    │ prompt → LLM  │    │ prompt → LLM  │
   │ web_search    │    │ scrape_url    │    │ → report      │    │ → score/review│
   │ (Tavily)      │    │ (BS4)         │    │               │    │               │
   └───────────────┘    └───────────────┘    └───────────────┘    └───────────────┘
                         All four use Gemini 2.5 Flash (temperature 0)
```

### How the pipeline works

| Step | Component | Type | What it does |
|------|-----------|------|--------------|
| 1 | **Search Agent** | LangChain tool-calling agent | Calls `web_search` (Tavily, `max_results=5`) to find recent, reliable information. Each result is returned as title, URL and a 300-character snippet. |
| 2 | **Reader Agent** | LangChain tool-calling agent | Gets the first 800 characters of the search results, picks the most relevant URL and calls `scrape_url`, which returns up to 3,000 characters of clean page text. |
| 3 | **Writer Chain** | LCEL chain (`prompt \| llm \| parser`) | Combines the search results and scraped content into a professional report: Introduction, Key Findings, Conclusion, Sources. |
| 4 | **Critic Chain** | LCEL chain | Reviews the report and returns `Score: X/10`, Strengths, Areas to Improve and a one-line verdict. |

The helper `_to_str()` in `pipeline.py` normalises the different output shapes (plain strings, LangChain messages, lists of content blocks) into plain text, so the API always returns strings.

---

## Project Structure

```
ai-research-agent/
├── Backend/
│   ├── .gitignore
│   └── backend/
│       ├── __init__.py
│       ├── agents.py        # Gemini LLM, Search/Reader agents, Writer/Critic chains
│       ├── tools.py         # web_search (Tavily) and scrape_url (BeautifulSoup) tools
│       ├── pipeline.py      # Orchestrates the 4-step pipeline (also runnable from the CLI)
│       ├── api.py           # FastAPI app: endpoints, validation, rate limiting, CORS
│       └── requirements.txt
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts       # React + Tailwind v4 plugins,
    └── src/
        ├── main.tsx
        ├── app/
        │   ├── App.tsx      # The whole dashboard (pages, agent cards, tabs, API call)
        │   └── components/ui/  # shadcn/ui-style Radix components
        └── styles/          # Tailwind, theme and font CSS
```

---

## 🛠️ Tech Stack

**Backend**
- Python 3.10+
- [LangChain](https://python.langchain.com/) (tool-calling agents, `AgentExecutor`, LCEL chains)
- [Google Gemini 2.5 Flash](https://ai.google.dev/) via `langchain-google-genai`
- [Tavily](https://tavily.com/) search API
- BeautifulSoup4 + Requests for scraping
- FastAPI + Uvicorn, Pydantic v2, SlowAPI (rate limiting), python-dotenv, Rich

**Frontend**
- React 18 + TypeScript, Vite 6
- Tailwind CSS v4
- Radix UI / shadcn-style components, Lucide icons
- Motion (Framer Motion) for animations, Recharts for charts, Sonner for toasts

---

##  Getting Started

### Prerequisites

- Python **3.10+**
- Node.js **18+** and npm
- A **Google Gemini API key** from [Google AI Studio](https://aistudio.google.com/app/apikey)
- A **Tavily API key** from [tavily.com](https://tavily.com/)

### 1. Clone the repository

```bash
git clone https://github.com/prateek9163/ai-research-agent.git
cd ai-research-agent
```

### 2. Set up the backend

```bash
cd Backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Run the backend

From inside the `Backend/` folder (so the `backend.` package imports resolve):

```bash
uvicorn backend.api:app --reload --port 8000
```

Check that it's running:

```bash
curl http://localhost:8000/api/health
# {"status":"ok"}
```

Interactive API docs are at **http://localhost:8000/docs**.

### 4. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**, enter a topic and click start.

### Optional: run the pipeline from the command line

No frontend needed:

```bash
cd Backend
python -m backend.pipeline
# Enter a research topic: Future of solid-state batteries
```

Each step's output is printed to the terminal, and the agents run with `verbose=True`, so you can watch the tool calls.

---

##  API Reference

### `GET /api/health`

Health check.

```json
{ "status": "ok" }
```

### `POST /api/research`

Runs the full multi-agent pipeline on a topic.

**Request**

```json
{ "topic": "Future of Agentic AI" }
```

| Field | Type | Rules |
|-------|------|-------|
| `topic` | string | Required. Leading and trailing whitespace is trimmed. Must not be empty and must be 500 characters or fewer. |

**Response `200 OK`**

```json
{
  "topic": "Future of Agentic AI",
  "search_result": "Title: ...\nURL: ...\nSnippet: ...\n----\n...",
  "scraped_content": "…clean text from the most relevant page…",
  "report": "Introduction ... Key Findings ... Conclusion ... Sources ...",
  "feedback": "Score: 8/10\n\nStrengths:\n- ...\n\nAreas to Improve:\n- ...\n\nOne line verdict:\n..."
}
```
