import Foundation
import Capacitor
import StoreKit
import UIKit
import Security

@objc(RankwispStorePlugin)
public class RankwispStorePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RankwispStorePlugin"
    public let jsName = "RankwispStore"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openAuth", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "haptic", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unfinished", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareExport", returnType: CAPPluginReturnPromise)
    ]
    private let productID = "ch.zhstudio.rankwisp.lifetime"
    private let trialID = "ch.zhstudio.rankwisp.trial24"
    private var transactionTask: Task<Void, Never>?
    private var authObserver: NSObjectProtocol?
    private var pendingAuth: [String: Date] = [:]

    static let authCompletionNotification = Notification.Name("RankwispAuthCompletion")

    static func receiveAuth(_ url: URL) -> Bool {
        guard url.absoluteString.utf8.count <= 512, url.scheme == "rankwisp", url.host == "auth",
              url.path == "/complete", url.port == nil, url.user == nil, url.password == nil,
              url.query == nil, let fragment = URLComponents(url: url, resolvingAgainstBaseURL: false)?.percentEncodedFragment,
              let parts = URLComponents(string: "https://callback.invalid/?" + fragment),
              let items = parts.queryItems, items.count == 2,
              let ticket = items.first(where: { $0.name == "ticket" })?.value,
              let code = items.first(where: { $0.name == "code" })?.value,
              ticket.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil,
              code.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else { return false }
        NotificationCenter.default.post(name: authCompletionNotification, object: nil, userInfo: ["ticket": ticket, "code": code])
        return true
    }

    public override func load() {
        authObserver = NotificationCenter.default.addObserver(forName: Self.authCompletionNotification, object: nil, queue: .main) { [weak self] notification in
            guard let self, let ticket = notification.userInfo?["ticket"] as? String,
                  let code = notification.userInfo?["code"] as? String,
                  let expiry = self.pendingAuth.removeValue(forKey: ticket), expiry > Date() else { return }
            self.notifyListeners("authCompleted", data: ["ticket": ticket, "code": code], retainUntilConsumed: true)
        }
        transactionTask = Task { [weak self] in
            for await result in Transaction.updates {
                if Task.isCancelled { return }
                guard let self, case .verified(let transaction) = result,
                      self.supported(transaction) else { continue }
                let payload = self.payload(result, transaction)
                DispatchQueue.main.async { [weak self] in
                    self?.notifyListeners("transactionUpdated", data: payload, retainUntilConsumed: true)
                }
            }
        }
    }

    deinit {
        transactionTask?.cancel()
        if let authObserver { NotificationCenter.default.removeObserver(authObserver) }
    }

    private func supported(_ transaction: Transaction) -> Bool {
        [productID, trialID].contains(transaction.productID)
    }

    private func payload(_ result: VerificationResult<Transaction>, _ transaction: Transaction) -> [String: Any] {
        ["signedTransaction": result.jwsRepresentation, "transactionID": String(transaction.id)]
    }

    private var keychainQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "ch.zhstudio.rankwisp.session",
         kSecAttrAccount as String: "session"]
    }

    @objc func getSession(_ call: CAPPluginCall) {
        #if DEBUG
        NSLog("Rankwisp secure storage read started")
        #endif
        var query = keychainQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        #if DEBUG
        NSLog("Rankwisp secure storage read status: %d", status)
        #endif
        if status == errSecItemNotFound { call.resolve(["token": ""]); return }
        guard status == errSecSuccess, let data = result as? Data,
              let token = String(data: data, encoding: .utf8) else {
            call.reject("SECURE_STORAGE_UNAVAILABLE"); return
        }
        call.resolve(["token": token])
    }

    @objc func setSession(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), token.isEmpty || token.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else {
            call.reject("INVALID_SESSION"); return
        }
        if token.isEmpty {
            let status = SecItemDelete(keychainQuery as CFDictionary)
            guard status == errSecSuccess || status == errSecItemNotFound else { call.reject("SECURE_STORAGE_UNAVAILABLE"); return }
            call.resolve(); return
        }
        let attributes: [String: Any] = [
            kSecValueData as String: Data(token.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]
        var status = SecItemUpdate(keychainQuery as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var item = keychainQuery
            attributes.forEach { item[$0.key] = $0.value }
            status = SecItemAdd(item as CFDictionary, nil)
        }
        guard status == errSecSuccess else { call.reject("SECURE_STORAGE_UNAVAILABLE"); return }
        call.resolve()
    }

    private var configuredAPI: URL? {
        guard let file = Bundle.main.url(forResource: "native-config", withExtension: "json", subdirectory: "public"),
              let data = try? Data(contentsOf: file),
              let config = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let raw = config["apiOrigin"] as? String, let url = URL(string: raw),
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              url.path.isEmpty || url.path == "/" else { return nil }
        if url.scheme == "https", url.host != nil { return url }
        if config["development"] as? Bool == true, url.scheme == "http",
           ["127.0.0.1", "localhost", "[::1]", "::1"].contains(url.host ?? "") { return url }
        return nil
    }

    @objc func openAuth(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), raw.utf8.count <= 16000,
              let url = URL(string: raw), let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              url.user == nil, url.password == nil, url.fragment == nil else { call.reject("INVALID_AUTH_URL"); return }
        let google = url.scheme == "https" && url.host == "accounts.google.com" && url.path == "/o/oauth2/v2/auth" && url.port == nil
        let items = parts.queryItems ?? []
        let api = configuredAPI
        let ticket = api != nil && url.scheme == api?.scheme && url.host == api?.host && url.port == api?.port
            && url.path == "/api/auth/google/start" && items.count == 1 && items[0].name == "ticket"
            && items[0].value?.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil
        guard google || ticket else { call.reject("INVALID_AUTH_URL"); return }
        // Open the backend ticket first so its HttpOnly browser binding is set before Google redirects.
        DispatchQueue.main.async {
            self.pendingAuth = self.pendingAuth.filter { $0.value > Date() }
            let ticketValue = ticket ? items[0].value : nil
            if let ticketValue { self.pendingAuth[ticketValue] = Date().addingTimeInterval(600) }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else {
                    if let ticketValue { self.pendingAuth.removeValue(forKey: ticketValue) }
                    call.reject("AUTH_BROWSER_UNAVAILABLE")
                }
            }
        }
    }

    @objc func haptic(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let feedback = UIImpactFeedbackGenerator(style: .light)
            feedback.prepare()
            feedback.impactOccurred()
            call.resolve()
        }
    }

    @objc func product(_ call: CAPPluginCall) {
        Task {
            do {
                guard let item = try await Product.products(for: [productID]).first else { call.reject("PAYMENTS_NOT_CONFIGURED"); return }
                call.resolve(["id": item.id, "price": item.displayPrice, "name": item.displayName])
            } catch { call.reject("STORE_UNAVAILABLE") }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let value = call.getString("accountToken"), let account = UUID(uuidString: value) else { call.reject("INVALID_ACCOUNT"); return }
        Task {
            do {
                let selectedID = call.getBool("trial") == true ? trialID : productID
                guard let item = try await Product.products(for: [selectedID]).first else { call.reject("PAYMENTS_NOT_CONFIGURED"); return }
                let outcome = try await item.purchase(options: [.appAccountToken(account)])
                switch outcome {
                case .success(let result):
                    guard case .verified(let transaction) = result else { call.reject("INVALID_PURCHASE"); return }
                    // JS must verify with our backend before calling finish. Failed delivery stays unfinished.
                    call.resolve(payload(result, transaction))
                case .pending: call.reject("PURCHASE_PENDING")
                case .userCancelled: call.reject("PURCHASE_CANCELLED")
                @unknown default: call.reject("STORE_UNAVAILABLE")
                }
            } catch { call.reject("STORE_UNAVAILABLE") }
        }
    }

    @objc func unfinished(_ call: CAPPluginCall) {
        Task {
            var transactions = [[String: Any]]()
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, supported(transaction) {
                    transactions.append(payload(result, transaction))
                }
            }
            call.resolve(["transactions": transactions])
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionID"), let id = UInt64(raw) else { call.reject("INVALID_PURCHASE"); return }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.id == id, supported(transaction) {
                    await transaction.finish()
                }
            }
            call.resolve()
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions = [[String: Any]]()
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result, supported(transaction) {
                        transactions.append(payload(result, transaction))
                    }
                }
                call.resolve(["transactions": transactions])
            } catch { call.reject("STORE_UNAVAILABLE") }
        }
    }

    @objc func shareExport(_ call: CAPPluginCall) {
        guard let text = call.getString("content"), text.utf8.count <= 20_000_000 else { call.reject("INVALID_EXPORT"); return }
        DispatchQueue.main.async {
            let folder = FileManager.default.temporaryDirectory.appendingPathComponent("rankwisp-export-" + UUID().uuidString)
            do {
                guard let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                    call.reject("EXPORT_FAILED"); return
                }
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let file = folder.appendingPathComponent("rankwisp-export.json")
                try Data(text.utf8).write(to: file, options: [.atomic, .completeFileProtection])
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: folder) }
                if let popover = sheet.popoverPresentationController {
                    popover.sourceView = presenter.view
                    popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 1, height: 1)
                }
                presenter.present(sheet, animated: true) { call.resolve() }
            } catch {
                try? FileManager.default.removeItem(at: folder)
                call.reject("EXPORT_FAILED")
            }
        }
    }
}

class RankwispViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RankwispStorePlugin())
    }
    override var preferredStatusBarStyle: UIStatusBarStyle { .darkContent }
}
