import SwiftUI
import RankblickCore

private struct WeekdayLabel: Identifiable {
    let id: String; let label: String
    static let all = [Self(id: "mo", label: "M"), Self(id: "di", label: "D"), Self(id: "mi", label: "M"), Self(id: "do", label: "D"), Self(id: "fr", label: "F"), Self(id: "sa", label: "S"), Self(id: "so", label: "S")]
}

struct MeasurementCalendar: View {
    let project: Project
    let nextDue: Date?
    @State private var monthOffset = 0
    @State private var selectedDay: Int?
    private var calendar: Calendar { var c = Calendar(identifier: .gregorian); c.locale = Locale(identifier: "de_CH"); c.firstWeekday = 2; return c }
    private var month: Date { calendar.date(byAdding: .month, value: monthOffset, to: Date())! }
    private var start: Date { calendar.date(from: calendar.dateComponents([.year, .month], from: month))! }
    private var leading: Int { (calendar.component(.weekday, from: start) + 5) % 7 }
    private var totalDays: Int { calendar.range(of: .day, in: .month, for: start)!.count }
    private var samples: [Sample] { project.keywords.flatMap(\.samples) }
    private var measured: Set<Int> { Set(samples.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) }.map { calendar.component(.day, from: $0.date) }) }
    private var title: String { let f = DateFormatter(); f.locale = Locale(identifier: "de_CH"); f.dateFormat = "MMMM yyyy"; return f.string(from: month) }
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Deine Messtage").font(Theme.font(14, .medium))
                Spacer(minLength: 8)
                Button { monthOffset -= 1; selectedDay = nil } label: { Image(systemName: "chevron.left").frame(width: 14, height: 20) }.accessibilityLabel("Vorheriger Monat")
                Text(title).font(Theme.font(9)).foregroundStyle(Theme.paper.opacity(0.75)).fixedSize()
                Button { monthOffset += 1; selectedDay = nil } label: { Image(systemName: "chevron.right").frame(width: 14, height: 20) }.accessibilityLabel("Nächster Monat")
            }.buttonStyle(.plain).font(.system(size: 8))
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 3), count: 7), spacing: 2) {
                ForEach(WeekdayLabel.all) { label in Text(label.label).font(Theme.font(9)).foregroundStyle(Theme.paper.opacity(0.65)).frame(height: 14) }
                ForEach(0..<(leading + totalDays), id: \.self) { cell in
                    if cell < leading { Color.clear.frame(height: 23) }
                    else { day(cell - leading + 1) }
                }
            }
            Spacer(minLength: 0)
            if let selectedDay {
                let amount = samples.filter { calendar.isDate($0.date, equalTo: month, toGranularity: .month) && calendar.component(.day, from: $0.date) == selectedDay }.count
                Text("\(selectedDay). \(title): \(amount) Keyword-Messungen").font(Theme.font(9)).foregroundStyle(Theme.paper.opacity(0.8))
            } else {
                HStack(spacing: 13) {
                    legend("Heute", color: Theme.paper, outlined: true)
                    legend("Gemessen", color: Theme.red)
                    legend("Geplant", color: Theme.muted)
                }
            }
        }.foregroundStyle(Theme.paper).surface(dark: true, padding: 22)
    }
    private func day(_ number: Int) -> some View {
        let date = calendar.date(byAdding: .day, value: number - 1, to: start)!
        let today = calendar.isDateInToday(date)
        let planned = nextDue.map { calendar.isDate($0, inSameDayAs: date) } ?? false
        return Button { selectedDay = selectedDay == number ? nil : number } label: {
            Text(String(number)).font(Theme.font(10, measured.contains(number) ? .semibold : .regular))
                .frame(width: 23, height: 23)
                .background(measured.contains(number) ? Theme.red : planned ? Theme.muted.opacity(0.35) : Theme.ink, in: Circle())
                .overlay(Circle().strokeBorder(today || selectedDay == number ? Theme.paper.opacity(0.7) : Theme.paper.opacity(0), lineWidth: 1))
                .frame(maxWidth: .infinity)
        }.buttonStyle(.plain).accessibilityLabel("\(number). \(title)\(measured.contains(number) ? ", Messungen vorhanden" : "")")
    }
    private func legend(_ title: String, color: Color, outlined: Bool = false) -> some View {
        HStack(spacing: 4) {
            Circle().fill(outlined ? Theme.ink : color).overlay(Circle().strokeBorder(color, lineWidth: 0.6)).frame(width: 5, height: 5)
            Text(title).font(Theme.font(8)).foregroundStyle(Theme.paper.opacity(0.75))
        }
    }
}
