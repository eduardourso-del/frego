import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/main.dart';

void main() {
  testWidgets('Shell inicial do Frego carrega', (tester) async {
    await tester.pumpWidget(const FregoApp());
    expect(find.text('Frego'), findsOneWidget);
  });
}
