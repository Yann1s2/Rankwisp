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
        CAPPluginMethod(name: "product", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareExport", returnType: CAPPluginReturnPromise)
    ]
    private var keychainQuery: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "ch.zhstudio.rankwisp.session", kSecAttrAccount as String: "session"] }
    @objc func getSession(_ call: CAPPluginCall) {
        var query = keychainQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        if status == errSecItemNotFound { call.resolve(["token": ""]); return }
        guard status == errSecSuccess, let data = result as? Data, let token = String(data: data, encoding: .utf8) else { call.reject("SECURE_STORAGE_UNAVAILABLE"); return }
        call.resolve(["token": token])
    }
    @objc func setSession(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), token.isEmpty || token.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil else { call.reject("INVALID_SESSION"); return }
        SecItemDelete(keychainQuery as CFDictionary)
        if token.isEmpty { call.resolve(); return }
        var item = keychainQuery
        item[kSecValueData as String] = Data(token.utf8)
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(item as CFDictionary, nil) == errSecSuccess else { call.reject("SECURE_STORAGE_UNAVAILABLE"); return }
        call.resolve()
    }
    private let productID = "ch.zhstudio.rankwisp.lifetime"
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
                let selectedID = call.getBool("trial") == true ? "ch.zhstudio.rankwisp.trial24" : productID
                guard let item = try await Product.products(for: [selectedID]).first else { call.reject("PAYMENTS_NOT_CONFIGURED"); return }
                let outcome = try await item.purchase(options: [.appAccountToken(account)])
                switch outcome {
                case .success(let result):
                    guard case .verified(let transaction) = result else { call.reject("INVALID_PURCHASE"); return }
                    // Finish only after the backend has verified this JWS and granted access.
                    call.resolve(["signedTransaction": result.jwsRepresentation, "transactionID": String(transaction.id)])
                case .pending: call.reject("PURCHASE_PENDING")
                case .userCancelled: call.reject("PURCHASE_CANCELLED")
                @unknown default: call.reject("STORE_UNAVAILABLE")
                }
            } catch { call.reject("STORE_UNAVAILABLE") }
        }
    }
    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionID"), let id = UInt64(raw) else { call.reject("INVALID_PURCHASE"); return }
        Task {
            for await result in Transaction.unfinished {
                if case .verified(let transaction) = result, transaction.id == id { await transaction.finish() }
            }
            call.resolve()
        }
    }
    @objc func restore(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                var transactions = [String]()
                for await result in Transaction.currentEntitlements {
                    if case .verified(let transaction) = result, [productID, "ch.zhstudio.rankwisp.trial24"].contains(transaction.productID) {
                        transactions.append(result.jwsRepresentation)
                    }
                }
                call.resolve(["transactions": transactions])
            } catch { call.reject("STORE_UNAVAILABLE") }
        }
    }
    @objc func shareExport(_ call: CAPPluginCall) {
        guard let text = call.getString("content"), text.utf8.count <= 20_000_000 else { call.reject("INVALID_EXPORT"); return }
        DispatchQueue.main.async {
            do {
                let folder = FileManager.default.temporaryDirectory.appendingPathComponent("rankwisp-export-" + UUID().uuidString)
                try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
                let file = folder.appendingPathComponent("rankwisp-export.json")
                try Data(text.utf8).write(to: file, options: [.atomic, .completeFileProtection])
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: folder) }
                if let popover = sheet.popoverPresentationController, let view = self.bridge?.viewController?.view {
                    popover.sourceView = view; popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                }
                self.bridge?.viewController?.present(sheet, animated: true)
                call.resolve()
            } catch { call.reject("EXPORT_FAILED") }
        }
    }
}

class RankwispViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(RankwispStorePlugin())
    }
}
