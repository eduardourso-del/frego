import Flutter
import UIKit
import UserNotifications

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  private static var pendingAPNsToken: Data?
  private static var channel: FlutterMethodChannel?
  private static var pendingOpened: [String: String]?
  private static var dartReady = false

  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    let ok = super.application(application, didFinishLaunchingWithOptions: launchOptions)
    UNUserNotificationCenter.current().delegate = self
    application.registerForRemoteNotifications()
    NSLog("Frego APNs: registerForRemoteNotifications after launch")
    return ok
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let messenger = engineBridge.applicationRegistrar.messenger()
    let channel = FlutterMethodChannel(name: "frego/push", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      if call.method == "register" {
        UIApplication.shared.registerForRemoteNotifications()
        NSLog("Frego APNs: registerForRemoteNotifications from Dart")
        AppDelegate.applyPendingAPNsToken()
        AppDelegate.dartReady = true
        AppDelegate.flushOpened()
        result(nil)
      } else {
        result(FlutterMethodNotImplemented)
      }
    }
    AppDelegate.channel = channel
    AppDelegate.applyPendingAPNsToken()
    AppDelegate.flushOpened()
  }

  override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    NSLog("Frego APNs token received (%d bytes)", deviceToken.count)
    AppDelegate.pendingAPNsToken = deviceToken
    AppDelegate.applyPendingAPNsToken()
    AppDelegate.channel?.invokeMethod("apns", arguments: deviceToken.count)
    super.application(
      application,
      didRegisterForRemoteNotificationsWithDeviceToken: deviceToken
    )
  }

  override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    NSLog("Frego APNs registration failed: %@", error.localizedDescription)
    AppDelegate.channel?.invokeMethod(
      "apnsError",
      arguments: error.localizedDescription
    )
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    if #available(iOS 14.0, *) {
      completionHandler([.banner, .list, .badge, .sound])
    } else {
      completionHandler([.alert, .badge, .sound])
    }
  }

  override func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    AppDelegate.offerOpened(response.notification.request.content.userInfo)
    completionHandler()
  }

  static func offerOpened(_ userInfo: [AnyHashable: Any]) {
    let payload = flattenUserInfo(userInfo)
    NSLog("Frego push opened: %@", payload)
    pendingOpened = payload
    flushOpened()
  }

  private static func flushOpened() {
    guard dartReady, let channel, let pendingOpened else { return }
    channel.invokeMethod("opened", arguments: pendingOpened)
    self.pendingOpened = nil
  }

  private static func flattenUserInfo(_ userInfo: [AnyHashable: Any]) -> [String: String] {
    var out: [String: String] = [:]
    func walk(_ dict: [AnyHashable: Any]) {
      for (rawKey, value) in dict {
        let key = String(describing: rawKey)
        if key == "aps" || key.hasPrefix("gcm.") || key.hasPrefix("google.") {
          continue
        }
        if let string = value as? String, !string.isEmpty {
          out[key] = string
        } else if let number = value as? NSNumber {
          out[key] = number.stringValue
        } else if let nested = value as? [AnyHashable: Any] {
          walk(nested)
        }
      }
    }
    walk(userInfo)
    return out
  }

  private static func applyPendingAPNsToken() {
    guard let deviceToken = pendingAPNsToken else { return }
    guard let messagingClass = NSClassFromString("FIRMessaging") as? NSObject.Type else {
      NSLog("Frego APNs: FIRMessaging not loaded yet")
      return
    }
    let messagingSel = NSSelectorFromString("messaging")
    guard messagingClass.responds(to: messagingSel),
          let unmanaged = messagingClass.perform(messagingSel) else {
      return
    }
    let messaging = unmanaged.takeUnretainedValue()
    (messaging as AnyObject).setValue(deviceToken, forKey: "APNSToken")
    NSLog("Frego APNs: forwarded token to FIRMessaging")
    pendingAPNsToken = nil
  }
}
