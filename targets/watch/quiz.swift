// The quiz: one photo, four name choices. Cards come from the mini-deck the
// phone synced. Score is per-session (wrist rounds don't touch the phone's
// lifetime stats — glanceable fun, not bookkeeping).

import SwiftUI

private struct Round: Equatable {
  let card: WatchCard
  let options: [String] // 4 names, shuffled; one equals card.name
}

struct QuizView: View {
  let deck: [WatchCard]

  @State private var round: Round?
  @State private var picked: String?
  @State private var score = 0
  @State private var total = 0
  @State private var lastId: Int? // avoid repeating the same card twice in a row

  var body: some View {
    ScrollView {
      if let round {
        VStack(spacing: 8) {
          AsyncImage(url: URL(string: round.card.image)) { phase in
            switch phase {
            case .success(let image):
              image.resizable().scaledToFill()
            case .failure:
              Image(systemName: "photo")
                .imageScale(.large)
                .foregroundStyle(.secondary)
            default:
              ProgressView()
            }
          }
          .frame(height: 86)
          .frame(maxWidth: .infinity)
          .clipShape(RoundedRectangle(cornerRadius: 10))

          ForEach(round.options, id: \.self) { option in
            Button {
              choose(option)
            } label: {
              Text(option)
                .font(.footnote.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .tint(tint(for: option))
            .disabled(picked != nil)
          }
        }
        .padding(.horizontal, 2)
      } else {
        ProgressView()
      }
    }
    .navigationTitle(total > 0 ? "\(score)/\(total)" : "gote")
    .onAppear { if round == nil { nextRound() } }
  }

  // Button tint: neutral while unanswered; after a pick, the right answer goes
  // green and a wrong pick goes red.
  private func tint(for option: String) -> Color {
    guard let picked, let round else { return goteTeal }
    if option == round.card.name { return .green }
    if option == picked { return .red }
    return .gray
  }

  private func choose(_ option: String) {
    guard picked == nil, let round else { return }
    picked = option
    total += 1
    if option == round.card.name { score += 1 }
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.1) {
      nextRound()
    }
  }

  private func nextRound() {
    picked = nil
    // Pick a target (not the same as last time), then 3 distinct wrong names.
    let candidates = deck.filter { $0.id != lastId }
    guard let card = (candidates.isEmpty ? deck : candidates).randomElement() else { return }
    lastId = card.id
    // Tiny decks with duplicate names could leave < 3 — show what we have.
    let wrong = Array(
      Set(deck.map(\.name).filter { $0 != card.name }).shuffled().prefix(3)
    )
    round = Round(card: card, options: ([card.name] + wrong).shuffled())
  }
}
