INPUT="$1"
OUTPUT="converted_${INPUT%.*}.png"

magick "$INPUT" \
  -profile "../shared/Tavor_Xrite_i1Profiler_VividCMYW.icc" \
  -profile "/System/Library/ColorSync/Profiles/sRGB Profile.icc" \
  "$OUTPUT"