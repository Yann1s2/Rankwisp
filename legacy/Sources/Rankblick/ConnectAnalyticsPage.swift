import SwiftUI
import AppKit
import RankblickCore

struct ConnectAnalyticsPage: View {
    let appID: Int
    @State private var snapshot: ConnectSnapshot?
    @State private var busy = false
    @State private var message = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            Text("Apple Analytics").font(.title2.bold())
            Text("Echte Apple-Berichte, getrennt von API-Listenpositionen und iPhone-Suchbeobachtungen. Diese Daten erklären keine einzelne Keyword-Platzierung.")
            HStack {
                Button("Berichte aktualisieren") { Task { await refresh() } }.disabled(busy)
                Button("Berichtsordner öffnen") { if let repo = try? Repository() { NSWorkspace.shared.open(repo.directory.appendingPathComponent("Analytics")) } }
                if busy { ProgressView().controlSize(.small) }
            }
            if !message.isEmpty { Text(message).textSelection(.enabled) }
            if let snapshot {
                Text("Letzter erfolgreicher Abruf: \(snapshot.checkedAt.formatted())").foregroundStyle(.secondary)
                Text("\(snapshot.requests.count) Berichtsaufträge · \(snapshot.reports.count) Berichtstypen")
                if snapshot.requests.isEmpty { Text("Noch keine Berichte aktiviert. Die einmalige Aktivierung erfordert Administratorrechte.") }
                else if snapshot.reports.isEmpty { Text("Apple bereitet die Berichte vor. Der erste Abruf kann 1–2 Tage dauern. Fehlende Daten sind keine Nullwerte.") }
                if snapshot.requests.contains(where: { $0.attributes?.stoppedDueToInactivity == true }) { Text("Ein Berichtsauftrag wurde wegen Inaktivität gestoppt.").foregroundStyle(.orange) }
                Text("Der Katalog enthält auch Berichtstypen ohne verfügbare Daten. Hier erscheinen die Standardberichte für Auffindbarkeit und Downloads.").font(.footnote)
                ForEach(snapshot.reports.filter { ["App Downloads Standard", "App Store Discovery and Engagement Standard"].contains($0.attributes?.name ?? "") }) { report in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(report.attributes?.name ?? report.id).font(.headline)
                            Text(report.attributes?.category ?? "").foregroundStyle(.secondary)
                            Text(report.id).font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Button("Tagesberichte laden") { Task { await download(report) } }.disabled(busy)
                    }.padding().background(.white, in: RoundedRectangle(cornerRadius: 12))
                }
            }
            Text("Downloads können direkt aus Suchtreffern erfolgen. Produktseitenaufrufe sind deshalb kein vollständiger Funnel. API-Berichte können aufgrund von Datenschutzschwellen und Verarbeitung vom Dashboard abweichen.").font(.footnote).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity, alignment: .leading)
        .task(id: appID) { snapshot = nil; if let repo = try? Repository(), let data = try? Data(contentsOf: repo.directory.appendingPathComponent("Analytics/\(appID).json")) { snapshot = try? JSONCoding.decoder().decode(ConnectSnapshot.self, from: data) }; await refresh() }
    }
    private func refresh() async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            let repo = try Repository()
            snapshot = try await ConnectAnalytics(configuration: .load(repository: repo)).refresh(appID: appID, repository: repo)
            message = "Verbindung erfolgreich."
        } catch { message = error.localizedDescription }
    }
    private func download(_ report: ConnectResource) async {
        busy = true; defer { busy = false }
        do {
            let repo = try Repository(); let client = ConnectAnalytics(configuration: try .load(repository: repo))
            let instances = try await client.instances(reportID: report.id)
            var count = 0
            for instance in instances { count += try await client.download(instanceID: instance.id, repository: repo) }
            message = instances.isEmpty ? "Apple hat noch keine Tagesberichte bereitgestellt." : "\(count) Berichtsdateien geladen. Originaldaten liegen im Berichtsordner."
        } catch { message = error.localizedDescription }
    }
}
