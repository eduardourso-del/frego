import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'firebase_options.dart';
import 'config/app_config.dart';
import 'theme/frego_theme.dart';
import 'features/auth/auth_gate.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.assertShipBuildUsesProductionApi();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  runApp(const FregoApp());
}

class FregoApp extends StatelessWidget {
  const FregoApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Frego',
      debugShowCheckedModeBanner: false,
      locale: const Locale('pt', 'BR'),
      supportedLocales: const [
        Locale('pt', 'BR'),
        Locale('en'),
      ],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: FregoTheme.light(forWeb: kIsWeb),
      darkTheme: FregoTheme.light(forWeb: kIsWeb),
      themeMode: ThemeMode.light,
      builder: (context, child) {
        return CupertinoTheme(
          data: FregoTheme.cupertino(Brightness.light),
          child: DefaultTextStyle.merge(
            style: Theme.of(context).textTheme.bodyMedium!.copyWith(
                  color: FregoColors.ink,
                  decoration: TextDecoration.none,
                ),
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
      home: const AuthGate(),
    );
  }
}
