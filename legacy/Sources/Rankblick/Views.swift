import SwiftUI
import Combine
import RankblickCore

private enum Destination { case overview, keywords, history, competition, analytics }

struct MainView: View {
    @Bindable var model: AppModel
    @State private var destination: Destination = .overview
    @State private var managingCompetitors = false
    @State private var addingApp = false
    @State private var addingKeywords = false
    @State private var query = ""
    @State private var sortByRank = false
    @State private var detailPresented = false
    @State private var showArchived = false
    @Environment(\.scenePhase) private var scenePhase
    private let timer = Timer.publish(every: 30, on: .main, in: .common).autoconnect()

    private var visibleKeywords: [Keyword] {
        (model.project?.keywords ?? []).filter {
            $0.archived == showArchived && (query.isEmpty || $0.text.localizedCaseInsensitiveContains(query))
        }.sorted { a, b in
            if sortByRank, a.latest?.rank != b.latest?.rank { return (a.latest?.rank ?? Int.max) < (b.latest?.rank ?? Int.max) }
            return a.text.localizedStandardCompare(b.text) == .orderedAscending
        }
    }
    var body: some View {
        HStack(alignment: .top, spacing: 24) {
            navigationRail
            VStack(spacing: 18) {
                header
                GeometryReader { geometry in
                    ScrollView { content(width: geometry.size.width).padding(.bottom, 4) }.scrollIndicators(.hidden)
                }
                footer
            }
        }
        .padding(.horizontal, 28).padding(.top, 24).padding(.bottom, 20)
        .background(Theme.ink.opacity(0.035).background(Theme.paper))
        .foregroundStyle(Theme.ink).font(Theme.font(12)).tint(Theme.crimson).preferredColorScheme(.light)
        .sheet(isPresented: $managingCompetitors) { CompetitorManager(model: model) }
        .sheet(isPresented: $addingApp) { AddAppView(model: model) }
        .sheet(isPresented: $addingKeywords) { AddKeywordsView(model: model) }
        .sheet(isPresented: $detailPresented) {
            if let keyword = model.keyword, let project = model.project { KeywordSheet(model: model, keyword: keyword, project: project) }
        }
        .alert("Rankblick", isPresented: Binding(get: { model.error != nil }, set: { if !$0 { model.error = nil } })) {
            Button("OK", role: .cancel) { model.error = nil }
        } message: { Text(model.error ?? "") }
        .onReceive(timer) { _ in model.poll() }
        .onChange(of: scenePhase) { if scenePhase == .active { model.poll() } }
    }
    private var navigationRail: some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(spacing: 9) {
                Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 23, weight: .bold)).foregroundStyle(Theme.crimson)
                Text("Rankblick").font(Theme.font(17, .bold))
            }.padding(.top, 14).padding(.bottom, 16)
            VStack(spacing: 7) {
                navigationItem("Übersicht", symbol: "square.grid.2x2", target: .overview, detail: "Stand & letzte Bewegungen")
                navigationItem("Keywords", symbol: "list.bullet.rectangle", target: .keywords, detail: "Begriffe & Abfragen verwalten")
                navigationItem("Verlauf", symbol: "chart.xyaxis.line", target: .history, detail: "Zeitreihen & Messprotokoll")
                navigationItem("Analytics", symbol: "chart.bar", target: .analytics, detail: "App Store Connect Berichte")
                navigationItem("Konkurrenz", symbol: "person.2", target: .competition, detail: "App-Profile & direkter Vergleich")
            }.padding(8).background(Theme.paper, in: RoundedRectangle(cornerRadius: 24))
            Spacer(minLength: 20)
            VStack(alignment: .leading, spacing: 16) {
                Menu {
                    Button("Aktuellen Analyse-Export öffnen") { model.openAnalysisExport() }
                    Button("Vollständiges Backup speichern …") { model.export() }
                } label: { Label("Daten & Export", systemImage: "square.and.arrow.up").font(Theme.font(11)).frame(maxWidth: .infinity, alignment: .leading) }
                    .menuStyle(.borderlessButton).menuIndicator(.hidden)
                SettingsLink { Label("Einstellungen", systemImage: "slider.horizontal.3").font(Theme.font(11)).frame(maxWidth: .infinity, alignment: .leading) }.buttonStyle(.plain)
                HStack(spacing: 8) {
                    Text("L").font(Theme.font(10, .semibold)).foregroundStyle(Theme.paper).frame(width: 28, height: 28).background(Theme.ink, in: Circle())
                    Text("Lokaler Workspace\nAuf diesem Mac").font(Theme.font(9)).foregroundStyle(Theme.secondary)
                }.padding(.top, 8)
            }.padding(.horizontal, 10).padding(.bottom, 4)
        }.frame(width: 148)
    }
    private func navigationItem(_ title: String, symbol: String, target: Destination, detail: String) -> some View {
        Button { destination = target; query = "" } label: {
            HStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 16)).frame(width: 20).foregroundStyle(destination == target ? Theme.red : Theme.secondary)
                Text(title).font(Theme.font(12, .medium))
                Spacer(minLength: 0)
            }.padding(.horizontal, 12).frame(height: 45)
                .foregroundStyle(destination == target ? Theme.paper : Theme.ink)
                .background(destination == target ? Theme.ink : Theme.paper, in: RoundedRectangle(cornerRadius: 15))
                .contentShape(RoundedRectangle(cornerRadius: 15))
        }.buttonStyle(.plain).help(detail).accessibilityLabel(title).accessibilityAddTraits(destination == target ? .isSelected : [])
    }
    private var header: some View {
        HStack(alignment: .center, spacing: 18) {
            VStack(alignment: .leading, spacing: 5) {
                Text(destination == .analytics ? "Apple Analytics" : destination == .overview ? "Dein Überblick" : destination == .competition ? "Deine Konkurrenz" : destination == .history ? "Deine Entwicklung" : "Deine Keywords")
                    .font(Theme.font(26, .semibold))
                HStack(spacing: 7) {
                    if let project = model.project { StoreIcon(info: project.storeInfo(for: project.appleID), size: 22) }
                    Text("Deine App im Blick.").foregroundStyle(Theme.secondary)
                    Menu {
                        ForEach(model.workspace.projects.filter { !$0.archived }) { project in
                            Button("\(project.name) · \(project.country.uppercased())") { model.selectProject(project.id) }
                        }
                        Divider()
                        Button("App hinzufügen …") { addingApp = true }
                    } label: {
                        HStack(spacing: 5) {
                            Text(model.project.map { "\($0.name) · \($0.country.uppercased())" } ?? "App auswählen").lineLimit(1)
                            Image(systemName: "chevron.down").font(.system(size: 8))
                        }.foregroundStyle(Theme.ink)
                    }.menuStyle(.borderlessButton).menuIndicator(.hidden).fixedSize()
                }.font(Theme.font(11))
            }
            Spacer(minLength: 0)
            if destination == .keywords || destination == .competition { HStack(spacing: 8) {
                Image(systemName: "magnifyingglass").font(.system(size: 12))
                TextField("Keyword suchen", text: $query).textFieldStyle(.plain).font(Theme.font(11))
                if !query.isEmpty { Button { query = "" } label: { Image(systemName: "xmark.circle.fill") }.buttonStyle(.plain).accessibilityLabel("Suche löschen") }
            }.padding(.horizontal, 16).frame(width: 150, height: 40).background(Theme.paper, in: Capsule()) }
            Button { Task { await model.refresh() } } label: {
                HStack(spacing: 8) {
                    if model.isRefreshing { ProgressView().controlSize(.mini).tint(Theme.paper) }
                    else { Image(systemName: "arrow.clockwise").font(.system(size: 11)) }
                    Text(model.isRefreshing ? "Aktualisiert …" : "Aktualisieren")
                }
            }.buttonStyle(PillStyle(dark: true)).disabled(model.isRefreshing || model.project == nil)
                .keyboardShortcut("r", modifiers: .command).help("Keywords & App-Profile aktualisieren · ⌘R")
        }.frame(minHeight: 68)
    }
    @ViewBuilder private func content(width: CGFloat) -> some View {
        if let project = model.project {
            switch destination {
            case .analytics:
                ConnectAnalyticsPage(appID: project.appleID).id(project.appleID)
            case .overview:
                OverviewPage(project: project, openHistory: { id in
                    if let id { model.selectedKeyword = id }
                    destination = .history
                }, openKeywords: { destination = .keywords })
            case .keywords:
                keywordCard(compact: false).frame(minHeight: 565)
            case .history:
                HistoryPage(model: model, project: project)
            case .competition:
                CompetitionPage(model: model, project: project, query: query) { managingCompetitors = true }
            }
        } else {
            VStack(spacing: 20) {
                Image(systemName: "app.badge").font(.system(size: 44)).foregroundStyle(Theme.red)
                Text("Deine nächste Entdeckung beginnt hier.").font(Theme.font(23, .semibold))
                Text("Füge eine App hinzu und beobachte ihre Keywords.").foregroundStyle(Theme.secondary)
                Button("App hinzufügen") { addingApp = true }.buttonStyle(PillStyle(dark: true))
            }.frame(maxWidth: .infinity).frame(height: 500).surface()
        }
    }
    private func keywordCard(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(showArchived ? "Archivierte Keywords" : "Begriffe verwalten").font(Theme.font(15, .semibold))
                Spacer()
                Picker("Keyword-Status", selection: $showArchived) { Text("Aktiv").tag(false); Text("Archiv").tag(true) }.labelsHidden().pickerStyle(.segmented).frame(width: 140)
                Menu { Toggle("Nach Position sortieren", isOn: $sortByRank) } label: { Image(systemName: "arrow.up.arrow.down").font(.system(size: 11)) }
                    .menuStyle(.borderlessButton).menuIndicator(.hidden).frame(width: 22).help("Sortierung")
                Button { addingKeywords = true } label: {
                    HStack(spacing: 8) {
                        Text("Hinzufügen").font(Theme.font(11))
                        Image(systemName: "plus").font(.system(size: 10, weight: .semibold)).foregroundStyle(Theme.red).frame(width: 22, height: 22).background(Theme.ink, in: Circle())
                    }
                }.buttonStyle(.plain).accessibilityLabel("Keywords hinzufügen")
            }
            ScrollView {
                LazyVStack(spacing: compact ? 4 : 8) {
                    ForEach(visibleKeywords) { keyword in
                        KeywordItem(keyword: keyword, selected: model.selectedKeyword == keyword.id, compact: compact,
                                    select: { model.selectedKeyword = keyword.id; detailPresented = true },
                                    details: { model.selectedKeyword = keyword.id; detailPresented = true },
                                    refresh: { Task { await model.refresh(onlyKeyword: keyword.id) } },
                                    archive: { model.archiveKeyword(keyword.id, archived: !keyword.archived) },
                                    refreshing: model.isRefreshing)
                    }
                    if visibleKeywords.isEmpty {
                        VStack(spacing: 10) {
                            Image(systemName: showArchived ? "archivebox" : "magnifyingglass").font(.system(size: 23)).foregroundStyle(Theme.muted)
                            Text(showArchived ? "Dein Archiv ist leer." : "Keine passenden Keywords.").font(Theme.font(12)).foregroundStyle(Theme.secondary)
                        }.frame(maxWidth: .infinity).padding(.vertical, 45)
                    }
                }
            }.scrollIndicators(.hidden)
            if !compact { Text("Begriff auswählen für Suchergebnisse und Abfragedetails. Archivierte Keywords behalten ihren Verlauf.").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
        }.surface(padding: 20)
    }
    private var footer: some View {
        HStack(spacing: 8) {
            Circle().fill(model.workspace.automaticUpdates && model.agentInstalled ? Theme.red : Theme.muted).frame(width: 5, height: 5)
            Text(model.isRefreshing ? model.activity : model.workspace.automaticUpdates ? "Automatisch jeden Tag" : "Automatik pausiert")
            if model.isRefreshing { ProgressView(value: model.progress).frame(width: 85).tint(Theme.red) }
            Spacer()
            Text(model.nextDue.map { "Nächster Abruf: \($0.formatted(date: .abbreviated, time: .shortened))" } ?? "Bereit für die erste Messung")
        }.font(Theme.font(10)).foregroundStyle(Theme.secondary).frame(height: 17)
    }
}

