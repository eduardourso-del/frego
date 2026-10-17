import 'dart:io';

import 'package:flutter/services.dart';

/// Serial from the Getnet hardware SDK. Empty off a Get Smart terminal.
class TerminalInfo {
  static const _channel = MethodChannel('com.bearlabs.frego_pdv/terminal');

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
