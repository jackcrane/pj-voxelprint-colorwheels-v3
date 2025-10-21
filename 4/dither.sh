#!/bin/bash
set -euo pipefail

# Usage: ./dither.sh <input_png> <out_dir> [layers]
# Defaults: input=pre.png, out=out/tavor, layers=100

INPUT="${1:-pre.png}"
OUTDIR="${2:-out/tavor}"
LAYERS="${3:-100}"

mkdir -p "$OUTDIR"
node index.js "$INPUT" "$OUTDIR" "$LAYERS"