#!/usr/bin/env python3
# android.py <serial> "<steps>"|<stepsfile> [outdir] — the iOS runner's step
# language, over adb, for a real Android phone (see README.md).
#
# Elements are found through `uiautomator dump`: a React Native testID is the
# node's resource-id, an accessibility label its content-desc, visible text its
# text. Screenshots and trees land in outdir (default out/android), named after
# their steps, like the iOS runner's.
#
# Steps: see README.md (the same table as the iOS runner's).
#
# Differences from iOS: `pinch` is skipped (adb's input has no multi-touch),
# `alert:<label>` taps the button in whatever dialog is up (a permission
# prompt's "While using the app"), and `back` presses the system back button.
import os, re, shutil, subprocess, sys, time, xml.etree.ElementTree as ET

ADB = os.environ.get("ADB") or shutil.which("adb") or os.path.expanduser("~/Library/Android/sdk/platform-tools/adb")
if len(sys.argv) < 3:
    sys.exit('usage: android.py <serial> "<steps>"|<stepsfile> [outdir]')
SER, STEPS = sys.argv[1], sys.argv[2]
OUT = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "out", "android")
PKG = os.environ.get("GOTE_PACKAGE", "com.gote.app")
shutil.rmtree(OUT, ignore_errors=True)
os.makedirs(OUT, exist_ok=True)
n = misses = fails = 0


def adb(*a, binary=False):
    r = subprocess.run([ADB, "-s", SER, *a], capture_output=True)
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


W, H = map(int, re.search(r"(\d+)x(\d+)", adb("shell", "wm", "size")).groups())


def dump():
    for _ in range(3):
        adb("shell", "uiautomator", "dump", "/sdcard/gote-ui.xml")
        x = adb("shell", "cat", "/sdcard/gote-ui.xml")
        if x.startswith("<?xml"):
            try:
                return ET.fromstring(x)
            except ET.ParseError:
                pass
        time.sleep(0.5)
    return ET.fromstring("<hierarchy/>")


def bounds(node):
    return tuple(map(int, re.findall(r"\d+", node.get("bounds", "[0,0][0,0]"))))


def find(pred, timeout=20.0):
    end = time.time() + timeout
    while True:
        for node in dump().iter("node"):
            if pred(node):
                return node
        if time.time() > end:
            return None
        time.sleep(0.4)


def name(s):
    global n
    n += 1
    return os.path.join(OUT, "%02d-%s" % (n, re.sub(r"[^\w.-]+", "_", s)))


def shot(s):
    with open(name(s) + ".png", "wb") as f:
        f.write(adb("exec-out", "screencap", "-p", binary=True))


def tree(s):
    lines = []

    def walk(node, d):
        rid, txt, desc = node.get("resource-id", ""), node.get("text", ""), node.get("content-desc", "")
        line = " " * d + node.get("class", "").split(".")[-1]
        if rid: line += " id=" + rid
        if txt: line += ' text="%s"' % txt
        if desc: line += ' desc="%s"' % desc
        if node.get("checked") == "true": line += " checked"
        if node.get("selected") == "true": line += " selected"
        lines.append(line + " " + node.get("bounds", ""))
        for c in node:
            walk(c, d + 1)

    walk(dump(), 0)
    with open(name("tree-" + s) + ".txt", "w") as f:
        f.write("\n".join(lines))


def center(node):
    x1, y1, x2, y2 = bounds(node)
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_node(node):
    x, y = center(node)
    adb("shell", "input", "tap", str(x), str(y))


def report(ok, what):
    global misses
    print("GOTE %s: %s" % ("found" if ok else "MISSING", what), flush=True)
    if not ok:
        misses += 1
        shot("missing-" + what)
        tree("missing-" + what)
    return ok


def fail(why):
    global fails
    fails += 1
    print("GOTE FAIL: " + why, flush=True)
    shot("fail")
    tree("fail")


def tap(pred, what):
    node = find(pred)
    if report(node is not None, what):
        tap_node(node)
    return node


def drag(x1, y1, x2, y2, ms=350):
    adb("shell", "input", "swipe", *[str(int(v)) for v in (x1 * W, y1 * H, x2 * W, y2 * H)], str(ms))


def label(node):
    return node.get("content-desc") or node.get("text") or ""


by_id = lambda v: (lambda nd: nd.get("resource-id") == v)
by_label = lambda v: (lambda nd: nd.get("text") == v or nd.get("content-desc") == v)
by_contains = lambda v: (lambda nd: v.lower() in (nd.get("text", "") + " " + nd.get("content-desc", "")).lower())
by_prefix = lambda v: (lambda nd: nd.get("resource-id", "").startswith(v))
# Android capitalises dialog buttons ("EXIT"), so alerts match either case.
by_button = lambda v: (lambda nd: nd.get("class", "").endswith("Button") and (nd.get("text") or "").lower() == v.lower())

if os.path.isfile(STEPS):
    lines = open(STEPS).read().splitlines()
else:
    lines = STEPS.split("|")

for raw in lines:
    step = raw.strip()
    if not step or step.startswith("#"):
        continue
    cmd, _, arg = step.partition(":")
    print("GOTE step: " + step, flush=True)
    key, _, val = arg.partition("=")
    if cmd == "launch":
        adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
        time.sleep(2)
    elif cmd == "relaunch":
        adb("shell", "am", "force-stop", PKG)
        adb("shell", "monkey", "-p", PKG, "-c", "android.intent.category.LAUNCHER", "1")
        time.sleep(3)
    elif cmd == "terminate":
        adb("shell", "am", "force-stop", PKG)
    elif cmd == "back":
        adb("shell", "input", "keyevent", "KEYCODE_BACK")
    elif cmd == "home":
        adb("shell", "input", "keyevent", "KEYCODE_HOME")
    elif cmd == "tap":
        tap(by_id(arg), arg)
    elif cmd == "taplabel":
        tap(by_label(arg), arg)
    elif cmd == "tapcontains":
        tap(by_contains(arg), arg)
    elif cmd == "tapfirst":
        tap(by_prefix(arg), arg)
    elif cmd == "tapxy":
        x, y = map(float, arg.split(","))
        adb("shell", "input", "tap", str(int(x * W)), str(int(y * H)))
    elif cmd == "tapif":
        node = find(by_id(arg), timeout=3)
        if node is not None:
            tap_node(node)
        print("GOTE %s: %s" % ("found" if node is not None else "absent", arg), flush=True)
    elif cmd in ("tapifon", "tapifoff"):
        node = find(by_id(arg))
        if report(node is not None, arg):
            on = node.get("checked") == "true"
            if on == (cmd == "tapifon"):
                tap_node(node)
                print("GOTE toggled: " + arg, flush=True)
            else:
                print("GOTE left: " + arg, flush=True)
    elif cmd == "doubletap":
        node = find(by_id(arg))
        if report(node is not None, arg):
            x, y = center(node)
            # One shell, so the second tap follows inside the double-tap window.
            adb("shell", "input tap %d %d & sleep 0.06; input tap %d %d" % (x, y, x, y))
    elif cmd == "pinch":
        print("GOTE skipped: pinch needs multi-touch, which adb input lacks", flush=True)
    elif cmd == "alert":
        # Not a miss when absent: a prompt shows only until it is answered.
        node = find(by_button(arg), timeout=8)
        if node is not None:
            tap_node(node)
        print("GOTE %s: alert %s" % ("found" if node is not None else "absent", arg), flush=True)
    elif cmd == "drag":
        drag(*map(float, arg.split(",")))
    elif cmd == "swipe":
        d = {"up": (0.5, 0.8, 0.5, 0.3), "down": (0.5, 0.3, 0.5, 0.8),
             "left": (0.85, 0.5, 0.15, 0.5), "right": (0.15, 0.5, 0.85, 0.5)}[arg]
        drag(*d)
    elif cmd == "scrollto":
        ok = False
        for _ in range(10):
            node = find(by_id(arg), timeout=0)
            if node is not None:
                x1, y1, x2, y2 = bounds(node)
                if y1 >= 0 and y2 <= H * 0.92 and y2 > y1:
                    ok = True
                    break
            drag(0.5, 0.8, 0.5, 0.4)
            time.sleep(0.6)
        report(ok, arg)
    elif cmd == "typeinto":
        node = tap(by_id(key), key)
        if node is not None and val:
            time.sleep(0.5)
            # adb's `input text` is ASCII only; %s is its space.
            adb("shell", "input", "text", val.replace(" ", "%s"))
    elif cmd == "type":
        adb("shell", "input", "text", arg.replace(" ", "%s"))
    elif cmd == "waitid":
        report(find(by_id(key), timeout=float(val or 20)) is not None, key)
    elif cmd == "waitlabel":
        report(find(by_contains(arg)) is not None, arg)
    elif cmd == "assertlabel":
        node = find(by_id(key))
        if report(node is not None, key):
            end = time.time() + 5
            while label(node) != val and time.time() < end:
                time.sleep(0.4)
                node = find(by_id(key), timeout=0) or node
            if label(node) == val:
                print("GOTE ok: %s = %s" % (key, val), flush=True)
            else:
                fail('%s is "%s", want "%s"' % (key, label(node), val))
    elif cmd == "assertgone":
        end = time.time() + 10
        while find(by_id(arg), timeout=0) is not None and time.time() < end:
            time.sleep(0.4)
        if find(by_id(arg), timeout=0) is not None:
            fail(arg + " is still there")
        else:
            print("GOTE ok: %s gone" % arg, flush=True)
    elif cmd == "wait":
        time.sleep(float(arg or 1))
    elif cmd == "shot":
        shot(arg)
    elif cmd == "tree":
        tree(arg)
    else:
        print("GOTE unknown step: " + cmd, flush=True)

print("GOTE summary: %d missing, %d failed" % (misses, fails), flush=True)
