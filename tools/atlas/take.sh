#!/usr/bin/env bash
# Bring a finished Atlas take into the game: its splats from the worldlabs branch, the floor grid, the file in public/.
#   tools/atlas/take.sh <take name on the branch> <realm data id> [grid radius in splat units, default 16] [work dir]
# e.g. tools/atlas/take.sh icecave icecave 16 ; tools/atlas/take.sh room-inn room-inn 7
set -euo pipefail
NAME=$1 ID=$2 RAD=${3:-16} WORK=${4:-/tmp/atlas-takes}
mkdir -p "$WORK/$NAME"
git fetch -q origin worldlabs
for f in scene.json splats.spz; do git show "origin/worldlabs:worldlabs/$NAME/$f" > "$WORK/$NAME/$f"; done
python3 tools/atlas/floor.py "$WORK/$NAME/splats.spz" "$ID" --radius "$RAD" --cell 0.3 --out src/game/realmData.ts --png "$WORK/$NAME/$ID-floor.png"
mkdir -p public/splats
cp "$WORK/$NAME/splats.spz" "public/splats/$ID.spz"
ls -la "public/splats/$ID.spz"
rm -rf tools/atlas/__pycache__
