#!/bin/bash
set -euo pipefail

# Usage: ./run_profiles.sh [profiles_dir] [out_root]
# Defaults: profiles_dir=../shared/profiles, out_root=out

PROFILES_DIR="${1:-../shared/profiles}"
OUT_ROOT="${2:-out}"

GEN="./gencolor.sh"
DITHER="./dither.sh"

mkdir -p "$OUT_ROOT"

shopt -s nullglob
# Collect .icc/.icm (case-insensitive), handle spaces safely
mapfile -d '' FILES < <(find "$PROFILES_DIR" -type f \( -iname '*.icc' -o -iname '*.icm' \) -print0 | sort -z)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No ICC/ICM profiles found in: $PROFILES_DIR" >&2
  exit 1
fi

for PROFILE in "${FILES[@]}"; do
  BASE="$(basename "$PROFILE")"
  NAME="${BASE%.*}"
  SAFE_NAME="$(printf '%s' "$NAME" | tr ' ' '_' | tr -cd '[:alnum:]_.-')"
  OUTDIR="$OUT_ROOT/$SAFE_NAME"
  INPUT="$OUTDIR/pre.png"

  echo "==> Processing: $BASE"
  "$GEN" "$PROFILE" "$INPUT"
  "$DITHER" "$INPUT" "$OUTDIR" 100
done

echo "Done. Outputs in $OUT_ROOT/<profile-name>/"