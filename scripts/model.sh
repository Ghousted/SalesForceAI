#!/usr/bin/env bash
#
# Boot the local llama.cpp model server for Sales OS.
#
# Downloads the GGUF on first run (via curl — llama.cpp's built-in `-hf` flag
# hangs on Hugging Face's Xet/CAS backend), then launches llama-server on the
# OpenAI-compatible port the app points at.
#
# Override any of these via env:
#   MODEL_DIR   (default ~/models)
#   MODEL_FILE  (default Qwen2.5-3B-Instruct-Q4_K_M.gguf)
#   MODEL_URL   (default bartowski HF resolve URL for the file above)
#   PORT        (default 8080)
#   CTX         (default 8192)
#   NGL         (default 99 — GPU layers; Metal on Apple Silicon)
set -euo pipefail

MODEL_DIR="${MODEL_DIR:-$HOME/models}"
MODEL_FILE="${MODEL_FILE:-Qwen2.5-3B-Instruct-Q4_K_M.gguf}"
MODEL_URL="${MODEL_URL:-https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf}"
PORT="${PORT:-8080}"
CTX="${CTX:-8192}"
NGL="${NGL:-99}"
MODEL_PATH="$MODEL_DIR/$MODEL_FILE"

if ! command -v llama-server >/dev/null 2>&1; then
  echo "✗ llama-server not found. Install it:  brew install llama.cpp" >&2
  exit 1
fi

if curl -s "http://localhost:$PORT/health" 2>/dev/null | grep -q '"ok"'; then
  echo "✓ A model server is already healthy on :$PORT — nothing to do."
  exit 0
fi

if [ ! -f "$MODEL_PATH" ]; then
  echo "→ Model not found, downloading once to $MODEL_PATH"
  mkdir -p "$MODEL_DIR"
  # -C - resumes a partial file; --retry rides out flaky connections.
  curl -L "$MODEL_URL" -o "$MODEL_PATH" --retry 3 -C -
  echo "✓ Download complete ($(du -h "$MODEL_PATH" | cut -f1))"
fi

echo "→ Starting llama-server on http://127.0.0.1:$PORT/v1  (model: $MODEL_FILE)"
echo "  Point the app at it:  LLM_PROVIDER=llamacpp  in .env.local"
exec llama-server -m "$MODEL_PATH" -c "$CTX" -ngl "$NGL" --port "$PORT" --host 127.0.0.1
