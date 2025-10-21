#!/bin/sh
set -eu

# Usage: ./run_profiles.sh [out_root] [source_image]
# - out_root:     root output directory (default: out)
# - source_image: the sRGB input you want to convert & then dither (default: input.png)

OUT_ROOT="${1:-out}"
SOURCE_IMAGE="${2:-input.png}"

CONVERT="./convert.sh"
DITHER="./dither.sh"
PROFILE="../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm"

# --- sanity checks ---
if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

if [ ! -f "$PROFILE" ]; then
  echo "Profile not found: $PROFILE" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 'magick' CLI not found in PATH." >&2
  exit 1
fi

mkdir -p "$OUT_ROOT"

BASE=$(basename "$PROFILE")
NAME="${BASE%.*}"
SAFE_NAME=$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')
OUTDIR="$OUT_ROOT/$SAFE_NAME"
PREPNG="$OUTDIR/pre.png"

mkdir -p "$OUTDIR"

echo "==> Processing: $BASE"
"$CONVERT" "$PROFILE" "$SOURCE_IMAGE" "$PREPNG"
"$DITHER" "$PREPNG" "$OUTDIR" 100

echo "==> Scaling PNGs in $OUTDIR"
if [ -x "./scale" ]; then
  # Prefer your custom scaler if present
  ./scale "$OUTDIR"
else
  # Fallback: double X only, preserve sharp edges (point), force PNG24, no interlace
  # Safe for filenames with spaces.
  find "$OUTDIR" -type f -name '*.png' -print0 | while IFS= read -r -d '' f; do
    tmp="${f}.tmp"
    magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$tmp"
    mv -f "$tmp" "$f"
  done
fi

echo "==> Converting to GCVF"
node buildGCVF.js "$OUTDIR" "$OUTDIR.gcvf"

echo "Done. Output in $OUTDIR"