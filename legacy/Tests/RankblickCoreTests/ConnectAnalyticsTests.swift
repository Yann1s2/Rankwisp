import XCTest
import CryptoKit
@testable import RankblickCore

final class ConnectAnalyticsTests: XCTestCase {
    func testPaginationAndAuthenticatedAPIRequests() async throws {
        var calls = 0
        let client = ConnectAnalytics(token: { "test-token" }, transport: { req in
            calls += 1
            XCTAssertEqual(req.value(forHTTPHeaderField: "Authorization"), "Bearer test-token")
            let body = calls == 1 ? #"{"data":[{"id":"a"}],"links":{"next":"https://api.appstoreconnect.apple.com/v1/next"}}"# : #"{"data":[{"id":"b"}]}"#
            return (Data(body.utf8), HTTPURLResponse(url: req.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        })
        let result = try await client.list("apps/1/analyticsReportRequests")
        XCTAssertEqual(result.map(\.id), ["a","b"])
        XCTAssertEqual(calls, 2)
    }
    func testRejectsForeignPaginationBeforeSendingToken() async throws {
        var calls = 0
        let client = ConnectAnalytics(token: { "secret" }, transport: { req in
            calls += 1
            return (Data(#"{"data":[],"links":{"next":"https://example.com/steal"}}"#.utf8), HTTPURLResponse(url:req.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
        })
        do { _ = try await client.list("test"); XCTFail("Foreign host accepted") } catch {}
        XCTAssertEqual(calls, 1)
    }
    func testFailurePreservesPreviousSnapshot() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:root) }
        let repo = try Repository(directory:root)
        let success = ConnectAnalytics(token: { "test" }, transport: { req in (Data(#"{"data":[]}"#.utf8),HTTPURLResponse(url:req.url!,statusCode:200,httpVersion:nil,headerFields:nil)!) })
        _ = try await success.refresh(appID:1,repository:repo)
        let file = root.appendingPathComponent("Analytics/1.json"); let before = try Data(contentsOf:file)
        let failure = ConnectAnalytics(token: { "test" }, transport: { req in (Data(),HTTPURLResponse(url:req.url!,statusCode:401,httpVersion:nil,headerFields:nil)!) })
        do { _ = try await failure.refresh(appID:1,repository:repo); XCTFail("Expected error") } catch {}
        XCTAssertEqual(try Data(contentsOf:file),before)
    }
    func testDownloadHasNoBearerAndChecksSize() async throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at:root) }
        let repo = try Repository(directory:root)
        let client = ConnectAnalytics(token: { "secret" }, transport: { req in
            if req.url!.host == "api.appstoreconnect.apple.com" {
                return (Data(#"{"data":[{"id":"segment","attributes":{"url":"https://example.com/report","sizeInBytes":20}}]}"#.utf8),HTTPURLResponse(url:req.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
            }
            XCTAssertNil(req.value(forHTTPHeaderField:"Authorization"))
            return (Data("short".utf8),HTTPURLResponse(url:req.url!,statusCode:200,httpVersion:nil,headerFields:nil)!)
        })
        do { _ = try await client.download(instanceID:"one",repository:repo); XCTFail("Truncated report accepted") } catch {}
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath:root.appendingPathComponent("Analytics/Reports").path),[])
    }
}
