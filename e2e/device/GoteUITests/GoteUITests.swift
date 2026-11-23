import XCTest

// Drives an installed app (default com.gote.app) from a step script passed in
// the GOTE_STEPS environment variable (set TEST_RUNNER_GOTE_STEPS for
// xcodebuild). Steps are separated by "|", each "cmd" or "cmd:arg":
//   launch | relaunch | terminate | home
//   tap:<identifier>  taplabel:<label>  tapcontains:<text>  tapxy:<x>,<y> (0..1)
//   waitid:<identifier>  waitlabel:<text>  wait:<seconds>
//   type:<text>  swipe:<up|down|left|right>
//   shot:<name>  tree:<name>
final class GoteUITests: XCTestCase {
    var app: XCUIApplication!
    var counter = 0

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
        case "tapxy":
            let xy = arg.split(separator: ",").compactMap { Double($0) }
            if xy.count == 2 {
                app.coordinate(withNormalizedOffset: CGVector(dx: xy[0], dy: xy[1])).tap()
            }
        case "waitid": wait(query(NSPredicate(format: "identifier == %@", arg)), arg)
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
        if !ok { shot("missing-\(what)"); tree("missing-\(what)") }
        return ok
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
