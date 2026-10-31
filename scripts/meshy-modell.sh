#!/bin/bash
# Ein Modell: Vorschau -> Oberflächen -> laden -> fürs iPhone verkleinern
ID=$1; PROMPT=$2; TARGET=$3
W=/home/user/Macks/assets/raw/meshy
M() { env NODE_USE_ENV_PROXY=1 npm exec --yes --package=meshy-cli@0.4.0 -- meshy "$@" --output-schema v1 --format json --no-update-check 2>>$W/$ID.err; }
j() { python3 -c "import json,sys;d=json.load(sys.stdin);r=d.get('result',{});print(eval(sys.argv[1]))" "$1" 2>/dev/null; }
[ -f /home/user/Macks/assets/raw/meshy/out/$ID.glb ] && { echo "$ID schon da"; exit 0; }
TID=$(M text-to-3d create --mode preview --prompt "$PROMPT" --target-formats glb --async | j "r['submission']['task_id']")
[ -z "$TID" ] && { echo "$ID FEHLER create"; exit 1; }
PD=$(M project init --root "$W/$ID" --name "$ID" --task-id $TID --task-type text-to-3d --workspace "$W" | j "r['project_dir']")
M text-to-3d wait $TID --timeout 1500 --project "$PD" --stage preview --workspace "$W" > /dev/null
RID=$(M text-to-3d create --mode refine --preview-task-id $TID --enable-pbr true --texture-resolution 2k --target-formats glb --async --project "$PD" --stage refine --workspace "$W" | j "r['submission']['task_id']")
[ -z "$RID" ] && { echo "$ID FEHLER refine"; exit 1; }
M text-to-3d wait $RID --timeout 1800 --project "$PD" --stage refine --workspace "$W" > /dev/null
M download --task-json "$PD/task_$RID.json" --asset thumbnail.primary --output "$W/$ID-preview.png" --project "$PD" --stage preview-img --workspace "$W" > /dev/null
M download --task-json "$PD/task_$RID.json" --asset model.glb --output "$W/$ID.glb" --project "$PD" --stage download --workspace "$W" > /dev/null
[ -f "$W/$ID.glb" ] || { echo "$ID FEHLER download"; exit 1; }
TRI=$(python3 -c "
import json,struct
b=open('$W/$ID.glb','rb').read();ln=struct.unpack('<I',b[12:16])[0];j=json.loads(b[20:20+ln]);t=0
for m in j['meshes']:
  for p in m['primitives']: t+=j['accessors'][p.get('indices',p['attributes']['POSITION'])]['count']//3
print(t)")
RATIO=$(python3 -c "print(min(1,$TARGET/$TRI))")
npx --yes @gltf-transform/cli@4 optimize "$W/$ID.glb" "/home/user/Macks/assets/raw/meshy/out/$ID.glb" --compress meshopt --texture-compress webp --texture-size 1024 --simplify-ratio $RATIO --simplify-error 0.03 > /dev/null 2>&1
echo "$ID fertig: $TRI Dreiecke roh, Datei $(stat -c %s /home/user/Macks/assets/raw/meshy/out/$ID.glb 2>/dev/null) Bytes"
