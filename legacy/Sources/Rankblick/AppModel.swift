import SwiftUI
import Observation
import RankblickCore
import UniformTypeIdentifiers

@Observable @MainActor final class AppModel {
    var workspace = Workspace()
    var selectedProject: UUID?
    var selectedKeyword: UUID?
    var isRefreshing = false
    var progress = 0.0
    var activity = "Bereit"
    var error: String?
    var agentInstalled = BackgroundAgent.installed
    @ObservationIgnored private(set) var repository: Repository?

    init() {
        do {
            let repo = try Repository(); try repo.bootstrap()
            repository = repo
            workspace = try repo.read()
            selectedProject = workspace.projects.first(where: { !$0.archived })?.id
            selectedKeyword = project?.activeKeywords.first(where: { $0.text == "intranet" })?.id ?? project?.activeKeywords.first?.id
        } catch {
            repository = nil
            self.error = "Daten konnten nicht geladen werden: \(error.localizedDescription)"
        }
    }
    var project: Project? { workspace.projects.first { $0.id == selectedProject } }
    var keyword: Keyword? { project?.keywords.first { $0.id == selectedKeyword } }
    var nextDue: Date? { workspace.projects.filter { !$0.archived }.flatMap(\.activeKeywords).map(\.nextDue).min() }
    func reload() {
        guard let repository else { return }
        do { workspace = try repository.read(); agentInstalled = BackgroundAgent.installed }
        catch { self.error = "Lesefehler: \(error.localizedDescription)" }
    }
    func poll() {
        reload()
        guard !isRefreshing, workspace.automaticUpdates,
              (workspace.projects.filter({ !$0.archived }).flatMap(\.activeKeywords).contains(where: { $0.isDue() }) || workspace.projects.contains(where: { !$0.archived && $0.metadataIsDue() })) else { return }
        Task { await refresh(force: false, allProjects: true) }
    }
    func selectProject(_ id: UUID?) {
        selectedProject = id; selectedKeyword = project?.activeKeywords.first(where: { $0.text == "intranet" })?.id ?? project?.activeKeywords.first?.id
    }
    func refresh(force: Bool = true, allProjects: Bool = false, onlyKeyword: UUID? = nil) async {
        guard !isRefreshing, let repository else { return }
        isRefreshing = true; progress = 0; activity = "Verbinde mit Apple …"
        defer { isRefreshing = false; reload() }
        do {
            let report = try await RefreshEngine(repository: repository).run(force: force, projectID: allProjects ? nil : selectedProject, keywordID: onlyKeyword, progress: { [self] word, done, total in
                await receiveProgress(word: word, done: done, total: total)
            })
            if report.succeeded + report.failed > 0 {
                activity = report.failed == 0 ? "\(report.succeeded) Keywords aktualisiert" : "\(report.succeeded) aktualisiert · \(report.failed) fehlgeschlagen"
            } else { activity = "Alle Messungen sind aktuell" }
            if report.metadataFailed > 0 { activity += " · App-Store-Daten teilweise fehlgeschlagen" }
            if report.metadataSucceeded > 0 { activity += " · \(report.metadataSucceeded) App-Profile geprüft" }
        } catch { activity = error.localizedDescription }
    }
    private func receiveProgress(word: String, done: Int, total: Int) {
        progress = total == 0 ? 1 : Double(done) / Double(total)
        activity = word == "Fertig" ? "Abruf abgeschlossen" : done >= total ? word : "\(done + 1)/\(total) · \(word)"
        reload()
    }
    func addKeywords(_ words: String) throws {
        guard let repository, let selectedProject else { throw RankblickError.message("Bitte zuerst eine App auswählen.") }
        try repository.addKeywords(words, projectID: selectedProject); reload()
        if selectedKeyword == nil { selectedKeyword = project?.activeKeywords.first(where: { $0.text == "intranet" })?.id ?? project?.activeKeywords.first?.id }
        Task { await refresh(force: false) }
    }
    func addProject(input: String, country: String) async throws {
        guard let repository else { throw RankblickError.message("Datenspeicher nicht verfügbar.") }
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let id: Int?
        if let number = Int(trimmed) { id = number }
        else if let range = trimmed.range(of: "id[0-9]+", options: .regularExpression) { id = Int(trimmed[range].dropFirst(2)) }
        else { id = nil }
        guard let id, id > 0 else { throw RankblickError.message("Bitte eine App-Store-URL oder numerische App-ID eingeben.") }
        if let existing = workspace.projects.first(where: { $0.appleID == id && $0.country == country }) {
            try repository.update { data in if let i = data.projects.firstIndex(where: { $0.id == existing.id }) { data.projects[i].archived = false } }
            reload(); selectProject(existing.id); return
        }
        let project = try await AppleClient(repository: repository).lookup(id: id, country: country)
        try repository.update { $0.projects.append(project) }; reload(); selectProject(project.id)
    }
    func addCompetitor(input: String) async throws {
        guard let repository, let project else { throw RankblickError.message("Bitte zuerst eine eigene App auswählen.") }
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let id = Int(trimmed) ?? trimmed.range(of: "id[0-9]+", options: .regularExpression).flatMap { Int(trimmed[$0].dropFirst(2)) }
        guard let id, id > 0 else { throw RankblickError.message("Bitte eine App-Store-URL oder App-ID eingeben.") }
        let app = try await AppleClient(repository: repository).details(id: id, country: project.country)
        try repository.addCompetitor(RankedApp(id: app.appleID, name: app.name), projectID: project.id)
        try repository.update { data in
            guard let p = data.projects.firstIndex(where: { $0.id == project.id }) else { return }
            if data.projects[p].storeSnapshots == nil { data.projects[p].storeSnapshots = [] }
            data.projects[p].storeSnapshots?.append(app)
        }
        reload()
    }
    func removeCompetitor(_ id: Int) {
        guard let repository, let selectedProject else { return }
        do {
            try repository.update { data in
                guard let p = data.projects.firstIndex(where: { $0.id == selectedProject }) else { return }
                data.projects[p].competitors?.removeAll { $0.id == id }
            }
            reload()
        } catch { self.error = error.localizedDescription }
    }
    func setCategory(_ id: UUID, category: KeywordCategory) {
        guard let repository, let selectedProject else { return }
        do {
            try repository.update { data in
                guard let p = data.projects.firstIndex(where: { $0.id == selectedProject }), let k = data.projects[p].keywords.firstIndex(where: { $0.id == id }) else { return }
                data.projects[p].keywords[k].category = category
                data.projects[p].keywords[k].researchNote = "Manuell eingeordnet am " + Date().ISO8601Format()
            }
            reload()
        } catch { self.error = error.localizedDescription }
    }
    func archiveKeyword(_ id: UUID, archived: Bool) {
        guard let repository, let selectedProject else { return }
        do {
            try repository.update { data in
                guard let p = data.projects.firstIndex(where: { $0.id == selectedProject }), let k = data.projects[p].keywords.firstIndex(where: { $0.id == id }) else { return }
                data.projects[p].keywords[k].archived = archived
            }
            reload()
            if archived && selectedKeyword == id { selectedKeyword = project?.activeKeywords.first(where: { $0.text == "intranet" })?.id ?? project?.activeKeywords.first?.id }
        } catch { self.error = error.localizedDescription }
    }
    func setAutomatic(_ enabled: Bool) {
        guard let repository else { return }
        do {
            if enabled {
                guard let binary = Bundle.main.executableURL else { throw RankblickError.message("App-Pfad nicht gefunden.") }
                try BackgroundAgent.install(executable: binary, repository: repository)
            } else { try BackgroundAgent.uninstall() }
            try repository.update { $0.automaticUpdates = enabled }; reload()
        } catch { self.error = error.localizedDescription; reload() }
    }
    var exportError: String? {
        guard let repository else { return "Datenspeicher nicht verfügbar" }
        return try? String(contentsOf: repository.exportErrorURL, encoding: .utf8)
    }
    var analysisExportDate: Date? {
        guard let repository else { return nil }
        return (try? repository.analysisExportURL.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate
    }
    func openAnalysisExport() {
        guard let repository else { return }
        do {
            // A no-op transaction regenerates the export under the same data lock.
            try repository.update { _ in }
            if let exportError { throw RankblickError.message(exportError) }
            NSWorkspace.shared.activateFileViewerSelecting([repository.analysisExportURL])
        } catch { self.error = error.localizedDescription }
    }
    func export() {
        guard let repository else { return }
        let panel = NSSavePanel(); panel.allowedContentTypes = [.json]; panel.nameFieldStringValue = "Rankblick-Backup.json"
        guard panel.runModal() == .OK, let url = panel.url else { return }
        do { try JSONCoding.encoder().encode(repository.read()).write(to: url, options: .atomic) }
        catch { self.error = error.localizedDescription }
    }
}
