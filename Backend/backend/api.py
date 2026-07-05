import asyncio
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from backend.pipeline import run_research_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

limiter = Limiter(key_func=get_remote_address, default_limits=["5/minute"])

app = FastAPI(title="Multi-Agent Research API")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        # Add your deployed URL
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

PIPELINE_TIMEOUT = 120.0

class ResearchRequest(BaseModel):
    topic: str

    @field_validator("topic")
    @classmethod
    def topic_must_be_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Topic cannot be empty.")
        if len(v) > 500:
            raise ValueError("Topic must be 500 characters or fewer.")
        return v


class ResearchResponse(BaseModel):
    topic: str
    search_result: str
    scraped_content: str
    report: str
    feedback: str

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/research", response_model=ResearchResponse)
@limiter.limit("5/minute")
async def research(request: Request, body: ResearchRequest):
    """
    Run the multi-agent research pipeline for a given topic.

    - Validation is handled by Pydantic (422 on bad input).
    - The synchronous pipeline is offloaded to a thread so the event loop
      is never blocked.
    - A 2-minute timeout prevents hung LLM / scraping calls.
    - Rate-limited to 5 requests per minute per IP.
    """
    logger.info("Research request received | topic=%r", body.topic)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(run_research_pipeline, body.topic),
            timeout=PIPELINE_TIMEOUT,
        )
    except asyncio.TimeoutError:
        logger.warning("Pipeline timed out | topic=%r", body.topic)
        raise HTTPException(
            status_code=504,
            detail="The research pipeline timed out. Try a narrower topic.",
        )
    except Exception:
        logger.exception("Pipeline failed | topic=%r", body.topic)
        raise HTTPException(
            status_code=500,
            detail="The research pipeline encountered an error. Check server logs.",
        )

    return ResearchResponse(
        topic=body.topic,
        search_result=result.get("search_result", ""),
        scraped_content=result.get("scraped_content", ""),
        report=result.get("report", ""),
        feedback=result.get("feedback", ""),
    )