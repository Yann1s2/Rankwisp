import Foundation

public struct AppStoreSnapshot: Codable, Sendable {
    public var appleID: Int
    public var name: String
    public var fetchedAt: Date
    public var version: String?
    public var currentVersionReleaseDate: Date?
    public var firstReleaseDate: Date?
    public var iconURL: String?
    public var description: String?
    public var releaseNotes: String?
    public var sellerName: String?
    public var rating: Double?
    public var ratingCount: Int?
    public var minimumOSVersion: String?
    public init(appleID: Int, name: String, fetchedAt: Date = Date(), version: String? = nil,
                currentVersionReleaseDate: Date? = nil, firstReleaseDate: Date? = nil,
                iconURL: String? = nil, description: String? = nil, releaseNotes: String? = nil,
                sellerName: String? = nil, rating: Double? = nil, ratingCount: Int? = nil, minimumOSVersion: String? = nil) {
        self.appleID = appleID; self.name = name; self.fetchedAt = fetchedAt; self.version = version
        self.currentVersionReleaseDate = currentVersionReleaseDate; self.firstReleaseDate = firstReleaseDate
        self.iconURL = iconURL; self.description = description; self.releaseNotes = releaseNotes
        self.sellerName = sellerName; self.rating = rating; self.ratingCount = ratingCount; self.minimumOSVersion = minimumOSVersion
    }
}
public extension Project {
    func storeInfo(for appleID: Int) -> AppStoreSnapshot? { storeSnapshots?.last { $0.appleID == appleID } }
    func metadataIsDue(at now: Date = Date()) -> Bool {
        if let lastMetadataAttempt, lastMetadataError != nil, now.timeIntervalSince(lastMetadataAttempt) < 900 { return false }
        return comparisonApps.contains { app in storeInfo(for: app.id).map { now.timeIntervalSince($0.fetchedAt) >= Keyword.refreshInterval } ?? true }
    }
}
