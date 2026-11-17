import SwiftUI
import Charts
import RankblickCore

private struct HistorySeries: Identifiable {
    let app: RankedApp
    let points: [TimelinePoint]
    var id: Int { app.id }
}
struct HistoryPage: View {
    @Bindable var model: AppModel
    let project: Project
    @State private var days = 30
    @State private var compare = false
    @State private var smooth = true
    @State private var selectedDate: Date?
    @State private var calendarPresented = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    private var keyword: Keyword? { project.keywords.first { $0.id == model.selectedKeyword } ?? project.activeKeywords.first }
    private var samples: [Sample] { RankingTimeline.samples(keyword?.samples ?? [], since: days == 0 ? nil : Date().addingTimeInterval(-Double(days) * 86400)) }
    private var apps: [RankedApp] { compare ? project.comparisonApps : Array(project.comparisonApps.prefix(1)) }
    private var series: [HistorySeries] { apps.map { HistorySeries(app: $0, points: RankingTimeline.points(samples, appleID: $0.id)) } }
    private var maxRank: Int { max(10, (series.flatMap(\.points).map(\.rank).max() ?? 10) + 4) }
    private var nearest: Sample? {
        guard let selectedDate else { return samples.last }
        return samples.min { abs($0.date.timeIntervalSince(selectedDate)) < abs($1.date.timeIntervalSince(selectedDate)) }
    }
    private var domain: ClosedRange<Date> {
        let first = samples.first?.date ?? Date(); let last = samples.last?.date ?? first
        let padding = max(180, last.timeIntervalSince(first) * 0.04)
        return first.addingTimeInterval(-padding)...last.addingTimeInterval(padding)
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Picker("Keyword", selection: Binding(get: { keyword?.id }, set: { model.selectedKeyword = $0; selectedDate = nil })) {
                    ForEach(project.keywords) { word in Text(word.text + (word.archived ? " · Archiv" : "")).tag(Optional(word.id)) }
                }.frame(width: 220)
                Picker("Ansicht", selection: $compare) { Text("Deine App").tag(false); Text("Mit Konkurrenz").tag(true) }.labelsHidden().pickerStyle(.segmented).frame(width: 230)
                Spacer()
                Button { calendarPresented = true } label: { Label("Messtage", systemImage: "calendar") }.buttonStyle(PillStyle(compact: true))
                    .popover(isPresented: $calendarPresented) { MeasurementCalendar(project: project, nextDue: model.nextDue).frame(width: 360, height: 300).padding(12).background(Theme.ink) }
            }
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(keyword?.text ?? "Noch kein Keyword").font(Theme.font(24, .semibold))
                        Text("Deine Entwicklung über Zeit").font(Theme.font(11)).foregroundStyle(Theme.secondary)
                    }
                    Spacer()
                    Picker("Zeitraum", selection: $days) { Text("7 T").tag(7); Text("30 T").tag(30); Text("90 T").tag(90); Text("1 J").tag(365); Text("Alle").tag(0) }
                        .labelsHidden().pickerStyle(.segmented).frame(width: 250)
                }
                HStack(spacing: 16) {
                    ForEach(apps) { app in HStack(spacing: 5) { Circle().fill(appColor(app.id, project: project)).frame(width: 6, height: 6); Text(app.name).font(Theme.font(10)).lineLimit(1) } }
                }
                chart.frame(height: 270)
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 5) {
                        Text(nearest.map { $0.date.formatted(date: .abbreviated, time: .shortened) } ?? "Noch keine Messung in diesem Zeitraum").font(Theme.font(10, .semibold))
                        Text(apps.map { app in "\(app.name): \(nearest?.rank(for: app.id).map { "#\($0)" } ?? "—")" }.joined(separator: "   ·   ")).font(Theme.font(10)).foregroundStyle(Theme.secondary)
                    }
                    Spacer()
                    Toggle("Weiche Kurve", isOn: $smooth).toggleStyle(.checkbox).font(Theme.font(10))
                }.frame(minHeight: 35)
                Text("Punkte sind echte Messungen. Die weiche Verbindung ist eine Darstellung, keine zusätzliche Messung. Fehlende Treffer und Pausen über 36 Stunden bleiben als Lücken sichtbar.").font(Theme.font(9)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
            }.surface()
            HStack(spacing: 16) {
                statistic("Zu Beginn", value: samples.first?.rank(for: project.appleID).map { "#\($0)" } ?? "—")
                statistic("Beste Position", value: samples.compactMap { $0.rank(for: project.appleID) }.min().map { "#\($0)" } ?? "—")
                statistic("Veränderung", value: change)
                statistic("Messungen", value: String(samples.count))
            }
            VStack(alignment: .leading, spacing: 14) {
                HStack { Text("Messprotokoll").font(Theme.font(16, .semibold)); Spacer(); Text("Die letzten 12 im gewählten Zeitraum").font(Theme.font(10)).foregroundStyle(Theme.secondary) }
                if samples.isEmpty { Text("Noch keine Messpunkte. Mit dem nächsten Abruf beginnt dein Verlauf.").font(Theme.font(12)).foregroundStyle(Theme.secondary) }
                ForEach(samples.suffix(12).reversed()) { sample in
                    HStack {
                        Text(sample.date.formatted(date: .abbreviated, time: .shortened)).frame(maxWidth: .infinity, alignment: .leading)
                        Text("\(sample.resultCount) Ergebnisse").foregroundStyle(Theme.secondary)
                        Text(sample.rank(for: project.appleID).map { "#\($0)" } ?? "Nicht gefunden").fontWeight(.semibold).frame(width: 100, alignment: .trailing)
                    }.font(Theme.font(11)).padding(.vertical, 5)
                }
                Text("Der vollständige Verlauf bleibt im automatischen Analyse-Export erhalten.").font(Theme.font(10)).foregroundStyle(Theme.secondary)
            }.surface()
        }
        .onChange(of: days) { selectedDate = nil }
        .onChange(of: project.id) { selectedDate = nil }
    }
    private var change: String {
        guard samples.count > 1, let first = samples.first?.rank(for: project.appleID), let last = samples.last?.rank(for: project.appleID) else { return "—" }
        let value = first - last
        return value > 0 ? "↑ \(value)" : value < 0 ? "↓ \(-value)" : "±0"
    }
    private func statistic(_ title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 7) { Text(title).font(Theme.font(10)).foregroundStyle(Theme.secondary); Text(value).font(Theme.font(24, .semibold)).monospacedDigit() }.surface(padding: 17)
    }
    @ViewBuilder private var chart: some View {
        if series.flatMap(\.points).isEmpty {
            VStack(spacing: 12) { Image(systemName: "chart.xyaxis.line").font(.system(size: 32)); Text("Keine gefundene Position im gewählten Zeitraum").font(Theme.font(12)) }.foregroundStyle(Theme.muted).frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            Chart {
                ForEach(series) { line in
                    ForEach(line.points) { point in
                        if !compare {
                            AreaMark(x: .value("Zeit", point.date), yStart: .value("Basis", -maxRank), yEnd: .value("Position", -point.rank), series: .value("Abschnitt", point.segment))
                                .interpolationMethod(smooth ? .monotone : .linear)
                                .foregroundStyle(LinearGradient(colors: [Theme.red.opacity(0.14), Theme.red.opacity(0.015)], startPoint: .top, endPoint: .bottom))
                        }
                        LineMark(x: .value("Zeit", point.date), y: .value("Position", -point.rank), series: .value("Abschnitt", "\(line.id)-\(point.segment)"))
                            .interpolationMethod(smooth ? .monotone : .linear)
                            .foregroundStyle(by: .value("App", String(line.id)))
                            .lineStyle(StrokeStyle(lineWidth: line.id == project.appleID ? 2.8 : 1.8, lineCap: .round, lineJoin: .round, dash: line.id == project.appleID ? [] : [4, 3]))
                        PointMark(x: .value("Zeit", point.date), y: .value("Position", -point.rank))
                            .foregroundStyle(by: .value("App", String(line.id))).symbolSize(samples.count > 90 ? 8 : 25)
                            .accessibilityLabel("\(line.app.name), \(point.date.formatted(date: .abbreviated, time: .shortened))").accessibilityValue("Position \(point.rank)")
                    }
                }
                if let selectedDate { RuleMark(x: .value("Auswahl", selectedDate)).foregroundStyle(Theme.muted.opacity(0.5)).lineStyle(StrokeStyle(dash: [3, 3])) }
            }
            .chartForegroundStyleScale(domain: apps.map { String($0.id) }, range: apps.map { appColor($0.id, project: project) })
            .chartLegend(.hidden).chartXScale(domain: domain).chartYScale(domain: -maxRank...0)
            .chartYAxis { AxisMarks(position: .leading) { value in
                AxisGridLine().foregroundStyle(Theme.muted.opacity(0.14))
                AxisValueLabel { if let value = value.as(Int.self), value < 0 { Text("\(-value)").font(Theme.font(9)).foregroundStyle(Theme.secondary) } }
            } }
            .chartXAxis { AxisMarks(values: .automatic(desiredCount: 5)) { _ in AxisValueLabel().font(Theme.font(9)).foregroundStyle(Theme.secondary) } }
            .chartXSelection(value: $selectedDate)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: smooth)
            .animation(reduceMotion ? nil : .easeInOut(duration: 0.35), value: samples.last?.id)
        }
    }
}
