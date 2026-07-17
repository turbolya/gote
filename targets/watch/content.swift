// Home screen: glanceable lifetime accuracy + streak, and the entry point into
// the quiz. Mirrors the phone hero's brand teal.

import SwiftUI

let goteTeal = Color(red: 0 / 255, green: 138 / 255, blue: 172 / 255)

// Screenshot-only showcase of the two watch-face complications (Accuracy +
// Streak), rendered as tiles reading the synced snapshot. Real face
// complications can't be captured headlessly (adding them to a face needs
// manual editing), so this stands in for the marketing shot. Reached via
// `-goteShot complications` (see RootView in index.swift).
struct ComplicationsShowcase: View {
  @EnvironmentObject var store: WatchStore

  private var accuracy: Int { store.snapshot.accuracy ?? 0 }
  private var streak: Int { store.snapshot.streak }

  var body: some View {
    ScrollView {
      VStack(spacing: 16) {
        Text("Watch face complications")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.secondary)

        // Circular pair (accuracy gauge + streak flame), as on a face corner.
        HStack(spacing: 22) {
          Gauge(value: Double(accuracy), in: 0...100) {
            Image(systemName: "flame.fill")
          } currentValueLabel: {
            Text("\(accuracy)%")
              .font(.system(.body, design: .rounded).weight(.bold))
              .minimumScaleFactor(0.6)
          }
          .gaugeStyle(.accessoryCircular)
          .tint(goteTeal)

          VStack(spacing: 0) {
            Image(systemName: "flame.fill").font(.caption).foregroundStyle(.orange)
            Text("\(streak)")
              .font(.system(.title3, design: .rounded).weight(.bold))
          }
          .frame(width: 52, height: 52)
          .background(Circle().stroke(.secondary.opacity(0.4), lineWidth: 2))
        }

        // Rectangular complication.
        VStack(alignment: .leading, spacing: 1) {
          Text("gote").font(.headline.weight(.heavy))
          Text("\(accuracy)% lifetime accuracy").font(.footnote)
          HStack(spacing: 3) {
            Image(systemName: "flame.fill")
            Text("\(streak)-day streak")
          }
          .font(.footnote)
          .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(.gray.opacity(0.18)))
      }
      .padding(.horizontal, 6)
      .padding(.top, 4)
    }
  }
}

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
