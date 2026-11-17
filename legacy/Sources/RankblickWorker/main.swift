import Foundation
import RankblickCore

Task.detached {
    do {
        let repository = try Repository(); try repository.bootstrap()
        if let index = CommandLine.arguments.firstIndex(of: "--analytics") {
            guard CommandLine.arguments.count > index + 1, let id = Int(CommandLine.arguments[index + 1]) else { throw RankblickError.message("Syntax: --analytics APP_ID") }
            let client = ConnectAnalytics(configuration: try .load(repository: repository))
            let snapshot = try await client.refresh(appID: id, repository: repository)
            print("Apple Analytics: \(snapshot.requests.count) Aufträge, \(snapshot.reports.count) Berichte")
            exit(0)
        }
        if let index = CommandLine.arguments.firstIndex(of: "--import-keywords") {
            guard CommandLine.arguments.count > index + 1 else { throw RankblickError.message("Syntax: --import-keywords FILE.json") }
            let plan = try JSONCoding.decoder().decode(KeywordResearchPlan.self, from: Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[index + 1])))
            try repository.importResearch(plan)
            print("Keyword-Recherche importiert: \(plan.keywords.count) Einträge")
            exit(0)
        }
        if let index = CommandLine.arguments.firstIndex(of: "--add-competitor") {
            let args = CommandLine.arguments
            guard args.count > index + 3, let target = Int(args[index + 1]), let rival = Int(args[index + 2]),
                  let project = try repository.read().projects.first(where: { $0.appleID == target && $0.country == args[index + 3] }) else {
                throw RankblickError.message("Syntax: --add-competitor OWN_APP_ID COMPETITOR_ID STORE")
            }
            let app = try await AppleClient(repository: repository).details(id: rival, country: project.country)
            try repository.addCompetitor(RankedApp(id: app.appleID, name: app.name), projectID: project.id)
            try repository.update { data in
                guard let p = data.projects.firstIndex(where: { $0.id == project.id }) else { return }
                if data.projects[p].storeSnapshots == nil { data.projects[p].storeSnapshots = [] }
                data.projects[p].storeSnapshots?.append(app)
            }
            print("Konkurrenz hinzugefügt: \(app.name) [\(app.appleID)]")
            exit(0)
        }
        let report = try await RefreshEngine(repository: repository).run(force: CommandLine.arguments.contains("--refresh-now"), background: true)
        print("\(Date().ISO8601Format()) · \(report.succeeded) erfolgreich, \(report.failed) fehlgeschlagen")
        print("App-Profile: \(report.metadataSucceeded) erfolgreich, \(report.metadataFailed) fehlgeschlagen")
        exit(report.failed + report.metadataFailed > 0 ? 1 : 0)
    } catch {
        fputs("\(error.localizedDescription)\n", stderr); exit(1)
    }
}
dispatchMain()
