import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/ui/ready_rewards_card.dart';

void main() {
  test('lists every prêmio she can Resgatar, and skips cashback', () {
    final lines = readyRewardLines([
      {
        'business': {'name': 'Padaria Zé'},
        'campaigns': [
          {
            'type': 'stamps',
            'canRedeem': true,
            'rewardTitle': 'Café',
            'campaignName': 'Cartela',
          },
          {
            'type': 'cashback',
            'canRedeem': false,
            'rewardTitle': '5% de volta',
          },
          {
            'type': 'stamps',
            'canRedeem': false,
            'rewardTitle': 'Pão',
          },
        ],
      },
      {
        'business': {'name': 'Bar do Léo'},
        'campaigns': [
          {
            'type': 'birthday',
            'canRedeem': true,
            'campaignName': 'Aniversário',
          },
        ],
      },
    ]);

    expect(lines, ['Café · Padaria Zé', 'Aniversário · Bar do Léo']);
    expect(readyRewardsTitle(1), 'Você tem 1 prêmio pronto');
    expect(readyRewardsTitle(2), 'Você tem 2 prêmios prontos');
    expect(
      readyRewardsSubtitle(lines),
      'Café · Padaria Zé · e mais 1',
    );
    expect(readyRewardsSubtitle([lines.first]), lines.first);
  });
}
