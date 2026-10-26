import 'package:frego_tokens/frego_tokens.dart';

/// How many cards a row shows before Ver todas.
const explorePreviewLimit = 8;

enum ExploreRelation { all, favorites, club, discover }

class ExploreBusiness {
  const ExploreBusiness({
    required this.id,
    required this.name,
    required this.type,
    this.slogan,
    this.logoUrl,
    this.heroImageUrl,
    this.primaryColor,
    this.primaryColorDark,
  });

  final String id;
  final String name;
  final String type;
  final String? slogan;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? primaryColor;
  final String? primaryColorDark;
}

class ExplorePlace {
  const ExplorePlace({
    required this.businessId,
    required this.isFavorite,
    required this.hasMembership,
    required this.business,
  });

  final String businessId;
  final bool isFavorite;
  final bool hasMembership;
  final ExploreBusiness business;

  ExplorePlace copyWith({bool? isFavorite}) {
    return ExplorePlace(
      businessId: businessId,
      isFavorite: isFavorite ?? this.isFavorite,
      hasMembership: hasMembership,
      business: business,
    );
  }
}

class ExploreCampaign {
  const ExploreCampaign({
    required this.campaignId,
    required this.businessId,
    required this.businessName,
    required this.name,
    required this.type,
    required this.canRedeem,
    required this.isFavorite,
    required this.hasMembership,
    this.logoUrl,
    this.rewardTitle,
    this.rewardDescription,
    this.rewardImageUrl,
    this.cashbackPercent,
    this.unitsNeeded,
    this.balance,
    this.cashbackBalanceCents,
    this.primaryColor,
    this.primaryColorDark,
  });

  final String campaignId;
  final String businessId;
  final String businessName;
  final String? logoUrl;
  final String name;
  final String type;
  final String? rewardTitle;
  final String? rewardDescription;
  final String? rewardImageUrl;
  final int? cashbackPercent;
  final int? unitsNeeded;
  final int? balance;
  final int? cashbackBalanceCents;
  final String? primaryColor;
  final String? primaryColorDark;
  final bool canRedeem;
  final bool isFavorite;
  final bool hasMembership;

  ExploreCampaign copyWith({bool? isFavorite}) {
    return ExploreCampaign(
      campaignId: campaignId,
      businessId: businessId,
      businessName: businessName,
      name: name,
      type: type,
      canRedeem: canRedeem,
      isFavorite: isFavorite ?? this.isFavorite,
      hasMembership: hasMembership,
      logoUrl: logoUrl,
      rewardTitle: rewardTitle,
      rewardDescription: rewardDescription,
      rewardImageUrl: rewardImageUrl,
      cashbackPercent: cashbackPercent,
      unitsNeeded: unitsNeeded,
      balance: balance,
      cashbackBalanceCents: cashbackBalanceCents,
      primaryColor: primaryColor,
      primaryColorDark: primaryColorDark,
    );
  }

  /// Prêmio title, or the cashback line.
  String get line {
    if (type == 'cashback' && (cashbackPercent ?? 0) > 0) {
      return '$cashbackPercent% de cashback';
    }
    final title = rewardTitle?.trim();
    if (title != null && title.isNotEmpty) return title;
    return name;
  }

  /// What kind of Campanha this is, in the words the Cliente already sees.
  String get kindLabel {
    switch (type) {
      case 'birthday':
        return 'Aniversário';
      case 'spend':
      case 'points':
        return 'Pontos';
      case 'cashback':
        return 'Cashback';
      case 'promo':
        return 'Promoção';
      case 'visits':
        return 'Visitas';
      default:
        return 'Carimbos';
    }
  }

  /// One extra line when the prize title does not say what the Campanha is.
  String? get detailLine {
    if (type == 'birthday') {
      return canRedeem
          ? 'Disponível agora · 1× ao ano'
          : 'No aniversário · 1× ao ano';
    }
    final title = rewardTitle?.trim() ?? '';
    final campaignName = name.trim();
    if (title.isNotEmpty &&
        campaignName.isNotEmpty &&
        campaignName != title &&
        line != campaignName) {
      return campaignName;
    }
    return null;
  }

  /// Stamp or points progress for a Cliente who already has this Clube.
  int? get progressNeeded {
    if (unitsNeeded == null || balance == null) return null;
    if (type == 'promo' || type == 'birthday' || type == 'cashback') {
      return null;
    }
    return unitsNeeded! <= 0 ? 1 : unitsNeeded;
  }

  int? get progressCurrent {
    final needed = progressNeeded;
    if (needed == null || balance == null) return null;
    if (canRedeem) return needed;
    return balance! % needed;
  }

  bool get showsStamps => type == 'stamps' || type == 'visits';

  String? get progressLabel {
    final current = progressCurrent;
    final needed = progressNeeded;
    if (current == null || needed == null) return null;
    if (canRedeem) return 'Pronto para resgatar';
    final unit = switch (type) {
      'spend' || 'points' => 'pontos',
      'visits' => 'visitas',
      _ => 'carimbos',
    };
    return '$current de $needed $unit';
  }
}

class ExploreSection {
  const ExploreSection({
    required this.type,
    required this.places,
    required this.campaigns,
  });

  final String type;
  final List<ExplorePlace> places;
  final List<ExploreCampaign> campaigns;
}

class ExploreSnapshot {
  const ExploreSnapshot({
    required this.redeemableCount,
    required this.sections,
  });

  final int redeemableCount;
  final List<ExploreSection> sections;

  static const empty = ExploreSnapshot(redeemableCount: 0, sections: []);

  int get placeCount =>
      sections.fold(0, (sum, section) => sum + section.places.length);

  /// Flips Favorito on every card for this Estabelecimento, before the save returns.
  ExploreSnapshot withFavorite(String businessId, bool isFavorite) {
    return ExploreSnapshot(
      redeemableCount: redeemableCount,
      sections: [
        for (final section in sections)
          ExploreSection(
            type: section.type,
            places: [
              for (final place in section.places)
                place.businessId == businessId
                    ? place.copyWith(isFavorite: isFavorite)
                    : place,
            ],
            campaigns: [
              for (final campaign in section.campaigns)
                campaign.businessId == businessId
                    ? campaign.copyWith(isFavorite: isFavorite)
                    : campaign,
            ],
          ),
      ],
    );
  }
}

class VisibleSection {
  const VisibleSection({
    required this.type,
    required this.places,
    required this.campaigns,
  });

  final String type;
  final List<ExplorePlace> places;
  final List<ExploreCampaign> campaigns;
}

ExploreSnapshot parseExplorationFeed(Map<String, dynamic> body) {
  final sections = (body['sections'] as List<dynamic>? ?? [])
      .whereType<Map<String, dynamic>>()
      .map(_section)
      .toList();
  final count = (body['redeemableCount'] as num?)?.toInt() ??
      sections.fold<int>(
        0,
        (sum, section) =>
            sum + section.campaigns.where((campaign) => campaign.canRedeem).length,
      );
  return ExploreSnapshot(redeemableCount: count, sections: sections);
}

String redeemCardLabel(int count) {
  final noun = count == 1 ? 'campanha' : 'campanhas';
  return '$count $noun para resgatar';
}

String redeemCampaignLine(ExploreCampaign campaign) =>
    '${campaign.line} · ${campaign.businessName}';

List<ExploreCampaign> redeemableCampaigns(ExploreSnapshot snapshot) {
  return [
    for (final section in snapshot.sections)
      for (final campaign in section.campaigns)
        if (campaign.canRedeem) campaign,
  ];
}

String placeRowTitle(String type) => FregoBusinessTypes.pluralOf(type);

String campaignAllTitle(String type) =>
    'Campanhas em ${FregoBusinessTypes.pluralOf(type).toLowerCase()}';

bool showsSeeAll(int count) => count > explorePreviewLimit;

List<T> previewOf<T>(List<T> items) => items.length <= explorePreviewLimit
    ? items
    : items.sublist(0, explorePreviewLimit);

/// Search and chips narrow the rows the API already ordered.
/// A Campanha title does not pull its Estabelecimento into the place row.
List<VisibleSection> visibleSections(
  ExploreSnapshot snapshot, {
  required String query,
  required ExploreRelation relation,
}) {
  final text = query.trim().toLowerCase();
  final visible = <VisibleSection>[];
  for (final section in snapshot.sections) {
    final places = section.places
        .where(
          (place) =>
              _matchesRelation(
                favorite: place.isFavorite,
                member: place.hasMembership,
                relation: relation,
              ) &&
              _matchesPlace(place, text),
        )
        .toList();
    final campaigns = section.campaigns
        .where(
          (campaign) =>
              _matchesRelation(
                favorite: campaign.isFavorite,
                member: campaign.hasMembership,
                relation: relation,
              ) &&
              _matchesCampaign(campaign, text),
        )
        .toList();
    if (places.isEmpty && campaigns.isEmpty) continue;
    visible.add(
      VisibleSection(type: section.type, places: places, campaigns: campaigns),
    );
  }
  return visible;
}

ExploreSection _section(Map<String, dynamic> raw) {
  return ExploreSection(
    type: raw['type'] as String? ?? 'outros',
    places: (raw['places'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(_place)
        .toList(),
    campaigns: (raw['campaigns'] as List<dynamic>? ?? [])
        .whereType<Map<String, dynamic>>()
        .map(_campaign)
        .toList(),
  );
}

ExplorePlace _place(Map<String, dynamic> raw) {
  final business = raw['business'] as Map<String, dynamic>? ?? {};
  final type = business['type'] as String? ?? raw['type'] as String? ?? 'outros';
  return ExplorePlace(
    businessId: raw['businessId'] as String? ?? '',
    isFavorite: raw['isFavorite'] == true,
    hasMembership: raw['hasMembership'] == true,
    business: ExploreBusiness(
      id: business['id'] as String? ?? raw['businessId'] as String? ?? '',
      name: business['name'] as String? ?? 'Estabelecimento',
      type: type,
      slogan: business['slogan'] as String?,
      logoUrl: business['logoUrl'] as String?,
      heroImageUrl: business['heroImageUrl'] as String?,
      primaryColor: business['primaryColor'] as String?,
      primaryColorDark: business['primaryColorDark'] as String?,
    ),
  );
}

ExploreCampaign _campaign(Map<String, dynamic> raw) {
  return ExploreCampaign(
    campaignId: raw['campaignId'] as String? ?? '',
    businessId: raw['businessId'] as String? ?? '',
    businessName: raw['businessName'] as String? ?? 'Estabelecimento',
    logoUrl: raw['logoUrl'] as String?,
    name: raw['name'] as String? ?? 'Campanha',
    type: raw['type'] as String? ?? 'stamps',
    rewardTitle: raw['rewardTitle'] as String?,
    rewardDescription: raw['rewardDescription'] as String?,
    rewardImageUrl: raw['rewardImageUrl'] as String?,
    cashbackPercent: (raw['cashbackPercent'] as num?)?.toInt(),
    unitsNeeded: (raw['unitsNeeded'] as num?)?.toInt(),
    balance: (raw['balance'] as num?)?.toInt(),
    cashbackBalanceCents: (raw['cashbackBalanceCents'] as num?)?.toInt(),
    primaryColor: raw['primaryColor'] as String?,
    primaryColorDark: raw['primaryColorDark'] as String?,
    canRedeem: raw['canRedeem'] == true && raw['type'] != 'cashback',
    isFavorite: raw['isFavorite'] == true,
    hasMembership: raw['hasMembership'] == true,
  );
}

bool _matchesRelation({
  required bool favorite,
  required bool member,
  required ExploreRelation relation,
}) {
  return switch (relation) {
    ExploreRelation.all => true,
    ExploreRelation.favorites => favorite,
    ExploreRelation.club => member,
    ExploreRelation.discover => !member,
  };
}

bool _matchesPlace(ExplorePlace place, String query) {
  if (query.isEmpty) return true;
  final type = place.business.type;
  return place.business.name.toLowerCase().contains(query) ||
      (place.business.slogan ?? '').toLowerCase().contains(query) ||
      type.toLowerCase().contains(query) ||
      FregoBusinessTypes.labelOf(type).toLowerCase().contains(query) ||
      FregoBusinessTypes.pluralOf(type).toLowerCase().contains(query);
}

bool _matchesCampaign(ExploreCampaign campaign, String query) {
  if (query.isEmpty) return true;
  return campaign.businessName.toLowerCase().contains(query) ||
      campaign.name.toLowerCase().contains(query) ||
      campaign.line.toLowerCase().contains(query);
}
