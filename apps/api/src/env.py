import os

from dotenv import load_dotenv

# load_dotenv() is a no-op when vars are already set (e.g. Railway), safe to call always
load_dotenv()


def _collect() -> tuple[list[str], list[str]]:
    missing: list[str] = []

    def require(key: str) -> str:
        val = os.environ.get(key, "").strip()
        if not val:
            missing.append(key)
        return val

    allowed_origins_raw = require("ALLOWED_ORIGINS")
    internal_secret = require("INTERNAL_SECRET")
    convex_url = require("CONVEX_URL")
    anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    return missing, [allowed_origins_raw, internal_secret, convex_url, anthropic_api_key]


_missing, _values = _collect()
if _missing:
    raise RuntimeError(
        "❌ Missing required environment variables:\n"
        + "\n".join(f"  {k}" for k in _missing)
    )

_allowed_origins_raw, _internal_secret, _convex_url, _anthropic_api_key = _values


class _Env:
    # Comma-separated origins → list; set ALLOWED_ORIGINS=https://app.example.com on Railway
    allowed_origins: list[str] = [o for o in _allowed_origins_raw.split(",") if o.strip()]
    internal_secret: str = _internal_secret
    convex_url: str = _convex_url
    anthropic_api_key: str = _anthropic_api_key  # optional; LLM cleaning disabled if absent


env = _Env()
