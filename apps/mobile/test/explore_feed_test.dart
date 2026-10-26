import 'package:flutter_test/flutter_test.dart';
import 'package:frego_mobile/features/explore/explore_feed.dart';

void main() {
  ExplorePlace place({
    required String id,
    required String name,
    String type = 'restaurant',
    bool favorite = false,
    bool member = false,
    String? slogan,
  }) {
    return ExplorePlace(
      businessId: id,
      isFavorite: favorite,
      hasMembership: member,
      business: ExploreBusiness(id: id, name: name, type: type, slogan: slogan),
    );
  }

  ExploreCampaign campaign({
    required String id,
    required String businessId,
    required String businessName,
    required String name,
    String type = 'stamps',
    String? rewardTitle,
    bool canRedeem = false,
    bool favorite = false,
    bool member = false,
    int? unitsNeeded,
    int? balance,
  }) {
    return ExploreCampaign(
      campaignId: id,
      businessId: businessId,
      businessName: businessName,
      name: name,
      type: type,
      rewardTitle: rewardTitle,
      canRedeem: canRedeem,
      isFavorite: favorite,
      hasMembership: member,
      unitsNeeded: unitsNeeded,
      balance: balance,
    );
  }

  ExploreSnapshot sample() {
    return ExploreSnapshot(
      redeemableCount: 1,
      sections: [
        ExploreSection(
          type: 'lanchonete',
          places: [
            place(id: 'ze', name: 'Frango do Zé', type: 'lanchonete', slogan: 'Desde 1990'),
          ],
          campaigns: [
            campaign(
              id: 'cafe',
              businessId: 'ze',
              businessName: 'Frango do Zé',
              name: 'Café grátis',
              rewardTitle: 'Café grátis',
            ),
          ],
        ),
        ExploreSection(
          type: 'restaurant',
          places: [
            place(id: 'casa', name: 'Casa Nova', type: 'restaurant', member: true),
          ],
          campaigns: [
            campaign(
              id: 'frango',
              businessId: 'casa',
              businessName: 'Casa Nova',
              name: 'Frango grátis',
              type: 'promo',
              rewardTitle: 'Frango grátis',
              canRedeem: true,
              member: true,
            ),
          ],
        ),
      ],
    );
  }

  test('search keeps a Campanha without pulling its Estabelecimento', () {
    final visible = visibleSections(
      sample(),
      query: 'frango grátis',
      relation: ExploreRelation.all,
    );
    expect(visible.map((section) => section.type), ['restaurant']);
    expect(visible.single.places, isEmpty);
    expect(visible.single.campaigns.single.campaignId, 'frango');
  });

  test('a matching place hides Campanhas that miss the search', () {
    final visible = visibleSections(
      sample(),
      query: '1990',
      relation: ExploreRelation.all,
    );
    expect(visible.single.type, 'lanchonete');
    expect(visible.single.places.single.businessId, 'ze');
    expect(visible.single.campaigns, isEmpty);
  });

  test('Seu clube keeps the Campanha with its place', () {
    final visible = visibleSections(
      sample(),
      query: '',
      relation: ExploreRelation.club,
    );
    expect(visible.single.type, 'restaurant');
    expect(visible.single.places.single.businessId, 'casa');
    expect(visible.single.campaigns.single.campaignId, 'frango');
  });

  test('stamp progress stays inside the current cycle', () {
    final mid = campaign(
      id: 'lanche',
      businessId: 'ze',
      businessName: 'Zé',
      name: 'Lanche',
      unitsNeeded: 10,
      balance: 13,
    );
    expect(mid.progressCurrent, 3);
    expect(mid.progressNeeded, 10);
    expect(mid.showsStamps, isTrue);
    expect(mid.progressLabel, '3 de 10 carimbos');

    final empty = campaign(
      id: 'cafe',
      businessId: 'ze',
      businessName: 'Zé',
      name: 'Café',
      unitsNeeded: 8,
      balance: 0,
    );
    expect(empty.progressCurrent, 0);
    expect(empty.progressLabel, '0 de 8 carimbos');

    final ready = campaign(
      id: 'lanche',
      businessId: 'ze',
      businessName: 'Zé',
      name: 'Lanche',
      canRedeem: true,
      member: true,
      unitsNeeded: 10,
      balance: 10,
    );
    expect(ready.progressCurrent, 10);
  });

  test('a birthday Campanha says it is aniversário', () {
    final birthday = campaign(
      id: 'bolo',
      businessId: 'ze',
      businessName: 'Zé',
      name: 'Bolo',
      type: 'birthday',
      rewardTitle: 'Bolo grátis',
    );
    expect(birthday.kindLabel, 'Aniversário');
    expect(birthday.line, 'Bolo grátis');
    expect(birthday.detailLine, 'No aniversário · 1× ao ano');

    final ready = campaign(
      id: 'bolo',
      businessId: 'ze',
      businessName: 'Zé',
      name: 'Bolo',
      type: 'birthday',
      rewardTitle: 'Bolo grátis',
      canRedeem: true,
    );
    expect(ready.detailLine, 'Disponível agora · 1× ao ano');
  });

  test('card copy follows the count', () {
    expect(redeemCardLabel(1), '1 campanha para resgatar');
    expect(redeemCardLabel(3), '3 campanhas para resgatar');
  });

  test('Ver todas appears after eight cards', () {
    expect(showsSeeAll(8), isFalse);
    expect(showsSeeAll(9), isTrue);
    expect(previewOf(List.generate(9, (i) => i)), List.generate(8, (i) => i));
  });

  test('cashback never counts as Resgatar', () {
    final feed = parseExplorationFeed({
      'redeemableCount': 0,
      'sections': [
        {
          'type': 'café',
          'places': [],
          'campaigns': [
            {
              'campaignId': 'cash',
              'businessId': 'cafe',
              'businessName': 'Café',
              'name': 'Cashback',
              'type': 'cashback',
              'cashbackPercent': 10,
              'canRedeem': true,
            },
          ],
        },
      ],
    });
    expect(feed.sections.single.campaigns.single.canRedeem, isFalse);
    expect(feed.sections.single.campaigns.single.line, '10% de cashback');
  });
}
