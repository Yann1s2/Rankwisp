import SwiftUI
import Charts
import RankblickCore

func appColor(_ id: Int, project: Project) -> Color {
    let index = project.comparisonApps.firstIndex { $0.id == id } ?? 0
    return [Theme.red, Theme.ink, Theme.muted, Theme.crimson, Theme.ink.opacity(0.6), Theme.red.opacity(0.5)][index % 6]
}
func shareText(_ value: Double?) -> String { value.map { String(format: "%.1f%%", $0 * 100) } ?? "—" }

struct StoreIcon: View {
    let info: AppStoreSnapshot?
    var size: CGFloat = 36
    var body: some View {
        AsyncImage(url: info?.iconURL.flatMap(URL.init(string:))) { phase in
            if let image = phase.image { image.resizable().scaledToFit() }
            else { Image(systemName: "app.dashed").font(.system(size: size * 0.48)).frame(maxWidth: .infinity, maxHeight: .infinity).foregroundStyle(Theme.muted) }
        }.frame(width: size, height: size).background(Theme.muted.opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: size * 0.23)).accessibilityHidden(true)
    }
}

struct CompetitionOverview: View {
    let project: Project
    let open: () -> Void
    var actionLabel = "Vergleichen"
    var category: KeywordCategory = .core
    private var snapshot: CompetitionSnapshot { CompetitionSnapshot(project: project, category: category) }
    private var hasComparison: Bool { snapshot.entries.count > 1 }
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Dein Anteil an der Suche").font(Theme.font(16, .semibold))
                    Text("\(category.title) · \(project.country.uppercased()) · \(snapshot.included)/\(snapshot.totalKeywords) aktuell einbezogen").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                    Text("Trefferbasis: Bei \(snapshot.matchedKeywords) von \(snapshot.included) gemessenen Begriffen erscheint mindestens eine dieser Apps.").font(Theme.font(9)).foregroundStyle(Theme.secondary)
                }
                Spacer()
                IconControl(symbol: "arrow.up.right", label: "Konkurrenzvergleich öffnen", size: 28, action: open)
            }
            HStack(spacing: 24) {
                ZStack {
                    Circle().stroke(Theme.muted.opacity(0.15), lineWidth: 18).padding(10)
                    if hasComparison {
                        Chart(snapshot.entries.filter { ($0.share ?? 0) > 0 }) { entry in
                            SectorMark(angle: .value("Sichtbarkeit", entry.score), innerRadius: .ratio(0.79), angularInset: 3)
                                .cornerRadius(4).foregroundStyle(by: .value("App", String(entry.id)))
                                .accessibilityLabel(entry.app.name).accessibilityValue(shareText(entry.share))
                        }.chartForegroundStyleScale(domain: project.comparisonApps.map { String($0.id) }, range: project.comparisonApps.map { appColor($0.id, project: project) }).chartLegend(.hidden)
                    }
                    VStack(spacing: 3) {
                        Text(hasComparison ? shareText(snapshot.entries.first?.share) : "—").font(Theme.font(27, .semibold)).monospacedDigit()
                        Text("Deine App").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                    }
                }.frame(width: 148, height: 148)
                VStack(spacing: 10) {
                    ForEach(Array(snapshot.entries.prefix(snapshot.entries.count > 4 ? 3 : 4))) { entry in
                        HStack(spacing: 8) {
                            Circle().fill(appColor(entry.id, project: project)).frame(width: 6, height: 6)
                            StoreIcon(info: project.storeInfo(for: entry.id), size: 25)
                            Text(entry.app.name).font(Theme.font(11, .medium)).lineLimit(1).help(entry.app.name)
                            Spacer(minLength: 2)
                            Text(hasComparison ? shareText(entry.share) : "—").font(Theme.font(12, .semibold)).monospacedDigit()
                        }
                    }
                    if snapshot.entries.count > 4 { Text("+ \(snapshot.entries.count - 3) weitere Apps im Vergleich").font(Theme.font(9)).foregroundStyle(Theme.secondary) }
                    if !hasComparison { Button("Konkurrenz hinzufügen", action: open).buttonStyle(.plain).foregroundStyle(Theme.crimson) }
                }
            }
            HStack {
                Text("Relativ zu diesen Apps · kein Download-Marktanteil").font(Theme.font(9)).foregroundStyle(Theme.secondary)
                Spacer()
                Button(actionLabel, action: open).font(Theme.font(10, .semibold)).buttonStyle(.plain)
            }
        }.frame(maxHeight: .infinity, alignment: .top).surface(padding: 22)
    }
}

struct CompetitionPage: View {
    @Bindable var model: AppModel
    let project: Project
    let query: String
    let manage: () -> Void
    @State private var profile: RankedApp?
    @State private var category: KeywordCategory = .core
    private var words: [Keyword] { project.activeKeywords.filter { $0.effectiveCategory == category && (query.isEmpty || $0.text.localizedCaseInsensitiveContains(query)) }.sorted { $0.text.localizedStandardCompare($1.text) == .orderedAscending } }
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            KeywordLeaderboardCard(project: project) { profile = $0 }.id(project.id)
            Picker("Vergleichsgruppe", selection: $category) {
                ForEach(KeywordCategory.allCases, id: \.self) { Text($0.title).tag($0) }
            }.pickerStyle(.segmented)
            CompetitionOverview(project: project, open: manage, actionLabel: "Apps verwalten", category: category).frame(height: 278)
            HStack {
                Text("Deine App & Konkurrenz").font(Theme.font(17, .semibold))
                Spacer()
                Button("Apps verwalten", action: manage).buttonStyle(PillStyle(compact: true))
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: min(4, project.comparisonApps.count)), spacing: 14) {
                ForEach(project.comparisonApps) { app in
                    Button { profile = app } label: { appCard(app) }.buttonStyle(.plain).help("Versionen und App-Store-Profil öffnen")
                }
            }
            if let error = project.lastMetadataError { Text("App-Profile: \(error)").font(Theme.font(11)).foregroundStyle(Theme.crimson) }
            DisclosureGroup("Alle Positionen als Tabelle") { matrix.padding(.top, 14) }.font(Theme.font(12, .medium)).padding(.horizontal, 4)
            methodCard
        }.sheet(item: $profile) { app in StoreProfileSheet(app: app, project: project) }
    }
    private func appCard(_ app: RankedApp) -> some View {
        let info = project.storeInfo(for: app.id)
        return VStack(alignment: .leading, spacing: 10) {
            HStack { StoreIcon(info: info, size: 42); Spacer(); Text(app.id == project.appleID ? "DEINE APP" : "KONKURRENZ").font(Theme.font(8, .semibold)).foregroundStyle(appColor(app.id, project: project)) }
            Text(app.name).font(Theme.font(12, .semibold)).lineLimit(1)
            Text("Version \(info?.version ?? "unbekannt")").font(Theme.font(11))
            Text(info?.currentVersionReleaseDate.map { "Update: \($0.formatted(date: .abbreviated, time: .omitted))" } ?? "Update-Datum unbekannt").font(Theme.font(10)).foregroundStyle(Theme.secondary)
            Text(info.map { "Geprüft: \($0.fetchedAt.formatted(date: .abbreviated, time: .shortened))" } ?? "Profil noch nicht abgerufen").font(Theme.font(9)).foregroundStyle(Theme.secondary)
            Text("App-Store-Profil ↗").font(Theme.font(9, .medium))
        }.frame(maxWidth: .infinity, alignment: .leading).surface(padding: 17)
    }
    private var matrix: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Positionen im direkten Vergleich").font(Theme.font(16, .semibold))
            HStack(spacing: 12) {
                Text("KEYWORD").frame(width: 150, alignment: .leading)
                ForEach(project.comparisonApps) { app in Text(app.name).foregroundStyle(appColor(app.id, project: project)).frame(maxWidth: .infinity).lineLimit(2) }
            }.font(Theme.font(10, .semibold))
            ForEach(words) { word in
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(word.text).font(Theme.font(12, .medium))
                            Text(word.effectiveCategory.title).font(Theme.font(8)).foregroundStyle(Theme.secondary)
                            Text(word.latest.map { $0.date.formatted(date: .omitted, time: .shortened) } ?? "Noch offen").font(Theme.font(9)).foregroundStyle(Theme.secondary)
                        }.frame(width: 150, alignment: .leading)
                        ForEach(project.comparisonApps) { app in
                            VStack(spacing: 2) {
                                Text(word.latest?.rank(for: app.id).map { "#\($0)" } ?? "—").font(Theme.font(16, .semibold)).monospacedDigit()
                                Text(word.latest == nil ? "Offen" : word.latest?.rank(for: app.id) == nil ? "Nicht gefunden" : "Gefunden").font(Theme.font(8)).foregroundStyle(Theme.secondary)
                            }.frame(maxWidth: .infinity)
                        }
                    }.padding(11).background(Theme.muted.opacity(0.07), in: RoundedRectangle(cornerRadius: 12)).contentShape(Rectangle())
            }
            if words.isEmpty { Text("Keine passenden Keywords.").foregroundStyle(Theme.secondary) }
            Text("Alle Apps einer Zeile stammen aus derselben Apple-Antwort. — bedeutet keinen Treffer innerhalb der gelieferten Ergebnisse. Den zeitlichen Vergleich findest du unter Verlauf.").font(Theme.font(10)).foregroundStyle(Theme.secondary)
        }.surface()
    }
    private var methodCard: some View {
        let snapshot = CompetitionSnapshot(project: project, category: category)
        return VStack(alignment: .leading, spacing: 10) {
            Text("So entsteht der Sichtbarkeitsanteil").font(Theme.font(14, .semibold))
            Text("Pro Keyword zählt Platz 1 als 1 Punkt, Platz 2 als ½, Platz 10 als ¹⁄₁₀; kein Treffer zählt als 0. Die Punkte einer App werden durch die Summe der ausgewählten Apps geteilt. Innerhalb der ausgewählten Gruppe zählen Keywords gleich viel. Markenbegriffe und Spezialthemen sind vom Hauptvergleich getrennt.").font(Theme.font(11)).fixedSize(horizontal: false, vertical: true)
            Text("Das ist ein Vergleichsmodell, keine Schätzung tatsächlicher Nutzer oder Downloads. Die Keyword-Auswahl beeinflusst den Anteil stark – insbesondere eigene Markenbegriffe. Andere Apps ausserhalb dieser Auswahl sind nicht Teil der 100 %. Fehlende, fehlgeschlagene oder über 24 h alte Messungen zählen nicht. Ein geänderter Keyword-Korb ist kein Wachstum; Suchvolumen ist unbekannt.").font(Theme.font(10)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            Text("Datenbasis: \(snapshot.included)/\(snapshot.totalKeywords) aktuell einbezogen · \(snapshot.failedKeywords) Abruffehler · \(snapshot.staleKeywords) Messungen älter als 24 h").font(Theme.font(10, .medium))
            if let oldest = snapshot.oldest, let newest = snapshot.newest {
                Text("Letzte erfolgreiche Abrufe: \(oldest.formatted(date: .abbreviated, time: .shortened)) bis \(newest.formatted(date: .abbreviated, time: .shortened)).").font(Theme.font(10)).foregroundStyle(Theme.secondary)
            }
        }.surface()
    }
}

struct CompetitorManager: View {
    @Bindable var model: AppModel
    @Environment(\.dismiss) private var dismiss
    @State private var input = ""
    @State private var busy = false
    @State private var error: String?
    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack { Text("Deine Konkurrenz").font(Theme.font(24, .semibold)); Spacer(); IconControl(symbol: "xmark", label: "Verwaltung schliessen") { dismiss() } }
            Text("Alle Apps werden mit denselben Keywords im selben Store verglichen. Ihre Positionen sind auch in vorhandenen Trefferlisten enthalten.").font(Theme.font(11)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            if let project = model.project {
                ForEach(project.comparisonApps) { app in
                    HStack(spacing: 10) {
                        StoreIcon(info: project.storeInfo(for: app.id), size: 32)
                        Text(app.name).font(Theme.font(12, .medium)); Spacer()
                        if app.id == project.appleID { Text("Deine App").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                        else { Button("Aus Vergleich nehmen") { model.removeCompetitor(app.id) }.buttonStyle(.plain).font(Theme.font(10)).foregroundStyle(Theme.crimson).disabled(busy) }
                    }
                }
            }
            TextField("App-Store-Link oder App-ID", text: $input).textFieldStyle(.plain).padding(12).background(Theme.muted.opacity(0.12), in: RoundedRectangle(cornerRadius: 10)).disabled(busy)
            if let error { Text(error).font(Theme.font(11)).foregroundStyle(Theme.crimson).fixedSize(horizontal: false, vertical: true) }
            HStack { Text("Bis zu fünf Konkurrenten. Messdaten bleiben erhalten.").font(Theme.font(10)).foregroundStyle(Theme.secondary); Spacer(); Button(busy ? "Prüft …" : "Hinzufügen") {
                busy = true
                Task { do { try await model.addCompetitor(input: input); input = ""; error = nil } catch { self.error = error.localizedDescription }; busy = false }
            }.buttonStyle(PillStyle(dark: true)).disabled(busy || input.isEmpty) }
        }.padding(26).frame(width: 590).background(Theme.paper).foregroundStyle(Theme.ink).preferredColorScheme(.light)
    }
}

struct StoreProfileSheet: View {
    let app: RankedApp
    let project: Project
    @Environment(\.dismiss) private var dismiss
    private var info: AppStoreSnapshot? { project.storeInfo(for: app.id) }
    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 13) {
                StoreIcon(info: info, size: 52)
                VStack(alignment: .leading, spacing: 4) { Text(app.name).font(Theme.font(22, .semibold)); Text("\(project.country.uppercased()) · App-Store-Profil").font(Theme.font(11)).foregroundStyle(Theme.secondary) }
                Spacer(); IconControl(symbol: "xmark", label: "App-Profil schliessen") { dismiss() }
            }.padding(24)
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Link("Im App Store ansehen ↗", destination: URL(string: "https://apps.apple.com/\(project.country)/app/id\(app.id)")!).foregroundStyle(Theme.crimson)
                    if let info {
                        Text("Version \(info.version ?? "unbekannt") · Update \(info.currentVersionReleaseDate?.formatted(date: .abbreviated, time: .omitted) ?? "unbekannt")").font(Theme.font(13, .semibold))
                        Text("Profil abgerufen: \(info.fetchedAt.formatted(date: .abbreviated, time: .shortened))\n\(info.sellerName ?? "Entwickler unbekannt") · \(info.ratingCount.map(String.init) ?? "—") Bewertungen").font(Theme.font(11)).foregroundStyle(Theme.secondary)
                        Text("Versionshinweise").font(Theme.font(15, .semibold)); Text(info.releaseNotes ?? "Keine Versionshinweise geliefert.").font(Theme.font(12)).textSelection(.enabled)
                        Text("Beschreibung").font(Theme.font(15, .semibold)); Text(info.description ?? "Keine Beschreibung geliefert.").font(Theme.font(12)).textSelection(.enabled)
                        Text("Beobachtete Versionen").font(Theme.font(15, .semibold))
                        ForEach(observedVersions, id: \.self) { value in Text(value).font(Theme.font(11)).foregroundStyle(Theme.secondary) }
                    } else { Text("Noch keine App-Store-Daten. Mit Aktualisieren werden die Profile abgerufen.") }
                    Text("Ein älteres Update ist kein Beweis, dass eine App nicht mehr gepflegt wird. Frühere Releases vor Beginn der Beobachtung sind nicht vollständig verfügbar.").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                }.frame(maxWidth: .infinity, alignment: .leading).padding(24)
            }
        }.frame(width: 660, height: 680).background(Theme.paper).foregroundStyle(Theme.ink).preferredColorScheme(.light)
    }
    private var observedVersions: [String] {
        var seen = Set<String>()
        return (project.storeSnapshots ?? []).reversed().filter { $0.appleID == app.id }.compactMap { snapshot in
            let value = "\(snapshot.version ?? "unbekannt") · veröffentlicht \(snapshot.currentVersionReleaseDate?.formatted(date: .abbreviated, time: .omitted) ?? "unbekannt")"
            return seen.insert(value).inserted ? value : nil
        }
    }
}
