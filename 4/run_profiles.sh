#!/bin/sh
set -eu

# Usage: ./run_profiles.sh [profiles_dir] [out_root] [source_image]
# - profiles_dir: where .icc/.icm live (default: ../shared/profiles)
# - out_root:     root output directory (default: out)
# - source_image: the sRGB input you want to convert & then dither (default: input.png)

PROFILES_DIR="${1:-../shared/profiles}"
OUT_ROOT="${2:-out}"
SOURCE_IMAGE="${3:-input.png}"

CONVERT="./convert.sh"
DITHER="./dither.sh"

if [ ! -f "$SOURCE_IMAGE" ]; then
  echo "Source image not found: $SOURCE_IMAGE" >&2
  exit 1
fi

mkdir -p "$OUT_ROOT"

# Find .icc and .icm files
FILES=$(find "$PROFILES_DIR" -type f \( -iname '*.icc' -o -iname '*.icm' \) | sort)

if [ -z "$FILES" ]; then
  echo "No ICC/ICM profiles found in: $PROFILES_DIR" >&2
  exit 1
fi

# Iterate line by line safely
echo "$FILES" | while IFS= read -r PROFILE; do
  BASE=$(basename "$PROFILE")
  NAME="${BASE%.*}"
  SAFE_NAME=$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')
  OUTDIR="$OUT_ROOT/$SAFE_NAME"
  PREPNG="$OUTDIR/pre.png"

  mkdir -p "$OUTDIR"

  echo "==> Processing: $BASE"
  # Convert the common source image into the printer profile-specific PNG
  "$CONVERT" "$PROFILE" "$SOURCE_IMAGE" "$PREPNG"

  # Dither that converted PNG
  "$DITHER" "$PREPNG" "$OUTDIR" 100
done

echo "Done. Outputs in $OUT_ROOT/<profile-name>/"