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

echo "pod install (keeps the codegen and the Pods project in step)…"
bash scripts/pod-install.sh

echo
echo "detox build (ios.sim.release)…"
exec npx detox build --configuration ios.sim.release
