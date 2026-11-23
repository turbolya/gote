#!/bin/zsh
# build.sh <udid> — sign and build the runner for a connected device.
#
# Automatic signing on team 24M7W58WAU (set in the project): the first build
# creates an Apple Development certificate and registers the device, so Xcode
# must be signed in to the team's Apple ID (Xcode → Settings → Accounts).
# A fresh device's profile can still be downloading on the first try ("Build
# input file cannot be found: …mobileprovision"), so it retries once.
set -u
D=${0:A:h}; UDID=${1:?usage: build.sh <udid>  (xcrun devicectl list devices)}
cd "$D"
for i in 1 2; do
  out=$(xcodebuild build-for-testing -scheme GoteUITests -destination "id=$UDID" \
    -derivedDataPath "$D/dd" -allowProvisioningUpdates -allowProvisioningDeviceRegistration 2>&1)
  if print -r -- "$out" | grep -q "TEST BUILD SUCCEEDED"; then echo "built for $UDID"; exit 0; fi
done
print -r -- "$out" | grep -E "error|FAILED" | head -20
exit 1
