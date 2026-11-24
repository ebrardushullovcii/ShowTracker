import CryptoKit
import ExpoModulesCore
import Foundation
import ImageIO
import UniformTypeIdentifiers
import WidgetKit

public final class WatchlistWidgetStorageModule: Module {
    private struct Poster: Decodable {
        let posterUrl: String?
    }

    private struct Snapshot: Decodable {
        let rows: [Poster]
    }

    private let appGroup = "group.com.ebrardushullovci.showtracker"
    private let queue = DispatchQueue(label: "showtracker.widget-storage")
    private var downloads: [String: (id: UUID, task: URLSessionDownloadTask)] = [:]
    private var posterReload: DispatchWorkItem?
    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForResource = 20
        return URLSession(configuration: configuration)
    }()

    public func definition() -> ModuleDefinition {
        Name("WatchlistWidgetStorage")

        Function("publish") { (snapshot: String?) in
            self.queue.async {
                self.saveSnapshot(snapshot)
            }
        }
    }

    private func saveSnapshot(_ snapshot: String?) {
        let files = FileManager.default
        guard let container = files.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return }
        let file = container.appendingPathComponent("WatchlistWidget.json")
        let data = snapshot.map { Data($0.utf8) }
        var coordinationError: NSError?
        var saved = false
        var changed = false
        NSFileCoordinator().coordinate(writingItemAt: file, options: .forReplacing, error: &coordinationError) { url in
            let previous = try? Data(contentsOf: url)
            if previous == data {
                saved = true
                return
            }
            do {
                if let data {
                    try data.write(to: url, options: [.atomic, .completeFileProtection])
                } else if files.fileExists(atPath: url.path) {
                    try files.removeItem(at: url)
                }
                saved = true
                changed = true
            } catch {
                // Keep the previous snapshot when a write fails.
            }
        }
        guard coordinationError == nil, saved else { return }
        let defaults = UserDefaults(suiteName: appGroup)
        let hadLegacySnapshot = defaults?.string(forKey: "watchlist-episode") != nil
        defaults?.removeObject(forKey: "watchlist-episode")
        defaults?.removeObject(forKey: "watchlist-today")
        if changed || hadLegacySnapshot {
            WidgetCenter.shared.reloadTimelines(ofKind: "ShowTrackerWatchlist")
        }

        let posters = data.flatMap { try? JSONDecoder().decode(Snapshot.self, from: $0) }?.rows ?? []
        updatePosters(Array(posters.prefix(4)))
    }

    private func updatePosters(_ posters: [Poster]) {
        let files = FileManager.default
        guard let container = files.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else { return }
        let directory = container.appendingPathComponent("WidgetPosters", isDirectory: true)
        let requests = posters.compactMap { poster -> (name: String, url: URL)? in
            guard let address = poster.posterUrl, let url = URL(string: address),
                  url.scheme == "https", url.host != nil, url.user == nil, url.password == nil else { return nil }
            let digest = SHA256.hash(data: Data(address.utf8)).map { String(format: "%02x", $0) }.joined()
            return (digest + "-720.jpg", url)
        }
        let names = Set(requests.map(\.name))
        for name in Array(downloads.keys) where !names.contains(name) {
            downloads.removeValue(forKey: name)?.task.cancel()
        }
        for file in (try? files.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)) ?? []
            where !names.contains(file.lastPathComponent) {
            try? files.removeItem(at: file)
        }
        guard !names.isEmpty,
              (try? files.createDirectory(at: directory, withIntermediateDirectories: true)) != nil else { return }

        for (name, url) in requests {
            let destination = directory.appendingPathComponent(name)
            guard downloads[name] == nil, !files.fileExists(atPath: destination.path) else { continue }

            let id = UUID()
            let task = session.downloadTask(with: url) { [weak self] temporaryFile, response, _ in
                guard let self else { return }
                let data = (response as? HTTPURLResponse).flatMap { response in
                    (200..<300).contains(response.statusCode) ? temporaryFile.flatMap(Self.thumbnail) : nil
                }
                self.queue.async {
                    guard self.downloads[name]?.id == id else { return }
                    self.downloads.removeValue(forKey: name)
                    guard let data, (try? data.write(to: destination, options: .atomic)) != nil else { return }
                    self.posterReload?.cancel()
                    let reload = DispatchWorkItem {
                        WidgetCenter.shared.reloadTimelines(ofKind: "ShowTrackerWatchlist")
                    }
                    self.posterReload = reload
                    self.queue.asyncAfter(deadline: .now() + 0.35, execute: reload)
                }
            }
            downloads[name] = (id, task)
            task.resume()
        }
    }

    private static func thumbnail(_ file: URL) -> Data? {
        guard let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 10_000_000,
              let source = CGImageSourceCreateWithURL(file as CFURL, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: 720,
              ] as CFDictionary) else { return nil }

        let data = NSMutableData()
        guard let output = CGImageDestinationCreateWithData(data as CFMutableData, UTType.jpeg.identifier as CFString, 1, nil) else {
            return nil
        }
        CGImageDestinationAddImage(output, image, [kCGImageDestinationLossyCompressionQuality: 0.8] as CFDictionary)
        return CGImageDestinationFinalize(output) ? data as Data : nil
    }
}
