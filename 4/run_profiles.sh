#!/bin/sh
set -euo pipefail

# run_profiles.sh — convert → dither → scale (2x in X) for a single profile
#
# Usage:
#   ./run_profiles.sh [out_root] [source_image]
# Defaults:
#   out_root     = out
#   source_image = input.png
#
# Notes:
# - Always uses convert.sh (no sweep, no gencolor)
# - Keeps PNGs sharp by using point filter, png24, no interlace

OUT_ROOT="${1:-out}"
SOURCE_IMAGE="${2:-input.png}"

CONVERT="./convert.sh"
DITHER="./dither.sh"
PROFILE="../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm"

# --- sanity checks ---
[ -f "$PROFILE" ] || { echo "Profile not found: $PROFILE" >&2; exit 1; }
[ -f "$SOURCE_IMAGE" ] || { echo "Source image not found: $SOURCE_IMAGE" >&2; exit 1; }
command -v magick >/dev/null 2>&1 || { echo "ImageMagick 'magick' not found in PATH." >&2; exit 1; }

# --- paths ---
BASE="$(basename "$PROFILE")"
NAME="${BASE%.*}"
SAFE_NAME="$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')"

WORK_DIR="$OUT_ROOT/$SAFE_NAME"
PREPNG="$WORK_DIR/pre.png"

# --- prepare destination ---
[ -d "$WORK_DIR" ] && { echo "==> Clearing destination: $WORK_DIR"; rm -rf "$WORK_DIR"; }
mkdir -p "$WORK_DIR"

echo "==> Profile: $BASE"
echo "==> Mode:    STANDARD (convert → dither → scale)"

# --- convert to pre.png ---
"$CONVERT" "$PROFILE" "$SOURCE_IMAGE" "$PREPNG"

# --- dither (existing script: dither.sh <input_png> <outdir> <levels>) ---
"$DITHER" "$PREPNG" "$WORK_DIR" 100

# --- scale PNGs: 2x X, keep sharp (point), png24, no interlace ---
echo "==> Scaling PNGs in $WORK_DIR"
find "$WORK_DIR" -type f -name '*.png' | while IFS= read -r f; do
  tmp="${f}.tmp"
  magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$tmp"
  mv -f "$tmp" "$f"
done

echo "Done. Output in $WORK_DIR"