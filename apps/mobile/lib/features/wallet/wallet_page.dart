import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/campaign_order.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/promo_copy.dart';
import '../../ui/skeleton.dart';
import '../../ui/voucher_sheet.dart';
import '../shops/campaign_detail_page.dart';

class WalletPage extends StatefulWidget {
  const WalletPage({super.key, required this.phoneE164});

  final String phoneE164;

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  bool _loading = true;
  bool _redeeming = false;
  String? _error;
  Map<String, dynamic>? _data;
  String? _selectedBusinessId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({String? businessId}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await fetchMyWallet(businessId: businessId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _selectedBusinessId =
            (data['business'] as Map<String, dynamic>?)?['id'] as String?;
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

  Future<void> _redeem(Map<String, dynamic> campaign) async {
    final businessId = _selectedBusinessId;
    final campaignId = campaign['campaignId'] as String?;
    if (businessId == null || campaignId == null) return;

    setState(() => _redeeming = true);
    try {
      final body = await redeemCampaign(
        businessId: businessId,
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              body['message'] as String? ?? 'Recompensa resgatada',
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      );
    } finally {
      if (mounted) setState(() => _redeeming = false);
    }
  }

  Future<void> _openCampaign(Map<String, dynamic> campaign) async {
    final businessId = _selectedBusinessId;
    final campaignId = campaign['campaignId'] as String?;
    if (businessId == null || campaignId == null || campaignId.isEmpty) return;
    await FregoAdaptive.push(
      context,
      CampaignDetailPage(businessId: businessId, campaignId: campaignId),
    );
    if (mounted) _load(businessId: businessId);
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
    final memberships = _data?['memberships'] as List<dynamic>? ?? [];
    final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
    final points = (pools['points'] as num?)?.toInt() ?? 0;
    final cashbackCents = (pools['cashbackCents'] as num?)?.toInt() ?? 0;
    final earnKinds = earnKindsFromCampaigns(campaigns);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: Row(
                children: [
                  const Text(
                    'Carteira',
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w600,
                      letterSpacing: -0.4,
                    ),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: _loading
                        ? null
                        : () => _load(businessId: _selectedBusinessId),
                    icon: const Icon(FregoIcons.refresh),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? const FregoDetailSkeleton()
                  : _error != null
                      ? ListView(
                          padding: const EdgeInsets.all(24),
                          children: [
                            Text(
                              _error == 'NO_MEMBERSHIP'
                                  ? 'Você ainda não tem fidelidade em nenhuma loja. Peça um carimbo no balcão.'
                                  : _error!,
                              style: const TextStyle(
                                fontSize: 15,
                                color: FregoColors.neutral500,
                              ),
                            ),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: () =>
                                  _load(businessId: _selectedBusinessId),
                              child: const Text('Tentar de novo'),
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(24),
                          children: [
                            Text(
                              widget.phoneE164,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: FregoColors.neutral500,
                              ),
                            ),
                            if (memberships.length > 1) ...[
                              const SizedBox(height: 12),
                              DropdownButtonFormField<String>(
                                value: _selectedBusinessId,
                                decoration: const InputDecoration(
                                  labelText: 'Loja',
                                  border: OutlineInputBorder(),
                                ),
                                items: [
                                  for (final m in memberships)
                                    DropdownMenuItem(
                                      value: m['businessId'] as String?,
                                      child: Text(
                                        m['name'] as String? ?? 'Loja',
                                      ),
                                    ),
                                ],
                                onChanged: (id) {
                                  if (id == null) return;
                                  _load(businessId: id);
                                },
                              ),
                            ],
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(20),
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    Color(
                                      _parseHex(
                                            business?['primaryColor']
                                                as String?,
                                          ) ??
                                          0xFF3B5BDB,
                                    ),
                                    Color(
                                      _parseHex(
                                            business?['primaryColorDark']
                                                as String?,
                                          ) ??
                                          0xFF2F49C4,
                                    ),
                                  ],
                                ),
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x473B5BDB),
                                    blurRadius: 20,
                                    offset: Offset(0, 8),
                                  ),
                                ],
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    business?['name'] as String? ?? 'Sua loja',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 22,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  if ((business?['slogan'] as String?)
                                          ?.isNotEmpty ==
                                      true)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4),
                                      child: Text(
                                        business!['slogan'] as String,
                                        style: TextStyle(
                                          color: Colors.white.withValues(
                                            alpha: 0.85,
                                          ),
                                          fontSize: 14,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 20),
                                  Row(
                                    children: [
                                      if (earnKinds.contains('stamps') ||
                                          stamps > 0)
                                        Expanded(
                                          child: _PoolChip(
                                            label: 'Carimbos',
                                            value: '$stamps',
                                          ),
                                        ),
                                      if ((earnKinds.contains('stamps') ||
                                              stamps > 0) &&
                                          (earnKinds.contains('points') ||
                                              points > 0))
                                        const SizedBox(width: 12),
                                      if (earnKinds.contains('points') ||
                                          points > 0)
                                        Expanded(
                                          child: _PoolChip(
                                            label: 'Pontos',
                                            value: '$points',
                                          ),
                                        ),
                                      if ((earnKinds.contains('stamps') ||
                                              stamps > 0 ||
                                              earnKinds.contains('points') ||
                                              points > 0) &&
                                          (earnKinds.contains('cashback') ||
                                              cashbackCents > 0))
                                        const SizedBox(width: 12),
                                      if (earnKinds.contains('cashback') ||
                                          cashbackCents > 0)
                                        Expanded(
                                          child: _PoolChip(
                                            label: 'Cashback',
                                            value:
                                                'R\$ ${(cashbackCents / 100).toStringAsFixed(2).replaceAll('.', ',')}',
                                          ),
                                        ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 28),
                            const Text(
                              'Campanhas',
                              style: TextStyle(
                                fontSize: 17,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              campaigns.any((c) => c['type'] == 'cashback')
                                  ? 'Cashback aparece primeiro. Use o saldo no caixa.'
                                  : 'Escolha onde gastar seus carimbos ou pontos.',
                              style: const TextStyle(
                                fontSize: 14,
                                color: FregoColors.neutral500,
                              ),
                            ),
                            const SizedBox(height: 12),
                            if (campaigns.isEmpty)
                              Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: FregoColors.neutral200,
                                  ),
                                ),
                                child: const Text(
                                  'Nenhuma campanha ativa nesta loja.',
                                  style: TextStyle(
                                    color: FregoColors.neutral500,
                                  ),
                                ),
                              )
                            else
                              ...campaigns.map((c) {
                                final canRedeem = c['canRedeem'] == true;
                                final type = c['type'] as String? ?? 'stamps';
                                final needed =
                                    (c['unitsNeeded'] as num?)?.toInt() ?? 0;
                                final isCashback = type == 'cashback';
                                final cashbackBalance =
                                    (c['cashbackBalanceCents'] as num?)
                                        ?.toInt() ??
                                    (pools['cashbackCents'] as num?)?.toInt() ??
                                    0;
                                final pool = type == 'spend'
                                    ? points
                                    : isCashback
                                        ? cashbackBalance
                                        : stamps;
                                final isBirthday = type == 'birthday';
                                final isPromo = type == 'promo';
                                final lockedReason =
                                    c['lockedReason'] as String?;
                                final daysUntil =
                                    (c['daysUntilBirthday'] as num?)?.toInt();
                                final unlocksAt = c['unlocksAt'] as String?;

                                if (isCashback) {
                                  final primary = _parseHex(
                                        business?['primaryColor'] as String?,
                                      ) ??
                                      0xFF3B5BDB;
                                  final primaryDark = _parseHex(
                                        business?['primaryColorDark']
                                            as String?,
                                      ) ??
                                      0xFF2F49C4;
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: LoyaltyCampaignCard(
                                      businessName:
                                          business?['name'] as String? ??
                                              'Sua loja',
                                      businessLogoUrl:
                                          business?['logoUrl'] as String?,
                                      primary: primary,
                                      primaryDark: primaryDark,
                                      campaignName: c['campaignName']
                                              as String? ??
                                          'Cashback',
                                      campaignType: 'cashback',
                                      unitsNeeded: 1,
                                      currentUnits: cashbackBalance,
                                      rewardTitle: c['rewardTitle']
                                              as String? ??
                                          'Volta em R\$',
                                      canRedeem: false,
                                      buttonLabel: lockedReason == 'audience'
                                          ? 'Indisponível pra você'
                                          : 'Use no caixa',
                                      cashbackPercent: (c['cashbackPercent']
                                              as num?)
                                          ?.toInt(),
                                      cashbackBalanceCents: cashbackBalance,
                                      onRedeem: null,
                                      onOpen: () => _openCampaign(c),
                                    ),
                                  );
                                }

                                String subtitle;
                                String buttonLabel;
                                if (isBirthday) {
                                  if (canRedeem) {
                                    subtitle =
                                        '${c['rewardTitle'] ?? 'Presente'} · disponível agora';
                                    buttonLabel = 'Resgatar presente';
                                  } else if (lockedReason == 'no_birthday') {
                                    subtitle =
                                        'Informe seu aniversário no perfil';
                                    buttonLabel = 'Bloqueado';
                                  } else if (lockedReason ==
                                      'already_redeemed') {
                                    subtitle = 'Já resgatado este ano';
                                    buttonLabel = 'Resgatado';
                                  } else if (daysUntil != null &&
                                      daysUntil > 0) {
                                    subtitle = daysUntil == 1
                                        ? 'Libera amanhã'
                                        : 'Libera em $daysUntil dias'
                                            '${unlocksAt != null ? ' ($unlocksAt)' : ''}';
                                    buttonLabel = 'Aguardando';
                                  } else {
                                    subtitle =
                                        c['rewardTitle'] as String? ??
                                            'Presente de aniversário';
                                    buttonLabel = 'Bloqueado';
                                  }
                                } else if (isPromo) {
                                  subtitle = promoStatusLine(
                                    lockedReason: lockedReason,
                                    canRedeem: canRedeem,
                                    unlocksAt: unlocksAt,
                                  );
                                  buttonLabel = promoButtonLabel(
                                    lockedReason: lockedReason,
                                    canRedeem: canRedeem,
                                  );
                                } else {
                                  final quotaHint = type == 'stamps'
                                      ? stampQuotaStatusLine(
                                          lockedReason: lockedReason,
                                          unlocksAt: unlocksAt,
                                        )
                                      : null;
                                  final frequency = type == 'stamps'
                                      ? stampFrequencyLine(c)
                                      : null;
                                  subtitle = quotaHint ??
                                      'Meta $needed · você tem $pool'
                                          '${c['rewardTitle'] != null ? ' · ${c['rewardTitle']}' : ''}';
                                  if (quotaHint == null && frequency != null) {
                                    subtitle = '$subtitle · $frequency';
                                  }
                                  buttonLabel = lockedReason == 'quota_exhausted'
                                      ? 'Já resgatado'
                                      : canRedeem
                                          ? 'Resgatar'
                                          : 'Ainda falta';
                                }

                                if (isPromo) {
                                  final primary = _parseHex(
                                        business?['primaryColor'] as String?,
                                      ) ??
                                      0xFF3B5BDB;
                                  final primaryDark = _parseHex(
                                        business?['primaryColorDark']
                                            as String?,
                                      ) ??
                                      0xFF2F49C4;
                                  return Padding(
                                    padding: const EdgeInsets.only(bottom: 12),
                                    child: LoyaltyCampaignCard(
                                      businessName:
                                          business?['name'] as String? ??
                                              'Sua loja',
                                      businessLogoUrl:
                                          business?['logoUrl'] as String?,
                                      primary: primary,
                                      primaryDark: primaryDark,
                                      campaignName: c['campaignName']
                                              as String? ??
                                          'Promoção',
                                      campaignType: 'promo',
                                      unitsNeeded: 1,
                                      currentUnits: canRedeem ? 1 : 0,
                                      rewardTitle: c['rewardTitle']
                                              as String? ??
                                          'Prêmio',
                                      rewardDescription:
                                          c['rewardDescription'] as String?,
                                      rewardImageUrl:
                                          c['rewardImageUrl'] as String?,
                                      canRedeem: canRedeem,
                                      buttonLabel: buttonLabel,
                                      statusHint: subtitle,
                                      promoCalendar:
                                          PromoCalendar.fromCampaign(c),
                                      onRedeem: !canRedeem || _redeeming
                                          ? null
                                          : () => _redeem(c),
                                      onOpen: () => _openCampaign(c),
                                    ),
                                  );
                                }

                                return Padding(
                                  padding: const EdgeInsets.only(bottom: 12),
                                  child: Material(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(16),
                                    child: InkWell(
                                      onTap: () => _openCampaign(c),
                                      borderRadius: BorderRadius.circular(16),
                                      child: Container(
                                    padding: const EdgeInsets.all(16),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: isBirthday
                                            ? const Color(0xFFC7D2F7)
                                            : FregoColors.neutral200,
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Row(
                                          children: [
                                            if (isBirthday) ...[
                                              const Text('🎂 ',
                                                  style:
                                                      TextStyle(fontSize: 16)),
                                            ],
                                            Expanded(
                                              child: Text(
                                                c['campaignName'] as String? ??
                                                    'Campanha',
                                                style: const TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.w600,
                                                ),
                                              ),
                                            ),
                                            Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                horizontal: 8,
                                                vertical: 4,
                                              ),
                                              decoration: BoxDecoration(
                                                color: isBirthday
                                                    ? const Color(0xFFEEF1FD)
                                                    : isPromo
                                                        ? FregoColors.promoBg
                                                        : type == 'spend'
                                                            ? const Color(
                                                                0xFFFFFBEB)
                                                            : FregoColors.stampsBg,
                                                borderRadius:
                                                    BorderRadius.circular(999),
                                              ),
                                              child: Text(
                                                isBirthday
                                                    ? 'Aniversário'
                                                    : isPromo
                                                        ? 'Promoção'
                                                        : type == 'spend'
                                                            ? 'Pontos'
                                                            : 'Carimbos',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w600,
                                                  color: isBirthday
                                                      ? FregoColors.primary500
                                                      : isPromo
                                                          ? FregoColors.promo
                                                          : type == 'spend'
                                                              ? const Color(
                                                                  0xFF92400E)
                                                              : const Color(
                                                                  0xFF115E59),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          subtitle,
                                          style: TextStyle(
                                            fontSize: 13,
                                            fontWeight: canRedeem && isBirthday
                                                ? FontWeight.w600
                                                : FontWeight.w400,
                                            color: canRedeem && isBirthday
                                                ? const Color(0xFF1F9D6B)
                                                : FregoColors.neutral500,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          width: double.infinity,
                                          child: FilledButton(
                                            onPressed: !canRedeem ||
                                                    _redeeming
                                                ? null
                                                : () => _redeem(c),
                                            child: Text(buttonLabel),
                                          ),
                                        ),
                                      ],
                                    ),
                                      ),
                                    ),
                                  ),
                                );
                              }),
                          ],
                        ),
            ),
          ],
        ),
      ),
    );
  }

  int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }
}

class _PoolChip extends StatelessWidget {
  const _PoolChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
