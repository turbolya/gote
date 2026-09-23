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
# pod install needs a UTF-8 locale or it dies in Ruby's unicode normalisation
# ("Unicode Normalization not appropriate for ASCII-8BIT"), which the plain
# `pod install` in the handbook does not mention and this VM hits every time.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "pod install (keeps the codegen and the Pods project in step)…"
(cd ios && LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 pod install)

echo
echo "detox build (ios.sim.release)…"
exec npx detox build --configuration ios.sim.release
