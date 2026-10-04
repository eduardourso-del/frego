import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart'
    show kIsWeb, LicenseRegistry, LicenseEntryWithLineBreaks;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:google_fonts/google_fonts.dart';

import 'analytics/frego_telemetry.dart';
import 'firebase_options.dart';
import 'config/app_config.dart';
import 'notifications/push_service.dart';
import 'theme/frego_theme.dart';
import 'features/auth/auth_gate.dart';

Future<void> main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  GoogleFonts.config.allowRuntimeFetching = false;
  LicenseRegistry.addLicense(() async* {
    final license = await rootBundle.loadString('google_fonts/OFL.txt');
    yield LicenseEntryWithLineBreaks(['google_fonts'], license);
  });
  SystemChrome.setSystemUIOverlayStyle(FregoTheme.statusBar);
  AppConfig.assertShipBuildUsesProductionApi();
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await FregoTelemetry.attach();
  PushService.attachNative();
  runApp(FregoApp(analyticsObserver: FregoTelemetry.observer));
}

class FregoApp extends StatelessWidget {
  const FregoApp({super.key, this.analyticsObserver});

  final NavigatorObserver? analyticsObserver;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Frego',
      debugShowCheckedModeBanner: false,
      navigatorObservers: [
        ?analyticsObserver,
      ],
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
        final bodyStyle = Theme.of(context).textTheme.bodyMedium!.copyWith(
              color: FregoColors.ink,
              decoration: TextDecoration.none,
              inherit: false,
            );
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: FregoTheme.statusBar,
          child: CupertinoTheme(
            data: FregoTheme.cupertino(Brightness.light),
            child: DefaultTextStyle(
              style: bodyStyle,
              child: child ?? const SizedBox.shrink(),
            ),
          ),
        );
      },
      home: const AuthGate(),
    );
  }
}
