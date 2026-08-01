// Phone-side WatchConnectivity bridge.
//
// OUTBOUND — the JS side (src/watch.js) calls updateContext(...) with a small
// plist-safe snapshot (lifetime accuracy, streak, mini-deck); WCSession
// delivers it to the paired watch as the "application context" — the latest
// snapshot wins and is handed to the watch app even if it isn't running when
// the update arrives.
//
// INBOUND — the watch queues game results (answers / finished rounds) with
// transferUserInfo. They're buffered here and drained by JS through
// consumePendingResults(); the "onWatchResults" event is only a wake-up
// signal, so results queued before JS attaches are never lost and never
// double-processed.
//
// Everything here is a safe no-op when there is no paired watch (Android
// never links this module; iPhones without a watch return isSupported()=false
// or fail the WCSession calls, which we swallow).

import ExpoModulesCore
import WatchConnectivity

public class WatchBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WatchBridge")

    Events("onWatchResults")

    // Activate the session at app start so results queued while the phone app
    // was closed get delivered right away, and wire the wake-up event.
    OnCreate {
      WatchSessionHolder.shared.onResultsChanged = { [weak self] in
        self?.sendEvent("onWatchResults", [:])
      }
      WatchSessionHolder.shared.activateIfNeeded()
    }

    // Whether WatchConnectivity exists on this device at all (false on iPad).
    Function("isSupported") { () -> Bool in
      WCSession.isSupported()
    }

    // Push the latest snapshot. Resolves immediately; delivery is best-effort
    // and handled by the session (queued through activation if needed).
    AsyncFunction("updateContext") { (context: [String: Any]) in
      WatchSessionHolder.shared.update(context: context)
    }

    // Atomically take (and clear) every buffered watch game result.
    AsyncFunction("consumePendingResults") { () -> [[String: Any]] in
      WatchSessionHolder.shared.drainResults()
    }
  }
}

// Owns the WCSession delegate, a pending snapshot to flush once the session
// finishes activating (activation is asynchronous on first use), and the
// buffer of game results received from the watch.
final class WatchSessionHolder: NSObject, WCSessionDelegate {
  static let shared = WatchSessionHolder()

  var onResultsChanged: (() -> Void)?
  private var pending: [String: Any]?
  private var results: [[String: Any]] = []
  private let lock = NSLock()

  func activateIfNeeded() {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil { session.delegate = self }
    if session.activationState != .activated { session.activate() }
  }

  func update(context: [String: Any]) {
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    if session.delegate == nil { session.delegate = self }
    switch session.activationState {
    case .activated:
      try? session.updateApplicationContext(context)
      pushComplication(context, on: session)
    default:
      pending = context
      session.activate()
    }
  }

  // Wake the watch in the background to refresh the face complication.
  // Application context (above) is only seen the next time the watch APP runs,
  // so a complication left on the face keeps showing the old streak/accuracy for
  // hours after phone play until the user opens the watch app. A complication
  // push is the one WatchConnectivity channel that wakes the watch's widget
  // extension in the background to update the complication. It's budgeted on
  // real devices, so only spend a transfer when a complication is actually
  // installed and budget remains; the deck is stripped since the complication
  // only needs the stats (and the payload must stay small).
  private func pushComplication(_ context: [String: Any], on session: WCSession) {
    guard session.isComplicationEnabled,
          session.remainingComplicationUserInfoTransfers > 0 else { return }
    var stats = context
    stats.removeValue(forKey: "deck")
    session.transferCurrentComplicationUserInfo(stats)
  }

  func drainResults() -> [[String: Any]] {
    lock.lock()
    defer { lock.unlock() }
    let out = results
    results = []
    return out
  }

  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    if activationState == .activated, let context = pending {
      try? session.updateApplicationContext(context)
      pushComplication(context, on: session)
      pending = nil
    }
  }

  // Game results from the watch arrive on two channels — queued transferUserInfo
  // (reliable, also delivered on activation for anything sent while this app
  // wasn't running) and instant sendMessage (when reachable). Both are buffered;
  // JS dedupes by each result's "rid" so a result sent on both channels counts
  // once.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    buffer(userInfo)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    buffer(message)
  }

  private func buffer(_ result: [String: Any]) {
    lock.lock()
    results.append(result)
    lock.unlock()
    onResultsChanged?()
  }

  // Required by the protocol on iOS (multi-watch handoff); nothing to do.
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    // Re-activate so a newly paired watch keeps receiving updates.
    session.activate()
  }
}
