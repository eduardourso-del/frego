import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/explore/cidade_gate_page.dart';
import 'package:frego_mobile/features/explore/city_picker.dart';

void main() {
  testWidgets(
    'the city field stays focused and still when the keyboard opens',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(402, 874);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);

      await tester.pumpWidget(
        MaterialApp(
          home: CidadeGatePage(
            initialCity: const CityChoice(city: 'Nova Odessa', state: 'SP'),
            onPicked: () {},
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));

      final field = find.byType(TextField);
      expect(field, findsOneWidget);
      final before = tester.getRect(field);

      await tester.tap(field);
      await tester.pump();
      expect(tester.binding.focusManager.primaryFocus?.hasFocus, isTrue);

      tester.view.viewInsets = const FakeViewPadding(bottom: 336);
      await tester.pump();

      expect(tester.binding.focusManager.primaryFocus?.hasFocus, isTrue);
      final after = tester.getRect(field);
      expect((after.top - before.top).abs(), lessThan(1));
      expect(tester.takeException(), isNull);
    },
  );
}
