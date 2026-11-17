import Foundation

public struct KeywordStanding: Identifiable, Sendable {
    public var id: Int { app.id }
    public let app: RankedApp
    public let rank: Int?
    public let previousRank: Int?
    public let hasPrevious: Bool
    public var delta: Int? {
        guard let rank, let previousRank else { return nil }
        return previousRank - rank
    }
}

public enum KeywordStandings {
    public static func entries(project: Project, keyword: Keyword) -> [KeywordStanding] {
        let apps = project.comparisonApps
        return apps.enumerated().map { index, app in
            (index, KeywordStanding(app: app, rank: keyword.latest?.rank(for: app.id), previousRank: keyword.previous?.rank(for: app.id), hasPrevious: keyword.previous != nil))
        }.sorted {
            let a = $0.1.rank ?? Int.max, b = $1.1.rank ?? Int.max
            return a == b ? $0.0 < $1.0 : a < b
        }.map { $0.1 }
    }
}
