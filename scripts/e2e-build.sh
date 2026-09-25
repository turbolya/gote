#!/usr/bin/env bash
#
# Build the app Detox runs against.
#
# It runs `pod install` first, every time, because the alternative is a build
# that fails with a wall of:
#
#   error: Build input file cannot be found:
#   '…/ios/build/generated/ios/ReactCodegen/react/renderer/components/…/States.cpp'
#
# whenever Xcode's derived data under ios/build has been cleared — which
# scripts/build-ios.sh does on every release build, to keep this VM off a full
# disk. The generated files themselves survive that pruning; what does not is
# whatever ties them to the Pods project, and only pod install puts that back.
# It is idempotent and takes under a minute, so paying it unconditionally is
# cheaper than the twenty minutes it costs to recognise the failure.
#
set -euo pipefail

cd "$(dirname "$0")/.."

# This build wants ~9 GB of derived data, and the screenshot capture leaves a
# similar pile in build-shots. Left alone they fill the disk between them —
# which is how this build failed with the volume at 158 MB free. Everything the
# pruner touches is regenerable, so paying for it here is cheaper than a build
# that dies halfway.
FREE_GB="$(df -g . | awk 'NR==2 {print $4}')"
if [ "$FREE_GB" -lt "${GOTE_E2E_MIN_GB:-12}" ]; then
  echo "Only ${FREE_GB} GB free — pruning first."
  bash scripts/build-ios.sh --clean
  echo
fi

echo "pod install (keeps the codegen and the Pods project in step)…"
bash scripts/pod-install.sh

echo
echo "detox build (ios.sim.release)…"
exec npx detox build --configuration ios.sim.release
