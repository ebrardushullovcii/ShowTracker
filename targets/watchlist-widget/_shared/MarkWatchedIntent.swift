import AppIntents
import Foundation

struct WidgetEpisodePosition: Codable {
    let seasonNumber: Int
    let episodeNumber: Int
    let newTodayUntil: Double?
}

struct WatchlistWidgetState: Codable {
    struct Grant: Codable {
        let token: String
        let expiresAt: Double
    }

    var rows: [WatchlistSnapshot]
    let grant: Grant?
    let convexUrl: String?

    static var file: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent("WatchlistWidget.json")
    }

    static func read(from url: URL) -> Self? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }

    var grantExpiry: Date? { grant.map { Date(timeIntervalSince1970: $0.expiresAt / 1000) } }
}

@available(iOS 17.0, *)
struct MarkWatchedIntent: AppIntent {
    static var title: LocalizedStringResource = "Mark Episode Watched"
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false

    @Parameter(title: "Show") var routeId: String
    @Parameter(title: "Season") var season: Int
    @Parameter(title: "Episode") var episode: Int

    init() {}

    init(routeId: String, season: Int, episode: Int) {
        self.routeId = routeId
        self.season = season
        self.episode = episode
    }

    private struct Reply: Decodable {
        struct Value: Decodable {
            struct Next: Decodable {
                let season: Int
                let episode: Int
            }
            let saved: Bool
            let next: Next?
        }
        let status: String
        let value: Value?
    }

    func perform() async throws -> some IntentResult {
        guard let file = WatchlistWidgetState.file,
              let state = WatchlistWidgetState.read(from: file),
              let grant = state.grant,
              state.rows.contains(where: matches) else { return .result() }

        guard let expiry = state.grantExpiry, expiry > .now,
              let address = state.convexUrl, let server = URL(string: address),
              isAllowed(server) else {
            update(file: file, token: grant.token, error: "Open app to refresh")
            return .result()
        }

        var request = URLRequest(url: server.appendingPathComponent("api/action"), timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "path": "watchlistWidget:mark",
            "format": "convex_encoded_json",
            "args": [["token": grant.token, "routeId": routeId, "season": season, "episode": episode]],
        ])

        let feedbackDeadline = ContinuousClock.now + .milliseconds(400)
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let reply = try? JSONDecoder().decode(Reply.self, from: data),
                  reply.status == "success", let value = reply.value else {
                update(file: file, token: grant.token, error: "Couldn’t save. Try again.")
                return .result()
            }
            if value.saved {
                update(file: file, token: grant.token, next: value.next)
                // Let the toggle's checked state remain visible on fast saves.
                try? await Task.sleep(until: feedbackDeadline, clock: .continuous)
            } else {
                update(file: file, token: grant.token, error: "Open app to refresh")
            }
        } catch {
            update(file: file, token: grant.token, error: "Couldn’t save. Try again.")
        }
        return .result()
    }

    private func isAllowed(_ url: URL) -> Bool {
        guard url.user == nil, url.password == nil, let host = url.host else { return false }
        if url.scheme == "https" { return true }
        #if targetEnvironment(simulator)
        if url.scheme == "http", host == "127.0.0.1" || host == "localhost" { return true }
        #endif
        return false
    }

    private func matches(_ row: WatchlistSnapshot) -> Bool {
        row.kind == .continueWatching && row.routeId == routeId && row.seasonNumber == season &&
            row.episodeNumber == episode && row.expiration > .now
    }

    private func update(file: URL, token: String, next: Reply.Value.Next? = nil, error: String? = nil) {
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(writingItemAt: file, options: .forReplacing, error: &coordinationError) { url in
            guard var state = WatchlistWidgetState.read(from: url), state.grant?.token == token,
                  let index = state.rows.firstIndex(where: matches) else { return }
            if let error {
                state.rows[index].saveError = error
            } else {
                var row = state.rows.remove(at: index)
                if let next, let following = row.following,
                   let nextIndex = following.firstIndex(where: { $0.seasonNumber == next.season && $0.episodeNumber == next.episode }) {
                    let position = following[nextIndex]
                    row.seasonNumber = position.seasonNumber
                    row.episodeNumber = position.episodeNumber
                    row.newTodayUntil = position.newTodayUntil
                    row.following = Array(following.dropFirst(nextIndex + 1))
                    row.saveError = nil
                    state.rows.insert(row, at: 0)
                }
            }
            if let data = try? JSONEncoder().encode(state) {
                try? data.write(to: url, options: [.atomic, .completeFileProtection])
            }
        }
    }
}
