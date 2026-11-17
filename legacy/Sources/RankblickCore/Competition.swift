import Foundation

public struct VisibilityShare: Identifiable, Sendable {
    public var id: Int { app.id }
    public let app: RankedApp
    public let score: Double
    public let share: Double?
    public let found: Int
    public let top10: Int
}

public struct CompetitionSnapshot: Sendable {
    public let entries: [VisibilityShare]
    public let matchedKeywords: Int
    public let included: Int
    public let measured: Int
    public let totalKeywords: Int
    public let oldest: Date?
    public let newest: Date?
    public let failedKeywords: Int
    public let staleKeywords: Int
    public init(project: Project, now: Date = Date(), category: KeywordCategory? = nil) {
        let keywords = project.activeKeywords.filter { category == nil || $0.effectiveCategory == category }
        let samples = keywords.compactMap(\.latest)
        measured = samples.count; totalKeywords = keywords.count
        oldest = samples.map(\.date).min(); newest = samples.map(\.date).max()
        failedKeywords = keywords.filter { $0.lastError != nil }.count
        staleKeywords = samples.filter { now.timeIntervalSince($0.date) > 86400 }.count
        let usable = keywords.filter { $0.lastError == nil }.compactMap(\.latest).filter { now.timeIntervalSince($0.date) >= 0 && now.timeIntervalSince($0.date) <= 86400 }
        included = usable.count
        let ids = Set(project.comparisonApps.map(\.id))
        matchedKeywords = usable.filter { sample in sample.results.contains { ids.contains($0.id) } }.count
        let values = project.comparisonApps.map { app -> (RankedApp, Double, Int, Int) in
            let ranks = usable.compactMap { $0.rank(for: app.id) }
            return (app, ranks.reduce(0) { $0 + 1.0 / Double($1) }, ranks.count, ranks.filter { $0 <= 10 }.count)
        }
        let sum = values.reduce(0) { $0 + $1.1 }
        entries = values.map { VisibilityShare(app: $0.0, score: $0.1, share: sum > 0 ? $0.1 / sum : nil, found: $0.2, top10: $0.3) }
    }
}

public extension Sample {
    func rank(for appleID: Int) -> Int? { results.firstIndex { $0.id == appleID }.map { $0 + 1 } }
}
public extension Project {
    var comparisonApps: [RankedApp] {
        var seen: Set<Int> = [appleID]
        return [RankedApp(id: appleID, name: name)] + (competitors ?? []).filter { seen.insert($0.id).inserted }
    }
}
public extension Repository {
    func addCompetitor(_ app: RankedApp, projectID: UUID) throws {
        try update { data in
            guard let p = data.projects.firstIndex(where: { $0.id == projectID }) else { throw RankblickError.message("App nicht gefunden.") }
            guard data.projects[p].appleID != app.id else { throw RankblickError.message("Diese App ist bereits deine Vergleichsbasis.") }
            var competitors = data.projects[p].competitors ?? []
            if let i = competitors.firstIndex(where: { $0.id == app.id }) { competitors[i] = app }
            else {
                guard competitors.count < 5 else { throw RankblickError.message("Bis zu fünf Konkurrenz-Apps pro Vergleich sind möglich.") }
                competitors.append(app)
            }
            data.projects[p].competitors = competitors
        }
    }
}
