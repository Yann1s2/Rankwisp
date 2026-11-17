import Foundation

struct AppleResponse: Decodable {
    var resultCount: Int
    var results: [AppleResult]
}
struct AppleResult: Decodable {
    var trackId: Int
    var trackName: String
    var kind: String?
    var version: String?
    var currentVersionReleaseDate: String?
    var releaseDate: String?
    var artworkUrl512: String?
    var artworkUrl100: String?
    var description: String?
    var releaseNotes: String?
    var sellerName: String?
    var averageUserRating: Double?
    var userRatingCount: Int?
    var minimumOsVersion: String?
}

public struct AppleClient: Sendable {
    public let repository: Repository
    public init(repository: Repository) { self.repository = repository }
    public static func searchURL(term: String, country: String) -> URL {
        var url = URLComponents(string: "https://itunes.apple.com/search")!
        url.queryItems = [URLQueryItem(name: "term", value: term), URLQueryItem(name: "country", value: country), URLQueryItem(name: "entity", value: "software"), URLQueryItem(name: "media", value: "software"), URLQueryItem(name: "limit", value: "200")]
        return url.url!
    }
    private func request(_ url: URL) async throws -> (AppleResponse, HTTPURLResponse) {
        let wait = try repository.reserveRequest()
        if wait > 0 { try await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000)) }
        try Task.checkCancellation()
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 35)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("Rankblick/1.0", forHTTPHeaderField: "User-Agent")
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw RankblickError.message("Apple hat keine gültige HTTP-Antwort geliefert.") }
        guard (200..<300).contains(http.statusCode) else {
            throw RankblickError.message(http.statusCode == 429 ? "Apple begrenzt gerade die Abrufe. Automatischer neuer Versuch in 15 Minuten." : "Apple ist momentan nicht erreichbar (HTTP \(http.statusCode)).")
        }
        let decoded = try JSONDecoder().decode(AppleResponse.self, from: data)
        guard decoded.resultCount == decoded.results.count else { throw RankblickError.message("Die Apple-Antwort ist unvollständig. Der letzte gültige Rang bleibt erhalten.") }
        return (decoded, http)
    }
    public func search(keyword: String, project: Project) async throws -> Sample {
        let (data, http) = try await request(Self.searchURL(term: keyword, country: project.country))
        let results = data.results.map { RankedApp(id: $0.trackId, name: $0.trackName) }
        return Sample(targetID: project.appleID, results: results, httpDate: http.value(forHTTPHeaderField: "Date"), cacheAge: http.value(forHTTPHeaderField: "Age"))
    }
    public func lookup(id: Int, country: String) async throws -> Project {
        let app = try await details(id: id, country: country)
        return Project(appleID: app.appleID, name: app.name, country: country)
    }
    public func details(id: Int, country: String) async throws -> AppStoreSnapshot {
        var url = URLComponents(string: "https://itunes.apple.com/lookup")!
        url.queryItems = [.init(name: "id", value: String(id)), .init(name: "country", value: country), .init(name: "entity", value: "software")]
        let (data, _) = try await request(url.url!)
        guard let app = data.results.first(where: { $0.trackId == id && $0.kind == "software" }) else { throw RankblickError.message("Diese iPhone-App wurde in diesem Store nicht gefunden.") }
        let dateParser = ISO8601DateFormatter()
        return AppStoreSnapshot(appleID: id, name: app.trackName, version: app.version,
            currentVersionReleaseDate: app.currentVersionReleaseDate.flatMap(dateParser.date(from:)),
            firstReleaseDate: app.releaseDate.flatMap(dateParser.date(from:)),
            iconURL: app.artworkUrl512 ?? app.artworkUrl100, description: app.description,
            releaseNotes: app.releaseNotes, sellerName: app.sellerName,
            rating: app.averageUserRating, ratingCount: app.userRatingCount, minimumOSVersion: app.minimumOsVersion)
    }
}

public struct RefreshReport: Sendable {
    public var succeeded = 0
    public var failed = 0
    public var metadataSucceeded = 0
    public var metadataFailed = 0
}

public struct RefreshEngine: Sendable {
    public let repository: Repository
    public init(repository: Repository) { self.repository = repository }
    public func run(force: Bool = false, projectID: UUID? = nil, keywordID: UUID? = nil,
                    background: Bool = false, includeMetadata: Bool = true,
                    metadataFetch: (@Sendable (Int, String) async throws -> AppStoreSnapshot)? = nil,
                    fetch: (@Sendable (String, Project) async throws -> Sample)? = nil,
                    progress: @escaping @Sendable (String, Int, Int) async -> Void = { _, _, _ in }) async throws -> RefreshReport {
        let lock = try repository.refreshLock(); defer { withExtendedLifetime(lock) {} }
        let state = try repository.read()
        if background && !force && !state.automaticUpdates { return RefreshReport() }
        if background { try repository.update { $0.lastBackgroundCheck = Date() } }
        let jobs = state.projects.filter { !$0.archived && (projectID == nil || $0.id == projectID) }.flatMap { p in
            p.keywords.filter { !$0.archived && (keywordID == nil || $0.id == keywordID) && (force || $0.isDue()) }.map { (p, $0) }
        }
        let client = AppleClient(repository: repository)
        var report = RefreshReport()
        for (index, job) in jobs.enumerated() {
            try Task.checkCancellation()
            let (project, keyword) = job
            let current = try repository.read()
            // Recheck after acquiring the cross-process refresh lock; archived items never resurrect.
            guard let liveProject = current.projects.first(where: { $0.id == project.id && !$0.archived }),
                  liveProject.keywords.contains(where: { $0.id == keyword.id && !$0.archived }) else { continue }
            await progress(keyword.text, index, jobs.count)
            do {
                let sample: Sample
                if let fetch { sample = try await fetch(keyword.text, project) }
                else { sample = try await client.search(keyword: keyword.text, project: project) }
                try repository.update { data in
                    guard let p = data.projects.firstIndex(where: { $0.id == project.id && !$0.archived }),
                          let k = data.projects[p].keywords.firstIndex(where: { $0.id == keyword.id && !$0.archived }) else { return }
                    data.projects[p].keywords[k].samples.append(sample)
                    data.projects[p].keywords[k].lastAttempt = sample.date
                    data.projects[p].keywords[k].lastError = nil
                }
                report.succeeded += 1
            } catch is CancellationError { throw CancellationError() }
            catch {
                let message = error.localizedDescription
                try repository.update { data in
                    guard let p = data.projects.firstIndex(where: { $0.id == project.id }),
                          let k = data.projects[p].keywords.firstIndex(where: { $0.id == keyword.id }) else { return }
                    data.projects[p].keywords[k].lastAttempt = Date(); data.projects[p].keywords[k].lastError = message
                }
                report.failed += 1
            }
        }
        if includeMetadata && keywordID == nil {
            let latest = try repository.read()
            for project in latest.projects where !project.archived && (projectID == nil || project.id == projectID) && (force || project.metadataIsDue()) {
                var errors: [String] = []
                for app in project.comparisonApps {
                    try Task.checkCancellation()
                    await progress("App-Store-Daten · \(app.name)", jobs.count, jobs.count)
                    do {
                        let info: AppStoreSnapshot
                        if let metadataFetch { info = try await metadataFetch(app.id, project.country) }
                        else { info = try await client.details(id: app.id, country: project.country) }
                        try repository.update { data in
                            guard let p = data.projects.firstIndex(where: { $0.id == project.id }) else { return }
                            if data.projects[p].storeSnapshots == nil { data.projects[p].storeSnapshots = [] }
                            data.projects[p].storeSnapshots?.append(info)
                        }
                        report.metadataSucceeded += 1
                    } catch is CancellationError { throw CancellationError() }
                    catch { errors.append("\(app.name): \(error.localizedDescription)"); report.metadataFailed += 1 }
                }
                try repository.update { data in
                    guard let p = data.projects.firstIndex(where: { $0.id == project.id }) else { return }
                    data.projects[p].lastMetadataAttempt = Date()
                    data.projects[p].lastMetadataError = errors.isEmpty ? nil : errors.joined(separator: "\n")
                }
            }
        }
        await progress("Fertig", jobs.count, jobs.count)
        return report
    }
}
