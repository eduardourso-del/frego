import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/explore/city_picker.dart';

void main() {
  test('search folds accents and stops at the limit', () {
    final catalog = CityCatalog(const [
      CityChoice(city: 'São Paulo', state: 'SP'),
      CityChoice(city: 'Campinas', state: 'SP'),
      CityChoice(city: 'Campina Grande', state: 'PB'),
      CityChoice(city: 'Santos', state: 'SP'),
    ]);

    expect(catalog.search('sao').map((city) => city.city).toList(), [
      'São Paulo',
    ]);
    expect(
      catalog.search('camp', limit: 1).map((city) => city.label).toList(),
      ['Campinas, SP'],
    );
    expect(catalog.search('').length, 4);
  });

  testWidgets('selecting a searched city closes the picker', (tester) async {
    CityChoice? picked;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              picked = await Navigator.of(context).push<CityChoice>(
                MaterialPageRoute(
                  builder: (_) => const CityPickerPage(
                    title: 'Cidade',
                    subtitle: 'Escolha',
                    cities: [
                      CityChoice(city: 'Campinas', state: 'SP'),
                      CityChoice(city: 'Campina Grande', state: 'PB'),
                      CityChoice(city: 'Santos', state: 'SP'),
                    ],
                  ),
                ),
              );
            },
            child: const Text('open'),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'camp');
    await tester.pump();
    await tester.tap(find.text('Campinas, SP'));
    await tester.pump();
    await tester.pumpAndSettle();

    expect(picked?.city, 'Campinas');
    expect(picked?.state, 'SP');
    expect(find.text('Cidade'), findsNothing);
  });
}
