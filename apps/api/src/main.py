import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.env import env
from src.routers import ocr

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


MODELS_DIR = Path(__file__).parent.parent / "models"


_startup_logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    MODELS_DIR.mkdir(exist_ok=True)
    if env.anthropic_api_key:
        _startup_logger.info("LLM cleaning enabled (ANTHROPIC_API_KEY set)")
    else:
        _startup_logger.warning("LLM cleaning DISABLED — ANTHROPIC_API_KEY not set")
    yield


app = FastAPI(title="HearSay API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=env.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router)
