import XCTest

// Drives an installed app (default com.gote.app) from a step script passed in
// the GOTE_STEPS environment variable (set TEST_RUNNER_GOTE_STEPS for
// xcodebuild). Steps are separated by "|", each "cmd" or "cmd:arg":
//   launch | relaunch | terminate | home
//   tap:<identifier>  taplabel:<label>  tapcontains:<text>  tapxy:<x>,<y> (0..1)
//   drag:<x1>,<y1>,<x2>,<y2>  tapfirst:<identifier prefix>  scrollto:<identifier>  typeinto:<identifier>=<text>
//   waitid:<identifier>  waitlabel:<text>  wait:<seconds>
//   type:<text>  swipe:<up|down|left|right>
//   doubletap:<identifier>  pinch:<identifier>=<scale>  alert:<button label>
//   assertlabel:<identifier>=<label>  assertgone:<identifier>
//   tapif:<identifier> (tap if it appears within 3 s; no miss if not)
//   tapifon:<identifier> / tapifoff:<identifier> (tap a switch only in that state)
//   shot:<name>  tree:<name>
// waitid takes an optional timeout: waitid:<identifier>=<seconds>.
// Every check prints "GOTE found|MISSING|ok|FAIL: …"; the run ends with a
// "GOTE summary" line counting the misses and failures.
final class GoteUITests: XCTestCase {
    var app: XCUIApplication!
    var counter = 0
    var misses = 0
    var fails = 0

    func testRun() throws {
        continueAfterFailure = true
        let env = ProcessInfo.processInfo.environment
        app = XCUIApplication(bundleIdentifier: env["GOTE_BUNDLE"] ?? "com.gote.app")
        let script = env["GOTE_STEPS"] ?? "launch|wait:3|shot:start|tree:start"
        for raw in script.components(separatedBy: "|") {
            let step = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if step.isEmpty { continue }
            let parts = step.split(separator: ":", maxSplits: 1).map(String.init)
            let cmd = parts[0]
            let arg = parts.count > 1 ? parts[1] : ""
            print("GOTE step: \(step)")
            run(cmd, arg)
        }
        print("GOTE summary: \(misses) missing, \(fails) failed")
    }

    func run(_ cmd: String, _ arg: String) {
        switch cmd {
        case "launch": app.activate()
        case "relaunch": app.terminate(); app.activate()
        case "terminate": app.terminate()
        case "home": XCUIDevice.shared.press(.home)
        case "tap": tap(query(NSPredicate(format: "identifier == %@", arg)), arg)
        case "taplabel": tap(query(NSPredicate(format: "label == %@", arg)), arg)
        case "tapcontains": tap(query(NSPredicate(format: "label CONTAINS[c] %@", arg)), arg)
        case "tapfirst": tap(query(NSPredicate(format: "identifier BEGINSWITH %@", arg)), arg)
        case "scrollto":
            let el = query(NSPredicate(format: "identifier == %@", arg))
            var tries = 0
            // Finger-speed drags: XCUITest's swipeUp() flick doesn't scroll
            // gote's menu on a real device.
            while !(el.exists && el.isHittable) && tries < 10 {
                app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
                    .press(forDuration: 0.05, thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.4)),
                           withVelocity: .default, thenHoldForDuration: 0.05)
                tries += 1
            }
            let ok = el.exists && el.isHittable
            if !ok { misses += 1 }
            print("GOTE \(ok ? "found" : "MISSING"): \(arg)")
        case "typeinto":
            let kv = arg.split(separator: "=", maxSplits: 1).map(String.init)
            let el = query(NSPredicate(format: "identifier == %@", kv[0]))
            if wait(el, kv[0]) {
                el.tap()
                // One key at a time: React Native's controlled inputs drop
                // keystrokes that arrive faster than they re-render.
                if kv.count > 1 {
                    for ch in kv[1] { el.typeText(String(ch)); Thread.sleep(forTimeInterval: 0.12) }
                }
            }
        case "tapxy":
            let xy = arg.split(separator: ",").compactMap { Double($0) }
            if xy.count == 2 {
                app.coordinate(withNormalizedOffset: CGVector(dx: xy[0], dy: xy[1])).tap()
            }
        case "drag":
            // drag:x1,y1,x2,y2 in 0..1 fractions of the screen, at finger speed.
            let v = arg.split(separator: ",").compactMap { Double($0) }
            if v.count == 4 {
                let a = app.coordinate(withNormalizedOffset: CGVector(dx: v[0], dy: v[1]))
                let b = app.coordinate(withNormalizedOffset: CGVector(dx: v[2], dy: v[3]))
                a.press(forDuration: 0.05, thenDragTo: b, withVelocity: .default, thenHoldForDuration: 0.05)
            }
        case "waitid":
            let kv = arg.split(separator: "=", maxSplits: 1).map(String.init)
            let t = kv.count > 1 ? Double(kv[1]) ?? 20 : 20
            wait(query(NSPredicate(format: "identifier == %@", kv[0])), kv[0], timeout: t)
        case "tapif":
            let el = query(NSPredicate(format: "identifier == %@", arg))
            if el.waitForExistence(timeout: 3) { el.tap(); print("GOTE found: \(arg)") }
            else { print("GOTE absent: \(arg)") }
        case "tapifon", "tapifoff":
            let el = query(NSPredicate(format: "identifier == %@", arg))
            if wait(el, arg) {
                let on = (el.value as? String) == "1"
                if on == (cmd == "tapifon") { el.tap(); print("GOTE toggled: \(arg)") }
                else { print("GOTE left: \(arg)") }
            }
        case "doubletap":
            let el = query(NSPredicate(format: "identifier == %@", arg))
            if wait(el, arg) { el.doubleTap() }
        case "pinch":
            // pinch:<id>=<scale>: above 1 zooms in, below 1 out.
            let kv = arg.split(separator: "=", maxSplits: 1).map(String.init)
            let el = query(NSPredicate(format: "identifier == %@", kv[0]))
            let scale = kv.count > 1 ? Double(kv[1]) ?? 2 : 2
            if wait(el, kv[0]) { el.pinch(withScale: scale, velocity: scale > 1 ? 1 : -1) }
        case "alert":
            // The app's own alerts, or a system one (a permission prompt),
            // which belongs to SpringBoard. Not a miss when absent: a prompt
            // shows only until it is answered.
            let sb = XCUIApplication(bundleIdentifier: "com.apple.springboard")
            let own = app.alerts.buttons[arg], sys = sb.buttons[arg]
            let end = Date().addingTimeInterval(8)
            while !own.exists && !sys.exists && Date() < end { Thread.sleep(forTimeInterval: 0.3) }
            if own.exists { own.tap(); print("GOTE found: alert \(arg)") }
            else if sys.exists { sys.tap(); print("GOTE found: alert \(arg)") }
            else { print("GOTE absent: alert \(arg)") }
        case "assertlabel":
            let kv = arg.split(separator: "=", maxSplits: 1).map(String.init)
            let el = query(NSPredicate(format: "identifier == %@", kv[0]))
            let want = kv.count > 1 ? kv[1] : ""
            if wait(el, kv[0]) {
                // Labels can lag a re-render; give it a few seconds to match.
                let end = Date().addingTimeInterval(5)
                while el.label != want && Date() < end { Thread.sleep(forTimeInterval: 0.3) }
                if el.label == want { print("GOTE ok: \(kv[0]) = \(want)") }
                else { fail("\(kv[0]) is \"\(el.label)\", want \"\(want)\"") }
            }
        case "assertgone":
            let el = query(NSPredicate(format: "identifier == %@", arg))
            let end = Date().addingTimeInterval(10)
            while el.exists && Date() < end { Thread.sleep(forTimeInterval: 0.3) }
            if el.exists { fail("\(arg) is still there") } else { print("GOTE ok: \(arg) gone") }
        case "waitlabel": wait(query(NSPredicate(format: "label CONTAINS[c] %@", arg)), arg)
        case "wait": Thread.sleep(forTimeInterval: Double(arg) ?? 1)
        case "type": app.typeText(arg)
        case "swipe":
            switch arg {
            case "up": app.swipeUp()
            case "down": app.swipeDown()
            case "left": app.swipeLeft()
            default: app.swipeRight()
            }
        case "shot": shot(arg)
        case "tree": tree(arg)
        default: print("GOTE unknown step: \(cmd)")
        }
    }

    func query(_ p: NSPredicate) -> XCUIElement {
        app.descendants(matching: .any).matching(p).firstMatch
    }

    @discardableResult
    func wait(_ el: XCUIElement, _ what: String, timeout: Double = 20) -> Bool {
        let ok = el.waitForExistence(timeout: timeout)
        print("GOTE \(ok ? "found" : "MISSING"): \(what)")
        if !ok { misses += 1; shot("missing-\(what)"); tree("missing-\(what)") }
        return ok
    }

    func fail(_ why: String) {
        fails += 1
        print("GOTE FAIL: \(why)")
        shot("fail"); tree("fail")
    }

    func tap(_ el: XCUIElement, _ what: String) {
        guard wait(el, what) else { return }
        if el.isHittable { el.tap() }
        else { el.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
    }

    func name(_ s: String) -> String {
        counter += 1
        return String(format: "%02d-%@", counter, s)
    }

    func shot(_ s: String) {
        let a = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        a.name = name(s)
        a.lifetime = .keepAlways
        add(a)
    }

    // Compact accessibility tree: type, identifier, label, frame.
    func tree(_ s: String) {
        var out = ""
        func walk(_ n: XCUIElementSnapshot, _ depth: Int) {
            let f = n.frame
            var line = String(repeating: " ", count: depth) + "\(n.elementType.rawValue)"
            if !n.identifier.isEmpty { line += " id=\(n.identifier)" }
            if !n.label.isEmpty { line += " label=\"\(n.label)\"" }
            if let v = n.value as? String, !v.isEmpty { line += " value=\"\(v)\"" }
            line += String(format: " [%.0f,%.0f %.0fx%.0f]", f.minX, f.minY, f.width, f.height)
            out += line + "\n"
            for c in n.children { walk(c, depth + 1) }
        }
        do { walk(try app.snapshot(), 0) } catch { out = "snapshot failed: \(error)" }
        let a = XCTAttachment(string: out)
        a.name = name("tree-\(s)")
        a.lifetime = .keepAlways
        add(a)
    }
}
