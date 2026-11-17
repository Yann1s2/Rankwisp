import SwiftUI
import RankblickCore

struct KeywordLeaderboardCard: View {
    let project: Project
    let openProfile: (RankedApp) -> Void
    @State private var selectedID: UUID?
    private var keywords: [Keyword] { project.activeKeywords.sorted { $0.text.localizedStandardCompare($1.text) == .orderedAscending } }
    private var selected: Keyword? {
        keywords.first { $0.id == selectedID } ?? keywords.first { $0.text == "intranet" } ?? keywords.first
    }
    private var shortcuts: [Keyword] {
        ["intranet", "schul intranet", "absenzen", "pluspunkte"].compactMap { text in keywords.first { $0.text == text } }
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .center, spacing: 20) {
                VStack(alignment: .leading, spacing: 5) {
                    Text("KEYWORD-RANGLISTE").font(Theme.font(9, .semibold)).tracking(1.6).foregroundStyle(Theme.secondary)
                    Menu {
                        ForEach(keywords) { keyword in
                            Button { selectedID = keyword.id } label: {
                                if keyword.id == selected?.id { Label(keyword.text, systemImage: "checkmark") }
                                else { Text(keyword.text) }
                            }
                        }
                    } label: {
                        HStack(spacing: 10) {
                            Text(selected?.text ?? "Keyword auswählen").font(Theme.font(27, .semibold)).lineLimit(1)
                            Image(systemName: "chevron.down").font(.system(size: 12, weight: .semibold))
                        }.foregroundStyle(Theme.ink)
                    }.menuStyle(.borderlessButton).menuIndicator(.hidden).frame(maxWidth: 360, alignment: .leading).disabled(keywords.isEmpty)
                        .help("Keyword für die Rangliste auswählen")
                }
                Spacer(minLength: 10)
                VStack(alignment: .trailing, spacing: 5) {
                    if selected?.text == "intranet" {
                        Label("Dein Fokus", systemImage: "scope").font(Theme.font(10, .semibold)).foregroundStyle(Theme.crimson)
                    }
                    Text("\(project.country.uppercased()) · iPhone · \(project.comparisonApps.count) Apps").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                    Text(selected?.latest.map { $0.date.formatted(date: .abbreviated, time: .shortened) } ?? "Noch nicht gemessen").font(Theme.font(9)).foregroundStyle(Theme.secondary)
                }
            }
            if !shortcuts.isEmpty {
                HStack(spacing: 7) {
                    ForEach(shortcuts) { keyword in
                        Button { selectedID = keyword.id } label: {
                            Text(keyword.text).font(Theme.font(10, .medium)).padding(.horizontal, 13).padding(.vertical, 7)
                                .foregroundStyle(selected?.id == keyword.id ? Theme.paper : Theme.secondary)
                                .background(selected?.id == keyword.id ? Theme.ink : Theme.muted.opacity(0.10), in: Capsule())
                        }.buttonStyle(.plain).accessibilityAddTraits(selected?.id == keyword.id ? .isSelected : [])
                    }
                }
            }
            if let keyword = selected {
                standings(keyword)
                if let error = keyword.lastError {
                    Label("Letzter Abruf fehlgeschlagen: \(error). Angezeigt wird die letzte erfolgreiche Messung.", systemImage: "exclamationmark.triangle")
                        .font(Theme.font(10)).foregroundStyle(Theme.crimson)
                } else if let sample = keyword.latest, Date().timeIntervalSince(sample.date) > 86400 {
                    Label("Diese Messung ist älter als 24 Stunden.", systemImage: "clock").font(Theme.font(10)).foregroundStyle(Theme.crimson)
                }
                Text("Echte Positionen in der Apple-Such-API, sortiert innerhalb deiner Vergleichs-Apps. Kleinere Zahl = weiter vorne. \(keyword.latest?.resultCount ?? 0) Ergebnisse geliefert; die iPhone-Suche kann abweichen.")
                    .font(Theme.font(9)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            } else {
                Text("Füge ein Keyword hinzu, um deine Apps im direkten Vergleich zu sehen.").font(Theme.font(12)).foregroundStyle(Theme.secondary).padding(.vertical, 24)
            }
        }.surface(padding: 22)
    }
    private func standings(_ keyword: Keyword) -> some View {
        let entries = KeywordStandings.entries(project: project, keyword: keyword)
        let leader = entries.first.flatMap { $0.rank == nil ? nil : $0 }
        let others = entries.filter { $0.id != leader?.id }
        return VStack(alignment: .leading, spacing: 13) {
            HStack(alignment: .top, spacing: 16) {
                Group {
                    if let leader {
                        Button { openProfile(leader.app) } label: { leaderTile(leader) }.buttonStyle(.plain)
                            .help("App-Store-Profil von \(leader.app.name) öffnen")
                    } else {
                        VStack(alignment: .leading, spacing: 14) {
                            Image(systemName: "magnifyingglass").font(.system(size: 28)).foregroundStyle(Theme.paper.opacity(0.65))
                            Text(keyword.latest == nil ? "Die Rangliste wartet auf Daten." : "Noch kein Treffer im Vergleich.").font(Theme.font(20, .semibold))
                            Text(keyword.latest == nil ? "Mit Aktualisieren wird das Keyword abgefragt." : "Keine dieser Apps ist in den gelieferten Ergebnissen enthalten.").font(Theme.font(11)).foregroundStyle(Theme.paper.opacity(0.7))
                        }.frame(maxWidth: .infinity, minHeight: 188, alignment: .leading).foregroundStyle(Theme.paper).padding(20)
                            .background(Theme.ink, in: RoundedRectangle(cornerRadius: 21))
                    }
                }.frame(width: 260)
                VStack(spacing: 9) {
                    ForEach(others) { entry in
                        Button { openProfile(entry.app) } label: { rankingRow(entry, measured: keyword.latest != nil) }.buttonStyle(.plain)
                            .help("App-Store-Profil von \(entry.app.name) öffnen")
                    }
                    if others.isEmpty {
                        Text("Weitere Apps kannst du unter Apps verwalten ergänzen.").font(Theme.font(12)).foregroundStyle(Theme.secondary).padding(20)
                    }
                }.frame(maxWidth: .infinity, alignment: .top)
            }
            if let own = entries.first(where: { $0.id == project.appleID }), let rank = own.rank, let leader, let first = leader.rank {
                HStack(spacing: 8) {
                    Image(systemName: own.id == leader.id ? "checkmark.circle" : "scope").foregroundStyle(Theme.crimson)
                    Text(own.id == leader.id ? "Deine App liegt in diesem Vergleich vorne – auf Suchposition #\(rank)." : "Deine App liegt \(rank - first) Suchpositionen hinter \(leader.app.name).")
                        .font(Theme.font(11, .medium))
                }.padding(.horizontal, 14).padding(.vertical, 10).frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.red.opacity(0.055), in: RoundedRectangle(cornerRadius: 12))
            }
        }
    }
    private func leaderTile(_ entry: KeywordStanding) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Label("VORNE IM VERGLEICH", systemImage: "crown").font(Theme.font(9, .semibold)).tracking(0.5)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right").font(.system(size: 11))
            }.foregroundStyle(Theme.paper.opacity(0.7))
            HStack(alignment: .center, spacing: 16) {
                StoreIcon(info: project.storeInfo(for: entry.id), size: 66)
                Text(entry.rank.map { "#\($0)" } ?? "—").font(Theme.font(47, .semibold)).monospacedDigit().foregroundStyle(Theme.paper)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(entry.app.name).font(Theme.font(16, .semibold)).lineLimit(2)
                Text(entry.id == project.appleID ? "Deine App · \(movement(entry))" : movement(entry)).font(Theme.font(10)).foregroundStyle(Theme.paper.opacity(0.7))
            }
        }.frame(maxWidth: .infinity, minHeight: 188, alignment: .leading).foregroundStyle(Theme.paper).padding(20)
            .background(Theme.ink.gradient, in: RoundedRectangle(cornerRadius: 21))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(entry.app.name), Suchposition \(entry.rank ?? 0), vorne im Vergleich. \(movement(entry))")
    }
    private func rankingRow(_ entry: KeywordStanding, measured: Bool) -> some View {
        let own = entry.id == project.appleID
        return HStack(spacing: 13) {
            StoreIcon(info: project.storeInfo(for: entry.id), size: 43)
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 7) {
                    Text(entry.app.name).font(Theme.font(12, .semibold)).lineLimit(1)
                    if own { Text("DEINE APP").font(Theme.font(8, .semibold)).foregroundStyle(Theme.crimson) }
                }
                Text(measured ? movement(entry) : "Noch nicht gemessen").font(Theme.font(9)).foregroundStyle(Theme.secondary)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 1) {
                Text(entry.rank.map { "#\($0)" } ?? "—").font(Theme.font(26, .semibold)).monospacedDigit().foregroundStyle(own ? Theme.crimson : Theme.ink)
                Text(entry.rank == nil ? (measured ? "Nicht gefunden" : "Offen") : "Suchposition").font(Theme.font(8)).foregroundStyle(Theme.secondary)
            }
        }.padding(.horizontal, 15).padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
            .background(own ? Theme.red.opacity(0.055) : Theme.muted.opacity(0.08), in: RoundedRectangle(cornerRadius: 16))
            .overlay { RoundedRectangle(cornerRadius: 16).strokeBorder(own ? Theme.red.opacity(0.3) : .clear, lineWidth: 1) }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("\(entry.app.name)\(own ? ", deine App" : ""), \(entry.rank.map { "Suchposition \($0)" } ?? (measured ? "nicht gefunden" : "noch nicht gemessen")), \(movement(entry))")
    }
    private func movement(_ entry: KeywordStanding) -> String {
        guard entry.hasPrevious else { return "Erste Messung" }
        if let delta = entry.delta {
            return delta == 0 ? "Unverändert zum letzten Abruf" : delta > 0 ? "↑ \(delta) Plätze seit letztem Abruf" : "↓ \(-delta) Plätze seit letztem Abruf"
        }
        if entry.rank != nil { return "Neu in den Ergebnissen" }
        return entry.previousRank != nil ? "Nicht mehr in den Ergebnissen" : "Weiterhin ohne Treffer"
    }
}
