import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/auth/profile_setup_page.dart';
import 'package:frego_mobile/features/explore/city_picker.dart';
import 'package:frego_mobile/theme/frego_theme.dart';

void main() {
  testWidgets('Continuar turns yellow only after name, birthday, and city', (
    tester,
  ) async {
    await tester.pumpWidget(_app());

    expect(find.byIcon(Icons.check_circle_rounded), findsNothing);
    expect(find.byIcon(Icons.circle_outlined), findsNWidgets(3));
    expect(_continueButton(tester).onPressed, isNull);
    expect(_buttonColor(tester), isNot(FregoColors.mostarda));

    await tester.enterText(find.byType(TextField), 'Ana');
    await tester.pump();
    expect(find.byIcon(Icons.check_circle_rounded), findsOneWidget);
    expect(_continueButton(tester).onPressed, isNull);
    expect(_buttonColor(tester), isNot(FregoColors.mostarda));

    await tester.tap(find.text('Aniversário'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.byIcon(Icons.check_circle_rounded), findsNWidgets(2));
    expect(_continueButton(tester).onPressed, isNull);

    await tester.tap(find.text('Onde você mora'));
    await tester.pumpAndSettle();
    expect(find.text('Campinas, SP'), findsOneWidget);
    expect(find.byIcon(Icons.check_circle_rounded), findsNWidgets(3));
    expect(find.byIcon(Icons.circle_outlined), findsNothing);
    expect(_continueButton(tester).onPressed, isNotNull);
    expect(_buttonColor(tester), FregoColors.mostarda);
    expect(tester.takeException(), isNull);
  });
}

FilledButton _continueButton(WidgetTester tester) {
  return tester.widget<FilledButton>(
    find.widgetWithText(FilledButton, 'Continuar'),
  );
}

Color? _buttonColor(WidgetTester tester) {
  final materials = tester.widgetList<Material>(
    find.descendant(
      of: find.byType(FilledButton),
      matching: find.byType(Material),
    ),
  );
  for (final material in materials) {
    final color = material.color;
    if (color != null && color.a > 0) return color;
  }
  return null;
}

Widget _app() {
  return MaterialApp(
    locale: const Locale('pt', 'BR'),
    supportedLocales: const [Locale('pt', 'BR'), Locale('en')],
    localizationsDelegates: const [
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    theme: FregoTheme.light(),
    home: ProfileSetupPage(
      phoneE164: '+5511999000100',
      onCompleted: ({bool citySet = false}) {},
      pickCity: (context, {selected}) async =>
          const CityChoice(city: 'Campinas', state: 'SP'),
    ),
  );
}
