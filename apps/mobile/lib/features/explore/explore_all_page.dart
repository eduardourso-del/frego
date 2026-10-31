import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/reward_campaign_card.dart';
import '../../ui/stamp_balance.dart';
import '../../ui/voucher_sheet.dart';
import '../shops/campaign_detail_page.dart';
import '../shops/shop_detail_page.dart';
import 'city_picker.dart';
import 'explore_cards.dart';
import 'explore_feed.dart';

/// Vertical list of one Explorar row, in the Relevância order already applied.
class ExploreAllPage extends StatefulWidget {
  const ExploreAllPage({
    super.key,
    required this.title,
    required this.browsing,
    this.places = const [],
    this.campaigns = const [],
  });

  final String title;
  final CityChoice browsing;
  final List<ExplorePlace> places;
  final List<ExploreCampaign> campaigns;

  @override
  State<ExploreAllPage> createState() => _ExploreAllPageState();
}

class _ExploreAllPageState extends State<ExploreAllPage> {
  late List<ExplorePlace> _places;
  late List<ExploreCampaign> _campaigns;
  final Map<String, _ClubCampaign> _club = {};
  bool _redeeming = false;
  bool _clubLoading = false;

  @override
  void initState() {
    super.initState();
    _places = [...widget.places];
    _campaigns = [...widget.campaigns];
    if (widget.places.isEmpty && widget.campaigns.isNotEmpty) {
      _clubLoading = true;
      _loadClub();
    }
  }

  Future<void> _loadClub() async {
    try {
      final res = await fetchMyMemberships();
      final memberships = (res['memberships'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final club = <String, _ClubCampaign>{};
      for (final membership in memberships) {
        final business =
            membership['business'] as Map<String, dynamic>? ?? {};
        final pools = membership['pools'] as Map<String, dynamic>? ?? {};
        final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
        final points = (pools['points'] as num?)?.toInt() ?? 0;
        final stampsExpire = (membership['stampsExpireDays'] as num?)?.toInt() ??
            (business['stampsExpireDays'] as num?)?.toInt();
        final pointsExpire = (membership['pointsExpireDays'] as num?)?.toInt() ??
            (business['pointsExpireDays'] as num?)?.toInt();
        final split = stampDestinationsOf(membership).length > 1;
        final campaigns = (membership['campaigns'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
        for (final campaign in campaigns) {
          final id = campaign['campaignId'] as String?;
          if (id == null || id.isEmpty) continue;
          club[id] = _ClubCampaign(
            business: business,
            campaign: campaign,
            stamps: stamps,
            points: points,
            stampsExpireDays: stampsExpire,
            pointsExpireDays: pointsExpire,
            stampSplit: split,
          );
        }
      }
      if (!mounted) return;
      setState(() {
        _club
          ..clear()
          ..addAll(club);
        _clubLoading = false;
      });
    } catch (_) {
      if (mounted) setState(() => _clubLoading = false);
    }
  }

  Future<void> _toggleFavorite(ExplorePlace place) async {
    final businessId = place.businessId;
    if (businessId.isEmpty) return;
    final next = !place.isFavorite;
    setState(() {
      _places = [
        for (final item in _places)
          if (item.businessId == businessId)
            item.copyWith(isFavorite: next)
          else
            item,
      ];
    });
    try {
      await setFavorite(businessId: businessId, isFavorite: next);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _places = [
          for (final item in _places)
            if (item.businessId == businessId)
              item.copyWith(isFavorite: !next)
            else
              item,
        ];
      });
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _openPlace(ExplorePlace place) async {
    await FregoAdaptive.push(
      context,
      ShopDetailPage(
        businessId: place.businessId,
        explorationCity: widget.browsing.city,
        explorationState: widget.browsing.state,
      ),
    );
  }

  Future<void> _openCampaign(ExploreCampaign campaign) async {
    await FregoAdaptive.push(
      context,
      CampaignDetailPage(
        businessId: campaign.businessId,
        campaignId: campaign.campaignId,
        explorationCity: widget.browsing.city,
        explorationState: widget.browsing.state,
      ),
    );
  }

  Future<void> _redeem(ExploreCampaign campaign) async {
    if (_redeeming || !campaign.canRedeem || campaign.type == 'cashback') {
      return;
    }
    setState(() => _redeeming = true);
    try {
      final body = await redeemCampaign(
        businessId: campaign.businessId,
        campaignId: campaign.campaignId,
      );
      if (!mounted) return;
      final voucher = body['voucherDisplay'] as String? ??
          body['voucherCode'] as String?;
      final reward = body['rewardTitle'] as String? ??
          campaign.rewardTitle ??
          campaign.line;
      if (voucher != null && voucher.isNotEmpty) {
        await showRedeemVoucherSheet(
          context,
          voucherDisplay: voucher,
          rewardTitle: reward,
          shopName: campaign.businessName,
          shopLogoUrl: campaign.logoUrl,
          campaignName: campaign.name,
          expiresAt: body['voucherExpiresAt'] as String?,
          status: body['voucherStatus'] as String?,
        );
      } else if (mounted) {
        FregoAdaptive.showMessage(
          context,
          body['message'] as String? ?? 'Recompensa resgatada',
        );
      }
      if (!mounted) return;
      setState(() {
        _campaigns = [
          for (final item in _campaigns)
            if (item.campaignId != campaign.campaignId) item,
        ];
      });
    } catch (e) {
      if (!mounted) return;
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _redeeming = false);
    }
  }

  String _buttonLabel(ExploreCampaign campaign) {
    if (campaign.canRedeem) return 'Resgatar e mostrar';
    if (campaign.type == 'birthday') return 'Ainda não liberou';
    if (campaign.type == 'promo') return 'Ver promoção';
    final needed = campaign.progressNeeded;
    final current = campaign.progressCurrent;
    if (needed != null && current != null && needed > current) {
      final left = needed - current;
      return left == 1 ? 'Ainda falta 1' : 'Ainda falta $left';
    }
    return 'Continuar acumulando';
  }

  @override
  Widget build(BuildContext context) {
    final places = widget.places.isNotEmpty;
    final count = places ? _places.length : _campaigns.length;
    return FregoPage(
      showNavBar: true,
      child: ListView.separated(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        itemCount: count + 1,
        separatorBuilder: (_, index) =>
            SizedBox(height: index == 0 ? 16 : 12),
        itemBuilder: (context, index) {
          if (index == 0) {
            return Text(
              widget.title,
              style: const TextStyle(
                fontSize: 28,
                height: 1.15,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.4,
                color: FregoColors.ink,
              ),
            );
          }
          final itemIndex = index - 1;
          if (places) {
            final place = _places[itemIndex];
            return ExplorePlaceCard(
              place: place,
              onOpen: () => _openPlace(place),
              onFavorite: () => _toggleFavorite(place),
            );
          }
          final campaign = _campaigns[itemIndex];
          final full = _club[campaign.campaignId];
          if (full != null) {
            return RewardCampaignCard(
              business: full.business,
              campaign: full.campaign,
              stamps: full.stamps,
              points: full.points,
              stampsExpireDays: full.stampsExpireDays,
              pointsExpireDays: full.pointsExpireDays,
              stampSplit: full.stampSplit,
              busy: _redeeming,
              onRedeem: () => _redeem(campaign),
              onOpenShop: () => _openPlace(
                ExplorePlace(
                  businessId: campaign.businessId,
                  isFavorite: campaign.isFavorite,
                  hasMembership: campaign.hasMembership,
                  business: ExploreBusiness(
                    id: campaign.businessId,
                    name: campaign.businessName,
                    type: 'outros',
                    logoUrl: campaign.logoUrl,
                  ),
                ),
              ),
              onOpen: () => _openCampaign(campaign),
            );
          }
          if (_clubLoading) {
            return const SizedBox(
              height: 220,
              child: Center(child: CircularProgressIndicator()),
            );
          }
          final primary = parseHexColor(campaign.primaryColor) ?? 0xFF070707;
          return LoyaltyCampaignCard(
            businessName: campaign.businessName,
            businessLogoUrl: campaign.logoUrl,
            primary: primary,
            primaryDark:
                parseHexColor(campaign.primaryColorDark) ?? primary,
            campaignName: campaign.name,
            campaignType: campaign.type,
            unitsNeeded: campaign.unitsNeeded ?? 0,
            currentUnits: campaign.balance ?? 0,
            rewardTitle: campaign.rewardTitle?.trim().isNotEmpty == true
                ? campaign.rewardTitle!.trim()
                : campaign.line,
            rewardDescription: campaign.rewardDescription,
            rewardImageUrl: campaign.rewardImageUrl,
            canRedeem: campaign.canRedeem,
            buttonLabel: _buttonLabel(campaign),
            cashbackPercent: campaign.cashbackPercent,
            cashbackBalanceCents: campaign.cashbackBalanceCents ?? 0,
            cashbackUseMultiple: campaign.cashbackUseMultiple,
            busy: _redeeming,
            statusHint: campaign.type == 'birthday' && campaign.canRedeem
                ? 'Disponível agora'
                : null,
            onOpenShop: () => _openPlace(
              ExplorePlace(
                businessId: campaign.businessId,
                isFavorite: campaign.isFavorite,
                hasMembership: campaign.hasMembership,
                business: ExploreBusiness(
                  id: campaign.businessId,
                  name: campaign.businessName,
                  type: 'outros',
                  logoUrl: campaign.logoUrl,
                ),
              ),
            ),
            onOpen: () => _openCampaign(campaign),
            onRedeem: campaign.canRedeem && campaign.type != 'cashback'
                ? () => _redeem(campaign)
                : null,
          );
        },
      ),
    );
  }
}

class _ClubCampaign {
  const _ClubCampaign({
    required this.business,
    required this.campaign,
    required this.stamps,
    required this.points,
    required this.stampSplit,
    this.stampsExpireDays,
    this.pointsExpireDays,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> campaign;
  final int stamps;
  final int points;
  final bool stampSplit;
  final int? stampsExpireDays;
  final int? pointsExpireDays;
}
