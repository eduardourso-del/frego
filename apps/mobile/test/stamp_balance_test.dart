import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/ui/stamp_balance.dart';

void main() {
  test('cashback is not a carimbo countdown', () {
    expect(
      loyaltyChipLabel(
        remaining: 1,
        type: 'cashback',
        rewardTitle: '10% de cashback',
      ),
      '10% de cashback',
    );
    expect(
      loyaltyChipLabel(remaining: 1, type: 'cashback', rewardTitle: null),
      'Cashback',
    );
    expect(
      loyaltyChipLabel(
        remaining: 3,
        type: 'stamps',
        rewardTitle: 'Café',
      ),
      'Faltam 3 carimbos · Café',
    );
  });

  test('a shop with no carimbo campaign hides the zero chip', () {
    expect(
      showsStampChip({
        'pools': {'stamps': 0},
        'campaigns': [
          {'type': 'cashback'},
        ],
      }),
      isFalse,
    );
    expect(
      showsStampChip({
        'pools': {'stamps': 0},
        'campaigns': <Map<String, dynamic>>[],
      }),
      isFalse,
    );
    expect(
      showsStampChip({
        'pools': {'stamps': 0},
        'campaigns': [
          {'type': 'stamps'},
        ],
      }),
      isTrue,
    );
    expect(
      showsStampChip({
        'pools': {'stamps': 2},
        'campaigns': <Map<String, dynamic>>[],
      }),
      isTrue,
    );
  });
}
