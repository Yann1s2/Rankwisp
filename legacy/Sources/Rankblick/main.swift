import SwiftUI
import RankblickCore

let arguments = CommandLine.arguments
if arguments.contains("--refresh-due") || arguments.contains("--refresh-now") {
    Task {
        do {
            let repository = try Repository(); try repository.bootstrap()
            let result = try await RefreshEngine(repository: repository).run(force: arguments.contains("--refresh-now"), background: true)
            print("\(Date().ISO8601Format()) · \(result.succeeded) erfolgreich, \(result.failed) fehlgeschlagen")
            exit(result.failed > 0 ? 1 : 0)
        } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
    }
    dispatchMain()
} else if arguments.contains("--install-agent") {
    do {
        let repository = try Repository(); try repository.bootstrap()
        try BackgroundAgent.install(executable: URL(fileURLWithPath: arguments[0]).standardizedFileURL, repository: repository)
        try repository.update { $0.automaticUpdates = true }
        print(BackgroundAgent.status())
    } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
} else if arguments.contains("--remove-agent") {
    do { try BackgroundAgent.uninstall(); try Repository().update { $0.automaticUpdates = false }; print("Hintergrunddienst entfernt.") }
    catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
} else if arguments.contains("--status") {
    do {
        let repository = try Repository(); let data = try repository.read()
        print("Daten: \(repository.dataURL.path)\nApps: \(data.projects.count)\nAutomatik: \(data.automaticUpdates)")
        for p in data.projects { for k in p.activeKeywords { print("\(p.name) [\(p.country)] \(k.text): \(k.latest?.rank.map(String.init) ?? "–") · \(k.samples.count) Messungen") } }
        print(BackgroundAgent.status())
    } catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
} else {
    RankblickApp.main()
}

struct RankblickApp: App {
    @State private var model = AppModel()
    var body: some Scene {
        Window("Rankblick", id: "main") {
            MainView(model: model)
                .frame(minWidth: 1040, minHeight: 700)
                .tint(Theme.crimson)
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 1280, height: 820)
        .commands {
            CommandGroup(after: .newItem) {
                Button("Jetzt aktualisieren") { Task { await model.refresh() } }
                    .keyboardShortcut("r", modifiers: .command).disabled(model.isRefreshing)
                Button("Daten exportieren …") { model.export() }.keyboardShortcut("e", modifiers: [.command, .shift])
            }
        }
        Settings { ScrollView { SettingsView(model: model).frame(width: 540).padding(28) }.frame(width: 596, height: 700).background(Theme.paper).preferredColorScheme(.light) }
    }
}
