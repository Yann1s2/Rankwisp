import Foundation

public struct RankedApp: Codable, Identifiable, Equatable, Sendable {
    public var id: Int
    public var name: String
    public init(id: Int, name: String) { self.id = id; self.name = name }
}

public struct Sample: Codable, Identifiable, Sendable {
    public var id = UUID()
    public var date: Date
    public var rank: Int?
    public var resultCount: Int
    public var results: [RankedApp]
    public var source = "apple-search-v1"
    public var httpDate: String?
    public var cacheAge: String?
    public init(date: Date = Date(), targetID: Int, results: [RankedApp], httpDate: String? = nil, cacheAge: String? = nil) {
        self.date = date; self.results = results; resultCount = results.count
        rank = results.firstIndex { $0.id == targetID }.map { $0 + 1 }
        self.httpDate = httpDate; self.cacheAge = cacheAge
    }
}

public enum KeywordCategory: String, Codable, CaseIterable, Sendable {
    case core, brand, adjacent, unclassified
    public var title: String {
        switch self {
        case .core: return "Gemeinsame Funktionen"
        case .brand: return "Marken & Schulportale"
        case .adjacent: return "Spezialthemen"
        case .unclassified: return "Noch nicht eingeordnet"
        }
    }
}

public struct Keyword: Codable, Identifiable, Sendable {
    public var id = UUID()
    public var text: String
    public var category: KeywordCategory?
    public var researchNote: String?
    public var effectiveCategory: KeywordCategory { category ?? .unclassified }
    public var samples: [Sample] = []
    public var lastAttempt: Date?
    public var lastError: String?
    public var archived = false
    public init(text: String) { self.text = text }
    public var latest: Sample? { samples.last }
    public var previous: Sample? { samples.dropLast().last }
    public var delta: Int? {
        guard let current = latest?.rank, let previous = previous?.rank else { return nil }
        return previous - current
    }
    public var movement: String {
        guard let last = latest else { return "Noch offen" }
        guard let prev = previous else { return "Erste Messung" }
        if let delta { return delta > 0 ? "↑ \(delta)" : delta < 0 ? "↓ \(-delta)" : "±0" }
        if prev.rank == nil, last.rank != nil { return "Neu gefunden" }
        if prev.rank != nil, last.rank == nil { return "Nicht mehr gefunden" }
        return "Weiterhin nicht gefunden"
    }
    // Start a little early so a five-minute scheduler interval does not push a healthy run past 24 h.
    public static let refreshInterval: TimeInterval = 23 * 3600 + 55 * 60
    public func isDue(at now: Date = Date()) -> Bool {
        guard !archived else { return false }
        if let attempt = lastAttempt, lastError != nil, now.timeIntervalSince(attempt) < 900 { return false }
        return latest.map { now.timeIntervalSince($0.date) >= Self.refreshInterval } ?? true
    }
    public var nextDue: Date { latest?.date.addingTimeInterval(Self.refreshInterval) ?? Date() }
}

public struct Project: Codable, Identifiable, Sendable {
    public var id = UUID()
    public var appleID: Int
    public var name: String
    public var country: String
    public var keywords: [Keyword] = []
    public var competitors: [RankedApp]?
    public var storeSnapshots: [AppStoreSnapshot]?
    public var lastMetadataAttempt: Date?
    public var lastMetadataError: String?
    public var archived = false
    public init(appleID: Int, name: String, country: String) {
        self.appleID = appleID; self.name = name; self.country = country.lowercased()
    }
    public var activeKeywords: [Keyword] { keywords.filter { !$0.archived } }
}

public struct Workspace: Codable, Sendable {
    public var schemaVersion = 1
    public var automaticUpdates = true
    public var projects: [Project] = []
    public var lastBackgroundCheck: Date?
    public init(projects: [Project] = []) { self.projects = projects }
}

public enum RankblickError: LocalizedError {
    case message(String)
    public var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

public enum JSONCoding {
    public static func encoder() -> JSONEncoder {
        let e = JSONEncoder(); e.outputFormatting = [.prettyPrinted, .sortedKeys]; e.dateEncodingStrategy = .iso8601; return e
    }
    public static func decoder() -> JSONDecoder {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let text = try decoder.singleValueContainer().decode(String.self)
            let formatter = ISO8601DateFormatter(); formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = formatter.date(from: text) { return date }
            formatter.formatOptions = [.withInternetDateTime]
            guard let date = formatter.date(from: text) else { throw RankblickError.message("Ungültiges Datum: \(text)") }
            return date
        }
        return d
    }
}

public func normalizedKeywords(_ text: String) -> [String] {
    var seen = Set<String>()
    return text.components(separatedBy: CharacterSet(charactersIn: ",\n;"))
        .map { $0.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ").lowercased() }
        .filter { !$0.isEmpty && seen.insert($0).inserted }
}
