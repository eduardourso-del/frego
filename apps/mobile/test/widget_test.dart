import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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
}

class FakeShopDetailPage extends StatelessWidget {
  const FakeShopDetailPage({super.key});

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}
