import UIKit
import Capacitor

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool { true }
}

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        for context in connectionOptions.urlContexts { forward(context) }
        for activity in connectionOptions.userActivities { forward(activity) }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        for context in URLContexts { forward(context) }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) { forward(userActivity) }

    private func forward(_ context: UIOpenURLContext) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: context.url, options: [
            .openInPlace: context.options.openInPlace,
            .sourceApplication: context.options.sourceApplication as Any,
            .annotation: context.options.annotation as Any
        ])
    }

    private func forward(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}
