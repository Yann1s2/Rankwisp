import Foundation

public struct TimelinePoint: Identifiable, Sendable {
    public var id: UUID { sampleID }
    public let sampleID: UUID
    public let date: Date
    public let rank: Int
    public let segment: Int
}

public enum RankingTimeline {
    /// Never connect across missing results or a gap longer than 36 hours.
    /// Duplicate timestamps use the last recorded response, avoiding undefined interpolation.
    public static func samples(_ samples: [Sample], since: Date? = nil) -> [Sample] {
        var byDate: [Date: Sample] = [:]
        for sample in samples where since == nil || sample.date >= since! { byDate[sample.date] = sample }
        return byDate.values.sorted { $0.date < $1.date }
    }
    public static func points(_ samples: [Sample], appleID: Int) -> [TimelinePoint] {
        var segment = 0
        var previous: Date?
        return self.samples(samples).compactMap { sample in
            defer { previous = sample.date }
            if let previous, sample.date.timeIntervalSince(previous) > 36 * 3600 { segment += 1 }
            guard let rank = sample.rank(for: appleID) else { segment += 1; return nil }
            return TimelinePoint(sampleID: sample.id, date: sample.date, rank: rank, segment: segment)
        }
    }
}
