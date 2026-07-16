// gote watch app entry point. The store is created at launch so the
// WatchConnectivity session activates immediately and any snapshot the phone
// pushed while the app was closed is picked up right away.

import SwiftUI

@main
struct GoteWatchApp: App {
  @StateObject private var store = WatchStore.shared

  var body: some Scene {
    WindowGroup {
      HomeView()
        .environmentObject(store)
    }
  }
}
