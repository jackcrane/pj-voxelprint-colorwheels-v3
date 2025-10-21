#!/bin/bash

# Usage: ./gencolor.sh input_icc_profile.icc output.png
# Example: ./gencolor.sh ../shared/Tavor_Xrite_i1Profiler_VividCMYW.icc pre.png

ICC_PROFILE="$1"
OUTPUT_IMAGE="$2"

if [ -z "$ICC_PROFILE" ] || [ -z "$OUTPUT_IMAGE" ]; then
  echo "Usage: $0 <icc_profile_path> <output_image>"
  exit 1
fi

magick -size 200x100 xc:"#0000FF" \
  -profile "/System/Library/ColorSync/Profiles/sRGB Profile.icc" \
  -profile "$ICC_PROFILE" \
  "$OUTPUT_IMAGE"