import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

/// Draws a push in the tray with the estabelecimento logo as a small picture
/// on the right. A wide FCM image would open into a banner, so this stays a
/// square thumbnail.
abstract final class PushTray {
  static final FlutterLocalNotificationsPlugin _plugin =
      FlutterLocalNotificationsPlugin();
  static Future<void>? _ready;
  static bool _launchConsumed = false;
  static void Function(Map<dynamic, dynamic> raw)? _onOpened;
  static Map<dynamic, dynamic>? _pendingOpen;

  static const _channelId = 'frego_campaigns';
  static const _thumb = 256;
  static const _maxLogoBytes = 1500000;

  static void bind(void Function(Map<dynamic, dynamic> raw) onOpened) {
    _onOpened = onOpened;
    final pending = _pendingOpen;
    if (pending == null) return;
    _pendingOpen = null;
    onOpened(pending);
  }

  static Future<void> prepare() async {
    await ensureInitialized();
    if (_launchConsumed) return;
    _launchConsumed = true;
    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp != true) return;
    _emit(launch?.notificationResponse?.payload);
  }

  static Future<void> ensureInitialized() {
    if (kIsWeb) return Future<void>.value();
    return _ready ??= _start();
  }

  static Future<void> _start() async {
    await _plugin.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('ic_notification'),
        iOS: DarwinInitializationSettings(
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: _onTap,
    );
  }

  static void _onTap(NotificationResponse response) {
    _emit(response.payload);
  }

  static void _emit(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final decoded = jsonDecode(payload);
      if (decoded is! Map) return;
      final raw = Map<dynamic, dynamic>.from(decoded);
      final handler = _onOpened;
      if (handler == null) {
        _pendingOpen = raw;
        return;
      }
      handler(raw);
    } catch (e) {
      debugPrint('PushTray tap ignored: $e');
    }
  }

  static Future<void> show(RemoteMessage message) async {
    if (kIsWeb) return;
    final data = <String, String>{};
    for (final entry in message.data.entries) {
      final text = entry.value?.toString() ?? '';
      if (text.isNotEmpty) data[entry.key] = text;
    }
    final title = data['title'] ?? message.notification?.title ?? '';
    final body = data['body'] ?? message.notification?.body ?? '';
    if (title.isEmpty && body.isEmpty) return;

    try {
      await ensureInitialized();
      final logo = await _logoPng(data['logoUrl']);
      await _show(
        title: title,
        body: body,
        data: data,
        logo: logo,
      );
    } catch (e) {
      debugPrint('PushTray show failed: $e');
    }
  }

  static Future<void> _show({
    required String title,
    required String body,
    required Map<String, String> data,
    required Uint8List? logo,
  }) async {
    String? attachmentPath;
    if (logo != null && defaultTargetPlatform == TargetPlatform.iOS) {
      final file = File(
        '${Directory.systemTemp.path}/frego-push-${DateTime.now().microsecondsSinceEpoch}.png',
      );
      await file.writeAsBytes(logo, flush: true);
      attachmentPath = file.path;
    }
    final id = DateTime.now().millisecondsSinceEpoch.remainder(1 << 31);
    await _plugin.show(
      id: id,
      title: title.isEmpty ? null : title,
      body: body.isEmpty ? null : body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(
          _channelId,
          'Avisos',
          channelDescription: 'Campanhas, carimbos e saldo',
          importance: Importance.high,
          priority: Priority.high,
          icon: 'ic_notification',
          color: const Color(0xFF0073C8),
          largeIcon: logo == null ? null : ByteArrayAndroidBitmap(logo),
          styleInformation: body.isEmpty
              ? null
              : BigTextStyleInformation(body),
        ),
        iOS: DarwinNotificationDetails(
          presentAlert: true,
          presentBanner: true,
          presentList: true,
          presentSound: true,
          attachments: attachmentPath == null
              ? null
              : [DarwinNotificationAttachment(attachmentPath)],
        ),
      ),
      payload: jsonEncode(data),
    );
  }

  static Future<Uint8List?> _logoPng(String? url) async {
    if (url == null || url.isEmpty) return null;
    final uri = Uri.tryParse(url);
    if (uri == null || uri.scheme != 'https') return null;
    try {
      final bytes = await _download(uri).timeout(const Duration(seconds: 3));
      if (bytes == null) return null;
      return await _squarePng(bytes);
    } catch (e) {
      debugPrint('PushTray logo skipped: $e');
      return null;
    }
  }

  static Future<Uint8List?> _download(Uri uri) async {
    final client = http.Client();
    try {
      final streamed = await client.send(http.Request('GET', uri));
      if (streamed.statusCode != 200) {
        await streamed.stream.drain<void>();
        return null;
      }
      final type = streamed.headers['content-type'] ?? '';
      final imageType = type.startsWith('image/') ||
          type.isEmpty ||
          type.startsWith('application/octet-stream');
      if (!imageType) {
        await streamed.stream.drain<void>();
        return null;
      }
      final builder = BytesBuilder(copy: false);
      await for (final chunk in streamed.stream) {
        builder.add(chunk);
        if (builder.length > _maxLogoBytes) return null;
      }
      final bytes = builder.takeBytes();
      if (bytes.length < 32) return null;
      return bytes;
    } finally {
      client.close();
    }
  }

  /// Center square, scaled down. The tray slot is small, so a wide wordmark
  /// keeps its middle and the phone does not need a second logo file.
  static Future<Uint8List?> _squarePng(Uint8List bytes) async {
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final src = frame.image;
    final side = math.min(src.width, src.height);
    if (side <= 0) {
      src.dispose();
      return null;
    }
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    canvas.drawImageRect(
      src,
      Rect.fromLTWH(
        (src.width - side) / 2,
        (src.height - side) / 2,
        side.toDouble(),
        side.toDouble(),
      ),
      const Rect.fromLTWH(0, 0, 256, 256),
      Paint()..isAntiAlias = true,
    );
    final picture = recorder.endRecording();
    final out = await picture.toImage(_thumb, _thumb);
    final data = await out.toByteData(format: ui.ImageByteFormat.png);
    src.dispose();
    out.dispose();
    picture.dispose();
    final png = data?.buffer.asUint8List();
    if (png == null || png.isEmpty) return null;
    return png;
  }
}
