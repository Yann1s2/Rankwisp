import Foundation
import CryptoKit

public struct ConnectConfiguration: Codable {
    public var issuerID: String
    public var keyID: String
    public var keyPath: String
    public static func load(repository: Repository) throws -> Self {
        try JSONDecoder().decode(Self.self, from: Data(contentsOf: repository.directory.appendingPathComponent("connect.json")))
    }
    public func token(now: Date = Date()) throws -> String {
        let key = try P256.Signing.PrivateKey(pemRepresentation: String(contentsOfFile: keyPath, encoding: .utf8))
        func b64(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }
        let h = b64(try JSONSerialization.data(withJSONObject: ["alg":"ES256", "kid":keyID, "typ":"JWT"]))
        let p = b64(try JSONSerialization.data(withJSONObject: ["iss":issuerID, "iat":Int(now.timeIntervalSince1970), "exp":Int(now.timeIntervalSince1970)+300, "aud":"appstoreconnect-v1"]))
        let message = h + "." + p
        return message + "." + b64(try key.signature(for: Data(message.utf8)).rawRepresentation)
    }
}
public struct ConnectResource: Codable, Identifiable {
    public let id: String
    public let attributes: Attributes?
    public struct Attributes: Codable {
        public var name: String?
        public var category: String?
        public var accessType: String?
        public var stoppedDueToInactivity: Bool?
        public var processingDate: String?
        public var granularity: String?
        public var url: String?
        public var checksum: String?
        public var sizeInBytes: Int?
    }
}
public struct ConnectSnapshot: Codable {
    public let appID: Int
    public let checkedAt: Date
    public let requests: [ConnectResource]
    public let reports: [ConnectResource]
}
public struct ConnectAnalytics {
    public typealias Transport = (URLRequest) async throws -> (Data, HTTPURLResponse)
    private let token: () throws -> String
    private let transport: Transport
    public init(configuration: ConnectConfiguration) {
        token = { try configuration.token() }
        transport = { request in
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { throw RankblickError.message("Ungültige Apple-Antwort.") }
            return (data, http)
        }
    }
    public init(token: @escaping () throws -> String, transport: @escaping Transport) { self.token = token; self.transport = transport }
    public static func validateAPIURL(_ url: URL) throws {
        guard url.scheme == "https", url.host == "api.appstoreconnect.apple.com", url.user == nil, url.password == nil, url.port == nil else {
            throw RankblickError.message("Ungültiges Ziel für den Apple-API-Zugriff.")
        }
    }
    public func list(_ path: String) async throws -> [ConnectResource] {
        struct Page: Decodable { let data: [ConnectResource]; let links: Links?; struct Links: Decodable { let next: String? } }
        var next: URL? = URL(string: "https://api.appstoreconnect.apple.com/v1/" + path)
        var seen = Set<URL>(); var results = [ConnectResource]()
        while let url = next {
            try Task.checkCancellation(); try Self.validateAPIURL(url)
            guard seen.insert(url).inserted, seen.count <= 1000 else { throw RankblickError.message("Unvollständige Apple-Paginierung.") }
            var request = URLRequest(url: url); request.timeoutInterval = 45
            request.setValue("Bearer " + (try token()), forHTTPHeaderField: "Authorization")
            let (data, response) = try await transport(request)
            guard (200..<300).contains(response.statusCode) else {
                throw RankblickError.message(response.statusCode == 403 ? "Apple verweigert den Zugriff (403). Bitte die Schlüsselrechte prüfen." : "Apple Analytics: HTTP \(response.statusCode). Letzter erfolgreicher Stand bleibt erhalten.")
            }
            let page = try JSONDecoder().decode(Page.self, from: data)
            results += page.data
            if let link = page.links?.next { guard let url = URL(string: link) else { throw RankblickError.message("Ungültige Folgeseite.") }; next = url } else { next = nil }
        }
        return results
    }
    public func refresh(appID: Int, repository: Repository) async throws -> ConnectSnapshot {
        let requests = try await list("apps/\(appID)/analyticsReportRequests")
        var reports = [ConnectResource]()
        for request in requests { reports += try await list("analyticsReportRequests/\(request.id)/reports") }
        var seen = Set<String>(); reports = reports.filter { seen.insert($0.id).inserted }
        let snapshot = ConnectSnapshot(appID: appID, checkedAt: Date(), requests: requests, reports: reports)
        let folder = repository.directory.appendingPathComponent("Analytics")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        try JSONCoding.encoder().encode(snapshot).write(to: folder.appendingPathComponent("\(appID).json"), options: .atomic)
        return snapshot
    }
    public func instances(reportID: String) async throws -> [ConnectResource] {
        try await list("analyticsReports/\(reportID)/instances?filter[granularity]=DAILY")
    }
    public func download(instanceID: String, repository: Repository) async throws -> Int {
        let segments = try await list("analyticsReportInstances/\(instanceID)/segments")
        let folder = repository.directory.appendingPathComponent("Analytics/Reports")
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
        for segment in segments {
            guard let raw = segment.attributes?.url, let url = URL(string: raw), url.scheme == "https", url.user == nil, url.password == nil else { throw RankblickError.message("Ungültige Download-Adresse.") }
            // Signed report URL: deliberately no Authorization header on storage requests.
            var request = URLRequest(url: url); request.timeoutInterval = 120
            let (data, response) = try await transport(request)
            guard response.statusCode == 200 else { throw RankblickError.message("Bericht-Download fehlgeschlagen (\(response.statusCode)).") }
            if let size = segment.attributes?.sizeInBytes, size != data.count { throw RankblickError.message("Unvollständiger Bericht-Download.") }
            let filename = SHA256.hash(data: Data((instanceID + ":" + segment.id).utf8)).map { String(format: "%02x", $0) }.joined() + ".gz"
            try data.write(to: folder.appendingPathComponent(filename), options: .atomic)
        }
        return segments.count
    }
}
