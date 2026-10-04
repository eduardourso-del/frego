import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/promo_copy.dart';
import '../../ui/skeleton.dart';
import '../../ui/voucher_sheet.dart';
import '../shops/campaign_detail_page.dart';
import '../shops/shop_detail_page.dart';

/// Lista todos os prêmios disponíveis nas lojas do cliente.
class RewardsPage extends StatefulWidget {
  const RewardsPage({super.key, this.refreshToken = 0});

  final int refreshToken;

  @override
  State<RewardsPage> createState() => _RewardsPageState();
}

enum _RewardFilter { all, ready, close }

class _RewardItem {
  const _RewardItem({
    required this.businessId,
    required this.business,
    required this.campaign,
    required this.stamps,
    required this.points,
    required this.stampsExpireDays,
    required this.pointsExpireDays,
  });

  final String businessId;
  final Map<String, dynamic> business;
  final Map<String, dynamic> campaign;
  final int stamps;
  final int points;
  final int? stampsExpireDays;
  final int? pointsExpireDays;

  bool get canRedeem => campaign['canRedeem'] == true;

  String get type => campaign['type'] as String? ?? 'stamps';

  int get needed => (campaign['unitsNeeded'] as num?)?.toInt() ?? 0;

  int get pool {
    if (type == 'spend') return points;
    if (type == 'birthday' || type == 'promo') return canRedeem ? 1 : 0;
    if (type == 'cashback') {
      return (campaign['cashbackBalanceCents'] as num?)?.toInt() ?? 0;
    }
    return stamps;
  }

  int get remaining {
    if (type == 'birthday' || type == 'promo') return canRedeem ? 0 : 1;
    if (type == 'cashback') return 0;
    final n = needed <= 0 ? 1 : needed;
    if (canRedeem) return 0;
    final inCycle = pool % n;
    return (n - inCycle).clamp(0, n);
  }

  bool get isClose {
    if (canRedeem || type == 'birthday' || type == 'cashback' || type == 'promo') {
      return false;
    }
    final n = needed;
    if (n <= 0) return false;
    return remaining > 0 &&
        (remaining <= 3 || remaining <= (n / 2).ceil());
  }
}

class _RewardsPageState extends State<RewardsPage> {
  bool _loading = true;
  bool _hydrated = false;
  bool _redeeming = false;
  String? _error;
  List<_RewardItem> _items = [];
  _RewardFilter _filter = _RewardFilter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant RewardsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) {
      _load();
    }
  }

  Future<void> _load() async {
    final keepContent = _hydrated;
    setState(() {
      if (!keepContent) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final res = await fetchMyMemberships();
      final memberships = (res['memberships'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final items = <_RewardItem>[];
      for (final m in memberships) {
        final businessId = m['businessId'] as String? ?? '';
        final business =
            m['business'] as Map<String, dynamic>? ?? <String, dynamic>{};
        final pools = m['pools'] as Map<String, dynamic>? ?? {};
        final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
        final points = (pools['points'] as num?)?.toInt() ?? 0;
        final stampsExpire =
            (m['stampsExpireDays'] as num?)?.toInt() ??
                (business['stampsExpireDays'] as num?)?.toInt();
        final pointsExpire =
            (m['pointsExpireDays'] as num?)?.toInt() ??
                (business['pointsExpireDays'] as num?)?.toInt();
        final campaigns = (m['campaigns'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
        for (final c in campaigns) {
          items.add(
            _RewardItem(
              businessId: businessId,
              business: business,
              campaign: c,
              stamps: stamps,
              points: points,
              stampsExpireDays: stampsExpire,
              pointsExpireDays: pointsExpire,
            ),
          );
        }
      }
      items.sort((a, b) {
        int rank(_RewardItem i) {
          if (i.type == 'cashback' &&
              i.campaign['lockedReason'] != 'audience') {
            return 0;
          }
          if (i.type != 'cashback') return 1;
          return 2;
        }

        final ra = rank(a);
        final rb = rank(b);
        if (ra != rb) return ra.compareTo(rb);
        if (ra == 0) {
          final pa = (a.campaign['cashbackPercent'] as num?)?.toInt() ?? 0;
          final pb = (b.campaign['cashbackPercent'] as num?)?.toInt() ?? 0;
          if (pb != pa) return pb.compareTo(pa);
        }
        if (a.canRedeem != b.canRedeem) return a.canRedeem ? -1 : 1;
        if (a.isClose != b.isClose) return a.isClose ? -1 : 1;
        return a.remaining.compareTo(b.remaining);
      });
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
        _hydrated = true;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceFirst('Exception: ', '');
      if (keepContent) {
        setState(() => _loading = false);
        FregoAdaptive.showMessage(context, message);
      } else {
        setState(() {
          _error = message;
          _loading = false;
        });
      }
    }
  }

  List<_RewardItem> get _filtered {
    return _items.where((item) {
      return switch (_filter) {
        _RewardFilter.all => true,
        _RewardFilter.ready => item.canRedeem,
        _RewardFilter.close => item.isClose,
      };
    }).toList();
  }

  int get _readyCount => _items.where((i) => i.canRedeem).length;
  int get _closeCount => _items.where((i) => i.isClose).length;

  Future<void> _openShop(String businessId) async {
    await FregoAdaptive.push(
      context,
      ShopDetailPage(businessId: businessId),
    );
    if (mounted) _load();
  }

  Future<void> _redeem(_RewardItem item) async {
    final campaignId = item.campaign['campaignId'] as String?;
    if (campaignId == null || _redeeming) return;
    setState(() => _redeeming = true);
    try {
      final body = await redeemCampaign(
        businessId: item.businessId,
        campaignId: campaignId,
      );
      if (!mounted) return;
      final voucher = body['voucherDisplay'] as String? ??
          body['voucherCode'] as String?;
      final reward = body['rewardTitle'] as String? ??
          item.campaign['rewardTitle'] as String? ??
          'Prêmio';
      final shop = item.business['name'] as String? ?? 'Loja';
      if (voucher != null && voucher.isNotEmpty) {
        await showRedeemVoucherSheet(
          context,
          voucherDisplay: voucher,
          rewardTitle: reward,
          shopName: shop,
          shopLogoUrl: item.business['logoUrl'] as String?,
          campaignName: item.campaign['campaignName'] as String?,
          expiresAt: body['voucherExpiresAt'] as String?,
          status: body['voucherStatus'] as String?,
        );
      } else {
        FregoAdaptive.showMessage(
          context,
          body['message'] as String? ?? 'Recompensa resgatada',
        );
      }
      await _load();
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

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    late final List<Widget> slivers;
    if (_loading && !_hydrated) {
      slivers = const [
        SliverToBoxAdapter(child: FregoRewardsSkeleton()),
      ];
    } else if (_error != null && !_hydrated) {
      slivers = [
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(FregoLargeTitlePage.gutter),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!),
                const SizedBox(height: 16),
                FregoPrimaryButton(
                  label: 'Tentar de novo',
                  onPressed: _load,
                ),
              ],
            ),
          ),
        ),
      ];
    } else {
      slivers = _bodySlivers(filtered: filtered);
    }

    return FregoLargeTitlePage(
      title: 'Prêmios',
      onRefresh: _load,
      slivers: slivers,
    );
  }

  List<Widget> _bodySlivers({
    required List<_RewardItem> filtered,
  }) {
    final children = <Widget>[
      Text(
        _items.isEmpty
            ? 'Quando você acumular em uma loja, os prêmios aparecem aqui.'
            : 'Campanhas das suas lojas — progresso, validade e resgate.',
        style: const TextStyle(
          fontSize: 15,
          height: 1.35,
          color: FregoColors.neutral500,
        ),
      ),
      const SizedBox(height: 16),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _FilterChip(
            label: 'Todos',
            selected: _filter == _RewardFilter.all,
            count: _items.length,
            onTap: () => setState(() => _filter = _RewardFilter.all),
          ),
          _FilterChip(
            label: 'Prontos',
            selected: _filter == _RewardFilter.ready,
            count: _readyCount,
            onTap: () => setState(() => _filter = _RewardFilter.ready),
          ),
          _FilterChip(
            label: 'Quase lá',
            selected: _filter == _RewardFilter.close,
            count: _closeCount,
            onTap: () => setState(() => _filter = _RewardFilter.close),
          ),
        ],
      ),
      const SizedBox(height: 18),
      if (filtered.isEmpty)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: FregoColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: Text(
            _items.isEmpty
                ? 'Nenhum prêmio ainda. Visite uma loja parceira e comece a acumular.'
                : 'Nada neste filtro. Experimente “Todos”.',
            style: const TextStyle(
              fontSize: 14,
              height: 1.4,
              color: FregoColors.neutral500,
            ),
          ),
        )
      else
        ...filtered.map((item) {
          final name = item.business['name'] as String? ?? 'Loja';
          final logoUrl = item.business['logoUrl'] as String?;
          final primary =
              _parseHex(item.business['primaryColor'] as String?) ??
                  0xFF070707;
          final primaryDark =
              _parseHex(item.business['primaryColorDark'] as String?) ??
                  0xFF070707;
          final type = item.type;
          final needed = item.needed <= 0 ? 1 : item.needed;
          final canRedeem = item.canRedeem;
          final expireHint = _expireHint(item);
          final birthdayHint = type == 'birthday'
              ? _birthdayStatusLine(item.campaign)
              : null;
          final promoHint = type == 'promo'
              ? promoStatusLine(
                  lockedReason: item.campaign['lockedReason'] as String?,
                  canRedeem: canRedeem,
                  unlocksAt: item.campaign['unlocksAt'] as String?,
                )
              : null;
          final stampQuotaHint = type == 'stamps'
              ? stampQuotaStatusLine(
                  lockedReason: item.campaign['lockedReason'] as String?,
                  unlocksAt: item.campaign['unlocksAt'] as String?,
                )
              : null;
          final stampFrequency =
              type == 'stamps' ? stampFrequencyLine(item.campaign) : null;
          final audienceEligible = item.campaign['audienceEligible'] == true;
          final audienceLocked = item.campaign['lockedReason'] == 'audience';
          final unlockMessage =
              item.campaign['audienceUnlockMessage'] as String?;
          final statusHint = [
            if (audienceLocked) 'Promo exclusiva para outro perfil',
            if (!audienceLocked && unlockMessage != null) unlockMessage,
            ?birthdayHint,
            ?promoHint,
            ?stampQuotaHint,
            if (stampQuotaHint == null) ?stampFrequency,
            if (!audienceLocked && type != 'promo') ?expireHint,
          ].join(' · ');

          late final String buttonLabel;
          if (type == 'birthday') {
            final locked = item.campaign['lockedReason'] as String?;
            buttonLabel = canRedeem
                ? 'Resgatar e mostrar'
                : locked == 'no_birthday'
                    ? 'Informe seu aniversário'
                    : locked == 'already_redeemed'
                        ? 'Já resgatado este ano'
                        : 'Ainda não liberou';
          } else if (type == 'promo') {
            buttonLabel = promoButtonLabel(
              lockedReason: item.campaign['lockedReason'] as String?,
              canRedeem: canRedeem,
            );
          } else if (type == 'cashback') {
            buttonLabel = audienceLocked ? 'Indisponível pra você' : 'Use no caixa';
          } else if (audienceLocked) {
            buttonLabel = 'Indisponível pra você';
          } else if (item.campaign['lockedReason'] == 'quota_exhausted') {
            buttonLabel = 'Já resgatado';
          } else {
            buttonLabel = canRedeem
                ? 'Resgatar e mostrar'
                : needed > item.pool
                    ? 'Ainda falta ${needed - item.pool}'
                    : 'Continuar acumulando';
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: LoyaltyCampaignCard(
              businessName: name,
              businessLogoUrl: logoUrl,
              primary: primary,
              primaryDark: primaryDark,
              campaignName:
                  item.campaign['campaignName'] as String? ?? 'Campanha',
              campaignType: type,
              unitsNeeded: needed,
              currentUnits: item.pool,
              rewardTitle:
                  item.campaign['rewardTitle'] as String? ?? 'Prêmio',
              rewardDescription:
                  item.campaign['rewardDescription'] as String?,
              rewardImageUrl: item.campaign['rewardImageUrl'] as String?,
              canRedeem: canRedeem,
              buttonLabel: buttonLabel,
              statusHint: statusHint.isEmpty ? null : statusHint,
              pointsPerReal: item.business['pointsPerReal'] as int?,
              cashbackPercent:
                  (item.campaign['cashbackPercent'] as num?)?.toInt(),
              cashbackBalanceCents: item.pool,
              busy: _redeeming,
              promoCalendar:
                  type == 'promo' ? PromoCalendar.fromCampaign(item.campaign) : null,
              audienceUnlocked: audienceEligible && !audienceLocked,
              audienceLabel: unlockMessage ??
                  (audienceEligible
                      ? 'Conquista liberada pra você'
                      : null),
              onRedeem: type == 'cashback' || !canRedeem || _redeeming
                  ? null
                  : () => _redeem(item),
              onOpenShop: () => _openShop(item.businessId),
              onOpen: () async {
                final campaignId =
                    item.campaign['campaignId'] as String?;
                if (campaignId == null) return;
                await FregoAdaptive.push(
                  context,
                  CampaignDetailPage(
                    businessId: item.businessId,
                    campaignId: campaignId,
                  ),
                );
                if (mounted) _load();
              },
            ),
          );
        }),
      const SizedBox(height: 24),
    ];

    return [
      SliverPadding(
        padding: const EdgeInsets.fromLTRB(FregoLargeTitlePage.gutter, 8, FregoLargeTitlePage.gutter, 24),
        sliver: SliverList(
          delegate: SliverChildListDelegate(children),
        ),
      ),
    ];
  }

  String? _expireHint(_RewardItem item) {
    final type = item.type;
    if (type == 'birthday') return null;
    if (type == 'spend') {
      final days = item.pointsExpireDays;
      if (days == null) return null;
      return 'Pontos válidos por $days ${_daysWord(days)}';
    }
    final days = item.stampsExpireDays;
    if (days == null) return null;
    return 'Carimbos válidos por $days ${_daysWord(days)}';
  }

  String _daysWord(int days) => days == 1 ? 'dia' : 'dias';

  String? _birthdayStatusLine(Map<String, dynamic> c) {
    final canRedeem = c['canRedeem'] == true;
    final lockedReason = c['lockedReason'] as String?;
    final daysUntil = (c['daysUntilBirthday'] as num?)?.toInt();
    if (canRedeem) return 'Disponível agora';
    switch (lockedReason) {
      case 'no_birthday':
        return 'Adicione seu aniversário no perfil';
      case 'already_redeemed':
        return 'Já resgatado este ano';
      case 'outside_window':
        if (daysUntil != null && daysUntil > 0) {
          return daysUntil == 1
              ? 'Libera amanhã'
              : 'Libera em $daysUntil dias';
        }
        return 'Fora da janela';
      default:
        return null;
    }
  }

  int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.count,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? FregoColors.primary500 : FregoColors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? FregoColors.primary500 : FregoColors.hairline,
            ),
          ),
          child: Text(
            '$label · $count',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? FregoColors.onPrimary : FregoColors.neutral500,
            ),
          ),
        ),
      ),
    );
  }
}
