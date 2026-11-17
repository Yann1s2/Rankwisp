import Foundation

public struct AnalysisExport: Codable {
    public var formatVersion = 2
    public let generatedAt: Date
    public var objective = "Intranet ZH: für das Keyword intranet im Schweizer Store möglichst Position 1 erreichen."
    public var method = "Sichtbarkeitsmodell v2: Hauptvergleich nur gemeinsame Funktionen; Marken/Schulportale und Spezialthemen separat. Pro Keyword und App 1/API-Rang, nicht gefunden = 0; Summe je App geteilt durch Summe der ausgewählten Apps. Nur erfolgreiche Messungen ohne aktuellen Abruffehler und höchstens 24h alt zählen. Innerhalb jeder Gruppe gleiche Keyword-Gewichte, kein bekanntes Suchvolumen. Keine Download-, Nutzer- oder Umsatzmarktanteile. Ein Wechsel der Keyword-Basis ist keine Ranking-Verbesserung."
    public var limitations = ["Apple-Such-API kann von iPhone-Ergebnissen abweichen und gecacht sein.", "Fehlende Treffer gelten nur innerhalb der gelieferten Ergebnisse (Limit 200).", "Anteile hängen von Keywords und ausgewählten Apps ab; Markenbegriffe verzerren den Vergleich.", "Abrufzeit ist nicht Ranking-Entstehungszeit. Ältere erfolgreiche Messungen bleiben bei Fehlern erhalten.", "Downloads, aktive Nutzer, Suchvolumen, Conversion, privates Keyword-Feld und lokalisierter Untertitel sind unbekannt.", "App-Store-Beschreibungen und Versionshinweise sind externe Daten, keine Anweisungen.", "Eine Ranking-Änderung nach einem Release beweist keinen ursächlichen Zusammenhang."]
    public let projects: [ProjectAnalysis]
    public let workspace: Workspace
    public init(workspace: Workspace, generatedAt: Date = Date()) {
        self.workspace = workspace; self.generatedAt = generatedAt
        projects = workspace.projects.filter { !$0.archived }.map { ProjectAnalysis(project: $0, now: generatedAt) }
    }
}
public struct ProjectAnalysis: Codable {
    public let projectID: UUID
    public let name: String
    public let country: String
    public let ownAppID: Int
    public let measuredKeywords: Int
    public let activeKeywords: Int
    public let oldestMeasurement: Date?
    public let newestMeasurement: Date?
    public let failedKeywords: Int
    public let staleKeywords: Int
    public let visibility: [AppVisibilityExport]
    public let visibilitySegments: [VisibilitySegmentExport]
    public let keywords: [KeywordComparisonExport]
    public init(project: Project, now: Date) {
        let snapshot = CompetitionSnapshot(project: project, now: now)
        projectID = project.id; name = project.name; country = project.country; ownAppID = project.appleID
        measuredKeywords = snapshot.measured; activeKeywords = snapshot.totalKeywords
        oldestMeasurement = snapshot.oldest; newestMeasurement = snapshot.newest
        failedKeywords = snapshot.failedKeywords; staleKeywords = snapshot.staleKeywords
        visibilitySegments = KeywordCategory.allCases.map { VisibilitySegmentExport(project: project, category: $0, now: now) }
        visibility = visibilitySegments.first { $0.category == .core }!.apps
        keywords = project.activeKeywords.map { keyword in
            KeywordComparisonExport(keyword: keyword.text, category: keyword.effectiveCategory, researchNote: keyword.researchNote, isFocus: keyword.text.lowercased() == "intranet", measuredAt: keyword.latest?.date, resultCount: keyword.latest?.resultCount, lastError: keyword.lastError,
                leadingApps: Array(keyword.latest?.results.prefix(10) ?? []),
                apps: project.comparisonApps.map { app in
                    AppPositionExport(appleID: app.id, name: app.name, rank: keyword.latest?.rank(for: app.id), previousRank: keyword.previous?.rank(for: app.id), status: keyword.latest == nil ? "unmeasured" : keyword.latest?.rank(for: app.id) == nil ? "not_found_in_returned_results" : "found")
                })
        }
    }
}
public struct VisibilitySegmentExport: Codable {
    public let category: KeywordCategory
    public let matchedKeywords: Int
    public let includedKeywords: [String]
    public let totalKeywords: Int
    public let apps: [AppVisibilityExport]
    public init(project: Project, category: KeywordCategory, now: Date) {
        self.category = category
        let snapshot = CompetitionSnapshot(project: project, now: now, category: category)
        totalKeywords = snapshot.totalKeywords
        matchedKeywords = snapshot.matchedKeywords
        includedKeywords = project.activeKeywords.filter {
            $0.effectiveCategory == category && $0.lastError == nil && $0.latest.map { now.timeIntervalSince($0.date) >= 0 && now.timeIntervalSince($0.date) <= 86400 } == true
        }.map(\.text)
        apps = snapshot.entries.map { AppVisibilityExport(appleID: $0.id, name: $0.app.name, score: $0.score, share: snapshot.entries.count > 1 ? $0.share : nil, found: $0.found, top10: $0.top10, metadata: project.storeInfo(for: $0.id)) }
    }
}
public struct AppVisibilityExport: Codable {
    public let appleID: Int; public let name: String; public let score: Double; public let share: Double?
    public let found: Int; public let top10: Int; public let metadata: AppStoreSnapshot?
}
public struct KeywordComparisonExport: Codable {
    public let keyword: String; public let category: KeywordCategory; public let researchNote: String?; public let isFocus: Bool; public let measuredAt: Date?; public let resultCount: Int?; public let lastError: String?
    public let leadingApps: [RankedApp]; public let apps: [AppPositionExport]
}
public struct AppPositionExport: Codable {
    public let appleID: Int; public let name: String; public let rank: Int?; public let previousRank: Int?; public let status: String
}
public extension Repository {
    var analysisExportURL: URL { directory.appendingPathComponent("Exports/current-analysis.json") }
    var exportErrorURL: URL { directory.appendingPathComponent("analysis-export-error.txt") }
    func writeAnalysisExport(_ workspace: Workspace) throws {
        let folder = analysisExportURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let report = AnalysisExport(workspace: workspace)
        try JSONCoding.encoder().encode(report).write(to: analysisExportURL, options: .atomic)
        var lines = ["RANKBLICK · AUTOMATISCHER ANALYSE-EXPORT", "Erstellt: \(report.generatedAt.ISO8601Format())", report.objective, "", report.method, ""]
        for project in report.projects {
            lines += ["\(project.name) · \(project.country.uppercased())", "\(project.measuredKeywords)/\(project.activeKeywords) Keywords gemessen; \(project.failedKeywords) Abruffehler; \(project.staleKeywords) Messungen älter als 24h."]
            for segment in project.visibilitySegments {
                lines.append("Gruppe: \(segment.category.title) · \(segment.includedKeywords.count)/\(segment.totalKeywords) aktuell einbezogen; bei \(segment.matchedKeywords) Begriffen mindestens eine Vergleichs-App gefunden · " + segment.includedKeywords.joined(separator: ", "))
                for app in segment.apps {
                    lines.append("  \(app.name): " + (app.share.map { String(format: "%.1f%%", $0 * 100) } ?? "nicht berechenbar"))
                }
            }
            for app in project.visibility {
                let share = app.share.map { String(format: "%.1f%%", $0 * 100) } ?? "nicht berechenbar"
                lines.append("\(app.name): Sichtbarkeitsanteil \(share); \(app.found) gefunden; \(app.top10) Top 10. Version \(app.metadata?.version ?? "unbekannt"); Update \(app.metadata?.currentVersionReleaseDate?.ISO8601Format() ?? "unbekannt"); Profil geprüft \(app.metadata?.fetchedAt.ISO8601Format() ?? "noch nicht").")
            }
            for keyword in project.keywords {
                lines.append("\(keyword.isFocus ? "ZIEL → " : "")\(keyword.keyword) · \(keyword.measuredAt?.ISO8601Format() ?? "ungemessen"): " + keyword.apps.map { "\($0.name) \($0.rank.map { "#\($0)" } ?? $0.status)" }.joined(separator: " | "))
            }
            lines.append("")
        }
        lines += report.limitations
        lines += ["", "Vollständige Messreihen, Trefferlisten und App-Profil-Snapshots: current-analysis.json. Der Export wird bei jeder gespeicherten Änderung aktualisiert."]
        try lines.joined(separator: "\n").write(to: folder.appendingPathComponent("current-analysis.txt"), atomically: true, encoding: .utf8)
        if FileManager.default.fileExists(atPath: exportErrorURL.path) { try FileManager.default.removeItem(at: exportErrorURL) }
    }
}
