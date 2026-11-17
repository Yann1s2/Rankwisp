import XCTest
@testable import RankblickCore

final class RankblickTests: XCTestCase {
    // Synthetic test-only observations. Never bundled as user data.
    func seedFixture(_ repo: Repository) throws {
        try repo.bootstrap()
        if !(try repo.read()).projects.isEmpty { return }
        var project = Project(appleID: 123456, name: "Fixture App", country: "ch")
        let words = ["inbox", "intranet kue", "intranet", "test four", "test five", "test six", "test seven", "test eight"]
        project.keywords = words.map { word in
            var keyword = Keyword(text: word)
            keyword.category = word == "inbox" ? .brand : .unclassified
            let results = (1...17).map { RankedApp(id: $0, name: "Fixture \($0)") } + [RankedApp(id: 123456, name: "Fixture App")]
            keyword.samples = [Sample(date: Date(timeIntervalSince1970: 1700000000), targetID: 123456, results: results)]
            return keyword
        }
        try repo.update { $0.projects = [project]; $0.automaticUpdates = true }
    }
    var root: URL!
    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent("rankblick-test-\(UUID())")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
    }
    override func tearDownWithError() throws { try FileManager.default.removeItem(at: root) }
    func testSyntheticFixtureDoesNotReset() throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        var data = try repo.read()
        XCTAssertEqual(data.projects.count, 1); XCTAssertEqual(data.projects[0].keywords.count, 8)
        XCTAssertEqual(data.projects[0].keywords.first { $0.text == "intranet" }?.latest?.rank, 18)
        try repo.update { $0.automaticUpdates = false }
        try repo.bootstrap(); data = try repo.read(); XCTAssertFalse(data.automaticUpdates)
    }
    func testRankingUsesResponseOrderAndAbsenceIsNotAnInventedRank() {
        let result = [RankedApp(id: 4, name: "First"), RankedApp(id: 7, name: "Target")]
        XCTAssertEqual(Sample(targetID: 7, results: result).rank, 2)
        XCTAssertNil(Sample(targetID: 99, results: result).rank)
        XCTAssertEqual(Sample(targetID: 99, results: result).resultCount, 2)
    }
    func testDailyScheduleAndFailureBackoff() {
        let now = Date(); var k = Keyword(text: "test")
        XCTAssertTrue(k.isDue(at: now))
        k.samples = [Sample(date: now, targetID: 1, results: [])]
        XCTAssertFalse(k.isDue(at: now.addingTimeInterval(23 * 3600)))
        XCTAssertTrue(k.isDue(at: now.addingTimeInterval(Keyword.refreshInterval)))
        k.lastAttempt = now.addingTimeInterval(86400); k.lastError = "Offline"
        XCTAssertFalse(k.isDue(at: now.addingTimeInterval(86400 + 899)))
        XCTAssertTrue(k.isDue(at: now.addingTimeInterval(86400 + 900)))
        k.archived = true; XCTAssertFalse(k.isDue(at: now.addingTimeInterval(172800)))
    }
    func testImprovementAndNotFoundTransitions() {
        var k = Keyword(text: "test")
        let apps = (1...10).map { RankedApp(id: $0, name: "\($0)") }
        k.samples = [Sample(targetID: 9, results: apps), Sample(targetID: 3, results: apps)]
        XCTAssertEqual(k.delta, 6); XCTAssertEqual(k.movement, "↑ 6")
        k.samples.append(Sample(targetID: 100, results: apps))
        XCTAssertNil(k.delta); XCTAssertEqual(k.movement, "Nicht mehr gefunden")
        k.samples.append(Sample(targetID: 3, results: apps)); XCTAssertEqual(k.movement, "Neu gefunden")
    }
    func testAddingDuplicateRestoresArchiveWithoutLosingHistory() throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let data = try repo.read(); let p = data.projects[0].id
        try repo.update { $0.projects[0].keywords[0].archived = true }
        try repo.addKeywords(" Inbox , inbox\nINTRANET   KUE;new term", projectID: p)
        let after = try repo.read().projects[0]
        XCTAssertEqual(after.keywords.count, 9)
        XCTAssertEqual(after.keywords.first { $0.text == "inbox" }?.samples.count, 1)
        XCTAssertFalse(after.keywords.first { $0.text == "inbox" }!.archived)
    }
    func testTwoRepositoriesMergeUpdatesRatherThanOverwriting() throws {
        let a = try Repository(directory: root); try seedFixture(a); let b = try Repository(directory: root)
        let p = try a.read().projects[0].id
        try a.addKeywords("first new", projectID: p); try b.addKeywords("second new", projectID: p)
        XCTAssertEqual(try a.read().projects[0].keywords.count, 10)
    }
    func testCorruptDatabaseIsNeverSilentlyResetOrOverwritten() throws {
        let repo = try Repository(directory: root)
        let broken = Data("not valid json".utf8); try broken.write(to: repo.dataURL)
        XCTAssertThrowsError(try repo.bootstrap()); XCTAssertThrowsError(try repo.update { $0.automaticUpdates = false })
        XCTAssertEqual(try Data(contentsOf: repo.dataURL), broken)
    }
    func testRefreshLockExcludesConcurrentWorkerAndReleases() throws {
        let repo = try Repository(directory: root)
        var lock: FileLock? = try repo.refreshLock()
        XCTAssertThrowsError(try repo.refreshLock())
        withExtendedLifetime(lock) {}; lock = nil
        XCTAssertNoThrow(try repo.refreshLock())
    }
    func testSearchParametersStayComparableToSeed() {
        let url = AppleClient.searchURL(term: "intranet küe & tam", country: "ch")
        let params = Dictionary(uniqueKeysWithValues: URLComponents(url: url, resolvingAgainstBaseURL: false)!.queryItems!.map { ($0.name, $0.value!) })
        XCTAssertEqual(params["term"], "intranet küe & tam")
        XCTAssertEqual(params["country"], "ch"); XCTAssertEqual(params["entity"], "software"); XCTAssertEqual(params["limit"], "200")
    }
    func testAutomaticDisabledDoesNotCreateMeasurements() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        try repo.update { $0.automaticUpdates = false }
        let before = try Data(contentsOf: repo.dataURL)
        let result = try await RefreshEngine(repository: repo).run(background: true)
        XCTAssertEqual(result.succeeded, 0); XCTAssertEqual(try Data(contentsOf: repo.dataURL), before)
    }
    func testNetworkFailuresPreserveHistoryAndSetRetryState() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let before = try repo.read().projects[0].keywords
        let result = try await RefreshEngine(repository: repo).run(force: true, includeMetadata: false, fetch: { _, _ in throw RankblickError.message("Offline") })
        XCTAssertEqual(result.failed, 8)
        let after = try repo.read().projects[0].keywords
        for (old, new) in zip(before, after) {
            XCTAssertEqual(old.samples.count, new.samples.count)
            XCTAssertEqual(old.latest?.id, new.latest?.id)
            XCTAssertEqual(new.lastError, "Offline"); XCTAssertNotNil(new.lastAttempt)
        }
    }
    func testRefreshAppendsRealResultsAndNotFoundWithoutResettingHistory() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let result = try await RefreshEngine(repository: repo).run(force: true, includeMetadata: false, fetch: { term, project in
            Sample(targetID: project.appleID, results: term == "inbox" ? [RankedApp(id: 99, name: "Other"), RankedApp(id: project.appleID, name: project.name)] : [])
        })
        XCTAssertEqual(result.succeeded, 8)
        let rows = try repo.read().projects[0].keywords
        XCTAssertTrue(rows.allSatisfy { $0.samples.count == 2 })
        XCTAssertEqual(rows.first { $0.text == "inbox" }?.latest?.rank, 2)
        XCTAssertNil(rows.first { $0.text == "intranet" }?.latest?.rank)
        XCTAssertEqual(rows.first { $0.text == "intranet" }?.previous?.rank, 18)
    }
    func testOverdueBackgroundRunThenImmediateRunDoesNotDuplicateMeasurements() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        try repo.update { data in
            for i in data.projects[0].keywords.indices { data.projects[0].keywords[i].samples[0].date = Date().addingTimeInterval(-90000) }
        }
        let engine = RefreshEngine(repository: repo)
        let first = try await engine.run(background: true, includeMetadata: false, fetch: { _, p in Sample(targetID: p.appleID, results: []) })
        let second = try await engine.run(background: true, includeMetadata: false, fetch: { _, _ in XCTFail("A current keyword must not be queried"); throw RankblickError.message("unexpected") })
        XCTAssertEqual(first.succeeded, 8); XCTAssertEqual(second.succeeded, 0)
        XCTAssertNotNil(try repo.read().lastBackgroundCheck)
        XCTAssertTrue(try repo.read().projects[0].keywords.allSatisfy { $0.samples.count == 2 })
    }
}

extension RankblickTests {
    func testCompetitionUsesIdenticalResponsesAndNormalizedReciprocalRanks() {
        var p = Project(appleID: 1, name: "Own", country: "ch")
        p.competitors = [RankedApp(id: 2, name: "Rival"), RankedApp(id: 3, name: "Absent")]
        var k = Keyword(text: "intranet")
        k.samples = [Sample(targetID: 1, results: [RankedApp(id: 2, name: "Rival"), RankedApp(id: 1, name: "Own")])]
        p.keywords = [k]
        let comparison = CompetitionSnapshot(project: p)
        XCTAssertEqual(comparison.entries[0].share!, 1.0 / 3, accuracy: 0.00001)
        XCTAssertEqual(comparison.entries[1].share!, 2.0 / 3, accuracy: 0.00001)
        XCTAssertEqual(comparison.entries[2].share, 0)
        XCTAssertEqual(comparison.entries.reduce(0) { $0 + ($1.share ?? 0) }, 1, accuracy: 0.00001)
        XCTAssertEqual(k.latest?.rank(for: 2), 1)
    }
    func testCompetitionNoResultsDoesNotInventSharesAndExcludesArchived() {
        var p = Project(appleID: 1, name: "Own", country: "ch")
        p.competitors = [RankedApp(id: 2, name: "Rival")]
        var archived = Keyword(text: "old"); archived.archived = true
        archived.samples = [Sample(targetID: 1, results: [RankedApp(id: 1, name: "Own")])]
        p.keywords = [Keyword(text: "unmeasured"), archived]
        let comparison = CompetitionSnapshot(project: p)
        XCTAssertEqual(comparison.measured, 0); XCTAssertEqual(comparison.totalKeywords, 1)
        XCTAssertTrue(comparison.entries.allSatisfy { $0.share == nil })
    }
    func testOldWorkspaceDecodesAndCompetitorsSurviveRepositoryUpdates() throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let p = try repo.read().projects[0]
        XCTAssertNil(p.storeSnapshots)
        // Remove optional fields to simulate a 1.0/1.1 database explicitly.
        var legacy = try JSONSerialization.jsonObject(with: Data(contentsOf: repo.dataURL)) as! [String: Any]
        var projects = legacy["projects"] as! [[String: Any]]
        projects[0].removeValue(forKey: "competitors"); legacy["projects"] = projects
        let decoded = try JSONCoding.decoder().decode(Workspace.self, from: JSONSerialization.data(withJSONObject: legacy))
        XCTAssertNil(decoded.projects[0].competitors)
        try repo.update { $0.projects[0].competitors = nil }
        try repo.addCompetitor(RankedApp(id: 2, name: "Rival"), projectID: p.id)
        try repo.addCompetitor(RankedApp(id: 2, name: "Renamed"), projectID: p.id)
        try repo.update { $0.lastBackgroundCheck = Date() }
        XCTAssertEqual(try repo.read().projects[0].competitors?.count, 1)
        XCTAssertEqual(try repo.read().projects[0].competitors?.first?.name, "Renamed")
        XCTAssertThrowsError(try repo.addCompetitor(RankedApp(id: p.appleID, name: "Own"), projectID: p.id))
    }
    func testAutomaticExportIncludesFocusHistoryAndCurrentMetadata() throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        try repo.update { data in
            data.projects[0].competitors = nil
            data.projects[0].storeSnapshots = [AppStoreSnapshot(appleID: data.projects[0].appleID, name: "Own", version: "2.0")]
        }
        let report = try JSONCoding.decoder().decode(AnalysisExport.self, from: Data(contentsOf: repo.analysisExportURL))
        XCTAssertEqual(report.workspace.projects[0].keywords.count, 8)
        XCTAssertEqual(report.projects[0].keywords.first { $0.isFocus }?.keyword, "intranet")
        XCTAssertEqual(report.projects[0].visibility[0].metadata?.version, "2.0")
        XCTAssertNil(report.projects[0].visibility[0].share) // no competitors means no meaningful share
        XCTAssertTrue(FileManager.default.fileExists(atPath: repo.analysisExportURL.deletingLastPathComponent().appendingPathComponent("current-analysis.txt").path))
        XCTAssertFalse(FileManager.default.fileExists(atPath: repo.exportErrorURL.path))
    }
    func testMetadataScheduleAndFailureCooldown() {
        let now = Date(); var p = Project(appleID: 1, name: "Own", country: "ch")
        XCTAssertTrue(p.metadataIsDue(at: now))
        p.storeSnapshots = [AppStoreSnapshot(appleID: 1, name: "Own", fetchedAt: now)]
        XCTAssertFalse(p.metadataIsDue(at: now))
        p.competitors = [RankedApp(id: 2, name: "New rival")]
        XCTAssertTrue(p.metadataIsDue(at: now))
        p.lastMetadataAttempt = now; p.lastMetadataError = "Offline"
        XCTAssertFalse(p.metadataIsDue(at: now.addingTimeInterval(899)))
        XCTAssertTrue(p.metadataIsDue(at: now.addingTimeInterval(900)))
    }
    func testMetadataFailurePreservesPreviousVersionAndExportsError() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        try repo.update { data in data.projects[0].competitors = nil; data.projects[0].storeSnapshots = [AppStoreSnapshot(appleID: data.projects[0].appleID, name: "Own", version: "1.0")] }
        let report = try await RefreshEngine(repository: repo).run(force: true,
            metadataFetch: { _, _ in throw RankblickError.message("Metadata offline") },
            fetch: { _, p in Sample(targetID: p.appleID, results: []) })
        XCTAssertEqual(report.metadataFailed, 1); XCTAssertEqual(report.succeeded, 8)
        let p = try repo.read().projects[0]
        XCTAssertEqual(p.storeInfo(for: p.appleID)?.version, "1.0")
        XCTAssertTrue(p.lastMetadataError?.contains("Metadata offline") == true)
    }
    func testMetadataRefreshTracksOwnAndRivalAndKeepsVersionHistory() async throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let project = try repo.read().projects[0]
        try repo.update { $0.projects[0].competitors = nil }
        try repo.addCompetitor(RankedApp(id: 2, name: "Rival"), projectID: project.id)
        try repo.update { $0.projects[0].storeSnapshots = [AppStoreSnapshot(appleID: project.appleID, name: "Own", version: "1.0")] }
        let result = try await RefreshEngine(repository: repo).run(force: true,
            metadataFetch: { id, _ in AppStoreSnapshot(appleID: id, name: "App", version: "2.0") },
            fetch: { _, p in Sample(targetID: p.appleID, results: []) })
        XCTAssertEqual(result.metadataSucceeded, 2)
        let p = try repo.read().projects[0]
        XCTAssertEqual(p.storeSnapshots?.count, 3)
        XCTAssertEqual(p.storeInfo(for: project.appleID)?.version, "2.0")
        XCTAssertEqual(p.storeInfo(for: 2)?.version, "2.0")
        XCTAssertNil(p.lastMetadataError)
    }
}

extension RankblickTests {
    func testTimelineKeepsNotFoundAndLongTimeGapsDisconnected() {
        let date = Date(timeIntervalSince1970: 100000)
        let found = [RankedApp(id: 1, name: "Own")]
        let samples = [Sample(date: date, targetID: 1, results: found),
                       Sample(date: date.addingTimeInterval(60), targetID: 1, results: []),
                       Sample(date: date.addingTimeInterval(120), targetID: 1, results: found),
                       Sample(date: date.addingTimeInterval(48 * 3600), targetID: 1, results: found)]
        let points = RankingTimeline.points(samples, appleID: 1)
        XCTAssertEqual(points.count, 3)
        XCTAssertNotEqual(points[0].segment, points[1].segment)
        XCTAssertNotEqual(points[1].segment, points[2].segment)
        XCTAssertEqual(points.map(\.rank), [1, 1, 1])
    }
    func testTimelineOrdersSamplesAndUsesLastResponseAtDuplicateTimestamp() {
        let first = Date(timeIntervalSince1970: 100000), last = first.addingTimeInterval(60)
        let a = Sample(date: last, targetID: 1, results: [RankedApp(id: 1, name: "Own")])
        let b = Sample(date: first, targetID: 1, results: [])
        let replacement = Sample(date: last, targetID: 1, results: [])
        let samples = RankingTimeline.samples([a, b, replacement])
        XCTAssertEqual(samples.map(\.id), [b.id, replacement.id])
        XCTAssertTrue(RankingTimeline.points(samples, appleID: 1).isEmpty)
    }
    func testTimelineFiltersPeriodAndDoesNotBridgeMissingCompetitor() {
        let start = Date(timeIntervalSince1970: 100000)
        let both = [RankedApp(id: 1, name: "Own"), RankedApp(id: 2, name: "Rival")]
        let samples = [Sample(date: start, targetID: 1, results: both),
                       Sample(date: start.addingTimeInterval(60), targetID: 1, results: [both[0]]),
                       Sample(date: start.addingTimeInterval(120), targetID: 1, results: both)]
        XCTAssertEqual(RankingTimeline.samples(samples, since: start.addingTimeInterval(60)).count, 2)
        XCTAssertEqual(Set(RankingTimeline.points(samples, appleID: 1).map(\.segment)).count, 1)
        XCTAssertEqual(Set(RankingTimeline.points(samples, appleID: 2).map(\.segment)).count, 2)
    }
}

extension RankblickTests {
    func testVisibilitySeparatesBrandsAndRejectsStaleOrFailedMeasurements() {
        let now = Date()
        var p = Project(appleID: 1, name: "Own", country: "ch")
        p.competitors = [RankedApp(id: 2, name: "Rival")]
        func word(_ text: String, _ category: KeywordCategory, _ date: Date, _ results: [RankedApp]) -> Keyword {
            var k = Keyword(text: text); k.category = category
            k.samples = [Sample(date: date, targetID: 1, results: results)]; return k
        }
        let own = RankedApp(id: 1, name: "Own"), rival = RankedApp(id: 2, name: "Rival")
        let core = word("intranet", .core, now, [rival, own])
        let brand = word("own", .brand, now, [own])
        let stale = word("old", .core, now.addingTimeInterval(-86401), [own])
        var failed = word("error", .core, now, [own]); failed.lastError = "HTTP 429"
        p.keywords = [core, brand, stale, failed, Keyword(text: "unreviewed")]
        let snapshot = CompetitionSnapshot(project: p, now: now, category: .core)
        XCTAssertEqual(snapshot.matchedKeywords, 1); XCTAssertEqual(snapshot.included, 1); XCTAssertEqual(snapshot.totalKeywords, 3)
        XCTAssertEqual(snapshot.entries[0].share!, 1.0 / 3, accuracy: 0.00001)
        XCTAssertEqual(CompetitionSnapshot(project: p, now: now, category: .brand).entries[0].share, 1)
        let report = AnalysisExport(workspace: Workspace(projects: [p]), generatedAt: now)
        XCTAssertEqual(report.projects[0].visibilitySegments.first { $0.category == .core }?.includedKeywords, ["intranet"])
        XCTAssertEqual(report.projects[0].visibility[0].share!, 1.0 / 3, accuracy: 0.00001)
    }
    func testResearchImportPreservesHistoryAndIsIdempotent() throws {
        let repo = try Repository(directory: root); try seedFixture(repo)
        let before = try repo.read().projects[0]
        let json = """
        {"appleID":\(before.appleID),"country":"ch","keywords":[{"text":"intranet","category":"core","rationale":"Shared purpose"},{"text":"moodle","category":"adjacent","rationale":"Competitor specialization"}]}
        """
        let plan = try JSONCoding.decoder().decode(KeywordResearchPlan.self, from: Data(json.utf8))
        try repo.importResearch(plan); try repo.importResearch(plan)
        let after = try repo.read().projects[0]
        XCTAssertEqual(after.keywords.count, before.keywords.count + 1)
        XCTAssertEqual(after.keywords.first { $0.text == "intranet" }?.samples.map(\.id), before.keywords.first { $0.text == "intranet" }?.samples.map(\.id))
        XCTAssertEqual(after.keywords.first { $0.text == "moodle" }?.category, .adjacent)
        XCTAssertEqual(after.keywords.first { $0.text == "inbox" }?.effectiveCategory, .brand)
        let report = try JSONCoding.decoder().decode(AnalysisExport.self, from: Data(contentsOf: repo.analysisExportURL))
        XCTAssertEqual(report.formatVersion, 2)
    }
}

extension RankblickTests {
    func testKeywordStandingsKeepActualSearchRanksAndSortCompetitors() {
        var project = Project(appleID: 18, name: "Own", country: "ch")
        project.competitors = [RankedApp(id: 3, name: "Third"), RankedApp(id: 1, name: "First"), RankedApp(id: 2, name: "Second")]
        var keyword = Keyword(text: "intranet")
        keyword.samples = [Sample(targetID: 18, results: (1...20).map { RankedApp(id: $0, name: "App \($0)") })]
        let entries = KeywordStandings.entries(project: project, keyword: keyword)
        XCTAssertEqual(entries.map(\.id), [1, 2, 3, 18])
        XCTAssertEqual(entries.map(\.rank), [1, 2, 3, 18]) // own app must never be displayed as search rank 4
    }
    func testKeywordStandingsMissingAppsAndPerAppMovement() {
        var project = Project(appleID: 1, name: "Own", country: "ch")
        project.competitors = [RankedApp(id: 2, name: "Rival"), RankedApp(id: 3, name: "Absent")]
        var keyword = Keyword(text: "keyword")
        keyword.samples = [
            Sample(targetID: 1, results: [RankedApp(id: 1, name: "Own"), RankedApp(id: 2, name: "Rival")]),
            Sample(targetID: 1, results: [RankedApp(id: 4, name: "Outside"), RankedApp(id: 2, name: "Rival")])
        ]
        let entries = KeywordStandings.entries(project: project, keyword: keyword)
        XCTAssertEqual(entries.map(\.id), [2, 1, 3])
        XCTAssertEqual(entries.first?.rank, 2) // selected leader isn't necessarily global rank 1
        XCTAssertEqual(entries.first?.delta, 0)
        XCTAssertNil(entries[1].rank); XCTAssertEqual(entries[1].previousRank, 1)
        let unmeasured = KeywordStandings.entries(project: project, keyword: Keyword(text: "new"))
        XCTAssertTrue(unmeasured.allSatisfy { $0.rank == nil && !$0.hasPrevious })
    }
}
