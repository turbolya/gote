// Receives the phone's snapshot over WatchConnectivity and persists it to the
// shared app-group defaults, where both this app (across launches) and the
// watch-face complication (targets/watch-widget) read it.
//
// Snapshot shape (see src/watch.js on the phone side):
//   { v, accuracy?, correct, answered, streak, streakBest,
//     deck: [{ id, name, sci, image }] }

import Foundation
import WatchConnectivity
import WidgetKit

struct WatchCard: Identifiable, Codable, Equatable {
  let id: Int
  let name: String
  let sci: String
  let image: String
}

struct Snapshot: Codable, Equatable {
  var accuracy: Int? // 0–100; nil until something has been played
  var correct: Int
  var answered: Int
  var streak: Int
  var streakBest: Int
  var deck: [WatchCard]

  static let empty = Snapshot(
    accuracy: nil, correct: 0, answered: 0, streak: 0, streakBest: 0, deck: []
  )
}

final class WatchStore: NSObject, ObservableObject {
  static let shared = WatchStore()
  static let appGroup = "group.com.gote.app"
  static let snapshotKey = "gote.snapshot"

  @Published var snapshot: Snapshot = WatchStore.loadPersisted()

  // Screenshot builds are launched with `-goteShot`; in that mode we freeze the
  // demo snapshot (see applyShotSnapshot) and ignore incoming WatchConnectivity
  // contexts, which would otherwise clobber the demo stats with the phone's.
  private let isShot = ProcessInfo.processInfo.arguments.contains("-goteShot")

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    let session = WCSession.default
    session.delegate = self
    session.activate()
  }

  private static func loadPersisted() -> Snapshot {
    let defaults = UserDefaults(suiteName: appGroup)
    if let data = defaults?.data(forKey: snapshotKey),
       let snap = try? JSONDecoder().decode(Snapshot.self, from: data) {
      return snap
    }
    return .empty
  }

  // Map the loose [String: Any] context into a typed snapshot, persist it, and
  // poke the complication so the watch face updates.
  fileprivate func apply(context: [String: Any]) {
    if isShot { return } // don't let live syncs overwrite the demo snapshot
    // Background complication pushes (transferCurrentComplicationUserInfo) carry
    // only the stats to stay small, with no "deck" key — keep the current deck
    // in that case so a stats refresh never wipes the quiz pool.
    let hasDeck = context["deck"] != nil
    let deckRaw = context["deck"] as? [[String: Any]] ?? []
    let parsedDeck: [WatchCard] = deckRaw.compactMap { d in
      guard let id = d["id"] as? Int,
            let name = d["name"] as? String,
            let image = d["image"] as? String
      else { return nil }
      return WatchCard(id: id, name: name, sci: d["sci"] as? String ?? "", image: image)
    }
    DispatchQueue.main.async {
      let snap = Snapshot(
        accuracy: context["accuracy"] as? Int,
        correct: context["correct"] as? Int ?? 0,
        answered: context["answered"] as? Int ?? 0,
        streak: context["streak"] as? Int ?? 0,
        streakBest: context["streakBest"] as? Int ?? 0,
        deck: hasDeck ? parsedDeck : self.snapshot.deck
      )
      guard snap != self.snapshot else { return }
      self.snapshot = snap
      if let data = try? JSONEncoder().encode(snap) {
        UserDefaults(suiteName: Self.appGroup)?.set(data, forKey: Self.snapshotKey)
      }
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}

extension WatchStore: WCSessionDelegate {
  func session(
    _ session: WCSession,
    activationDidCompleteWith activationState: WCSessionActivationState,
    error: Error?
  ) {
    // A context pushed while we weren't running is waiting here on activation.
    if activationState == .activated, !session.receivedApplicationContext.isEmpty {
      apply(context: session.receivedApplicationContext)
    }
  }

  func session(
    _ session: WCSession,
    didReceiveApplicationContext applicationContext: [String: Any]
  ) {
    apply(context: applicationContext)
  }

  // Background complication push from the phone (transferCurrentComplicationUserInfo).
  // This is what refreshes the face complication without the watch app being
  // opened; it carries stats only (no deck), which apply() merges in place.
  func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any] = [:]) {
    apply(context: userInfo)
  }
}

// MARK: - Reporting results back to the phone

// Wrist play counts: each answered card (and each finished round) is queued to
// the phone with transferUserInfo — delivery survives the phone app being
// closed and lands next time it runs. The phone folds these into the same
// lifetime / streak / per-species / history stats as phone play, then pushes
// an updated snapshot back here.
extension WatchStore {
  // Screenshot-only: force the canonical demo stats (matching the iPhone
  // screenshot set — 83% · 1392/1680, 12-day streak) so every device in the
  // marketing set is consistent, while KEEPING the real synced deck for real
  // photos. If the phone hasn't synced a deck yet, a demo deck is planted too
  // (no images → the quiz shows a placeholder rather than a broken photo).
  // Never runs in normal use (only from the -goteShot launch path).
  func applyShotSnapshot() {
    var snap = snapshot
    // Kept in step with the phone seeder (src/e2e/shotsSeed.js), whose rate is
    // the mean of the generated history — so every device in the marketing set
    // shows the same lifetime accuracy.
    snap.accuracy = 78
    snap.correct = 1409
    snap.answered = 1801
    snap.streak = 12
    snap.streakBest = 21
    if snap.deck.isEmpty {
      let names: [(Int, String, String)] = [
        (12727, "American Robin", "Turdus migratorius"),
        (48662, "Mallard", "Anas platyrhynchos"),
        (52381, "Monarch", "Danaus plexippus"),
        (47219, "Western Honey Bee", "Apis mellifera"),
        (58583, "Common Dandelion", "Taraxacum officinale"),
      ]
      snap.deck = names.map { WatchCard(id: $0.0, name: $0.1, sci: $0.2, image: "") }
    }
    snapshot = snap
  }

  func reportAnswer(card: WatchCard, correct: Bool) {
    send([
      "kind": "answer",
      "id": card.id,
      "name": card.name,
      "sci": card.sci,
      "image": card.image,
      "correct": correct,
    ])
  }

  func reportRound(correct: Int, total: Int) {
    guard total > 0 else { return }
    send([
      "kind": "round",
      "correct": correct,
      "total": total,
    ])
  }

  // Deliver a result to the phone via BOTH paths, tagged with a unique id so
  // the phone applies it exactly once (it dedupes by "rid"):
  //   • transferUserInfo — queued + reliable, survives the phone app being
  //     closed (the backbone; this is what counts on a real device).
  //   • sendMessage when reachable — instant delivery while both apps are
  //     active (great UX, and the only path that works between paired
  //     simulators, where background transfers don't bridge).
  private func send(_ payload: [String: Any]) {
    guard WCSession.isSupported() else { return }
    var msg = payload
    msg["rid"] = UUID().uuidString
    msg["ts"] = Date().timeIntervalSince1970 * 1000
    let session = WCSession.default
    session.transferUserInfo(msg)
    if session.isReachable {
      session.sendMessage(msg, replyHandler: nil, errorHandler: nil)
    }
  }
}
