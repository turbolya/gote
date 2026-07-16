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
    let deckRaw = context["deck"] as? [[String: Any]] ?? []
    let deck: [WatchCard] = deckRaw.compactMap { d in
      guard let id = d["id"] as? Int,
            let name = d["name"] as? String,
            let image = d["image"] as? String
      else { return nil }
      return WatchCard(id: id, name: name, sci: d["sci"] as? String ?? "", image: image)
    }
    let snap = Snapshot(
      accuracy: context["accuracy"] as? Int,
      correct: context["correct"] as? Int ?? 0,
      answered: context["answered"] as? Int ?? 0,
      streak: context["streak"] as? Int ?? 0,
      streakBest: context["streakBest"] as? Int ?? 0,
      deck: deck
    )
    DispatchQueue.main.async {
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
}

// MARK: - Reporting results back to the phone

// Wrist play counts: each answered card (and each finished round) is queued to
// the phone with transferUserInfo — delivery survives the phone app being
// closed and lands next time it runs. The phone folds these into the same
// lifetime / streak / per-species / history stats as phone play, then pushes
// an updated snapshot back here.
extension WatchStore {
  func reportAnswer(card: WatchCard, correct: Bool) {
    guard WCSession.isSupported() else { return }
    WCSession.default.transferUserInfo([
      "kind": "answer",
      "id": card.id,
      "name": card.name,
      "sci": card.sci,
      "image": card.image,
      "correct": correct,
      "ts": Date().timeIntervalSince1970 * 1000,
    ])
  }

  func reportRound(correct: Int, total: Int) {
    guard WCSession.isSupported(), total > 0 else { return }
    WCSession.default.transferUserInfo([
      "kind": "round",
      "correct": correct,
      "total": total,
      "ts": Date().timeIntervalSince1970 * 1000,
    ])
  }
}
