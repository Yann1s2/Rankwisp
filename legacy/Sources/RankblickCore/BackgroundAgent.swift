import Foundation

public enum BackgroundAgent {
    public static let label = "ch.yannis.rankblick.refresh"
    public static var plistURL: URL { FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/LaunchAgents/\(label).plist") }
    public static var installed: Bool { FileManager.default.fileExists(atPath: plistURL.path) }
    private static var domain: String { "gui/\(getuid())" }
    @discardableResult private static func launchctl(_ args: [String], check: Bool = true) throws -> String {
        let process = Process(); process.executableURL = URL(fileURLWithPath: "/bin/launchctl"); process.arguments = args
        let pipe = Pipe(); process.standardOutput = pipe; process.standardError = pipe
        try process.run()
        let data = pipe.fileHandleForReading.readDataToEndOfFile(); process.waitUntilExit()
        let text = String(data: data, encoding: .utf8) ?? ""
        if check && process.terminationStatus != 0 { throw RankblickError.message("Hintergrunddienst konnte nicht eingerichtet werden: \(text)") }
        return text
    }
    public static func install(executable: URL, repository: Repository) throws {
        let worker = executable.deletingLastPathComponent().appendingPathComponent("RankblickWorker")
        guard FileManager.default.isExecutableFile(atPath: worker.path) else { throw RankblickError.message("RankblickWorker fehlt. Bitte die vollständige App installieren.") }
        try FileManager.default.createDirectory(at: plistURL.deletingLastPathComponent(), withIntermediateDirectories: true)
        let plist: [String: Any] = [
            "Label": label, "ProgramArguments": [worker.path, "--refresh-due"],
            "StartInterval": 300, "RunAtLoad": true,
            "StandardOutPath": repository.directory.appendingPathComponent("background.log").path,
            "StandardErrorPath": repository.directory.appendingPathComponent("background-error.log").path
        ]
        // bootout is best effort: the first install has no existing service.
        try launchctl(["bootout", "\(domain)/\(label)"], check: false)
        let bytes = try PropertyListSerialization.data(fromPropertyList: plist, format: .xml, options: 0)
        try bytes.write(to: plistURL, options: .atomic)
        try launchctl(["bootstrap", domain, plistURL.path])
    }
    public static func uninstall() throws {
        try launchctl(["bootout", "\(domain)/\(label)"], check: false)
        if installed { try FileManager.default.removeItem(at: plistURL) }
    }
    public static func status() -> String { (try? launchctl(["print", "\(domain)/\(label)"])) ?? "Nicht geladen" }
}
