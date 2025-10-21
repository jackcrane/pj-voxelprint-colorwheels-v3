#!/bin/bash
set -euo pipefail

# Usage: ./dither.sh <input_png> <out_dir> [threshold]
# Defaults: input=pre.png, out=out/tavor, threshold=100

INPUT="${1:-pre.png}"
OUTDIR="${2:-out/tavor}"
THRESH="${3:-100}"

mkdir -p "$OUTDIR"
node index.js "$INPUT" "$OUTDIR" "$THRESH"