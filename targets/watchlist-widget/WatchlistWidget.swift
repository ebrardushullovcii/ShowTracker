import SwiftUI
import WidgetKit

private let widgetKind = "ShowTrackerWatchlist"
private let storageKey = "watchlist-episode"
private let watchRingColor = Color(red: 63.0 / 255, green: 63.0 / 255, blue: 70.0 / 255)
private let watchedColor = Color(red: 52.0 / 255, green: 211.0 / 255, blue: 153.0 / 255)

private struct EpisodeWatchToggleStyle: ToggleStyle {
    let label: String

    func makeBody(configuration: Configuration) -> some View {
        Button {
            configuration.isOn.toggle()
        } label: {
            ZStack {
                Circle().strokeBorder(configuration.isOn ? watchedColor : watchRingColor, lineWidth: 2)
                if configuration.isOn {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(.white)
                        .frame(width: 16, height: 16)
                        .background(watchedColor, in: Circle())
                }
            }
            .frame(width: 24, height: 24)
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

private struct WatchlistEntry: TimelineEntry {
    let date: Date
    let episodes: [WatchlistSnapshot]
    var canMark = false

    var heading: String {
        switch episodes.first?.kind {
        case .continueWatching: "Continue Watching"
        case .upcoming: "Coming Up"
        case nil: "Watchlist"
        }
    }
}

private struct WatchlistProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchlistEntry {
        emptyEntry(at: .now)
    }

    func getSnapshot(in context: Context, completion: @escaping (WatchlistEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : entries().first ?? emptyEntry(at: .now))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchlistEntry>) -> Void) {
        completion(Timeline(entries: entries(), policy: .never))
    }

    private func entries() -> [WatchlistEntry] {
        let now = Date.now
        let decoder = JSONDecoder()
        let state = WatchlistWidgetState.file.flatMap(WatchlistWidgetState.read(from:))
        let prior = UserDefaults(suiteName: appGroup)?.string(forKey: storageKey).map { Data($0.utf8) }
        let legacy = prior.flatMap { (try? decoder.decode([WatchlistSnapshot].self, from: $0))
            ?? (try? decoder.decode(WatchlistSnapshot.self, from: $0)).map { [$0] } }
        let snapshots = state?.rows ?? legacy ?? []
        let available = snapshots.prefix(4).filter { $0.expiration > now }
        var dates: Set<Date> = [now]
        if let expires = state?.grantExpiry, expires > now, available.contains(where: { $0.expiration > expires }) {
            dates.insert(expires)
        }
        for snapshot in available {
            dates.insert(snapshot.expiration)
            if let newUntil = snapshot.newUntil, now < newUntil, newUntil < snapshot.expiration {
                dates.insert(newUntil)
            }
        }
        return dates.sorted().map { date in
            WatchlistEntry(date: date, episodes: available.filter { $0.expiration > date },
                           canMark: state?.grantExpiry.map { $0 > date } ?? false)
        }
    }

    private func emptyEntry(at date: Date) -> WatchlistEntry {
        WatchlistEntry(date: date, episodes: [])
    }
}

private struct WatchlistWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WatchlistEntry

    private var smallPoster: UIImage? {
        family == .systemSmall ? entry.episodes.first?.poster : nil
    }

    var body: some View {
        let poster = smallPoster
        VStack(alignment: .leading, spacing: 8) {
            Label(entry.heading, systemImage: entry.episodes.first?.kind == .continueWatching ? "play.circle" : "calendar")
                .font(.caption.weight(.semibold))
                .lineLimit(2)
                .foregroundStyle(Color("$accent"))
                .widgetAccentable()
            if entry.episodes.isEmpty {
                Spacer(minLength: 2)
                Text("Open Watchlist").font(.headline)
            } else if family == .systemSmall, let episode = entry.episodes.first {
                Spacer(minLength: 2)
                episodeText(episode, compact: false)
            } else {
                ForEach(entry.episodes.prefix(family == .systemLarge ? 4 : 2), id: \.routeId) { episode in
                    HStack(spacing: 8) {
                        Link(destination: episode.destination) {
                            row(episode)
                        }
                        if entry.canMark && episode.kind == .continueWatching && !episode.routeId.hasPrefix("imdb:") {
                            Toggle(isOn: false, intent: MarkWatchedIntent(routeId: episode.routeId,
                                                                           season: episode.seasonNumber,
                                                                           episode: episode.episodeNumber)) {
                                EmptyView()
                            }
                            .toggleStyle(EpisodeWatchToggleStyle(
                                label: "Mark \(episode.title), \(episode.episodeLabel) watched"
                            ))
                        }
                    }
                }
                Spacer(minLength: 0)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetURL(entry.episodes.first?.destination ?? widgetDestination(path: "/home"))
        .containerBackground(for: .widget) {
            if let poster {
                posterBackground(poster)
            } else {
                Color("$widgetBackground")
            }
        }
        .environment(\.colorScheme, .dark)
    }

    private func posterBackground(_ poster: UIImage) -> some View {
        GeometryReader { bounds in
            Image(uiImage: poster)
                .resizable()
                .scaledToFill()
                .frame(width: bounds.size.width, height: bounds.size.height)
                .clipped()
                .overlay {
                    LinearGradient(
                        stops: [
                            .init(color: .black.opacity(0.88), location: 0),
                            .init(color: .black.opacity(0.80), location: 0.28),
                            .init(color: .black.opacity(0.10), location: 0.46),
                            .init(color: .black.opacity(0.82), location: 0.70),
                            .init(color: .black.opacity(0.96), location: 1)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
        }
        .accessibilityHidden(true)
        .privacySensitive()
    }

    private func row(_ episode: WatchlistSnapshot) -> some View {
        HStack(spacing: 9) {
            Group {
                if let image = episode.poster {
                    Image(uiImage: image).resizable().scaledToFill()
                } else {
                    Color.white.opacity(0.08).overlay {
                        Image(systemName: "tv").font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            .frame(width: family == .systemLarge ? 38 : 32, height: family == .systemLarge ? 52 : 42)
            .clipShape(.rect(cornerRadius: 5))
            .accessibilityHidden(true)

            episodeText(episode, compact: true)
            Spacer(minLength: 0)
        }
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
        .privacySensitive()
    }

    private func episodeText(_ episode: WatchlistSnapshot, compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(episode.title)
                .font(compact ? .subheadline.weight(.semibold) : .headline)
                .lineLimit(compact && family == .systemMedium ? 1 : 2)
            if compact {
                HStack(spacing: 6) {
                    Text(episode.episodeLabel).layoutPriority(1).invalidatableContent()
                    if let timing = episode.timingLabel(at: entry.date) {
                        Text("·").accessibilityHidden(true)
                        Text(timing).lineLimit(1)
                    }
                }
                .font(.caption)
                .foregroundStyle(.secondary)
                if let error = episode.saveError {
                    Text(error).font(.caption2).foregroundStyle(Color("$accent")).lineLimit(1)
                }
            } else {
                Text(episode.episodeLabel).font(.caption).foregroundStyle(.secondary)
                if let timing = episode.timingLabel(at: entry.date) {
                    Text(timing).font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .privacySensitive()
    }
}

@main
struct WatchlistWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: WatchlistProvider()) { entry in
            WatchlistWidgetView(entry: entry)
        }
        .configurationDisplayName("ShowTracker Watchlist")
        .description("Pick up at your next episode or see an upcoming release from your Watchlist.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
