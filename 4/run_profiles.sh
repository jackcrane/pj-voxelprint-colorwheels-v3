#!/bin/sh
set -euo pipefail

# run_profiles.sh — convert/dither/scale/build pipeline + optional CMY bump sweep
#
# Usage:
#   ./run_profiles.sh [out_root] [source_image] [--gen=convert|gencolor] [--sweep] [--layers=N]
#
# Defaults:
#   out_root     = out
#   source_image = input.png (ignored if --gen=gencolor)
#   --gen        = convert   | gencolor
#   --layers     = 100 (only used for --sweep)
#
# In --sweep mode:
#   - Generates pre.png (convert/gencolor)
#   - Runs halftone.js across combos: c, m, y, cm, cy, my, cmy (each +0.1)
#   - Writes to: <out_root>/<combo>-01/
#   - Scales each folder's PNGs (2x X, point filter)
#
# Env overrides (optional):
#   GEN=convert|gencolor   HALFTONE_JS=./halftone.js  PROFILE=...icm

OUT_ROOT="${1:-out}"
SOURCE_IMAGE_DEFAULT="input.png"
SOURCE_IMAGE="${2:-$SOURCE_IMAGE_DEFAULT}"

# --- option parsing ---
GEN_CHOICE_ENV="${GEN:-}"
GEN_CHOICE_FLAG="$(printf '%s' "${3:-}" | sed -n 's/^--gen=\(.*\)$/\1/p')"
GEN="${GEN_CHOICE_ENV:-${GEN_CHOICE_FLAG:-convert}}"   # convert | gencolor

SWEEP=0
LAYERS=100
for arg in "$@"; do
  case "$arg" in
    --sweep) SWEEP=1 ;;
    --layers=*) LAYERS="${arg#--layers=}" ;;
  esac
done

CONVERT="./convert.sh"
GENCOLOR="./gencolor.sh"
DITHER="./dither.sh"
HALFTONE_JS="${HALFTONE_JS:-./halftone.js}"
PROFILE="${PROFILE:-../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm}"

# --- sanity checks ---
if [ ! -f "$PROFILE" ]; then
  echo "Profile not found: $PROFILE" >&2
  exit 1
fi

if ! command -v magick >/dev/null 2>&1; then
  echo "ImageMagick 'magick' CLI not found in PATH." >&2
  exit 1
fi

# Only require SOURCE_IMAGE when using convert
if [ "$GEN" = "convert" ] && [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

mkdir -p "$OUT_ROOT"

BASE=$(basename "$PROFILE")
NAME="${BASE%.*}"
SAFE_NAME=$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')
PRE_WORK_ROOT="$OUT_ROOT"               # where we put final outputs
WORK_DIR="$OUT_ROOT/$SAFE_NAME"         # only used for non-sweep path
PREPNG="$WORK_DIR/pre.png"

echo "==> Profile:  $BASE"
echo "==> Generator: $GEN"
[ "$SWEEP" -eq 1 ] && echo "==> Mode:     SWEEP (layers=$LAYERS)" || echo "==> Mode:     STANDARD"

# --- generate pre.png via selected generator ---
if [ "$SWEEP" -eq 1 ]; then
  # For sweep we still need a pre.png; stage under a temp work dir
  if [ -d "$WORK_DIR" ]; then rm -rf "$WORK_DIR"; fi
  mkdir -p "$WORK_DIR"

  case "$GEN" in
    convert)  "$CONVERT"  "$PROFILE" "$SOURCE_IMAGE" "$PREPNG" ;;
    gencolor) "$GENCOLOR" "$PROFILE" "$PREPNG" ;;
    *) echo "Unknown generator: $GEN (expected: convert or gencolor)" >&2; exit 1 ;;
  esac

  # ---- bump sweep: c, m, y, cm, cy, my, cmy (+0.1 each) ----
  combos="c m y cm cy my cmy"
  for combo in $combos; do
    # build bumps
    bump_c=0.0; bump_m=0.0; bump_y=0.0
    echo "$combo" | grep -q "c" && bump_c=0.1 || true
    echo "$combo" | grep -q "m" && bump_m=0.1 || true
    echo "$combo" | grep -q "y" && bump_y=0.1 || true

    outdir="$PRE_WORK_ROOT/${combo}-01"
    echo "==> Halftone ${combo}-01  (c=$bump_c m=$bump_m y=$bump_y) -> $outdir"
    rm -rf "$outdir"
    mkdir -p "$outdir"

    # halftone per layer
    node "$HALFTONE_JS" "$PREPNG" "$outdir" "$LAYERS" --c="$bump_c" --m="$bump_m" --y="$bump_y"

    # scale each PNG (2x X, point, png24, no interlace)
    echo "    Scaling PNGs in $outdir"
    find "$outdir" -type f -name '*.png' -print0 | while IFS= read -r -d '' f; do
      tmp="${f}.tmp"
      magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$tmp"
      mv -f "$tmp" "$f"
    done
  done

  echo "Done. Outputs in $PRE_WORK_ROOT/<combo>-01/"
  exit 0
fi

# --- STANDARD path (legacy): convert/gencolor -> dither.sh -> scale into $WORK_DIR ---
# clear destination folder if it exists
if [ -d "$WORK_DIR" ]; then
  echo "==> Clearing destination: $WORK_DIR"
  rm -rf "$WORK_DIR"
fi
mkdir -p "$WORK_DIR"

case "$GEN" in
  convert)  "$CONVERT"  "$PROFILE" "$SOURCE_IMAGE" "$PREPNG" ;;
  gencolor) "$GENCOLOR" "$PROFILE" "$PREPNG" ;;
  *) echo "Unknown generator: $GEN (expected: convert or gencolor)" >&2; exit 1 ;;
esac

# dither step (existing)
# dither.sh <input_png> <outdir> <levels>
"$DITHER" "$PREPNG" "$WORK_DIR" 100

# scale PNGs (2x X, 1x Y), keep sharp (point), compat PNG
echo "==> Scaling PNGs in $WORK_DIR"
find "$WORK_DIR" -type f -name '*.png' -print0 | while IFS= read -r -d '' f; do
  tmp="${f}.tmp"
  magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$tmp"
  mv -f "$tmp" "$f"
done

echo "Done. Output in $WORK_DIR"