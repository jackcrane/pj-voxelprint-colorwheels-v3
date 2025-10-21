#!/bin/sh
set -euo pipefail

# run_profiles.sh — convert → dither → scale (2x in X)
#
# Usage:
#   ./run_profiles.sh [out_root] [source_path] [--layers=100]
#
# Defaults:
#   out_root    = out
#   source_path = input.png  (file or directory)
#   --layers    = 100        (passed to dither.sh in single-image mode only)
#
# Notes:
# - Always uses convert.sh (no sweep, no gencolor)
# - Keeps PNGs sharp by using point filter, png24, no interlace
# - If source_path is a directory: process each image once (ignore --layers)

OUT_ROOT="${1:-out}"
SOURCE_PATH="${2:-input.png}"
LAYERS="100" # default

# --- parse options ---
shift_count=0
# Count provided positionals (so we can shift past them for option parsing)
[ "${1:-}" = "$OUT_ROOT" ] && shift_count=$((shift_count+1))
[ "${2:-}" = "$SOURCE_PATH" ] && shift_count=$((shift_count+1))
# shellcheck disable=SC2039
set +u
# shift away the two positionals if they were supplied
[ $shift_count -ge 1 ] && shift 1
[ $shift_count -ge 2 ] && shift 1
# parse remaining options
while [ $# -gt 0 ]; do
  case "$1" in
    --layers=*)
      LAYERS="${1#*=}"
      # basic integer check
      case "$LAYERS" in
        ''|*[!0-9]*) echo "Invalid --layers value: $LAYERS" >&2; exit 1 ;;
      esac
      ;;
    *)
      echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done
set -u

CONVERT="./convert.sh"
DITHER="./dither.sh"
PROFILE="../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm"

# --- sanity checks common ---
[ -f "$PROFILE" ] || { echo "Profile not found: $PROFILE" >&2; exit 1; }
command -v magick >/dev/null 2>&1 || { echo "ImageMagick 'magick' not found in PATH." >&2; exit 1; }

# --- derived paths ---
BASE="$(basename "$PROFILE")"
NAME="${BASE%.*}"
SAFE_NAME="$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')"
WORK_ROOT="$OUT_ROOT/$SAFE_NAME"

# --- helpers ---
scale_pngs_in_dir() {
  dir="$1"
  echo "==> Scaling PNGs in $dir"
  # Use find to hit all PNGs; write to tmp then replace to avoid partial writes
  find "$dir" -type f -name '*.png' | while IFS= read -r f; do
    tmp="${f}.tmp"
    magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$tmp"
    mv -f "$tmp" "$f"
  done
}

process_single_image() {
  src_img="$1"

  [ -f "$src_img" ] || { echo "Source image not found: $src_img" >&2; exit 1; }

  # fresh work dir for the profile
  [ -d "$WORK_ROOT" ] && { echo "==> Clearing destination: $WORK_ROOT"; rm -rf "$WORK_ROOT"; }
  mkdir -p "$WORK_ROOT"

  PREPNG="$WORK_ROOT/pre.png"

  echo "==> Profile: $BASE"
  echo "==> Mode:    SINGLE (convert → dither → scale)"
  echo "==> Layers:  $LAYERS"

  "$CONVERT" "$PROFILE" "$src_img" "$PREPNG"
  "$DITHER"  "$PREPNG" "$WORK_ROOT" "$LAYERS"

  scale_pngs_in_dir "$WORK_ROOT"

  echo "Done. Output in $WORK_ROOT"
}

process_directory() {
  src_dir="$1"

  [ -d "$src_dir" ] || { echo "Directory not found: $src_dir" >&2; exit 1; }

  # fresh root
  [ -d "$WORK_ROOT" ] && { echo "==> Clearing destination: $WORK_ROOT"; rm -rf "$WORK_ROOT"; }
  mkdir -p "$WORK_ROOT"

  echo "==> Profile: $BASE"
  echo "==> Mode:    DIRECTORY (per-image convert → dither → scale)"
  echo "==> Note:    --layers is ignored in directory mode"

  # Find likely raster inputs (png/jpg/jpeg/tif/tiff). You can expand as needed.
  # Each image gets its own subfolder under WORK_ROOT.
  found_any="0"
  find "$src_dir" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.tif' -o -iname '*.tiff' \) | while IFS= read -r img; do
    found_any="1"
    basefile="$(basename "$img")"
    stem="${basefile%.*}"
    out_dir="$WORK_ROOT/$stem"
    mkdir -p "$out_dir"

    echo "----"
    echo "Processing: $basefile → $stem/"
    prepng="$out_dir/pre.png"

    "$CONVERT" "$PROFILE" "$img" "$prepng"
    # In directory mode, run the dither pipeline ONCE per image (ignore --layers option).
    # Pass a fixed 100 to satisfy existing dither.sh signature.
    "$DITHER"  "$prepng" "$out_dir" 100

    scale_pngs_in_dir "$out_dir"
    echo "Output: $out_dir"
  done

  # If no images found, warn and exit non-zero.
  if ! find "$src_dir" -type f \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.tif' -o -iname '*.tiff' \) | grep -q . ; then
    echo "No images found in: $src_dir (png/jpg/jpeg/tif/tiff)" >&2
    exit 1
  fi

  echo "Done. Outputs under $WORK_ROOT"
}

# --- dispatch based on SOURCE_PATH type ---
if [ -d "$SOURCE_PATH" ]; then
  process_directory "$SOURCE_PATH"
else
  process_single_image "$SOURCE_PATH"
fi