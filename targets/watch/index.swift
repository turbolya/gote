// gote watch app entry point. The store is created at launch so the
// WatchConnectivity session activates immediately and any snapshot the phone
// pushed while the app was closed is picked up right away.

import SwiftUI

@main
struct GoteWatchApp: App {
  @StateObject private var store = WatchStore.shared

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(store)
    }
  }
}

// Normal launch shows the home screen. Screenshot builds pass
// `-goteShot <screen>` (home | photo | answers | summary | complications) to
// jump straight to one screen — the capture script uses this because watchOS UI
// can't be driven/tapped headlessly. Uses the synced snapshot, or a seeded demo
// if the phone hasn't synced yet.
struct RootView: View {
  @EnvironmentObject var store: WatchStore

  private var shot: String? {
    let args = ProcessInfo.processInfo.arguments
    guard let i = args.firstIndex(of: "-goteShot"), i + 1 < args.count else { return nil }
    return args[i + 1]
  }

  var body: some View {
    if let shot {
      shotView(shot)
        .onAppear { store.applyShotSnapshot() }
    } else {
      HomeView()
    }
  }

  @ViewBuilder
  private func shotView(_ shot: String) -> some View {
    switch shot {
    case "photo":
      NavigationStack { QuizView(deck: store.snapshot.deck, shot: .photo) }
    case "answers":
      NavigationStack { QuizView(deck: store.snapshot.deck, shot: .answers) }
    case "summary":
      NavigationStack { QuizView(deck: store.snapshot.deck, shot: .summary) }
    case "complications":
      ComplicationsShowcase()
    default:
      HomeView()
    }
  }
}
