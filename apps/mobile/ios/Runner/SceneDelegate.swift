import Flutter
import UIKit
import UserNotifications

class SceneDelegate: FlutterSceneDelegate {
  override func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    super.scene(scene, willConnectTo: session, options: connectionOptions)
    UIApplication.shared.registerForRemoteNotifications()
    if let response = connectionOptions.notificationResponse {
      AppDelegate.offerOpened(response.notification.request.content.userInfo)
    }
  }
}
