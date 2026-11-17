import SwiftUI
import RankblickCore

struct KeywordItem: View {
    let keyword: Keyword
    let selected: Bool
    let compact: Bool
    let select: () -> Void
    let details: () -> Void
    let refresh: () -> Void
    let archive: () -> Void
    let refreshing: Bool
    var body: some View {
        HStack(spacing: 6) {
            Button(action: select) {
                HStack(spacing: 9) {
                    Image(systemName: keyword.latest?.rank == nil ? "magnifyingglass" : "number")
                        .font(.system(size: compact ? 10 : 13, weight: .medium)).foregroundStyle(selected ? Theme.paper : Theme.ink)
                        .frame(width: compact ? 22 : 32, height: compact ? 22 : 32)
                        .background(selected ? Theme.ink : Theme.muted.opacity(0.22), in: Circle())
                    VStack(alignment: .leading, spacing: 3) {
                        Text(keyword.text).font(Theme.font(compact ? 12 : 13, .medium)).lineLimit(1)
                        if !compact {
                            if keyword.lastError != nil { Text("Abruf fehlgeschlagen").foregroundStyle(Theme.crimson).font(Theme.font(10)) }
                            else if let sample = keyword.latest { Text(sample.date, style: .relative).font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                            else { Text("Noch nicht gemessen").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                        }
                    }
                    Spacer(minLength: 4)
                    Text(keyword.latest?.rank.map { "#\($0)" } ?? "—").font(Theme.font(compact ? 12 : 15, .semibold)).monospacedDigit().frame(width: 44, alignment: .trailing)
                        .help(keyword.latest?.rank == nil ? "In den gelieferten Ergebnissen nicht gefunden" : "Position in der Apple-Such-API")
                    Text(keyword.delta == nil ? (keyword.previous == nil ? "Neu" : "—") : keyword.movement)
                        .font(Theme.font(10, .medium)).foregroundStyle((keyword.delta ?? 0) < 0 ? Theme.crimson : Theme.secondary).frame(width: 36, alignment: .trailing)
                    if compact { TrendBars(samples: keyword.samples).frame(width: 45) }
                }.contentShape(Rectangle())
            }.buttonStyle(.plain).accessibilityLabel("\(keyword.text), \(keyword.latest?.rank.map { "Position \($0)" } ?? "nicht gefunden"), \(keyword.movement)")
            Menu {
                Button("Suchergebnisse & Details", action: details)
                Button("Jetzt aktualisieren", action: refresh).disabled(refreshing || keyword.archived)
                Divider()
                Button(keyword.archived ? "Wiederherstellen" : "Archivieren", action: archive)
            } label: { Image(systemName: "ellipsis").font(.system(size: 12)).frame(width: 17, height: 24) }
                .menuStyle(.borderlessButton).menuIndicator(.hidden).frame(width: 17).help("Aktionen für \(keyword.text)")
        }.padding(.horizontal, 9).padding(.vertical, compact ? 2 : 10)
            .background(selected ? Theme.muted.opacity(0.20) : Theme.ink.opacity(0.035), in: RoundedRectangle(cornerRadius: compact ? 10 : 15))
            .overlay(alignment: .leading) { if selected { Capsule().fill(Theme.red).frame(width: 3, height: compact ? 14 : 24).padding(.leading, 1) } }
    }
}

private struct TrendBars: View {
    let samples: [Sample]
    var body: some View {
        HStack(alignment: .bottom, spacing: 2) {
            ForEach(Array(samples.suffix(10))) { sample in
                RoundedRectangle(cornerRadius: 2)
                    .fill(sample.rank == nil ? Theme.muted.opacity(0.55) : Theme.red)
                    .frame(width: 3, height: sample.rank.map { max(4, 17 - Double(min($0, 200)) / 16) } ?? 4)
            }
        }.frame(maxWidth: .infinity, alignment: .trailing).frame(height: 18)
            .help("Die letzten \(min(10, samples.count)) Messungen. Höhere Balken bedeuten bessere Positionen.").accessibilityHidden(true)
    }
}

struct KeywordSheet: View {
    @Bindable var model: AppModel
    let keyword: Keyword
    let project: Project
    @Environment(\.dismiss) private var dismiss
    private var live: Keyword { model.project?.keywords.first { $0.id == keyword.id } ?? keyword }
    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 5) {
                    Text(live.text).font(Theme.font(25, .semibold)).textSelection(.enabled)
                    Text("\(project.name) · \(project.country.uppercased()) · iPhone").font(Theme.font(11)).foregroundStyle(Theme.secondary)
                }
                Spacer()
                Button { Task { await model.refresh(onlyKeyword: live.id) } } label: { Label("Aktualisieren", systemImage: "arrow.clockwise") }
                    .buttonStyle(PillStyle(dark: true, compact: true)).disabled(model.isRefreshing || live.archived)
                IconControl(symbol: "xmark", label: "Details schliessen") { dismiss() }
            }.padding(24)
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(live.latest?.rank.map { "#\($0)" } ?? "—").font(Theme.font(43, .semibold))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(live.movement).font(Theme.font(12, .medium))
                            Text("\(live.latest?.resultCount ?? 0) gelieferte Suchergebnisse").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                        }
                    }
                    Picker("Vergleichsgruppe", selection: Binding(get: { live.effectiveCategory }, set: { model.setCategory(live.id, category: $0) })) {
                        ForEach(KeywordCategory.allCases, id: \.self) { Text($0.title).tag($0) }
                    }
                    if let note = live.researchNote { Text(note).font(Theme.font(10)).foregroundStyle(Theme.secondary).textSelection(.enabled) }
                    if let error = live.lastError { Label(error, systemImage: "exclamationmark.triangle").font(Theme.font(11)).foregroundStyle(Theme.crimson) }
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Letzter Abruf").font(Theme.font(15, .semibold))
                        Text(live.latest?.date.formatted(date: .abbreviated, time: .shortened) ?? "Noch nicht gemessen").font(Theme.font(12))
                        Text("\(live.samples.count) Messpunkte gespeichert. Zeitreihen und das Messprotokoll findest du auf der Seite Verlauf.").font(Theme.font(11)).foregroundStyle(Theme.secondary)
                        if let date = live.latest?.httpDate { Text("HTTP Date: \(date)").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                        if let age = live.latest?.cacheAge { Text("Server-Cache-Alter: \(age) s").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                    }.surface()
                    if let sample = live.latest, !sample.results.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            Text("Vorne in der Suche").font(Theme.font(15, .medium))
                            ForEach(Array(sample.results.prefix(5))) { app in
                                Link(destination: URL(string: "https://apps.apple.com/\(project.country)/app/id\(app.id)")!) {
                                    HStack { Text(app.name); Spacer(); Image(systemName: "arrow.up.right") }.font(Theme.font(12))
                                }.foregroundStyle(Theme.ink)
                            }
                        }.surface()
                    }
                    Text("Quelle: Apple-Such-API · Limit 200. API-Positionen können von der iPhone-Suche abweichen. Apple kann Antworten zwischenspeichern; der Zeitstempel zeigt den Abruf.")
                        .font(Theme.font(10)).foregroundStyle(Theme.secondary)
                    Button(live.archived ? "Keyword wiederherstellen" : "Keyword archivieren") { model.archiveKeyword(live.id, archived: !live.archived); dismiss() }
                        .buttonStyle(PillStyle(compact: true))
                }.padding(.horizontal, 24).padding(.bottom, 24)
            }
        }.frame(width: 650, height: 690).background(Theme.muted.opacity(0.08).background(Theme.paper))
            .foregroundStyle(Theme.ink).tint(Theme.crimson).preferredColorScheme(.light)
    }
}
