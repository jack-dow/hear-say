import nltk
from PIL import Image

# Download punkt tokenizer on first use
nltk.download("punkt_tab", quiet=True)

# Layout block types to keep for TTS — excludes headers, footers, captions, figures, tables
_KEEP_LABELS = {"Text", "ListItem", "SectionHeader"}


def _poly_to_bbox(polygon: list[list[float]]) -> tuple[float, float, float, float]:
    xs = [p[0] for p in polygon]
    ys = [p[1] for p in polygon]
    return min(xs), min(ys), max(xs), max(ys)


def _line_in_valid_blocks(
    line_bbox: list[float],
    valid_bboxes: list[tuple[float, float, float, float]],
) -> bool:
    # Check if line's center point falls within any valid layout block
    cx = (line_bbox[0] + line_bbox[2]) / 2
    cy = (line_bbox[1] + line_bbox[3]) / 2
    return any(x1 <= cx <= x2 and y1 <= cy <= y2 for x1, y1, x2, y2 in valid_bboxes)


def ocr_pages(images: list[Image.Image]) -> list[dict]:
    from surya.layout import LayoutPredictor
    from surya.recognition import DetectionPredictor, FoundationPredictor, RecognitionPredictor

    foundation_predictor = FoundationPredictor()
    det_predictor = DetectionPredictor()
    rec_predictor = RecognitionPredictor(foundation_predictor)
    layout_predictor = LayoutPredictor(foundation_predictor)

    layout_results = layout_predictor(images)
    results = rec_predictor(images, det_predictor=det_predictor)

    pages = []
    for page_idx, (image, result, layout) in enumerate(zip(images, results, layout_results)):
        img_w, img_h = image.size

        # Build valid block bboxes in image pixel coords
        valid_bboxes = [
            _poly_to_bbox(box.polygon)
            for box in layout.bboxes
            if box.label in _KEEP_LABELS
        ]

        # Build line data, filtering to lines within valid layout blocks
        line_data = []
        offset = 0
        for line in result.text_lines:
            if not line.text.strip():
                continue
            if valid_bboxes and not _line_in_valid_blocks(line.bbox, valid_bboxes):
                continue
            if line_data:
                offset += 1  # space separator in join
            text = line.text
            line_data.append({
                "text": text,
                "bbox": line.bbox,  # [x1, y1, x2, y2] in image px
                "start": offset,
                "end": offset + len(text),
            })
            offset += len(text)

        full_text = " ".join(d["text"] for d in line_data)

        sentences = []
        sentence_id = 0
        paragraphs = full_text.split("\n\n") if "\n\n" in full_text else [full_text]

        search_start = 0
        for para_idx, paragraph in enumerate(paragraphs):
            para_sentences = nltk.sent_tokenize(paragraph.strip())
            for sent_text in para_sentences:
                sent_text = sent_text.strip()
                if not sent_text:
                    continue

                # Map sentence back to source lines for bbox
                bbox = None
                pos = full_text.find(sent_text, search_start)
                if pos != -1:
                    sent_end = pos + len(sent_text)
                    search_start = sent_end
                    overlapping = [d for d in line_data if d["end"] > pos and d["start"] < sent_end]
                    if overlapping:
                        x1 = min(d["bbox"][0] for d in overlapping)
                        y1 = min(d["bbox"][1] for d in overlapping)
                        x2 = max(d["bbox"][2] for d in overlapping)
                        y2 = max(d["bbox"][3] for d in overlapping)
                        bbox = {
                            "x1": x1 / img_w,
                            "y1": y1 / img_h,
                            "x2": x2 / img_w,
                            "y2": y2 / img_h,
                        }

                sentence = {
                    "id": f"p{page_idx + 1}s{sentence_id}",
                    "text": sent_text,
                    "paragraph": para_idx,
                }
                if bbox:
                    sentence["bbox"] = bbox
                sentences.append(sentence)
                sentence_id += 1

        pages.append({
            "page": page_idx + 1,
            "text": full_text,
            "sentences": sentences,
        })

    return pages
