#!/bin/zsh
# run.sh <udid> "<steps>" [outdir] — run a step script on a device (after
# build.sh) and export its screenshots and accessibility trees into outdir
# (default: out/latest). Set GOTE_BUNDLE to drive another app, e.g.
# GOTE_BUNDLE=com.apple.TestFlight to update gote from TestFlight.
#
# The device must stay unlocked: xcodebuild waits silently while it is locked.
set -u
D=${0:A:h}; UDID=${1:?usage: run.sh <udid> "<steps>" [outdir]}; STEPS=${2:?missing steps}
OUT=${3:-$D/out/latest}
rm -rf "$OUT" "$OUT.xcresult"; mkdir -p "$OUT"
cd "$D"
TEST_RUNNER_GOTE_STEPS="$STEPS" TEST_RUNNER_GOTE_BUNDLE="${GOTE_BUNDLE:-com.gote.app}" \
  xcodebuild test-without-building -scheme GoteUITests -destination "id=$UDID" \
  -derivedDataPath "$D/dd" -resultBundlePath "$OUT.xcresult" -allowProvisioningUpdates 2>&1 \
  | grep -E "GOTE|error:|TEST EXECUTE"
xcrun xcresulttool export attachments --path "$OUT.xcresult" --output-path "$OUT" >/dev/null 2>&1
# Rename the exported files to the names the steps gave them (01-menu.png, …).
if [[ -f "$OUT/manifest.json" ]]; then
  python3 -I - "$OUT" <<'PY'
import json, os, sys
out = sys.argv[1]
for t in json.load(open(os.path.join(out, "manifest.json"))):
    for a in t.get("attachments", []):
        src = os.path.join(out, a["exportedFileName"])
        ext = os.path.splitext(a["exportedFileName"])[1]
        base = a.get("suggestedHumanReadableName", a["exportedFileName"]).split("_0_")[0]
        dst = os.path.join(out, base if base.endswith(ext) else base + ext)
        if os.path.exists(src):
            os.rename(src, dst)
PY
fi
ls "$OUT"
