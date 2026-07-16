// gote watch-face complication: lifetime accuracy (+ streak where the family
// has room). Reads the snapshot the watch app persists to the shared app-group
// defaults; the app reloads the timeline whenever a new snapshot arrives, so
// `.never` refresh is enough.

import SwiftUI
import WidgetKit

private let appGroup = "group.com.gote.app"
private let snapshotKey = "gote.snapshot"

struct GoteEntry: TimelineEntry {
  let date: Date
  let accuracy: Int? // nil until something has been played
  let answered: Int
  let streak: Int
}

private func loadEntry() -> GoteEntry {
  let defaults = UserDefaults(suiteName: appGroup)
  if let data = defaults?.data(forKey: snapshotKey),
     let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    return GoteEntry(
      date: .now,
      accuracy: obj["accuracy"] as? Int,
      answered: obj["answered"] as? Int ?? 0,
      streak: obj["streak"] as? Int ?? 0
    )
  }
  return GoteEntry(date: .now, accuracy: nil, answered: 0, streak: 0)
}

struct GoteProvider: TimelineProvider {
  func placeholder(in context: Context) -> GoteEntry {
    GoteEntry(date: .now, accuracy: 83, answered: 1680, streak: 12)
  }

  func getSnapshot(in context: Context, completion: @escaping (GoteEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GoteEntry>) -> Void) {
    completion(Timeline(entries: [loadEntry()], policy: .never))
  }
}

struct GoteWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: GoteEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryCircular:
        // Accuracy gauge with the streak flame as its label.
        Gauge(value: Double(entry.accuracy ?? 0), in: 0...100) {
          Image(systemName: "flame.fill")
        } currentValueLabel: {
          Text(entry.accuracy.map { "\($0)%" } ?? "–")
            .font(.system(.body, design: .rounded).weight(.bold))
            .minimumScaleFactor(0.6)
        }
        .gaugeStyle(.accessoryCircular)

      case .accessoryCorner:
        Text(entry.accuracy.map { "\($0)%" } ?? "gote")
          .font(.system(.title3, design: .rounded).weight(.bold))
          .widgetLabel {
            Text(entry.streak > 0 ? "🔥 \(entry.streak)-day streak" : "gote")
          }

      case .accessoryInline:
        Text(inlineText)

      default: // .accessoryRectangular
        VStack(alignment: .leading, spacing: 1) {
          Text("gote")
            .font(.headline.weight(.heavy))
          Text(entry.accuracy.map { "\($0)% lifetime accuracy" } ?? "No rounds yet")
            .font(.footnote)
          HStack(spacing: 3) {
            Image(systemName: "flame.fill")
            Text(entry.streak > 0 ? "\(entry.streak)-day streak" : "no streak")
          }
          .font(.footnote)
          .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
    }
    .containerBackground(for: .widget) { Color.clear }
  }

  private var inlineText: String {
    if let accuracy = entry.accuracy {
      return entry.streak > 0 ? "gote \(accuracy)% · 🔥\(entry.streak)" : "gote \(accuracy)%"
    }
    return "gote"
  }
}

@main
struct GoteWatchWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "GoteWatchWidget", provider: GoteProvider()) { entry in
      GoteWidgetView(entry: entry)
    }
    .configurationDisplayName("gote")
    .description("Your lifetime accuracy and daily streak.")
    .supportedFamilies([
      .accessoryCircular, .accessoryCorner, .accessoryRectangular, .accessoryInline,
    ])
  }
}
