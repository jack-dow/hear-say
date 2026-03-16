import asyncio

import httpx
from convex import ConvexClient
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Request, UploadFile
from pdf2image import convert_from_bytes

from src.env import env
from src.services import llm, ocr

router = APIRouter(tags=["ocr"])


def _user_client(token: str) -> ConvexClient:
    client = ConvexClient(env.convex_url)
    client.set_auth(token)
    return client


def _internal_client() -> ConvexClient:
    return ConvexClient(env.convex_url)


def _update_step(document_id: str, step: str) -> None:
    _internal_client().mutation(
        "documents:updateProcessingStep",
        {"documentId": document_id, "step": step, "internalSecret": env.internal_secret},
    )


async def _process_and_complete(
    pdf_bytes: bytes,
    doc_id: str,
    filename: str,
    token: str,
) -> None:
    # Init document (validates auth, creates stub, returns upload URL)
    init_data = await asyncio.to_thread(
        _user_client(token).mutation,
        "documents:initUpload",
        {"docId": doc_id, "filename": filename},
    )

    if init_data.get("isDuplicate"):
        return

    document_id: str = init_data["documentId"]
    upload_url: str = init_data["uploadUrl"]

    # Upload PDF directly to Convex storage
    async with httpx.AsyncClient(timeout=60) as client:
        upload_res = await client.post(
            upload_url,
            content=pdf_bytes,
            headers={"Content-Type": "application/pdf"},
        )

    if not upload_res.is_success:
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:failUpload",
            {
                "documentId": document_id,
                "errorMessage": f"Storage upload failed: {upload_res.status_code}",
                "internalSecret": env.internal_secret,
            },
        )
        return

    storage_id: str = upload_res.json()["storageId"]

    try:
        await asyncio.to_thread(_update_step, document_id, "converting")
        images = convert_from_bytes(pdf_bytes)
        await asyncio.to_thread(_update_step, document_id, "ocr")
        pages = await asyncio.to_thread(ocr.ocr_pages, images)
        await asyncio.to_thread(_update_step, document_id, "cleaning")
        pages, llm_cleaned = await llm.clean_pages(pages)
        await asyncio.to_thread(_update_step, document_id, "done")
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:completeUpload",
            {
                "documentId": document_id,
                "storageId": storage_id,
                "pages": pages,
                "internalSecret": env.internal_secret,
                "llmCleaned": llm_cleaned,
            },
        )
    except Exception as e:
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:failUpload",
            {
                "documentId": document_id,
                "storageId": storage_id,
                "errorMessage": str(e),
                "internalSecret": env.internal_secret,
            },
        )


async def _retry_and_complete(document_id: str, token: str) -> None:
    # Reset document + get PDF URL and storageId
    retry_data = await asyncio.to_thread(
        _user_client(token).mutation,
        "documents:prepareRetry",
        {"documentId": document_id},
    )

    pdf_url: str = retry_data["pdfUrl"]
    storage_id: str = retry_data["storageId"]

    async with httpx.AsyncClient(timeout=120) as client:
        pdf_res = await client.get(pdf_url)
        pdf_res.raise_for_status()
        pdf_bytes = pdf_res.content

    try:
        await asyncio.to_thread(_update_step, document_id, "converting")
        images = convert_from_bytes(pdf_bytes)
        await asyncio.to_thread(_update_step, document_id, "ocr")
        pages = await asyncio.to_thread(ocr.ocr_pages, images)
        await asyncio.to_thread(_update_step, document_id, "cleaning")
        pages, llm_cleaned = await llm.clean_pages(pages)
        await asyncio.to_thread(_update_step, document_id, "done")
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:completeUpload",
            {
                "documentId": document_id,
                "storageId": storage_id,
                "pages": pages,
                "internalSecret": env.internal_secret,
                "llmCleaned": llm_cleaned,
            },
        )
    except Exception as e:
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:failUpload",
            {
                "documentId": document_id,
                "storageId": storage_id,
                "errorMessage": str(e),
                "internalSecret": env.internal_secret,
            },
        )


async def _llm_clean_only(document_id: str, token: str) -> None:
    prepare_data = await asyncio.to_thread(
        _user_client(token).mutation,
        "documents:prepareLlmClean",
        {"documentId": document_id},
    )
    pages = prepare_data["pages"]
    try:
        pages, llm_cleaned = await llm.clean_pages(pages)
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:applyLlmCleaning",
            {
                "documentId": document_id,
                "pages": pages,
                "llmCleaned": llm_cleaned,
                "internalSecret": env.internal_secret,
            },
        )
    except Exception as e:
        await asyncio.to_thread(
            _internal_client().mutation,
            "documents:failUpload",
            {
                "documentId": document_id,
                "errorMessage": str(e),
                "internalSecret": env.internal_secret,
            },
        )


@router.post("/api/llm-clean", status_code=202)
async def llm_clean(
    request: Request,
    background_tasks: BackgroundTasks,
    body: dict,
):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization header")

    document_id = body.get("document_id")
    if not document_id:
        raise HTTPException(400, "Missing document_id")

    token = auth_header.removeprefix("Bearer ").strip()
    background_tasks.add_task(_llm_clean_only, document_id, token)
    return {"status": "accepted"}


@router.post("/api/upload", status_code=202)
async def upload_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile,
    doc_id: str = Form(...),
    filename: str = Form(...),
):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    pdf_bytes = await file.read()
    background_tasks.add_task(_process_and_complete, pdf_bytes, doc_id, filename, token)
    return {"doc_id": doc_id}


@router.post("/api/retry", status_code=202)
async def retry_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    body: dict,
):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "Missing Authorization header")

    document_id = body.get("document_id")
    if not document_id:
        raise HTTPException(400, "Missing document_id")

    token = auth_header.removeprefix("Bearer ").strip()
    background_tasks.add_task(_retry_and_complete, document_id, token)
    return {"status": "accepted"}
