import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/auth/otp_page.dart';
import 'package:frego_mobile/features/auth/phone_entry_page.dart';
import 'package:frego_mobile/theme/frego_theme.dart';
import 'package:frego_mobile/ui/adaptive.dart';

void main() {
  test('routeNameOf converts widget types to snake_case screens', () {
    expect(FregoAdaptive.routeNameOf(const SizedBox()), 'sized_box');
    expect(
      FregoAdaptive.routeNameOf(const FakeShopDetailPage()),
      'fake_shop_detail',
    );
  });

  testWidgets('Tela de telefone mostra a marca Frego', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: FregoTheme.light(),
        home: const PhoneEntryPage(isRoot: true),
      ),
    );
    expect(find.bySemanticsLabel('Frego'), findsWidgets);
    expect(find.text('Política de Privacidade'), findsOneWidget);
    expect(find.text('Termos de Uso'), findsOneWidget);
  });

  testWidgets(
      'iOS large text keeps the phone field and Continuar above the keyboard',
      (tester) async {
    const keyboard = 336.0;
    const screen = Size(402, 874);
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = screen;
    tester.view.padding = const FakeViewPadding(top: 59, bottom: 34);
    tester.view.viewPadding = const FakeViewPadding(top: 59, bottom: 34);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: FregoTheme.light().copyWith(platform: TargetPlatform.iOS),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            textScaler: const TextScaler.linear(2.5),
          ),
          child: CupertinoTheme(
            data: FregoTheme.cupertino(Brightness.light),
            child: child!,
          ),
        ),
        home: const PhoneEntryPage(isRoot: true),
      ),
    );

    final fieldFinder = find.byType(CupertinoTextField);
    await tester.ensureVisible(fieldFinder);
    await tester.pumpAndSettle();
    await tester.tap(fieldFinder);
    await tester.pump();
    tester.view.viewInsets = const FakeViewPadding(bottom: keyboard);
    await tester.pumpAndSettle();

    final keyboardTop = screen.height - keyboard;
    final field = tester.getRect(find.byType(CupertinoTextField));
    final button = tester.getRect(find.text('Continuar'));
    expect(field.bottom, lessThanOrEqualTo(keyboardTop));
    expect(field.top, greaterThanOrEqualTo(0));
    expect(button.bottom, lessThanOrEqualTo(keyboardTop));
    expect(button.top, greaterThanOrEqualTo(field.bottom));
    expect(tester.takeException(), isNull);
  });

  testWidgets('iOS OTP suggestion paste fills all six boxes', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: FregoTheme.light().copyWith(platform: TargetPlatform.iOS),
        home: const OtpPage(phoneE164: '+5511999000100'),
      ),
    );
    final fields = find.byType(CupertinoTextField);
    expect(fields, findsNWidgets(6));
    await tester.enterText(fields.first, '847291');
    await tester.pump();
    for (var i = 0; i < 6; i++) {
      expect(
        tester.widget<CupertinoTextField>(fields.at(i)).controller?.text,
        '847291'[i],
      );
    }
  });

  testWidgets('iOS sticky nav bar left-aligns the title and stays above content',
      (tester) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.padding = const FakeViewPadding(top: 47, bottom: 34);
    tester.view.viewPadding = const FakeViewPadding(top: 47, bottom: 34);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: FregoTheme.light().copyWith(platform: TargetPlatform.iOS),
        builder: (context, child) => CupertinoTheme(
          data: FregoTheme.cupertino(Brightness.light),
          child: child!,
        ),
        home: const FregoPage(
          title: 'Loja Teste',
          child: Text('conteúdo da loja'),
        ),
      ),
    );

    expect(find.byType(CupertinoNavigationBar), findsNothing);
    expect(find.text('Loja Teste'), findsNothing);
    final content = tester.getRect(find.text('conteúdo da loja'));
    expect(content.top, greaterThan(47));
  });

  testWidgets('iOS tab page title is sticky and does not sit under the status bar',
      (tester) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.padding = const FakeViewPadding(top: 47, bottom: 34);
    tester.view.viewPadding = const FakeViewPadding(top: 47, bottom: 34);
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: FregoTheme.light().copyWith(platform: TargetPlatform.iOS),
        builder: (context, child) => CupertinoTheme(
          data: FregoTheme.cupertino(Brightness.light),
          child: child!,
        ),
        home: const FregoLargeTitlePage(
          title: 'Lojas',
          slivers: [
            SliverToBoxAdapter(child: Text('lista de lojas')),
          ],
        ),
      ),
    );

    expect(find.byType(CupertinoNavigationBar), findsNothing);
    final title = tester.getRect(find.text('Lojas'));
    final content = tester.getRect(find.text('lista de lojas'));
    expect(title.top, greaterThanOrEqualTo(47));
    expect(title.left, lessThan(24));
    expect(content.top, greaterThan(title.bottom));
    expect(tester.widget<Text>(find.text('Lojas')).style?.fontSize, 34);
  });
}

class FakeShopDetailPage extends StatelessWidget {
  const FakeShopDetailPage({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
