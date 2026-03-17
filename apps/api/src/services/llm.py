import asyncio
import json
import logging

from src.env import env

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a text cleanup processor preparing OCR-extracted PDF content for text-to-speech (TTS) playback.
Your ONLY job is to REMOVE non-essential content that would disrupt a natural listening experience. You must NOT rewrite, paraphrase, summarise, or alter the remaining text in any way. The output must be a verbatim subset of the input.
REMOVE the following:

Page numbers (e.g. "Page 12", "- 3 -", standalone numbers that are clearly pagination)
Headers and footers that repeat across pages (e.g. chapter titles, document titles, author names, dates appearing as running heads)
Footnote/endnote reference markers (superscript numbers, asterisks, daggers like ¹ ² * † within body text)
Footnote/endnote bodies (the actual footnote text, typically at the bottom of a page or end of a section, beginning with a number or symbol)
Inline citations (e.g. "(Smith, 2020)", "(ibid.)", "[1]", "[12, 15-17]", "(see Figure 3)")
Reference lists / bibliographies (sections listing sources, typically at the end)
Figure/table captions and labels (e.g. "Figure 2.1:", "Table 4:", "Source: ...")
"Table of contents" entries and page reference lists
OCR artifacts and garbled text (random character sequences, broken encoding)
Watermarks or stamps (e.g. "DRAFT", "CONFIDENTIAL", "Downloaded from...")
DOIs, URLs, and ISBNs
Copyright notices and licensing boilerplate
Line numbers (if present in margins)

PRESERVE exactly as-is:

ALL body text, paragraphs, and prose content
All headings and subheadings (these provide structure for the listener)
Block quotes and excerpts (these are part of the content)
Lists (bulleted or numbered) that are part of the main content
Any content where you are unsure whether it is essential — when in doubt, KEEP IT

RULES:

Output ONLY the cleaned text. No explanations, no metadata, no commentary.
Do NOT add any text that was not in the original.
Do NOT rephrase, reword, or restructure any sentence.
Do NOT merge or split paragraphs.
Maintain the original paragraph spacing and logical flow.
If removing a citation leaves awkward punctuation (e.g. "the study found ,"), clean up only the immediate punctuation — nothing else.
If an entire page consists only of removable content (e.g. a references page), omit it entirely.

Return ONLY a JSON array of cleaned strings with no explanation."""


def _apply_cleaned(sentences: list[dict], cleaned_texts: list[str]) -> list[dict]:
    """Merge cleaned texts back onto sentence dicts as cleanedText (text stays as original OCR)."""
    return [
        {
            **s,
            **({"cleanedText": cleaned_texts[i]} if i < len(cleaned_texts) and cleaned_texts[i] != s["text"] else {}),
        }
        for i, s in enumerate(sentences)
    ]


async def _clean_with_anthropic(sentences: list[dict]) -> list[dict]:
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=env.anthropic_api_key)
    raw_texts = [s["text"] for s in sentences]

    message = await client.messages.create(
        model=env.llm_model,
        max_tokens=8192,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(raw_texts)}],
    )

    try:
        cleaned_texts: list[str] = json.loads(message.content[0].text)
    except Exception:
        logger.warning("LLM cleaning (anthropic): failed to parse response as JSON — returning original sentences")
        return sentences

    return _apply_cleaned(sentences, cleaned_texts)


async def _clean_with_gemini(sentences: list[dict]) -> list[dict]:
    import google.generativeai as genai

    genai.configure(api_key=env.gemini_api_key)
    model = genai.GenerativeModel(env.llm_model, system_instruction=_SYSTEM_PROMPT)
    raw_texts = [s["text"] for s in sentences]

    response = await asyncio.to_thread(model.generate_content, json.dumps(raw_texts))

    try:
        cleaned_texts: list[str] = json.loads(response.text)
    except Exception:
        logger.warning("LLM cleaning (gemini): failed to parse response as JSON — returning original sentences")
        return sentences

    return _apply_cleaned(sentences, cleaned_texts)


async def _clean_sentences(sentences: list[dict]) -> list[dict]:
    """Route to the configured LLM provider."""
    if not sentences:
        return sentences
    if env.llm_provider == "gemini":
        return await _clean_with_gemini(sentences)
    return await _clean_with_anthropic(sentences)


async def clean_pages(pages: list[dict], chunk_size: int = 40) -> tuple[list[dict], bool]:
    """Clean all sentences across pages using concurrent ordered chunks.

    Flattens sentences globally, splits into chunks of `chunk_size` (each with a
    monotonic chunk_id for ordered reconstruction), processes concurrently, then
    rebuilds the page structure in the original order.

    Returns (cleaned_pages, llm_cleaned) where llm_cleaned=True only if ≥1 sentence changed.
    No-op if the active provider's API key is unset.
    """
    active_key = env.anthropic_api_key if env.llm_provider == "anthropic" else env.gemini_api_key
    if not active_key:
        logger.warning("LLM cleaning skipped: %s_API_KEY is not set", env.llm_provider.upper())
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

    any_changed = any(
        "cleanedText" in s
        for pi in range(len(pages))
        for s in page_sentences[pi]
    )

    return cleaned_pages, any_changed
