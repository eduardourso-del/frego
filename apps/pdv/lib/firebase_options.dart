// Firebase project voltei-e9d6d (brand: Frego).
// Same project as the customer app and the web establishment panel.
//
// The PDV does not link the Firebase Auth SDK. Getnet certification rejects
// WebView, and that SDK's reCAPTCHA library is full of it. Sign-in uses the
// Identity Toolkit REST API with these keys instead.
// ignore_for_file: lines_longer_than_80_chars

import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class FirebaseProject {
  static String get apiKey {
    if (kIsWeb) return webApiKey;
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return iosApiKey;
      case TargetPlatform.android:
        return androidApiKey;
      default:
        throw UnsupportedError(
          'FirebaseProject não configurado para esta plataforma.',
        );
    }
  }

  static const webApiKey = 'AIzaSyCcrc3gu7Q0c50IZA5hRUfSXheyZFgybVw';
  static const iosApiKey = 'AIzaSyBDFxK5epXAecY2PWGYkP51WxEOVIW4nlY';
  static const androidApiKey = 'AIzaSyDOeL88e-eNi0ZtQhM1NKMosbyrbkI6DeU';

  static const androidPackage = 'com.bearlabs.frego.pdv';
  static const iosBundleId = 'com.bearlabs.frego.pdv';
}
