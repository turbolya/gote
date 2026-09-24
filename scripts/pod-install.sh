#!/usr/bin/env bash
#
# `pod install`, for every path that builds the native app on this machine.
#
# It exists because scripts/build-ios.sh prunes ios/build to keep this VM off a
# full disk, and the next native build then fails with a wall of:
#
#   error: Build input file cannot be found:
#   '…/ios/build/generated/ios/ReactCodegen/…/States.cpp'
#
# The codegen lives under the derived-data path, so pruning takes it with it,
# and only pod install puts it back. Both the Detox build (scripts/e2e-build.sh)
# and the screenshot capture (screenshots-local/capture-screenshots.sh) call
# this first; it is idempotent and takes under a minute, which is far cheaper
# than recognising that failure again.
#
# The UTF-8 locale is not optional: without it CocoaPods dies in Ruby's unicode
# normalisation ("Unicode Normalization not appropriate for ASCII-8BIT").
set -euo pipefail

cd "$(dirname "$0")/../ios"
LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 exec pod install
