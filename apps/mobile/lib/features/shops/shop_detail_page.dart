import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/voucher_sheet.dart';

class ShopDetailPage extends StatefulWidget {
  const ShopDetailPage({super.key, required this.businessId});

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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await fetchMyWallet(businessId: widget.businessId);
      if (!mounted) return;
      final membership = data['membership'] as Map<String, dynamic>?;
      setState(() {
        _data = data;
        _isFavorite = membership?['isFavorite'] == true;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
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
      final shop = (_data?['business'] as Map?)?['name'] as String? ?? 'Loja';
      if (voucher != null && voucher.isNotEmpty) {
        await showRedeemVoucherSheet(
          context,
          voucherDisplay: voucher,
          rewardTitle: reward,
          shopName: shop,
          campaignName: campaign['campaignName'] as String?,
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
    final campaigns = (_data?['campaigns'] as List<dynamic>?) ??
        (_data?['wallet'] as Map<String, dynamic>?)?['campaigns']
            as List<dynamic>? ??
        [];
    final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
    final points = (pools['points'] as num?)?.toInt() ?? 0;
    final primary = _parseHex(business?['primaryColor'] as String?) ?? 0xFF3B5BDB;
    final primaryDark =
        _parseHex(business?['primaryColorDark'] as String?) ?? 0xFF2F49C4;
    final cupertino = FregoAdaptive.useCupertino(context);
    final title = business?['name'] as String? ?? 'Loja';

    return FregoPage(
      showNavBar: true,
      title: title,
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
      child: _loading
          ? const Center(child: FregoProgress())
          : _error != null
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
                  campaigns: campaigns,
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
    required List<dynamic> campaigns,
    required int primary,
    required int primaryDark,
  }) {
    final name = business?['name'] as String? ?? 'Sua loja';
    final slogan = business?['slogan'] as String?;
    final logoUrl = business?['logoUrl'] as String?;
    final heroImageUrl = business?['heroImageUrl'] as String?;
    final locations = (business?['locations'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final letter = name.trim().isEmpty ? 'V' : name.trim()[0].toUpperCase();
    final addressLine = _primaryAddressLine(locations);
    final hasHero = heroImageUrl != null && heroImageUrl.isNotEmpty;

    final brandHeader = Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
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
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ShopLogo(
            letter: letter,
            logoUrl: logoUrl,
            size: 48,
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
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.2,
                  ),
                ),
                if (slogan != null && slogan.isNotEmpty) ...[
                  const SizedBox(height: 2),
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
                if (addressLine != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        FregoIcons.location,
                        size: 13,
                        color: Colors.white.withValues(alpha: 0.85),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          addressLine,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 12,
                            height: 1.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    _MiniStat(label: 'Carimbos', value: '$stamps'),
                    const SizedBox(width: 8),
                    _MiniStat(label: 'Pontos', value: '$points'),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );

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
                    errorBuilder: (_, __, ___) => ColoredBox(
                      color: Color(primary),
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
      const Text(
        'O mesmo cartão que a loja configura — progresso e prêmio ao vivo.',
        style: TextStyle(
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
        ...campaigns.map((raw) {
          final c = raw as Map<String, dynamic>;
          final canRedeem = c['canRedeem'] == true;
          final type = c['type'] as String? ?? 'stamps';
          final needed = (c['unitsNeeded'] as num?)?.toInt() ?? 0;
          final pool = type == 'spend' ? points : stamps;
          final isBirthday = type == 'birthday';
          final lockedReason = c['lockedReason'] as String?;
          final daysUntil = (c['daysUntilBirthday'] as num?)?.toInt();
          final unlocksAt = c['unlocksAt'] as String?;

          late final String buttonLabel;
          String? statusHint;
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
          } else {
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
              busy: _redeeming,
              onRedeem: canRedeem && !_redeeming ? () => _redeem(c) : null,
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
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(22),
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

