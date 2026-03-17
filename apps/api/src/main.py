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
    provider = env.llm_provider
    active_key = env.anthropic_api_key if provider == "anthropic" else env.gemini_api_key
    if active_key:
        _startup_logger.info("LLM cleaning enabled — provider=%s model=%s", provider, env.llm_model)
    else:
        key_name = "ANTHROPIC_API_KEY" if provider == "anthropic" else "GEMINI_API_KEY"
        _startup_logger.warning("LLM cleaning DISABLED — %s not set (LLM_PROVIDER=%s)", key_name, provider)
    yield


app = FastAPI(title="HearSay API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=env.allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router)
