import asyncio
import json
import logging

from src.env import env

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a text cleaner for a text-to-speech reader. Clean the provided sentences for natural audio playback.

Rules:
- Remove inline citations: [1], [1,2], (Author, 2020), (Author et al., 2020), ibid., op. cit.
- Fix line-break hyphenation: "stu-dying" → "studying", "im-portant" → "important"
- Fix common OCR artifacts: ligatures, garbled characters, stray punctuation mid-word
- Do NOT rewrite, summarize, or change the meaning of any sentence
- Do NOT add or remove sentences — return exactly the same number of items

Return ONLY a JSON array of cleaned strings with no explanation."""


async def _clean_sentences(sentences: list[dict]) -> list[dict]:
    """Clean a list of sentence dicts via Claude. Falls back per-sentence on parse errors."""
    if not sentences:
        return sentences

    import anthropic

    client = anthropic.AsyncAnthropic(api_key=env.anthropic_api_key)
    raw_texts = [s["text"] for s in sentences]

    message = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(raw_texts)}],
    )

    try:
        cleaned_texts: list[str] = json.loads(message.content[0].text)
    except Exception:
        logger.warning("LLM cleaning: failed to parse Claude response as JSON — returning original sentences")
        return sentences

    # Apply index-by-index; fall back per-sentence on count mismatch.
    # Set rawText to original only when text actually changed.
    return [
        {
            **s,
            "text": cleaned_texts[i] if i < len(cleaned_texts) else s["text"],
            **({"rawText": s["text"]} if i < len(cleaned_texts) and cleaned_texts[i] != s["text"] else {}),
        }
        for i, s in enumerate(sentences)
    ]


async def clean_pages(pages: list[dict], chunk_size: int = 40) -> tuple[list[dict], bool]:
    """Clean all sentences across pages using concurrent ordered chunks.

    Flattens sentences globally, splits into chunks of `chunk_size` (each with a
    monotonic chunk_id for ordered reconstruction), processes concurrently, then
    rebuilds the page structure in the original order.

    Returns (cleaned_pages, llm_cleaned) where llm_cleaned=True only if ≥1 sentence changed.
    No-op if ANTHROPIC_API_KEY is unset.
    """
    if not env.anthropic_api_key:
        logger.warning("LLM cleaning skipped: ANTHROPIC_API_KEY is not set")
        return pages, False

    # Flatten all sentences with their source page index
    flat: list[tuple[int, dict]] = [
        (pi, s) for pi, page in enumerate(pages) for s in page["sentences"]
    ]
    if not flat:
        logger.warning("LLM cleaning skipped: no sentences found in pages")
        return pages, False

    # Split into ordered chunks (chunk_id encodes position for reconstruction)
    chunks = [
        {
            "chunk_id": i,
            "sentences": [s for _, s in flat[i : i + chunk_size]],
            "page_idxs": [pi for pi, _ in flat[i : i + chunk_size]],
        }
        for i in range(0, len(flat), chunk_size)
    ]

    # Process all chunks concurrently; gather preserves input order
    cleaned_chunks = await asyncio.gather(
        *[_clean_sentences(c["sentences"]) for c in chunks]
    )

    # Reconstruct pages in original order using chunk_id-ordered results
    page_sentences: list[list[dict]] = [[] for _ in pages]
    for chunk, cleaned_sents in zip(chunks, cleaned_chunks):
        for page_idx, cleaned_sent in zip(chunk["page_idxs"], cleaned_sents):
            page_sentences[page_idx].append(cleaned_sent)

    cleaned_pages = [
        {**page, "sentences": page_sentences[pi], "text": " ".join(s["text"] for s in page_sentences[pi])}
        for pi, page in enumerate(pages)
    ]

    orig_texts = [s["text"] for _, s in flat]
    cleaned_texts = [s["text"] for pi in range(len(pages)) for s in page_sentences[pi]]
    any_changed = any(c != o for c, o in zip(cleaned_texts, orig_texts))

    return cleaned_pages, any_changed
