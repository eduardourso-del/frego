import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';

import 'config/app_config.dart';
import 'features/auth/auth_gate.dart';
import 'firebase_options.dart';
import 'theme/frego_theme.dart';

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
  AppConfig.assertShipBuildUsesProductionApi();
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const FregoPdvApp());
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
