#!/bin/sh
set -eu
cd "$(dirname "$0")/.."

# 原本は変更しない。24fpsの各10秒を重ね、朝の光から空の余韻へつなぐ。
# 1→2: 1.5秒、2→3: 1秒の白フェード。同じキャラを二重に重ねない。
# 最後の空を2秒延長し、全体は29.5秒。余韻を残してから暗転する。
# 暗転の長さは1.5秒から1フレーム引き、24fpsの最終フレームを黒にする。
ffmpeg -hide_banner -y \
  -i public/assets/movies/ending-1.mp4 \
  -i public/assets/movies/ending-2.mp4 \
  -i public/assets/movies/ending-3.mp4 \
  -filter_complex \
  '[0:v]trim=duration=10,setpts=PTS-STARTPTS,fps=24,settb=AVTB,format=yuv420p[a];[1:v]trim=duration=10,setpts=PTS-STARTPTS,fps=24,settb=AVTB,format=yuv420p[b];[2:v]trim=duration=10,setpts=PTS-STARTPTS,fps=24,settb=AVTB,format=yuv420p[c];[a][b]xfade=transition=fadewhite:duration=1.5:offset=8.5[ab];[ab][c]xfade=transition=fadewhite:duration=1:offset=17.5,tpad=stop_mode=clone:stop_duration=2,fade=t=in:st=0:d=0.75,fade=t=out:st=28:d=1.4583333333[out]' \
  -map '[out]' -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -movflags +faststart public/assets/movies/ending.mp4
