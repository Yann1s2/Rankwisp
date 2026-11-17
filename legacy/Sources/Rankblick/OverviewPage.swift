import SwiftUI
import RankblickCore

struct OverviewPage: View {
    let project: Project
    let openHistory: (UUID?) -> Void
    let openKeywords: () -> Void
    private var words: [Keyword] { project.activeKeywords }
    private var measured: [Keyword] { words.filter { $0.latest != nil } }
    private var ranks: [Int] { words.compactMap { $0.latest?.rank } }
    private var focus: Keyword? { words.first { $0.text == "intranet" } ?? words.first }
    private var changed: [Keyword] { words.filter { $0.previous != nil && $0.latest?.rank != $0.previous?.rank }.sorted { ($0.latest?.date ?? .distantPast) > ($1.latest?.date ?? .distantPast) } }
    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 16) {
                metric("Beobachtete Keywords", value: String(words.count), note: "\(measured.count) mit Messung", icon: "number")
                metric("In den Top 10", value: String(ranks.filter { $0 <= 10 }.count), note: "Unter den ersten zehn Treffern", icon: "scope")
                metric("Zuletzt verändert", value: String(changed.count), note: "Gegenüber dem jeweiligen Vorabruf", icon: "arrow.up.arrow.down")
            }
            HStack(alignment: .top, spacing: 20) {
                VStack(alignment: .leading, spacing: 16) {
                    HStack { Text("DEIN FOKUS").font(Theme.font(10, .semibold)); Spacer(); Image(systemName: "scope").foregroundStyle(Theme.red) }
                    Text(focus?.text ?? "Dein erstes Keyword").font(Theme.font(28, .semibold))
                    HStack(alignment: .firstTextBaseline, spacing: 12) {
                        Text(focus?.latest?.rank.map { "#\($0)" } ?? "—").font(Theme.font(54, .semibold))
                        Text("Ziel #1").font(Theme.font(18)).foregroundStyle(Theme.paper.opacity(0.6))
                    }
                    Text(focus?.latest.map { "Stand: \($0.date.formatted(date: .abbreviated, time: .shortened))" } ?? "Noch keine Messung").font(Theme.font(10)).foregroundStyle(Theme.paper.opacity(0.7))
                    Spacer(minLength: 8)
                    Button { openHistory(focus?.id) } label: { HStack { Text("Entwicklung ansehen"); Spacer(); Image(systemName: "arrow.up.right") }.font(Theme.font(12, .medium)) }.buttonStyle(.plain)
                }.foregroundStyle(Theme.paper).frame(maxWidth: .infinity, minHeight: 238).surface(dark: true)
                VStack(alignment: .leading, spacing: 18) {
                    Text("Wo du sichtbar bist").font(Theme.font(16, .semibold))
                    distribution("Platz 1–10", count: ranks.filter { $0 <= 10 }.count, color: Theme.red)
                    distribution("Platz 11–50", count: ranks.filter { (11...50).contains($0) }.count, color: Theme.ink)
                    distribution("Platz 51+", count: ranks.filter { $0 > 50 }.count, color: Theme.muted)
                    distribution("Nicht gefunden", count: measured.count - ranks.count, color: Theme.crimson.opacity(0.6))
                    Text("\(words.count - measured.count) noch offen · Positionen innerhalb der gelieferten API-Treffer.").font(Theme.font(10)).foregroundStyle(Theme.secondary)
                }.frame(maxWidth: .infinity, minHeight: 238).surface()
            }
            VStack(alignment: .leading, spacing: 16) {
                HStack { Text("Was sich zuletzt bewegt hat").font(Theme.font(16, .semibold)); Spacer(); Button("Keywords verwalten", action: openKeywords).buttonStyle(.plain).font(Theme.font(11)).foregroundStyle(Theme.crimson) }
                if changed.isEmpty {
                    HStack(spacing: 15) {
                        Image(systemName: "equal.circle").font(.system(size: 30)).foregroundStyle(Theme.muted)
                        VStack(alignment: .leading, spacing: 5) {
                            Text(measured.contains { $0.previous != nil } ? "Die Positionen sind bislang stabil." : "Deine Vergleichsbasis entsteht gerade.").font(Theme.font(14, .medium))
                            Text("Hier erscheinen Verbesserungen, Rückgänge sowie neu gefundene oder verlorene Treffer – sobald sie gemessen wurden.").font(Theme.font(11)).foregroundStyle(Theme.secondary).fixedSize(horizontal: false, vertical: true)
                        }
                    }.padding(.vertical, 16)
                } else {
                    ForEach(changed.prefix(6)) { keyword in
                        Button { openHistory(keyword.id) } label: {
                            HStack { Text(keyword.text).font(Theme.font(12, .medium)); Spacer(); Text(keyword.movement).font(Theme.font(12, .semibold)); Image(systemName: "arrow.up.right") }.padding(12).background(Theme.muted.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                        }.buttonStyle(.plain)
                    }
                }
                let failed = words.filter { $0.lastError != nil }.count
                let stale = measured.filter { Date().timeIntervalSince($0.latest!.date) > 86400 }.count
                Text("Datenqualität: \(failed) Abruffehler · \(stale) Messungen älter als 24 h. Die genaue iPhone-Suche kann abweichen.").font(Theme.font(10)).foregroundStyle(failed > 0 || stale > 0 ? Theme.crimson : Theme.secondary)
            }.surface()
        }
    }
    private func metric(_ title: String, value: String, note: String, icon: String) -> some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack { Text(title).font(Theme.font(11, .medium)); Spacer(); Image(systemName: icon).foregroundStyle(Theme.crimson) }
            Text(value).font(Theme.font(30, .semibold)).monospacedDigit()
            Text(note).font(Theme.font(9)).foregroundStyle(Theme.secondary)
        }.surface(padding: 18)
    }
    private func distribution(_ title: String, count: Int, color: Color) -> some View {
        VStack(spacing: 6) {
            HStack { Text(title); Spacer(); Text(String(count)).fontWeight(.semibold) }.font(Theme.font(11))
            GeometryReader { geometry in
                Capsule().fill(Theme.muted.opacity(0.12))
                Capsule().fill(color).frame(width: geometry.size.width * Double(count) / Double(max(words.count, 1)))
            }.frame(height: 5)
        }
    }
}
