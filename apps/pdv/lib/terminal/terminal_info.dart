import 'dart:io';

import 'package:flutter/services.dart';

/// Package name and signing-cert SHA-1 for an Android-restricted API key.
class AndroidClientIdentity {
  const AndroidClientIdentity({
    required this.packageName,
    required this.certSha1,
  });

  final String packageName;

  /// Lowercase hex, no colons. Empty when the cert cannot be read.
  final String certSha1;
}

/// Serial from the Getnet hardware SDK. Empty off a Get Smart terminal.
class TerminalInfo {
  static const _channel = MethodChannel('com.bearlabs.frego_pdv/terminal');

  static Future<AndroidClientIdentity?> clientIdentity() async {
    if (!Platform.isAndroid) return null;
    try {
      final raw = await _channel.invokeMapMethod<String, String>(
        'clientIdentity',
      );
      final packageName = raw?['packageName']?.trim() ?? '';
      if (packageName.isEmpty) return null;
      return AndroidClientIdentity(
        packageName: packageName,
        certSha1: (raw?['certSha1'] ?? '').trim().toLowerCase(),
      );
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }

  static Future<String?> serialNumber() async {
    if (!Platform.isAndroid) return null;
    try {
      final value = await _channel.invokeMethod<String>('serialNumber');
      final trimmed = value?.trim();
      if (trimmed == null || trimmed.isEmpty) return null;
      return trimmed;
    } on MissingPluginException {
      return null;
    } on PlatformException {
      return null;
    }
  }
}
