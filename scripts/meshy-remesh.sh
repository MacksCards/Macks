#!/bin/bash
# Sauberer Neuaufbau mit weniger Dreiecken (Meshy remesh, Oberfläche bleibt), dann fürs iPhone packen
P=$1; OUT=$2; TGT=$3
W=/home/user/Macks/assets/raw/meshy
M() { env NODE_USE_ENV_PROXY=1 npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@" --output-schema v1 --format json --no-update-check 2>>$W/remesh.err; }
j() { python3 -c "import json,sys;d=json.load(sys.stdin);r=d.get('result',{});print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
PD=$(ls -d $W/$P/*/ | head -1); PD=${PD%/}
X=$(python3 -c "
import json,glob
for f in glob.glob('$PD/task_*.json'):
  d=json.load(open(f)); t=d.get('result',d); t=t.get('task',t)
  if t.get('status')=='SUCCEEDED' and (t.get('task_type')=='remesh' or 'remesh' in str(t.get('type',''))) and '$TGT' in json.dumps(d): print(t.get('id'))" | head -1)
if [ -z "$X" ]; then
  RID=$(python3 -c "
import json,glob
for f in glob.glob('$PD/task_*.json'):
  d=json.load(open(f)); t=d.get('result',d); t=t.get('task',t)
  if t.get('mode')=='refine' and t.get('status')=='SUCCEEDED': print(t.get('id'))" | head -1)
  X=$(M remesh create --input-task-id $RID --topology triangle --target-polycount $TGT --target-formats glb --async --project "$PD" --stage remesh --workspace "$W" | j "r['submission']['task_id']")
  M remesh wait $X --timeout 1500 --project "$PD" --stage remesh --workspace "$W" > /dev/null
fi
M download --task-json "$PD/task_$X.json" --asset model.glb --output "$W/$OUT-rm.glb" --overwrite --project "$PD" --stage download-rm --workspace "$W" > /dev/null
npx --yes @gltf-transform/cli@4 optimize "$W/$OUT-rm.glb" "/home/user/Macks/public/models/$OUT.glb" --compress meshopt --texture-compress webp --texture-size 1024 --no-simplify > /dev/null 2>&1 || npx --yes @gltf-transform/cli@4 optimize "$W/$OUT-rm.glb" "/home/user/Macks/public/models/$OUT.glb" --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio 1 > /dev/null 2>&1
echo "$OUT neu: $(stat -c %s /home/user/Macks/public/models/$OUT.glb) Bytes"
