#!/bin/bash
# Capture App Store screenshots from the live app using a real iNaturalist
# account (default mate_koch), across all device types, and save them to a
# timestamped folder in the (non-git) gote-launch folder.
#
#   ./screenshots-local/capture-screenshots.sh
#
# Env overrides:
#   SHOTS_USER      iNaturalist account                 (default: mate_koch)
#   SHOTS_PLACE     place searched for "Nearby species" (default: Kaposvar)
#   SHOTS_DEVICE    capture a single device only
#   SHOTS_DEVICES   newline-separated device list       (default: the set below)
#   SHOTS_SETTLE    slow-net delay multiplier (e.g. 2)  (default: 1)
#
# Output: /Users/mkoch/Developer/gote-launch/screenshots/<timestamp>/<device>/*.png

set -uo pipefail
export HOME=/Users/mkoch
export PATH=/Users/mkoch/Developer/node/bin:$PATH
# Watchman writes its socket/state under $XDG_STATE_HOME (default ~/.local/state),
# which is root-owned here and makes `watchman get-sockname` fail with EACCES —
# which detox/jest treat as fatal, capturing 0 screenshots. Redirect it to a
# writable dir so the Metro/haste watcher can start.
export XDG_STATE_HOME="${XDG_STATE_HOME:-/tmp/mkoch-xdg-state}"
mkdir -p "$XDG_STATE_HOME"

REPO=/Users/mkoch/Developer/gote
SHOTS_DIR="$REPO/screenshots-local"
CONFIG="$SHOTS_DIR/detox.shots.config.js"
TEST="$SHOTS_DIR/screenshots.test.js"

USER_LOGIN="${SHOTS_USER:-mate_koch}"
# Nearby-species center (Kaposvár, Hungary) — set as the simulator GPS location.
PLACE_NAME="${SHOTS_PLACE:-Kaposvár, Hungary}"
LAT="${SHOTS_LAT:-46.3594}"
LNG="${SHOTS_LNG:-17.7968}"

TS="$(date +%Y%m%d-%H%M%S)"
OUT="/Users/mkoch/Developer/gote-launch/screenshots/$TS"
mkdir -p "$OUT"
cd "$REPO" || exit 1

# --- device list (one per App Store family) -----------------------------------
if [ -n "${SHOTS_DEVICE:-}" ]; then
  DEVICES=("$SHOTS_DEVICE")
elif [ -n "${SHOTS_DEVICES:-}" ]; then
  IFS=$'\n' read -rd '' -a DEVICES <<< "$SHOTS_DEVICES"
else
  DEVICES=(
    "iPhone 17 Pro Max"        # 6.9" iPhone (required)
    "iPhone 17"                # standard iPhone
    "iPad Pro 13-inch (M4)"    # 13" iPad (required while supportsTablet is on)
  )
fi

# --- look up a nice species for the detail screenshot (best-effort) -----------
TID=""; TNAME=""
read -r TID TNAME < <(
  curl -s "https://api.inaturalist.org/v1/observations?user_login=${USER_LOGIN}&photos=true&order_by=votes&order=desc&per_page=1&fields=taxon" \
    -H "User-Agent: gote" 2>/dev/null \
  | python3 -c 'import sys,json
try:
    t=json.load(sys.stdin)["results"][0]["taxon"]; print(t["id"], t.get("name",""))
except Exception:
    print("")'
)

echo "──────────────────────────────────────────────"
echo " gote screenshots"
echo "  account : @$USER_LOGIN"
echo "  nearby  : $PLACE_NAME ($LAT, $LNG), 50 km"
echo "  detail  : ${TNAME:-(skipped)} ${TID:+(taxon $TID)}"
echo "  output  : $OUT"
echo "  devices : ${DEVICES[*]}"
echo "──────────────────────────────────────────────"

export SHOTS_USER="$USER_LOGIN" \
       SHOTS_TAXON_ID="$TID" SHOTS_TAXON_NAME="$TNAME" \
       SHOTS_LAT="$LAT" SHOTS_LNG="$LNG"

echo "▶ Building screenshot app once (Release, live network)…"
npx detox build -c ios.shots --config-path "$CONFIG" || { echo "✗ build failed"; exit 1; }

# --- capture per device × appearance ------------------------------------------
# The app follows the OS light/dark setting (app.json userInterfaceStyle
# "automatic" + the default "system" theme mode), so the appearance is set on the
# simulator with `simctl ui` before each run. Light shots keep the original
# folder names (they're the App Store set); dark ones get a `-dark` suffix.
# Set SHOTS_APPEARANCES="light" to skip the dark pass and halve the runtime.
APPEARANCES="${SHOTS_APPEARANCES:-light dark}"
for DEVICE in "${DEVICES[@]}"; do
  if ! xcrun simctl list devices available | grep -q "$DEVICE ("; then
    echo "⚠️  skip (simulator not installed): $DEVICE"
    continue
  fi
  SLUG="$(echo "$DEVICE" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-')"
  # UDID of the first matching available device — needed to set its appearance.
  UDID="$(xcrun simctl list devices available | grep -m1 "$DEVICE (" \
    | grep -oE '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}')"
  for APPEARANCE in $APPEARANCES; do
    DOUT="$OUT/$SLUG"
    [ "$APPEARANCE" = "dark" ] && DOUT="$OUT/$SLUG-dark"
    mkdir -p "$DOUT"
    echo "▶ Capturing on: $DEVICE ($APPEARANCE) → $DOUT"
    if [ -n "$UDID" ]; then
      # Appearance can only be set on a booted device, and Detox reuses it.
      xcrun simctl boot "$UDID" 2>/dev/null || true
      xcrun simctl bootstatus "$UDID" -b >/dev/null 2>&1 || true
      xcrun simctl ui "$UDID" appearance "$APPEARANCE" >/dev/null 2>&1 \
        || echo "   (could not set $APPEARANCE appearance)"
    fi
    SHOTS_OUT="$DOUT" SHOTS_DEVICE="$DEVICE" \
      npx detox test -c ios.shots --config-path "$CONFIG" \
      --artifacts-location "$DOUT" --cleanup "$TEST"
    # Flatten Detox's nested artifact dirs into this device's folder.
    find "$DOUT" -mindepth 2 -type f -name '*.png' -exec mv -f {} "$DOUT/" \; 2>/dev/null
    find "$DOUT" -mindepth 1 -type d -empty -delete 2>/dev/null
    echo "   $(find "$DOUT" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ') screenshot(s)."
  done
done

# --- Apple Watch pass ---------------------------------------------------------
# watchOS UI can't be driven headlessly (no Detox for the watch, no simctl tap),
# so we capture by relaunching the watch app in `-goteShot <screen>` mode, which
# jumps straight to each screen. Real gameplay data (photos + the seeded 83%
# stats) comes from a quick phone→watch sync first; if that yields nothing the
# app seeds a demo snapshot so screens are never blank.
#
# Needs a paired iPhone+Watch simulator (create one in Xcode ▸ Devices, or
# `xcrun simctl pair <watch-udid> <phone-udid>`). Set SHOTS_WATCH=0 to skip.
APP_BIN="$REPO/build-shots/Build/Products/Release-iphonesimulator/gote.app"
if [ "${SHOTS_WATCH:-1}" = "1" ]; then
  WATCH_UDID="$(xcrun simctl list pairs | grep -m1 'Watch:' | grep -oE '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}')"
  PHONE_UDID="$(xcrun simctl list pairs | grep -m1 'Phone:' | grep -oE '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}')"
  if [ -z "$WATCH_UDID" ] || [ -z "$PHONE_UDID" ]; then
    echo "⚠️  skip Apple Watch: no paired iPhone+Watch simulator found."
    echo "    Create one in Xcode ▸ Devices, then re-run (or SHOTS_WATCH=0 to silence)."
  elif [ ! -d "$APP_BIN/Watch/GoteWatch.app" ]; then
    echo "⚠️  skip Apple Watch: no embedded watch app in the build ($APP_BIN)."
  else
    WOUT="$OUT/apple-watch"
    mkdir -p "$WOUT"
    echo "▶ Apple Watch: phone $PHONE_UDID + watch $WATCH_UDID → $WOUT"
    xcrun simctl boot "$PHONE_UDID" 2>/dev/null || true
    xcrun simctl boot "$WATCH_UDID" 2>/dev/null || true
    # Install the phone app (carries the watch app) on the phone, and the watch
    # app directly on the watch (sim doesn't auto-propagate the embedded app).
    xcrun simctl install "$PHONE_UDID" "$APP_BIN" || true
    xcrun simctl install "$WATCH_UDID" "$APP_BIN/Watch/GoteWatch.app" || true
    # Sync real data: the phone app (seeded 83% stats + real deck) pushes a
    # snapshot; then the watch app receives + persists it.
    xcrun simctl launch "$PHONE_UDID" com.gote.app >/dev/null 2>&1 || true
    sleep 12
    xcrun simctl launch "$WATCH_UDID" com.gote.app.watch >/dev/null 2>&1 || true
    sleep 5
    # The quiz photo loads over the network, so a fixed sleep can catch the
    # spinner. The app writes `shot-photo-ready` into its Documents dir once the
    # image is actually on screen — clear it, launch, then wait for it (bounded),
    # so the capture is deterministic. NOTE: resolve the app's DATA container,
    # not its app group — `get_app_container <udid> group.…` fails on a watch sim.
    GROUP_DIR="$(xcrun simctl get_app_container "$WATCH_UDID" com.gote.app.watch data 2>/dev/null)"
    READY="$GROUP_DIR/Documents/shot-photo-ready"
    WI=0
    for SHOT in home photo answers summary complications; do
      WI=$((WI + 1))
      NUM="$(printf '%02d' "$WI")"
      [ -n "$GROUP_DIR" ] && rm -f "$READY"
      xcrun simctl terminate "$WATCH_UDID" com.gote.app.watch >/dev/null 2>&1 || true
      xcrun simctl launch "$WATCH_UDID" com.gote.app.watch -goteShot "$SHOT" >/dev/null 2>&1 || true
      if [ "$SHOT" = "photo" ] && [ -n "$GROUP_DIR" ]; then
        WAITED=0
        while [ ! -f "$READY" ] && [ "$WAITED" -lt 40 ]; do
          sleep 1
          WAITED=$((WAITED + 1))
        done
        [ -f "$READY" ] || echo "   watch: photo did not report ready in ${WAITED}s — capturing anyway"
        sleep 1 # let the image settle/fade in
      else
        sleep 4
      fi
      xcrun simctl io "$WATCH_UDID" screenshot "$WOUT/watch-$NUM-$SHOT.png" >/dev/null 2>&1 \
        && echo "   watch: $SHOT" || echo "   watch: $SHOT (failed)"
    done
    echo "   $(find "$WOUT" -maxdepth 1 -name '*.png' | wc -l | tr -d ' ') watch screenshot(s)."
  fi
fi

echo "──────────────────────────────────────────────"
echo "✓ Done → $OUT"
find "$OUT" -name '*.png' | sort
