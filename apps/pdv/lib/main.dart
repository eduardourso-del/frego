import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

import 'config/app_config.dart';
import 'features/auth/auth_gate.dart';
import 'theme/frego_theme.dart';

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
  AppConfig.assertShipBuildUsesProductionApi();
  // Nothing before runApp may wait on the network or Play services. On the
  // DX8000 and P3 that wait never finishes and the native splash stays up.
  widgetsBinding.addPostFrameCallback((_) => FlutterNativeSplash.remove());
  runApp(const FregoPdvApp());
  unawaited(
    Future<void>.delayed(
      const Duration(seconds: 2),
      FlutterNativeSplash.remove,
    ),
  );
}

class FregoPdvApp extends StatelessWidget {
  const FregoPdvApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Frego PDV',
      debugShowCheckedModeBanner: false,
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [Locale('pt', 'BR'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: FregoTheme.light(),
      darkTheme: FregoTheme.light(),
      themeMode: ThemeMode.light,
      builder: (context, child) {
        final bodyStyle = Theme.of(context).textTheme.bodyMedium!.copyWith(
          color: FregoColors.ink,
          decoration: TextDecoration.none,
          inherit: false,
        );
        return CupertinoTheme(
          data: FregoTheme.cupertino(),
          child: DefaultTextStyle(
            style: bodyStyle,
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: const AuthGate(),
    );
  }
}
