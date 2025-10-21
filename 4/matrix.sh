#!/bin/sh
set -euo pipefail

# matrix.sh — 1×N CMY bump matrix for a given HEX color (POSIX sh)
#
# Usage:
#   ./matrix.sh <out_root> <hex_rgb> [--layers=N]
# Defaults:
#   out_root=blue_matrix   hex_rgb=0000FF   layers=100
#
# Env:
#   PROFILE=../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm
#   HALFTONE_JS=./index.js
#   GENCOLOR=./gencolor.sh
#   BUMP_C_SEQ="0:0.5:0.05"   BUMP_M_SEQ="0.5:0:-0.05"   BUMP_Y="0"
#   KEEP_WORK=1  (keeps workspace dir)

OUT_ROOT="${1:-blue_matrix}"
HEX_RGB="${2:-0000FF}"

LAYERS=100
# allow flags after the two positionals
shiftc=0
[ $# -gt 0 ] && shiftc=2 || shiftc=0
# rebuild "$@" starting from third cli arg if present
set -- ${3+"$@"}
for arg in "$@"; do
  case "$arg" in
    --layers=*) LAYERS="${arg#--layers=}" ;;
  esac
done

PROFILE="${PROFILE:-../shared/profiles/Stratasys_J750_Vivid_CMY_1mm.icm}"
HALFTONE_JS="${HALFTONE_JS:-./index.js}"
GENCOLOR="${GENCOLOR:-./gencolor.sh}"

BUMP_C_SEQ="${BUMP_C_SEQ:-0:0.5:0.05}"
BUMP_M_SEQ="${BUMP_M_SEQ:-0.5:0:-0.05}"
BUMP_Y="${BUMP_Y:-0}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1" >&2; exit 1; }; }
need magick
need awk
[ -f "$PROFILE" ] || { echo "Profile not found: $PROFILE" >&2; exit 1; }
[ -f "$HALFTONE_JS" ] || { echo "Halftone JS not found: $HALFTONE_JS" >&2; exit 1; }
[ -f "$GENCOLOR" ] || { echo "gencolor script not found: $GENCOLOR" >&2; exit 1; }

mkws() { mktemp -d -t matrix.XXXXXX 2>/dev/null || mktemp -d "${TMPDIR:-/tmp}/matrix.XXXXXX"; }
WORK_ROOT="$(mkws)"
if [ "${KEEP_WORK:-0}" -eq 0 ]; then trap 'rm -rf "$WORK_ROOT"' EXIT; else echo "KEEP_WORK=1 → $WORK_ROOT"; fi

# --- sequences into files (one value per line)
seq_file() {
  awk -v spec="$1" '
    BEGIN{
      n=split(spec,a,":"); if(n!=3){print "Bad seq: "spec >"/dev/stderr"; exit 1}
      start=a[1]+0; end=a[2]+0; step=a[3]+0; if(step==0){print "Zero step" >"/dev/stderr"; exit 1}
      eps=1e-9
      if(step>0){ for(x=start; x<=end+eps; x+=step) printf "%.10g\n", x }
      else      { for(x=start; x>=end-eps; x+=step) printf "%.10g\n", x }
    }'
}

C_FILE="$WORK_ROOT/C.txt";  M_FILE="$WORK_ROOT/M.txt"
seq_file "$BUMP_C_SEQ" > "$C_FILE"
seq_file "$BUMP_M_SEQ" > "$M_FILE"
NC=$(wc -l < "$C_FILE" | tr -d ' ')
NM=$(wc -l < "$M_FILE" | tr -d ' ')
[ "$NC" -eq "$NM" ] || { echo "C/M length mismatch: $NC vs $NM" >&2; exit 1; }

echo "==> Columns: $NC (C: $BUMP_C_SEQ) (M: $BUMP_M_SEQ) (Y: $BUMP_Y)"
echo "==> Layers:  $LAYERS"
echo "==> Profile: $(basename "$PROFILE")"
echo "==> Color:   #$HEX_RGB"

# 1) base 100x100 square with profile for HEX
PREPNG="$WORK_ROOT/pre.png"
"$GENCOLOR" "$PROFILE" "$PREPNG" "$HEX_RGB"
[ -f "$PREPNG" ] || { echo "Failed to create $PREPNG" >&2; exit 1; }

# 2) halftone each column
i=0
paste "$C_FILE" "$M_FILE" | while IFS="$(printf '\t')" read -r CVAL MVAL; do
  COL_DIR="$WORK_ROOT/col_$(printf '%02d' "$i")"
  rm -rf "$COL_DIR"; mkdir -p "$COL_DIR"
  echo "   -> col $(printf '%02d' "$i"): C=$(printf '%.2f' "$CVAL") M=$(printf '%.2f' "$MVAL") Y=$(printf '%.2f' "$BUMP_Y")"
  node "$HALFTONE_JS" "$PREPNG" "$COL_DIR" "$LAYERS" --c="$CVAL" --m="$MVAL" --y="$BUMP_Y" >/dev/null
  if ! find "$COL_DIR" -type f \( -name '*.png' -o -iname '*.tif' -o -iname '*.tiff' \) | grep -q .; then
    echo "No slices produced in $COL_DIR" >&2; exit 1
  fi
  i=$((i+1))
done

# 3) detect slice extension & height
REF_DIR="$WORK_ROOT/col_00"
if find "$REF_DIR" -type f -name '*.png' | grep -q .; then EXT='png'
elif find "$REF_DIR" -type f -iname '*.tif' | grep -q .; then EXT='tif'
elif find "$REF_DIR" -type f -iname '*.tiff' | grep -q .; then EXT='tiff'
else echo "Cannot detect slice extension in $REF_DIR" >&2; exit 1; fi
echo "==> Detected slice type: *.$EXT"

REF_LIST="$WORK_ROOT/ref_layers.txt"
find "$REF_DIR" -type f -name "*.$EXT" -print | sort > "$REF_LIST"
REF_COUNT=$(wc -l < "$REF_LIST" | tr -d ' ')
[ "$REF_COUNT" -gt 0 ] || { echo "No slices in ref column" >&2; exit 1; }

# get height from first ref image
FIRST_REF="$(head -n1 "$REF_LIST")"
HEIGHT="$(magick identify -format '%h' "$FIRST_REF")"

# 4) merge horizontally with 5px white spacers → OUT_ROOT
rm -rf "$OUT_ROOT"; mkdir -p "$OUT_ROOT"
echo "==> Merging into: $OUT_ROOT (5px white spacers)"
while IFS= read -r REF; do
  BASE="$(basename "$REF")"
  LST="$WORK_ROOT/list_$BASE.txt"; : > "$LST"
  idx=0
  while [ "$idx" -lt "$NC" ]; do
    COL_PATH="$(printf '%s/col_%02d/%s' "$WORK_ROOT" "$idx" "$BASE")"
    [ -f "$COL_PATH" ] || { echo "Missing $BASE in col_$(printf '%02d' "$idx")" >&2; exit 1; }
    printf '%s\n' "$COL_PATH" >> "$LST"
    idx=$((idx+1))
    if [ "$idx" -lt "$NC" ]; then
      printf 'xc:white[%sx%s]\n' "5" "$HEIGHT" >> "$LST"
    fi
  done
  OUT="$OUT_ROOT/$BASE"
  if [ "$NC" -gt 1 ]; then magick @"$LST" +append "$OUT"; else magick @"$LST" "$OUT"; fi
done < "$REF_LIST"

# 5) scale 2x in X with point filter
echo "==> Scaling (2x X, point)"
if [ "$EXT" = "png" ]; then
  find "$OUT_ROOT" -type f -name '*.png' -print0 | while IFS= read -r -d '' f; do
    t="$f.tmp"
    magick "$f" -filter point -resize 200%x100% -define png:format=png24 -interlace none "$t"
    mv -f "$t" "$f"
  done
else
  find "$OUT_ROOT" -type f \( -iname '*.tif' -o -iname '*.tiff' \) -print0 | while IFS= read -r -d '' f; do
    t="$f.tmp"
    magick "$f" -filter point -resize 200%x100% "$t"
    mv -f "$t" "$f"
  done
fi

COUNT=$(find "$OUT_ROOT" -type f -name "*.$EXT" | wc -l | tr -d ' ')
echo "Done. Wrote $COUNT merged layers to: $OUT_ROOT"