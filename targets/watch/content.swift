// Home screen: glanceable lifetime accuracy + streak, and the entry point into
// the quiz. Mirrors the phone hero's brand teal.

import SwiftUI

let goteTeal = Color(red: 0 / 255, green: 138 / 255, blue: 172 / 255)

struct HomeView: View {
  @EnvironmentObject var store: WatchStore

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(spacing: 12) {
          // Lifetime accuracy
          if let accuracy = store.snapshot.accuracy {
            VStack(spacing: 2) {
              Text("\(accuracy)%")
                .font(.system(size: 40, weight: .black, design: .rounded))
                .foregroundStyle(goteTeal)
              Text("lifetime accuracy")
                .font(.footnote)
                .foregroundStyle(.secondary)
              Text("\(store.snapshot.correct)/\(store.snapshot.answered)")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.secondary)
            }
          } else {
            Text("Play a round on your iPhone to see your stats here.")
              .font(.footnote)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }

          // Daily streak — two stacked lines so nothing crops on small screens.
          VStack(spacing: 1) {
            HStack(spacing: 5) {
              Image(systemName: "flame.fill")
                .foregroundStyle(store.snapshot.streak > 0 ? .orange : .secondary)
              Text(store.snapshot.streak > 0
                ? "\(store.snapshot.streak)-day streak"
                : "No streak yet")
                .font(.footnote.weight(.semibold))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
            if store.snapshot.streakBest > 0 {
              Text("best: \(store.snapshot.streakBest)")
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          }

          // Quiz entry — needs enough cards for 1 photo + 3 wrong names.
          if store.snapshot.deck.count >= 4 {
            NavigationLink {
              QuizView(deck: store.snapshot.deck)
            } label: {
              HStack(spacing: 8) {
                Image("newt")
                  .resizable()
                  .scaledToFit()
                  .frame(height: 22)
                Text("Play")
                  .font(.headline)
              }
            }
            .buttonStyle(.borderedProminent)
            .tint(goteTeal)
          } else {
            Text("Open gote on your iPhone to sync your cards.")
              .font(.footnote)
              .foregroundStyle(.secondary)
              .multilineTextAlignment(.center)
          }
        }
        .padding(.horizontal, 4)
      }
    }
  }
}
