import UIKit
import UserNotifications

/// Downloads the estabelecimento logo and attaches a small square.
/// The banner shows that square on the right. A wide source keeps its center.
final class NotificationService: UNNotificationServiceExtension {
  private var contentHandler: ((UNNotificationContent) -> Void)?
  private var bestAttempt: UNMutableNotificationContent?
  private var finished = false

  override func didReceive(
    _ request: UNNotificationRequest,
    withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
  ) {
    self.contentHandler = contentHandler
    guard let content = request.content.mutableCopy() as? UNMutableNotificationContent else {
      finish(request.content)
      return
    }
    bestAttempt = content
    guard let url = Self.logoURL(in: request.content.userInfo) else {
      finish(content)
      return
    }

    let config = URLSessionConfiguration.ephemeral
    config.timeoutIntervalForRequest = 5
    config.timeoutIntervalForResource = 8
    URLSession(configuration: config).dataTask(with: url) { data, response, _ in
      let status = (response as? HTTPURLResponse)?.statusCode ?? 0
      if status == 200,
         let data,
         data.count <= 1_500_000,
         let attachment = Self.squareAttachment(from: data) {
        content.attachments = [attachment]
      }
      self.finish(content)
    }.resume()
  }

  override func serviceExtensionTimeWillExpire() {
    if let bestAttempt {
      finish(bestAttempt)
    }
  }

  private func finish(_ content: UNNotificationContent) {
    DispatchQueue.main.async {
      guard !self.finished else { return }
      self.finished = true
      self.contentHandler?(content)
    }
  }

  private static func logoURL(in userInfo: [AnyHashable: Any]) -> URL? {
    let nested = userInfo["data"] as? [AnyHashable: Any]
    let raw = (userInfo["logoUrl"] as? String) ?? (nested?["logoUrl"] as? String)
    guard let raw, let url = URL(string: raw), url.scheme == "https" else {
      return nil
    }
    return url
  }

  private static func squareAttachment(from data: Data) -> UNNotificationAttachment? {
    guard let image = UIImage(data: data) else { return nil }
    let side = min(image.size.width, image.size.height)
    guard side > 0 else { return nil }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 256, height: 256), format: format)
    let rendered = renderer.image { _ in
      let scale = 256 / side
      let draw = CGRect(
        x: (256 - image.size.width * scale) / 2,
        y: (256 - image.size.height * scale) / 2,
        width: image.size.width * scale,
        height: image.size.height * scale
      )
      image.draw(in: draw)
    }
    guard let png = rendered.pngData() else { return nil }
    let file = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString)
      .appendingPathExtension("png")
    do {
      try png.write(to: file)
      return try UNNotificationAttachment(identifier: "logo", url: file)
    } catch {
      return nil
    }
  }
}
