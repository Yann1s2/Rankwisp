import Foundation
import Darwin

public final class FileLock {
    private var descriptor: Int32 = -1
    public init(url: URL, nonBlocking: Bool = false) throws {
        descriptor = Darwin.open(url.path, O_CREAT | O_RDWR, S_IRUSR | S_IWUSR)
        guard descriptor >= 0 else { throw RankblickError.message("Sperrdatei kann nicht geöffnet werden.") }
        if flock(descriptor, LOCK_EX | (nonBlocking ? LOCK_NB : 0)) != 0 {
            Darwin.close(descriptor); descriptor = -1
            throw RankblickError.message("Eine andere Aktualisierung läuft bereits.")
        }
    }
    deinit { if descriptor >= 0 { flock(descriptor, LOCK_UN); Darwin.close(descriptor) } }
}

public struct Repository: Sendable {
    public let directory: URL
    public var dataURL: URL { directory.appendingPathComponent("rankblick.json") }
    public init(directory: URL? = nil) throws {
        if let directory { self.directory = directory }
        else if let path = ProcessInfo.processInfo.environment["RANKBLICK_DATA_DIR"] { self.directory = URL(fileURLWithPath: path) }
        else { self.directory = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Rankblick", isDirectory: true) }
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
    }
    public func read() throws -> Workspace {
        let lock = try FileLock(url: directory.appendingPathComponent("data.lock")); defer { withExtendedLifetime(lock) {} }
        return try readUnlocked()
    }
    private func readUnlocked() throws -> Workspace {
        guard FileManager.default.fileExists(atPath: dataURL.path) else { return Workspace() }
        let data = try Data(contentsOf: dataURL)
        let workspace = try JSONCoding.decoder().decode(Workspace.self, from: data)
        guard workspace.schemaVersion == 1 else { throw RankblickError.message("Diese Datenbank benötigt eine neuere Rankblick-Version.") }
        return workspace
    }
    @discardableResult public func update(_ change: (inout Workspace) throws -> Void) throws -> Workspace {
        let lock = try FileLock(url: directory.appendingPathComponent("data.lock")); defer { withExtendedLifetime(lock) {} }
        var workspace = try readUnlocked()
        try change(&workspace)
        try backupUnlocked()
        try JSONCoding.encoder().encode(workspace).write(to: dataURL, options: .atomic)
        chmod(dataURL.path, S_IRUSR | S_IWUSR)
        do { try writeAnalysisExport(workspace) }
        catch { try? ("Automatischer Analyse-Export fehlgeschlagen: " + error.localizedDescription).write(to: exportErrorURL, atomically: true, encoding: .utf8) }
        return workspace
    }
    private func backupUnlocked() throws {
        guard FileManager.default.fileExists(atPath: dataURL.path) else { return }
        let folder = directory.appendingPathComponent("Backups", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let name = ISO8601DateFormatter().string(from: Date()).prefix(10)
        let target = folder.appendingPathComponent("rankblick-\(name).json")
        if !FileManager.default.fileExists(atPath: target.path) { try FileManager.default.copyItem(at: dataURL, to: target) }
    }
    public func bootstrap() throws {
        let lock = try FileLock(url: directory.appendingPathComponent("data.lock")); defer { withExtendedLifetime(lock) {} }
        guard !FileManager.default.fileExists(atPath: dataURL.path) else { _ = try readUnlocked(); return }
        let bundledSeed = Bundle.main.executableURL?.deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Resources/seed.json")
        let nearbySeed = bundledSeed.flatMap { FileManager.default.fileExists(atPath: $0.path) ? $0 : nil }
        guard let seed = Bundle.main.url(forResource: "seed", withExtension: "json") ?? nearbySeed ?? Bundle.module.url(forResource: "seed", withExtension: "json") else { throw RankblickError.message("Startdaten fehlen.") }
        let data = try Data(contentsOf: seed)
        _ = try JSONCoding.decoder().decode(Workspace.self, from: data)
        try data.write(to: dataURL, options: .atomic); chmod(dataURL.path, S_IRUSR | S_IWUSR)
    }
    public func refreshLock() throws -> FileLock { try FileLock(url: directory.appendingPathComponent("refresh.lock"), nonBlocking: true) }
    // Coordinate API pacing across the GUI and the launchd worker, including app lookups.
    public func reserveRequest() throws -> TimeInterval {
        let lock = try FileLock(url: directory.appendingPathComponent("rate.lock")); defer { withExtendedLifetime(lock) {} }
        let url = directory.appendingPathComponent("next-request.txt")
        let previous = (try? String(contentsOf: url, encoding: .utf8)).flatMap(Double.init) ?? 0
        let now = Date().timeIntervalSince1970
        let slot = max(now, min(previous, now + 120))
        try String(slot + 3.3).write(to: url, atomically: true, encoding: .utf8)
        return max(0, slot - now)
    }
    public func addKeywords(_ text: String, projectID: UUID) throws {
        let words = normalizedKeywords(text)
        guard !words.isEmpty else { throw RankblickError.message("Bitte mindestens ein Keyword eingeben.") }
        guard words.allSatisfy({ $0.count <= 100 }) else { throw RankblickError.message("Ein Keyword darf höchstens 100 Zeichen enthalten.") }
        try update { data in
            guard let p = data.projects.firstIndex(where: { $0.id == projectID }) else { throw RankblickError.message("App nicht gefunden.") }
            let new = words.filter { word in !data.projects[p].keywords.contains { $0.text == word } }
            guard data.projects[p].activeKeywords.count + new.count + data.projects[p].keywords.filter({ $0.archived && words.contains($0.text) }).count <= 100 else {
                throw RankblickError.message("Pro App und Store sind bis zu 100 aktive Keywords möglich.")
            }
            for i in data.projects[p].keywords.indices where words.contains(data.projects[p].keywords[i].text) { data.projects[p].keywords[i].archived = false }
            data.projects[p].keywords.append(contentsOf: new.map(Keyword.init))
        }
    }
}
