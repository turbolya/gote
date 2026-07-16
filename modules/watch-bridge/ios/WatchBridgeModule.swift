// Phone-side WatchConnectivity bridge. The JS side (src/watch.js) calls
// updateContext(...) with a small plist-safe snapshot (lifetime accuracy,
// streak, mini-deck); WCSession delivers it to the paired watch as the
// "application context" — the latest snapshot wins and is handed to the watch
// app even if it isn't running when the update arrives.
//
// Everything here is a safe no-op when there is no paired watch (Android
// never links this module; iPhones without a watch return isSupported()=false
// or fail updateApplicationContext, which we swallow).

import ExpoModulesCore
import WatchConnectivity

public class WatchBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    // Whether WatchConnectivity exists on this device at all (false on iPad).
    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    // Push the latest snapshot. Resolves immediately; delivery is best-effort
    // and handled by the session (queued through activation if needed).
    AsyncFunction("updateContext") { (context: [String: Any]) in
      WatchSessionHolder.shared.update(context: context)
    }
  }
}

// Owns the WCSession delegate + a pending snapshot to flush once the session
// finishes activating (activation is asynchronous on first use).
final class WatchSessionHolder: NSObject, WCSessionDelegate {
  static let shared = WatchSessionHolder()
  private var pending: [String: Any]?

  func update(context: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil { session.delegate = self }
    switch session.activationState {
    case .activated:
      try? session.updateApplicationContext(context)
    default:
      pending = context
      session.activate()
    }
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, let context = pending {
      try? session.updateApplicationContext(context)
      pending = nil
    }
  }

  // Required by the protocol on iOS (multi-watch handoff); nothing to do.
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate so a newly paired watch keeps receiving updates.
    session.activate()
  }
}
