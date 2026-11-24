import CryptoKit
import Foundation
import UIKit

let appGroup = "group.com.ebrardushullovci.showtracker"

struct WatchlistSnapshot: Codable {
    enum Kind: String, Codable {
        case continueWatching, upcoming
    }

    let kind: Kind
    let title: String
    let routeId: String
    let posterUrl: String?
    var seasonNumber: Int
    var episodeNumber: Int
    var newTodayUntil: Double?
    var following: [WidgetEpisodePosition]?
    var saveError: String?
    let scheduledAt: Double?
    let hasExactAirtime: Bool?
    let expiresAt: Double

    var expiration: Date { Date(timeIntervalSince1970: expiresAt / 1000) }
    var newUntil: Date? { newTodayUntil.map { Date(timeIntervalSince1970: $0 / 1000) } }
    var destination: URL { widgetDestination(path: "/show/\(routeId)") }
    var episodeLabel: String { "S\(seasonNumber) E\(episodeNumber)" }

    func timingLabel(at date: Date) -> String? {
        if let newUntil, date < newUntil { return "New today" }
        if let scheduledAt {
            let airtime = Date(timeIntervalSince1970: scheduledAt / 1000)
            let style: Date.FormatStyle = hasExactAirtime == true
                ? .dateTime.month(.abbreviated).day().hour().minute()
                : .dateTime.month(.abbreviated).day()
            return airtime.formatted(style)
        }
        return nil
    }

    var poster: UIImage? {
        guard let posterUrl, !posterUrl.isEmpty,
              let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return nil }
        let digest = SHA256.hash(data: Data(posterUrl.utf8)).map { String(format: "%02x", $0) }.joined()
        let directory = container.appendingPathComponent("WidgetPosters")
        return UIImage(contentsOfFile: directory.appendingPathComponent(digest + "-720.jpg").path)
            ?? UIImage(contentsOfFile: directory.appendingPathComponent(digest + ".jpg").path)
    }
}

func widgetDestination(path: String) -> URL {
    var components = URLComponents()
    components.scheme = "showtracker"
    components.host = ""
    components.path = path
    return components.url ?? URL(string: "showtracker:///home")!
}
