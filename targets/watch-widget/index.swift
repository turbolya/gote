// gote watch-face complications. A WidgetBundle exposing TWO independent
// complications — "Accuracy" (lifetime accuracy) and "Streak" (daily streak) —
// so either (or both) can be placed on a watch face. Both read the snapshot
// the watch app persists to the shared app-group defaults; the app reloads the
// timelines whenever a new snapshot arrives.
//
// The streak needs one thing more than a reload, though. The phone only pushes
// when something on the phone changes, and a day passing with no round changes
// nothing there — so "your streak ended" is an event NOBODY sends. The timeline
// therefore carries a second entry at the moment the streak lapses, which is
// the only reason the face can correct itself while the app, the watch app and
// the phone all stay shut.

import SwiftUI
import WidgetKit

private let appGroup = "group.com.gote.app"
private let snapshotKey = "gote.snapshot"

struct GoteEntry: TimelineEntry {
  let date: Date
  let accuracy: Int? // nil until something has been played
  let answered: Int
  let streak: Int // already aged — see loadEntry
  let streakBest: Int
  let streakDay: String? // local YYYY-MM-DD the streak was last counted on
}

// The instant a streak last counted on `day` stops counting: the start of the
// second day after it. Counted Monday → alive all Tuesday → gone at Wednesday
// 00:00. Calendar arithmetic, so month ends and DST are not special cases.
//
// Mirrors goteStreakLapse / goteLiveStreak in targets/watch/store.swift, which
// is a separate target and cannot be imported here, and streakStatus in
// src/storage.js on the phone.
private func streakLapse(_ day: String) -> Date? {
  let parts = day.split(separator: "-").compactMap { Int($0) }
  guard parts.count == 3 else { return nil }
  var c = DateComponents()
  c.year = parts[0]
  c.month = parts[1]
  c.day = parts[2]
  let cal = Calendar.current
  guard let d = cal.date(from: c) else { return nil }
  return cal.date(byAdding: .day, value: 2, to: cal.startOfDay(for: d))
}

private func liveStreak(_ count: Int, _ day: String?) -> Int {
  guard count > 0 else { return 0 }
  guard let day, let lapse = streakLapse(day) else { return count }
  return Date() < lapse ? count : 0
}

private func loadEntry() -> GoteEntry {
  let defaults = UserDefaults(suiteName: appGroup)
  if let data = defaults?.data(forKey: snapshotKey),
     let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
    let day = obj["streakDay"] as? String
    return GoteEntry(
      date: .now,
      accuracy: obj["accuracy"] as? Int,
      answered: obj["answered"] as? Int ?? 0,
      streak: liveStreak(obj["streak"] as? Int ?? 0, day),
      streakBest: obj["streakBest"] as? Int ?? 0,
      streakDay: day
    )
  }
  return GoteEntry(
    date: .now, accuracy: nil, answered: 0, streak: 0, streakBest: 0, streakDay: nil
  )
}

struct GoteProvider: TimelineProvider {
  func placeholder(in context: Context) -> GoteEntry {
    GoteEntry(
      date: .now, accuracy: 83, answered: 1680, streak: 12, streakBest: 21,
      streakDay: nil
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (GoteEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : loadEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<GoteEntry>) -> Void) {
    let now = loadEntry()
    var entries = [now]
    // …and the moment it lapses, so the face zeroes itself with nothing running.
    // Only worth an entry while the streak is still alive and the lapse is
    // ahead of us; once it has passed, `now` already reads 0.
    if now.streak > 0, let day = now.streakDay, let lapse = streakLapse(day), lapse > .now {
      entries.append(
        GoteEntry(
          date: lapse, accuracy: now.accuracy, answered: now.answered,
          streak: 0, streakBest: now.streakBest, streakDay: day
        )
      )
    }
    completion(Timeline(entries: entries, policy: .never))
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
//
// The backing asset is deliberately small (see expo-target.config.js). A
// complication's rendered content is archived under a tight size budget, and an
// oversized bitmap makes watchOS discard it and draw the redacted placeholder
// instead — grey boxes where the glyph and the number should be. Every use must
// go through this helper so the image is always explicitly bounded.
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
            newtGlyph(12) // bounded like the others — never a raw Image here
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
