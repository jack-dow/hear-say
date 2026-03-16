#!/usr/bin/env bash
set -euo pipefail

MODELS_DIR="$(dirname "$0")/../apps/api/models"
mkdir -p "$MODELS_DIR"

VOICE="en_US-lessac-high"
BASE_URL="https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/high"

if [[ -f "$MODELS_DIR/$VOICE.onnx" ]]; then
  echo "Voice model already exists: $VOICE"
  exit 0
fi

echo "Downloading $VOICE..."
curl -L --progress-bar -o "$MODELS_DIR/$VOICE.onnx" "$BASE_URL/$VOICE.onnx"
curl -L --progress-bar -o "$MODELS_DIR/$VOICE.onnx.json" "$BASE_URL/$VOICE.onnx.json"
echo "Done."
