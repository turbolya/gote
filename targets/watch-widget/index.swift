// gote watch-face complications. A WidgetBundle exposing TWO independent
// complications — "Accuracy" (lifetime accuracy) and "Streak" (daily streak) —
// so either (or both) can be placed on a watch face. Both read the snapshot
// the watch app persists to the shared app-group defaults; the app reloads the
// timelines whenever a new snapshot arrives, so `.never` refresh is enough.

import SwiftUI
import WidgetKit

private let appGroup = "group.com.gote.app"
private let snapshotKey = "gote.snapshot"

struct GoteEntry: TimelineEntry {
  let date: Date
  let accuracy: Int? // nil until something has been played
  let answered: Int
  let streak: Int
  let streakBest: Int
}

private func loadEntry() -> GoteEntry {
  let defaults = UserDefaults(suiteName: appGroup)
  if let data = defaults?.data(forKey: snapshotKey),
     let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    return GoteEntry(
      date: .now,
      accuracy: obj["accuracy"] as? Int,
      answered: obj["answered"] as? Int ?? 0,
      streak: obj["streak"] as? Int ?? 0,
      streakBest: obj["streakBest"] as? Int ?? 0
    )
  }
  return GoteEntry(date: .now, accuracy: nil, answered: 0, streak: 0, streakBest: 0)
}

struct GoteProvider: TimelineProvider {
  func placeholder(in context: Context) -> GoteEntry {
    GoteEntry(date: .now, accuracy: 83, answered: 1680, streak: 12, streakBest: 21)
  }

  func getSnapshot(in context: Context, completion: @escaping (GoteEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GoteEntry>) -> Void) {
    completion(Timeline(entries: [loadEntry()], policy: .never))
  }
}

// MARK: - Accuracy complication

struct AccuracyView: View {
  @Environment(\.widgetFamily) var family
  let entry: GoteEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        Gauge(value: Double(entry.accuracy ?? 0), in: 0...100) {
          Text("acc")
        } currentValueLabel: {
          Text(entry.accuracy.map { "\($0)%" } ?? "–")
            .font(.system(.body, design: .rounded).weight(.bold))
            .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircular)

      case .accessoryCorner:
        Text(entry.accuracy.map { "\($0)%" } ?? "–")
          .font(.system(.title3, design: .rounded).weight(.bold))
          .widgetLabel { Text("lifetime accuracy") }

      case .accessoryInline:
        Text(entry.accuracy.map { "gote \($0)% accuracy" } ?? "gote")

      default: // .accessoryRectangular
        VStack(alignment: .leading, spacing: 1) {
          Text("gote")
            .font(.headline.weight(.heavy))
          Text(entry.accuracy.map { "\($0)% lifetime accuracy" } ?? "No rounds yet")
            .font(.footnote)
          if entry.answered > 0 {
            Text("\(entry.answered) cards answered")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
  }
}

struct AccuracyWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GoteAccuracy", provider: GoteProvider()) { entry in
      AccuracyView(entry: entry)
    }
    .configurationDisplayName("Accuracy")
    .description("Your lifetime identification accuracy.")
    .supportedFamilies([
      .accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline,
    ])
  }
}

// MARK: - Streak complication

// The gote newt, standing in for the usual flame glyph. Unlike an SF Symbol it's
// a bitmap, so it must be resized explicitly; template rendering lets the watch
// face tint it to match the surrounding glyphs.
private func newtGlyph(_ size: CGFloat) -> some View {
  Image("newt")
    .renderingMode(.template)
    .resizable()
    .scaledToFit()
    .frame(width: size, height: size)
}

struct StreakView: View {
  @Environment(\.widgetFamily) var family
  let entry: GoteEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        VStack(spacing: 0) {
          newtGlyph(15)
          Text("\(entry.streak)")
            .font(.system(.title3, design: .rounded).weight(.bold))
            .minimumScaleFactor(0.6)
        }

      case .accessoryCorner:
        Text("\(entry.streak)")
          .font(.system(.title3, design: .rounded).weight(.bold))
          .widgetLabel {
            Text(entry.streak > 0 ? "day streak" : "no streak")
          }

      case .accessoryInline:
        // Inline complications render a single line: an optional leading image
        // plus text. A Label pairs the newt glyph with the streak text.
        if entry.streak > 0 {
          Label {
            Text("\(entry.streak)-day streak")
          } icon: {
            Image("newt").renderingMode(.template)
          }
        } else {
          Text("gote — no streak")
        }

      default: // .accessoryRectangular
        VStack(alignment: .leading, spacing: 1) {
          Text("gote")
            .font(.headline.weight(.heavy))
          HStack(spacing: 3) {
            newtGlyph(13)
            Text(entry.streak > 0 ? "\(entry.streak)-day streak" : "No streak yet")
          }
          .font(.footnote)
          if entry.streakBest > 0 {
            Text("Best: \(entry.streakBest)")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
  }
}

struct StreakWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GoteStreak", provider: GoteProvider()) { entry in
      StreakView(entry: entry)
    }
    .configurationDisplayName("Streak")
    .description("Your daily play streak.")
    .supportedFamilies([
      .accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline,
    ])
  }
}

// MARK: - Bundle

@main
struct GoteWidgets: WidgetBundle {
  var body: some Widget {
    AccuracyWidget()
    StreakWidget()
  }
}
