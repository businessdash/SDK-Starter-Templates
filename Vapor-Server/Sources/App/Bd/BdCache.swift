import Foundation
import Vapor

/// Tag-addressed read cache.
///
/// An `actor` rather than a lock-guarded dictionary: the whole surface is
/// async already, and the compiler then proves there is no data race across
/// the concurrent request handlers hitting it.
///
/// Entries are indexed by tag as well as by key, so the publish webhook can
/// drop `bd:blog` without touching the product catalog. That is the entire
/// reason this isn't a plain TTL cache.
actor BdCache {
    private struct Entry {
        let value: Data
        let expiresAt: Date
    }

    private var entries: [String: Entry] = [:]
    private var keysByTag: [String: Set<String>] = [:]
    private let ttl: TimeInterval

    init(ttl: TimeInterval = 300) {
        self.ttl = ttl
    }

    /// Read through the cache.
    ///
    /// Only successes are cached — a failed read must not pin an error in
    /// place for the whole TTL. On any failure the caller gets `fallback`, so
    /// a page renders local content instead of 500ing.
    func fetch<T: Codable & Sendable>(
        _ key: String,
        tags: [String],
        fallback: T,
        load: () async throws -> T
    ) async -> T {
        if let entry = entries[key], entry.expiresAt > Date(),
           let value = try? JSONDecoder.bd.decode(T.self, from: entry.value) {
            return value
        }

        do {
            let value = try await load()
            if let data = try? JSONEncoder().encode(value) {
                entries[key] = Entry(value: data, expiresAt: Date().addingTimeInterval(ttl))
                for tag in tags { keysByTag[tag, default: []].insert(key) }
            }
            return value
        } catch {
            return fallback
        }
    }

    /// Drop every entry carrying any of `tags`.
    @discardableResult
    func purge(tags: [String]) -> Int {
        var dropped = 0
        for tag in tags {
            for key in keysByTag[tag] ?? [] where entries.removeValue(forKey: key) != nil {
                dropped += 1
            }
            keysByTag[tag] = nil
        }
        return dropped
    }
}

/// App-wide storage for the client + cache, so handlers reach them without a
/// global.
extension Application {
    private struct BdClientKey: StorageKey {
        typealias Value = BdClient
    }

    private struct BdCacheKey: StorageKey {
        typealias Value = BdCache
    }

    var bd: BdClient? {
        get { storage[BdClientKey.self] }
        set { storage[BdClientKey.self] = newValue }
    }

    var bdCache: BdCache {
        if let existing = storage[BdCacheKey.self] { return existing }
        let cache = BdCache(ttl: Environment.get("BD_CACHE_TTL").flatMap(Double.init) ?? 300)
        storage[BdCacheKey.self] = cache
        return cache
    }

    /// True once a site id is present — drives the "not connected" banner.
    var bdConfigured: Bool { Environment.get("BD_SITE_ID") != nil }
}

extension Request {
    var bd: BdClient? { application.bd }
    var bdCache: BdCache { application.bdCache }
}
