import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/balance_lots_section.dart';
import '../../ui/campaign_order.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/promo_copy.dart';
import '../../ui/skeleton.dart';
import '../../ui/voucher_sheet.dart';
import 'campaign_detail_page.dart';
import 'earn_detail_page.dart';
import 'shop_balance_page.dart';

class ShopDetailPage extends StatefulWidget {
  const ShopDetailPage({
    super.key,
    required this.businessId,
  });

  final String businessId;

  @override
  State<ShopDetailPage> createState() => _ShopDetailPageState();
}

class _ShopDetailPageState extends State<ShopDetailPage> {
  bool _loading = true;
  bool _redeeming = false;
  bool _togglingFavorite = false;
  String? _error;
  Map<String, dynamic>? _data;
  bool _isFavorite = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final keepContent = _data != null;
    setState(() {
      if (!keepContent) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final data = await fetchMyWallet(businessId: widget.businessId);
      if (!mounted) return;
      final membership = data['membership'] as Map<String, dynamic>?;
      setState(() {
        _data = data;
        _isFavorite = membership?['isFavorite'] == true;
        _loading = false;
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

  Future<void> _toggleFavorite() async {
    if (_togglingFavorite) return;
    final next = !_isFavorite;
    setState(() {
      _togglingFavorite = true;
      _isFavorite = next;
    });
    try {
      await setMembershipFavorite(
        businessId: widget.businessId,
        isFavorite: next,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _isFavorite = !next);
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _togglingFavorite = false);
    }
  }

  Future<void> _redeem(Map<String, dynamic> campaign) async {
    final campaignId = campaign['campaignId'] as String?;
    if (campaignId == null) return;

    setState(() => _redeeming = true);
    try {
      final body = await redeemCampaign(
        businessId: widget.businessId,
        campaignId: campaignId,
      );
      if (!mounted) return;
      setState(() {
        _data = {
          ...?_data,
          'wallet': body['wallet'],
          'pools': body['pools'],
          'campaigns': body['campaigns'],
        };
      });
      final voucher = body['voucherDisplay'] as String? ??
          body['voucherCode'] as String?;
      final reward = body['rewardTitle'] as String? ??
          campaign['rewardTitle'] as String? ??
          'Prêmio';
      final business = _data?['business'] as Map?;
      final shop = business?['name'] as String? ?? 'Loja';
      if (voucher != null && voucher.isNotEmpty) {
        await showRedeemVoucherSheet(
          context,
          voucherDisplay: voucher,
          rewardTitle: reward,
          shopName: shop,
          shopLogoUrl: business?['logoUrl'] as String?,
          campaignName: campaign['campaignName'] as String?,
          expiresAt: body['voucherExpiresAt'] as String?,
          status: body['voucherStatus'] as String?,
        );
      } else {
        FregoAdaptive.showMessage(
          context,
          body['message'] as String? ?? 'Recompensa resgatada',
        );
      }
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
    final business = _data?['business'] as Map<String, dynamic>?;
    final pools = (_data?['pools'] as Map<String, dynamic>?) ??
        (_data?['wallet'] as Map<String, dynamic>?)?['pools']
            as Map<String, dynamic>? ??
        {'stamps': 0, 'points': 0};
    final campaigns = sortCampaignsForCustomer(
      ((_data?['campaigns'] as List<dynamic>?) ??
              (_data?['wallet'] as Map<String, dynamic>?)?['campaigns']
                  as List<dynamic>? ??
              [])
          .cast<Map<String, dynamic>>(),
      campaignOf: (c) => c,
    );
    final lots = ((_data?['wallet'] as Map<String, dynamic>?)?['lots']
                as List<dynamic>? ??
            _data?['lots'] as List<dynamic>? ??
            [])
        .cast<Map<String, dynamic>>();
    final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
    final points = (pools['points'] as num?)?.toInt() ?? 0;
    final cashbackCents = (pools['cashbackCents'] as num?)?.toInt() ?? 0;
    final wallet = _data?['wallet'] as Map<String, dynamic>?;
    final stampsExpireDays = (wallet?['stampsExpireDays'] as num?)?.toInt() ??
        (business?['stampsExpireDays'] as num?)?.toInt();
    final pointsExpireDays = (wallet?['pointsExpireDays'] as num?)?.toInt() ??
        (business?['pointsExpireDays'] as num?)?.toInt();
    final primary = _parseHex(business?['primaryColor'] as String?) ?? 0xFF3B5BDB;
    final primaryDark =
        _parseHex(business?['primaryColorDark'] as String?) ?? 0xFF2F49C4;
    final cupertino = FregoAdaptive.useCupertino(context);

    return FregoPage(
      showNavBar: true,
      title: 'Loja',
      trailing: cupertino
          ? CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: _loading || _togglingFavorite ? null : _toggleFavorite,
              child: Icon(
                _isFavorite
                    ? FregoIcons.favoriteFilled
                    : FregoIcons.favorite,
                color: _isFavorite
                    ? FregoColors.danger
                    : FregoColors.ink,
              ),
            )
          : IconButton(
              onPressed: _loading || _togglingFavorite ? null : _toggleFavorite,
              tooltip: _isFavorite ? 'Remover dos favoritos' : 'Favoritar',
              icon: Icon(
                _isFavorite
                    ? FregoIcons.favoriteFilled
                    : FregoIcons.favorite,
                color: _isFavorite
                    ? FregoColors.danger
                    : FregoColors.ink,
              ),
            ),
      child: _loading && _data == null
          ? const FregoDetailSkeleton()
          : _error != null && _data == null
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(_error!),
                    const SizedBox(height: 16),
                    FregoPrimaryButton(
                      label: 'Tentar de novo',
                      onPressed: _load,
                    ),
                  ],
                )
              : _buildContent(
                  cupertino: cupertino,
                  business: business,
                  stamps: stamps,
                  points: points,
                  cashbackCents: cashbackCents,
                  stampsExpireDays: stampsExpireDays,
                  pointsExpireDays: pointsExpireDays,
                  lots: lots,
                  campaigns: campaigns,
                  badges: (_data?['badges'] as List<dynamic>? ?? [])
                      .cast<Map<String, dynamic>>(),
                  primary: primary,
                  primaryDark: primaryDark,
                ),
    );
  }

  Widget _buildContent({
    required bool cupertino,
    required Map<String, dynamic>? business,
    required int stamps,
    required int points,
    required int cashbackCents,
    required int? stampsExpireDays,
    required int? pointsExpireDays,
    required List<Map<String, dynamic>> lots,
    required List<Map<String, dynamic>> campaigns,
    required List<Map<String, dynamic>> badges,
    required int primary,
    required int primaryDark,
  }) {
    final name = business?['name'] as String? ?? 'Sua loja';
    final slogan = business?['slogan'] as String?;
    final typeLabel = FregoBusinessTypes.labelOf(business?['type'] as String?);
    final logoUrl = business?['logoUrl'] as String?;
    final heroImageUrl = business?['heroImageUrl'] as String?;
    final locations = (business?['locations'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final letter = name.trim().isEmpty ? 'V' : name.trim()[0].toUpperCase();
    final addressLine = _primaryAddressLine(locations);
    final hasHero = heroImageUrl != null && heroImageUrl.isNotEmpty;
    final earnKinds = earnKindsFromCampaigns(campaigns);

    final expiryLine = _balanceExpiryLine(
      stampsExpireDays:
          earnKinds.contains('stamps') || stamps > 0 ? stampsExpireDays : null,
      pointsExpireDays:
          earnKinds.contains('points') || points > 0 ? pointsExpireDays : null,
    );

    final brandHeader = Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
      decoration: BoxDecoration(
        borderRadius: hasHero
            ? const BorderRadius.vertical(bottom: Radius.circular(16))
            : BorderRadius.circular(16),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(primary),
            Color(primaryDark),
          ],
        ),
        boxShadow: hasHero
            ? null
            : [
                BoxShadow(
                  color: Color(primary).withValues(alpha: 0.2),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Identity only — logo + name/slogan side by side
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _ShopLogo(
                letter: letter,
                logoUrl: logoUrl,
                size: 56,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.3,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      typeLabel,
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.72),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.04,
                      ),
                    ),
                    if (slogan != null && slogan.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        slogan,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.88),
                          fontSize: 13,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          // Meta full-width — address, balance, expiry
          if (addressLine != null) ...[
            const SizedBox(height: 14),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.only(top: 1),
                  child: Icon(
                    FregoIcons.location,
                    size: 14,
                    color: Colors.white.withValues(alpha: 0.85),
                  ),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    addressLine,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 13,
                      height: 1.35,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (earnKinds.contains('stamps') || stamps > 0)
                _MiniStat(label: 'Carimbos', value: '$stamps'),
              if (earnKinds.contains('points') || points > 0)
                _MiniStat(label: 'Pontos', value: '$points'),
              if (earnKinds.contains('cashback') || cashbackCents > 0)
                _MiniStat(
                  label: 'Cashback',
                  value:
                      'R\$ ${(cashbackCents / 100).toStringAsFixed(2).replaceAll('.', ',')}',
                ),
            ],
          ),
          if (expiryLine != null) ...[
            const SizedBox(height: 10),
            Text(
              expiryLine,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.78),
                fontSize: 12,
                height: 1.3,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ],
      ),
    );

    final achievementBadge = badges.isEmpty
        ? null
        : () {
            final b = badges.first;
            final title = b['badgeTitle'] as String? ?? 'Cliente da casa';
            final message = b['badgeMessage'] as String? ??
                'A loja reconhece você — condições especiais liberadas.';
            final unlocked =
                (b['unlockedCampaignCount'] as num?)?.toInt() ?? 0;
            return _ShopAchievementBadge(
              title: title,
              message: message,
              unlockedCampaignCount: unlocked,
              accent: Color(primary),
            );
          }();

    final bodyChildren = <Widget>[
      // Compact shop header — optional hero + brand + address + balance
      if (hasHero)
        DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: Color(primary).withValues(alpha: 0.2),
                blurRadius: 14,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Image.network(
                    heroImageUrl,
                    fit: BoxFit.cover,
                    loadingBuilder: (context, child, progress) {
                      if (progress == null) return child;
                      return const ColoredBox(color: FregoColors.neutral200);
                    },
                    errorBuilder: (_, __, ___) => const ColoredBox(
                      color: FregoColors.neutral200,
                    ),
                  ),
                ),
                brandHeader,
              ],
            ),
          ),
        )
      else
        brandHeader,
      if (achievementBadge != null) ...[
        const SizedBox(height: 12),
        achievementBadge,
      ],
      if (lots.isNotEmpty ||
          stampsExpireDays != null ||
          pointsExpireDays != null) ...[
        const SizedBox(height: 20),
        BalanceLotsSection(
          lots: lots,
          previewLimit: 3,
          onSeeMore: lots.isEmpty
              ? null
              : () {
                  FregoAdaptive.push(
                    context,
                    ShopBalancePage(
                      businessId: widget.businessId,
                      shopName: name,
                      initialLots: lots,
                    ),
                  );
                },
          onLotTap: (lot) async {
            await FregoAdaptive.push(
              context,
              EarnDetailPage(
                businessId: widget.businessId,
                unitKind: normalizeEarnKind(lot['unitKind'] as String?),
                quantity: (lot['quantity'] as num?)?.toInt(),
              ),
            );
            if (mounted) _load();
          },
          emptyLabel: stamps == 0 && points == 0 && cashbackCents == 0
              ? 'Sem saldo nesta loja no momento.'
              : 'Seu saldo atual não tem data de validade.',
        ),
      ],
      const SizedBox(height: 20),
      const Text(
        'Suas campanhas',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.04,
          color: FregoColors.neutral400,
        ),
      ),
      const SizedBox(height: 4),
      Text(
        campaigns.any((c) => c['type'] == 'cashback')
            ? 'Cashback primeiro — o saldo é descontado no caixa. Depois, carimbos e pontos.'
            : 'O mesmo cartão que a loja configura — progresso e prêmio ao vivo.',
        style: const TextStyle(
          fontSize: 13,
          height: 1.35,
          color: FregoColors.neutral500,
        ),
      ),
      const SizedBox(height: 12),
      if (campaigns.isEmpty)
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: FregoColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: const Text(
            'Nenhuma campanha ativa nesta loja no momento.',
            style: TextStyle(color: FregoColors.neutral500),
          ),
        )
      else
        ...campaigns.map((c) {
          final canRedeem = c['canRedeem'] == true;
          final type = c['type'] as String? ?? 'stamps';
          final needed = (c['unitsNeeded'] as num?)?.toInt() ?? 0;
          final isCashback = type == 'cashback';
          final cashbackBalance =
              (c['cashbackBalanceCents'] as num?)?.toInt() ?? cashbackCents;
          final pool = type == 'spend'
              ? points
              : isCashback
                  ? cashbackBalance
                  : stamps;
          final isBirthday = type == 'birthday';
          final isPromo = type == 'promo';
          final lockedReason = c['lockedReason'] as String?;
          final daysUntil = (c['daysUntilBirthday'] as num?)?.toInt();
          final unlocksAt = c['unlocksAt'] as String?;
          final campaignId = c['campaignId'] as String? ?? '';

          late final String buttonLabel;
          String? statusHint;
          final audienceEligible = c['audienceEligible'] == true;
          final audienceLocked = c['lockedReason'] == 'audience';
          final unlockMessage = c['audienceUnlockMessage'] as String?;
          if (isBirthday) {
            statusHint = _birthdayStatusLine(
              lockedReason: lockedReason,
              daysUntil: daysUntil,
              unlocksAt: unlocksAt,
              canRedeem: canRedeem,
            );
            buttonLabel = canRedeem
                ? 'Resgatar e mostrar'
                : lockedReason == 'no_birthday'
                    ? 'Informe seu aniversário'
                    : lockedReason == 'already_redeemed'
                        ? 'Já resgatado este ano'
                        : 'Ainda não liberou';
          } else if (isPromo) {
            statusHint = promoStatusLine(
              lockedReason: lockedReason,
              canRedeem: canRedeem,
              unlocksAt: unlocksAt,
            );
            buttonLabel = promoButtonLabel(
              lockedReason: lockedReason,
              canRedeem: canRedeem,
            );
          } else if (isCashback) {
            statusHint = audienceLocked
                ? 'Promo exclusiva para outro perfil de cliente'
                : (unlockMessage ?? 'O saldo é descontado no caixa da loja');
            buttonLabel = audienceLocked ? 'Indisponível pra você' : 'Use no caixa';
          } else if (audienceLocked) {
            statusHint = 'Promo exclusiva para outro perfil de cliente';
            buttonLabel = 'Indisponível pra você';
          } else {
            final expireDays =
                type == 'spend' ? pointsExpireDays : stampsExpireDays;
            if (unlockMessage != null && unlockMessage.isNotEmpty) {
              statusHint = unlockMessage;
            } else if (expireDays != null) {
              statusHint = type == 'spend'
                  ? 'Pontos válidos por $expireDays ${_daysWord(expireDays)}'
                  : 'Carimbos válidos por $expireDays ${_daysWord(expireDays)}';
            }
            buttonLabel = canRedeem
                ? 'Resgatar e mostrar'
                : needed > pool
                    ? 'Ainda falta ${needed - pool}'
                    : 'Continuar acumulando';
          }

          return Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: LoyaltyCampaignCard(
              businessName: name,
              businessLogoUrl: logoUrl,
              primary: primary,
              primaryDark: primaryDark,
              campaignName: c['campaignName'] as String? ?? 'Campanha',
              campaignType: type,
              unitsNeeded: needed <= 0 ? 1 : needed,
              currentUnits: pool,
              rewardTitle: c['rewardTitle'] as String? ?? 'Prêmio',
              rewardDescription: c['rewardDescription'] as String?,
              rewardImageUrl: c['rewardImageUrl'] as String?,
              canRedeem: canRedeem,
              buttonLabel: buttonLabel,
              statusHint: statusHint,
              pointsPerReal: business?['pointsPerReal'] as int?,
              cashbackPercent: (c['cashbackPercent'] as num?)?.toInt(),
              cashbackBalanceCents: cashbackBalance,
              busy: _redeeming,
              promoCalendar:
                  isPromo ? PromoCalendar.fromCampaign(c) : null,
              audienceUnlocked: audienceEligible && !audienceLocked,
              audienceLabel: unlockMessage ??
                  (audienceEligible ? 'Conquista liberada pra você' : null),
              onRedeem: isCashback || !canRedeem || _redeeming
                  ? null
                  : () => _redeem(c),
              onOpen: campaignId.isEmpty
                  ? null
                  : () async {
                      await FregoAdaptive.push(
                        context,
                        CampaignDetailPage(
                          businessId: widget.businessId,
                          campaignId: campaignId,
                        ),
                      );
                      if (mounted) _load();
                    },
            ),
          );
        }),
    ];

    if (cupertino) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          CupertinoSliverRefreshControl(onRefresh: _load),
          SliverPadding(
            padding: const EdgeInsets.all(24),
            sliver: SliverList(
              delegate: SliverChildListDelegate(bodyChildren),
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        children: bodyChildren,
      ),
    );
  }

  String? _primaryAddressLine(List<Map<String, dynamic>> locations) {
    for (final loc in locations) {
      final address = (loc['address'] as String?)?.trim() ?? '';
      if (address.isEmpty) continue;
      final locName = (loc['name'] as String?)?.trim();
      final closed = loc['isOpen'] == false;
      final base = locName != null &&
              locName.isNotEmpty &&
              locations.length > 1
          ? '$locName · $address'
          : address;
      return closed ? '$base · fechado' : base;
    }
    return null;
  }

  String? _balanceExpiryLine({
    required int? stampsExpireDays,
    required int? pointsExpireDays,
  }) {
    final parts = <String>[];
    if (stampsExpireDays != null) {
      parts.add('Carimbos: $stampsExpireDays ${_daysWord(stampsExpireDays)}');
    }
    if (pointsExpireDays != null) {
      parts.add('Pontos: $pointsExpireDays ${_daysWord(pointsExpireDays)}');
    }
    if (parts.isEmpty) return null;
    return 'Validade · ${parts.join(' · ')}';
  }

  String _daysWord(int days) => days == 1 ? 'dia' : 'dias';

  String _birthdayStatusLine({
    required String? lockedReason,
    required int? daysUntil,
    required String? unlocksAt,
    required bool canRedeem,
  }) {
    if (canRedeem) return 'Disponível agora · aproveite seu presente';
    switch (lockedReason) {
      case 'no_birthday':
        return 'Adicione seu aniversário no perfil para desbloquear';
      case 'already_redeemed':
        return 'Você já resgatou este presente neste ano';
      case 'outside_window':
        if (daysUntil != null && daysUntil > 0) {
          final when = _formatUnlockDate(unlocksAt);
          if (daysUntil == 1) {
            return when != null
                ? 'Libera amanhã ($when)'
                : 'Libera amanhã';
          }
          return when != null
              ? 'Libera $when — em $daysUntil dias'
              : 'Libera em $daysUntil dias';
        }
        return 'Fora da janela de aniversário';
      default:
        return 'Presente de aniversário';
    }
  }

  String? _formatUnlockDate(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return null;
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    return '${d.day} ${months[d.month - 1]}';
  }

  int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }
}

class _ShopAchievementBadge extends StatelessWidget {
  const _ShopAchievementBadge({
    required this.title,
    required this.message,
    required this.unlockedCampaignCount,
    required this.accent,
  });

  final String title;
  final String message;
  final int unlockedCampaignCount;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FregoColors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 14,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 52,
            height: 52,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFF6D8),
                  Color(0xFFF0C43A),
                ],
              ),
              border: Border.all(
                color: const Color(0xFFFFE08A),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFF0C43A).withValues(alpha: 0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 3),
                ),
              ],
            ),
            child: const Icon(
              FregoIcons.trophy,
              size: 26,
              color: Color(0xFF8A5A00),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CONQUISTA DESBLOQUEADA',
                  style: TextStyle(
                    color: accent,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.7,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  title,
                  style: const TextStyle(
                    color: FregoColors.ink,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    height: 1.15,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  unlockedCampaignCount > 0
                      ? '$message · $unlockedCampaignCount promo${unlockedCampaignCount == 1 ? '' : 's'} exclusiva${unlockedCampaignCount == 1 ? '' : 's'}'
                      : message,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: FregoColors.neutral500,
                    fontSize: 12,
                    height: 1.35,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ShopLogo extends StatelessWidget {
  const _ShopLogo({
    required this.letter,
    required this.size,
    this.logoUrl,
  });

  final String letter;
  final double size;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    final radius = size * 0.28;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null && logoUrl!.isNotEmpty
          ? Image.network(
              logoUrl!,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return const ColoredBox(color: FregoColors.neutral200);
              },
              errorBuilder: (_, __, ___) => _fallback(),
            )
          : _fallback(),
    );
  }

  Widget _fallback() {
    return ColoredBox(
      color: FregoColors.primary50,
      child: Center(
        child: Text(
          letter,
          style: TextStyle(
            color: FregoColors.primary500,
            fontSize: size * 0.4,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  const _MiniStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$value ',
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
            TextSpan(
              text: label.toLowerCase(),
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.82),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

