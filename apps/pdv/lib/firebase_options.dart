// Firebase options for project voltei-e9d6d (brand: Frego).
// Same project as the customer app and the web establishment panel.
// Initialized from Dart only — no google-services.json package-name check.
// ignore_for_file: lines_longer_than_80_chars

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.android:
        return android;
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions não configurado para esta plataforma.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyCcrc3gu7Q0c50IZA5hRUfSXheyZFgybVw',
    appId: '1:258859601466:web:246b84233b07f19918af03',
    messagingSenderId: '258859601466',
    projectId: 'voltei-e9d6d',
    authDomain: 'voltei-e9d6d.firebaseapp.com',
    storageBucket: 'voltei-e9d6d.firebasestorage.app',
    measurementId: 'G-E7N236DB0M',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyBDFxK5epXAecY2PWGYkP51WxEOVIW4nlY',
    appId: '1:258859601466:ios:cb11a459fce71b9e18af03',
    messagingSenderId: '258859601466',
    projectId: 'voltei-e9d6d',
    storageBucket: 'voltei-e9d6d.firebasestorage.app',
    iosBundleId: 'com.bearlabs.frego.pdv',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDOeL88e-eNi0ZtQhM1NKMosbyrbkI6DeU',
    appId: '1:258859601466:android:2732aa53865511b718af03',
    messagingSenderId: '258859601466',
    projectId: 'voltei-e9d6d',
    storageBucket: 'voltei-e9d6d.firebasestorage.app',
  );
}
