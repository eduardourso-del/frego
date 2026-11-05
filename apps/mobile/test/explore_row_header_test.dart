import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/explore/explore_cards.dart';

void main() {
  testWidgets('explore section title fits beside Ver todas', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: SizedBox(
            width: 360,
            child: ExploreRowHeader(
              title: 'Hamburguerias',
              count: 12,
              prominent: true,
              onSeeAll: _noop,
            ),
          ),
        ),
      ),
    );

    final title = tester.renderObject<RenderParagraph>(
      find.text('Hamburguerias'),
    );
    final style = tester.widget<Text>(find.text('Hamburguerias')).style;
    expect(style?.fontSize, 18);
    // The title keeps the width beside "Ver todas", instead of splitting it
    // with a spacer and ellipsizing a short name.
    expect(title.constraints.maxWidth, greaterThan(100));
  });
}

void _noop() {}
