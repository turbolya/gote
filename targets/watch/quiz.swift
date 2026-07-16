// The quiz, in three screens:
//   1. PHOTO — fullscreen, aspect-fit. Digital Crown zooms, drag pans.
//      Top-left ✕ ends the game (→ summary), top-right › shows the answers.
//   2. ANSWERS — four name choices. The pick turns green/red (the right answer
//      is always revealed green), then it auto-advances to the next photo
//      after 2 seconds.
//   3. SUMMARY — session score, shown by ✕. Done returns to the home screen.
//
// Score is per-session (wrist rounds don't touch the phone's lifetime stats).

import SwiftUI

private struct Round {
  let card: WatchCard
  let options: [String] // 4 names, shuffled; one equals card.name
}

struct QuizView: View {
  let deck: [WatchCard]
  @Environment(\.dismiss) private var dismiss

  private enum Phase { case photo, answers, summary }
  @State private var phase: Phase = .photo
  @State private var round: Round?
  @State private var picked: String?
  @State private var score = 0
  @State private var total = 0
  @State private var lastId: Int? // avoid repeating the same card twice in a row
  @State private var roundReported = false // summary sent to the phone once

  // Photo zoom (Digital Crown) + pan (drag). Reset for every new card.
  @State private var zoom: Double = 1.0
  @State private var panOffset: CGSize = .zero
  @State private var panStart: CGSize = .zero

  var body: some View {
    Group {
      switch phase {
      case .photo: photoScreen
      case .answers: answersScreen
      case .summary: summaryScreen
      }
    }
    .navigationBarBackButtonHidden(true)
    .onAppear { if round == nil { nextRound() } }
  }

  // MARK: - 1. Fullscreen photo

  private var photoScreen: some View {
    GeometryReader { geo in
      ZStack {
        Color.black
        if let round {
          AsyncImage(url: URL(string: round.card.image)) { imagePhase in
            switch imagePhase {
            case .success(let image):
              image
                .resizable()
                .scaledToFit()
                .frame(width: geo.size.width, height: geo.size.height)
                .scaleEffect(zoom)
                .offset(panOffset)
            case .failure:
              Image(systemName: "photo")
                .imageScale(.large)
                .foregroundStyle(.secondary)
            default:
              ProgressView()
            }
          }
        }
      }
    }
    .ignoresSafeArea()
    // Digital Crown → zoom. The view must be focusable to receive the crown.
    .focusable()
    .digitalCrownRotation(
      $zoom,
      from: 1.0, through: 5.0, by: 0.05,
      sensitivity: .medium,
      isContinuous: false,
      isHapticFeedbackEnabled: false
    )
    // Drag → pan the (zoomed) photo.
    .gesture(
      DragGesture()
        .onChanged { value in
          panOffset = CGSize(
            width: panStart.width + value.translation.width,
            height: panStart.height + value.translation.height
          )
        }
        .onEnded { _ in panStart = panOffset }
    )
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        Button { phase = .summary } label: {
          Image(systemName: "xmark")
        }
      }
      ToolbarItem(placement: .topBarTrailing) {
        Button { phase = .answers } label: {
          Image(systemName: "chevron.right")
        }
        .tint(goteTeal)
      }
    }
  }

  // MARK: - 2. Answers

  private var answersScreen: some View {
    ScrollView {
      VStack(spacing: 6) {
        if let round {
          ForEach(round.options, id: \.self) { option in
            // Plain button + explicit background: the .bordered style renders
            // DISABLED buttons dimmed gray, which swallowed the green/red
            // reveal tint. Extra taps during the reveal are ignored by the
            // guard in choose() instead.
            Button {
              choose(option)
            } label: {
              Text(option)
                .font(.footnote.weight(.semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
                .minimumScaleFactor(0.75)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .padding(.horizontal, 6)
                .background(
                  RoundedRectangle(cornerRadius: 11)
                    .fill(fill(for: option))
                )
            }
            .buttonStyle(.plain)
          }
        }
      }
      .padding(.horizontal, 2)
    }
    .navigationTitle(total > 0 ? "\(score)/\(total)" : "")
    .toolbar {
      ToolbarItem(placement: .topBarLeading) {
        Button { phase = .summary } label: {
          Image(systemName: "xmark")
        }
        .disabled(picked != nil) // let the reveal finish
      }
    }
  }

  // MARK: - 3. Summary

  private var summaryScreen: some View {
    VStack(spacing: 6) {
      Text("Round over")
        .font(.headline)
        .onAppear {
          // Queue the finished round for the phone's accuracy-history chart
          // (once — the summary can only be entered, never revisited).
          if !roundReported, total > 0 {
            roundReported = true
            WatchStore.shared.reportRound(correct: score, total: total)
          }
        }
      Text("\(score)/\(total)")
        .font(.system(size: 40, weight: .black, design: .rounded))
        .foregroundStyle(goteTeal)
      if total > 0 {
        Text("\(Int((Double(score) / Double(total) * 100).rounded()))% correct")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      Button("Done") { dismiss() }
        .buttonStyle(.borderedProminent)
        .tint(goteTeal)
        .padding(.top, 4)
    }
  }

  // MARK: - Logic

  // Button fill: translucent teal while unanswered; after a pick, the right
  // answer goes solid green, a wrong pick solid red, the rest fade out.
  private func fill(for option: String) -> Color {
    guard let picked, let round else { return goteTeal.opacity(0.38) }
    if option == round.card.name { return .green.opacity(0.85) }
    if option == picked { return .red.opacity(0.85) }
    return .gray.opacity(0.22)
  }

  private func choose(_ option: String) {
    guard picked == nil, let round else { return }
    picked = option
    total += 1
    let correct = option == round.card.name
    if correct { score += 1 }
    // Queue this answer to the phone so it counts into lifetime stats, the
    // daily streak, and the per-species tallies.
    WatchStore.shared.reportAnswer(card: round.card, correct: correct)
    DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
      nextRound()
      phase = .photo
    }
  }

  private func nextRound() {
    picked = nil
    zoom = 1.0
    panOffset = .zero
    panStart = .zero
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
