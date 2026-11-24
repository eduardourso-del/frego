import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/balance_lots_section.dart';
import '../../ui/loyalty_campaign_card.dart';
import '../../ui/promo_copy.dart';
import '../../ui/shop_summary_card.dart';
import '../../ui/skeleton.dart';
import '../../ui/stamp_balance.dart';
import '../../ui/voucher_sheet.dart';
import 'check_in_scan_page.dart';
import 'shop_detail_page.dart';

/// Full campaign for a shop — opened from a push or a card tap.
class CampaignDetailPage extends StatefulWidget {
  const CampaignDetailPage({
    super.key,
    required this.businessId,
    required this.campaignId,
    this.explorationCity,
    this.explorationState,
  });

  final String businessId;
  final String campaignId;
  final String? explorationCity;
  final String? explorationState;

  @override
  State<CampaignDetailPage> createState() => _CampaignDetailPageState();
}

class _CampaignDetailPageState extends State<CampaignDetailPage> {
  bool _loading = true;
  bool _redeeming = false;
  String? _error;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      if (_data == null) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final exploring = widget.explorationCity != null &&
          widget.explorationState != null;
      final data = exploring
          ? await fetchExplorationPlace(
              businessId: widget.businessId,
              city: widget.explorationCity!,
              state: widget.explorationState!,
            )
          : await fetchMyWallet(businessId: widget.businessId);
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Map<String, dynamic>? get _campaign {
    final campaigns = ((_data?['campaigns'] as List<dynamic>?) ??
            (_data?['wallet'] as Map<String, dynamic>?)?['campaigns']
                as List<dynamic>? ??
            [])
        .cast<Map<String, dynamic>>();
    for (final c in campaigns) {
      if (c['campaignId'] == widget.campaignId) return c;
    }
    return null;
  }

  List<Map<String, dynamic>> get _lots {
    return ((_data?['wallet'] as Map<String, dynamic>?)?['lots']
                as List<dynamic>? ??
            _data?['lots'] as List<dynamic>? ??
            [])
        .cast<Map<String, dynamic>>();
  }

  List<Map<String, dynamic>> get _cashbackLots {
    return _lots
        .where((lot) => (lot['unitKind'] as String?) == 'cashback_cents')
        .toList();
  }

  bool _lotExpiringSoon(Map<String, dynamic> lot) {
    final daysLeft = (lot['daysLeft'] as num?)?.toInt();
    return lot['expiresAt'] != null && daysLeft != null && daysLeft <= 14;
  }

  Future<void> _redeem(Map<String, dynamic> campaign) async {
    if (_redeeming) return;
    setState(() => _redeeming = true);
    try {
      final body = await redeemCampaign(
        businessId: widget.businessId,
        campaignId: widget.campaignId,
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
      if (voucher != null && voucher.isNotEmpty) {
        await showRedeemVoucherSheet(
          context,
          voucherDisplay: voucher,
          rewardTitle: reward,
          shopName: business?['name'] as String? ?? 'Loja',
          shopLogoUrl: business?['logoUrl'] as String?,
          campaignName: campaign['campaignName'] as String?,
          expiresAt: body['voucherExpiresAt'] as String?,
          status: body['voucherStatus'] as String?,
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

  Future<void> _openCheckIn() async {
    await openCheckInScanner(
      context,
      onRecorded: () {
        if (mounted) _load();
      },
    );
    if (mounted) _load();
  }

  Future<void> _openShop() async {
    await FregoAdaptive.push(
      context,
      ShopDetailPage(
        businessId: widget.businessId,
        explorationCity: widget.explorationCity,
        explorationState: widget.explorationState,
      ),
    );
    if (mounted) _load();
  }

  @override
  Widget build(BuildContext context) {
    final business = _data?['business'] as Map<String, dynamic>?;
    final campaign = _campaign;

    return FregoPage(
      showNavBar: true,
      title: 'Campanha',
      child: _loading && _data == null
          ? const FregoDetailSkeleton()
          : _error != null && _data == null
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(_error!),
                    const SizedBox(height: 16),
                    FregoPrimaryButton(label: 'Tentar de novo', onPressed: _load),
                  ],
                )
              : campaign == null
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const Text(
                          'Esta campanha não está mais disponível.',
                          style: TextStyle(
                            fontSize: 16,
                            height: 1.4,
                            color: FregoColors.ink,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'A loja pode ter encerrado ou pausado a promoção.',
                          style: TextStyle(color: FregoColors.neutral500),
                        ),
                        const SizedBox(height: 20),
                        ShopSummaryCard(
                          business: business,
                          onTap: _openShop,
                        ),
                      ],
                    )
                  : _body(business, campaign),
    );
  }

  Widget _body(Map<String, dynamic>? business, Map<String, dynamic> campaign) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final children = _bodyChildren(business, campaign);
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
              delegate: SliverChildListDelegate(children),
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
        children: children,
      ),
    );
  }

  List<Widget> _bodyChildren(
    Map<String, dynamic>? business,
    Map<String, dynamic> campaign,
  ) {
    final name = business?['name'] as String? ?? 'Loja';
    final logoUrl = business?['logoUrl'] as String?;
    final primary = _parseHex(business?['primaryColor'] as String?) ?? 0xFF070707;
    final primaryDark =
        _parseHex(business?['primaryColorDark'] as String?) ?? 0xFF070707;
    final pools = (_data?['pools'] as Map<String, dynamic>?) ??
        (_data?['wallet'] as Map<String, dynamic>?)?['pools']
            as Map<String, dynamic>? ??
        {'stamps': 0, 'points': 0};
    final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
    final points = (pools['points'] as num?)?.toInt() ?? 0;
    final cashbackCents = (pools['cashbackCents'] as num?)?.toInt() ?? 0;
    final wallet = _data?['wallet'] as Map<String, dynamic>?;
    final stampRows = stampDestinationsOf(wallet ?? _data ?? {});
    final stampsExpireDays = (wallet?['stampsExpireDays'] as num?)?.toInt() ??
        (business?['stampsExpireDays'] as num?)?.toInt();
    final pointsExpireDays = (wallet?['pointsExpireDays'] as num?)?.toInt() ??
        (business?['pointsExpireDays'] as num?)?.toInt();
    final cashbackExpireDays =
        (wallet?['cashbackExpireDays'] as num?)?.toInt() ??
            (business?['cashbackExpireDays'] as num?)?.toInt();

    final type = campaign['type'] as String? ?? 'stamps';
    final needed = (campaign['unitsNeeded'] as num?)?.toInt() ?? 0;
    final canRedeem = campaign['canRedeem'] == true;
    final isCashback = type == 'cashback';
    final isBirthday = type == 'birthday';
    final isPromo = type == 'promo';
    final cashbackBalance =
        (campaign['cashbackBalanceCents'] as num?)?.toInt() ?? cashbackCents;
    final pool = campaignUnits(
      campaign,
      stamps: stamps,
      points: points,
      cashbackCents: cashbackBalance,
    );
    final lockedReason = campaign['lockedReason'] as String?;
    final daysUntil = (campaign['daysUntilBirthday'] as num?)?.toInt();
    final unlocksAt = campaign['unlocksAt'] as String?;
    final audienceEligible = campaign['audienceEligible'] == true;
    final audienceLocked = lockedReason == 'audience';
    final unlockMessage = campaign['audienceUnlockMessage'] as String?;
    late String buttonLabel;
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
      if (audienceLocked) {
        statusHint = 'Promo exclusiva para outro perfil de cliente';
      } else if (unlockMessage != null && unlockMessage.isNotEmpty) {
        statusHint = unlockMessage;
      } else if (cashbackExpireDays != null) {
        statusHint =
            'Cashback válido por $cashbackExpireDays ${_daysWord(cashbackExpireDays)} · o mais antigo é usado primeiro';
      } else {
        statusHint = 'O saldo é descontado no caixa da loja';
      }
      buttonLabel = audienceLocked ? 'Indisponível pra você' : 'Use no caixa';
    } else if (type == 'checkin') {
      final quotaHint = stampQuotaStatusLine(
        lockedReason: lockedReason,
        unlocksAt: unlocksAt,
      );
      statusHint = quotaHint ??
          'A cada $needed check-in${needed == 1 ? '' : 's'} · um por dia';
      buttonLabel = lockedReason == 'quota_exhausted'
          ? 'Já resgatado'
          : canRedeem
              ? 'Resgatar e mostrar'
              : 'Fazer check-in';
    } else if (audienceLocked) {
      statusHint = 'Promo exclusiva para outro perfil de cliente';
      buttonLabel = 'Indisponível pra você';
    } else {
      final expireDays = type == 'spend' ? pointsExpireDays : stampsExpireDays;
      final quotaHint = type == 'stamps'
          ? stampQuotaStatusLine(
              lockedReason: lockedReason,
              unlocksAt: unlocksAt,
            )
          : null;
      final frequency = type == 'stamps' ? stampFrequencyLine(campaign) : null;
      if (unlockMessage != null && unlockMessage.isNotEmpty) {
        statusHint = unlockMessage;
      } else if (quotaHint != null) {
        statusHint = quotaHint;
      } else if (expireDays != null) {
        statusHint = type == 'spend'
            ? 'Pontos válidos por $expireDays ${_daysWord(expireDays)}'
            : 'Carimbos válidos por $expireDays ${_daysWord(expireDays)}';
      }
      if (quotaHint == null && frequency != null) {
        statusHint =
            statusHint == null ? frequency : '$statusHint · $frequency';
      }
      buttonLabel = lockedReason == 'quota_exhausted'
          ? 'Já resgatado'
          : canRedeem
              ? 'Resgatar e mostrar'
              : needed > pool
                  ? 'Ainda falta ${needed - pool}'
                  : 'Continuar acumulando';
    }

    if (!isPromo) {
      final window = outsideDatesLine(
        lockedReason: lockedReason,
        unlocksAt: unlocksAt,
      );
      if (window != null) {
        statusHint = window;
        if (!isCashback) buttonLabel = 'Fora do período';
      }
    }

    return [
      ShopSummaryCard(
        business: business,
        onTap: _openShop,
      ),
      const SizedBox(height: 20),
      LoyaltyCampaignCard(
          businessName: name,
          businessLogoUrl: logoUrl,
          primary: primary,
          primaryDark: primaryDark,
          campaignName: campaign['campaignName'] as String? ?? 'Campanha',
          campaignType: type,
          unitsNeeded: needed <= 0 ? 1 : needed,
          currentUnits: pool,
          rewardTitle: campaign['rewardTitle'] as String? ?? 'Prêmio',
          rewardDescription: campaign['rewardDescription'] as String?,
          rewardImageUrl: campaign['rewardImageUrl'] as String?,
          canRedeem: canRedeem,
          buttonLabel: buttonLabel,
          statusHint: statusHint,
          pointsPerReal: business?['pointsPerReal'] as int?,
          cashbackPercent: (campaign['cashbackPercent'] as num?)?.toInt(),
          cashbackBalanceCents: cashbackBalance,
          cashbackUseMultiple:
              (campaign['cashbackUseMultiple'] as num?)?.toInt(),
          busy: _redeeming,
          promoCalendar: PromoCalendar.fromCampaign(campaign),
          audienceUnlocked: audienceEligible && !audienceLocked,
          audienceLabel: unlockMessage ??
              (audienceEligible ? 'Conquista liberada pra você' : null),
          scopeLabel: stampScopeLabel(
            campaign,
            split: stampRows.length > 1,
          ),
          fullText: true,
          onRedeem: type == 'checkin' &&
                  !canRedeem &&
                  lockedReason != 'quota_exhausted'
              ? () => _openCheckIn()
              : isCashback || !canRedeem || _redeeming
                  ? null
                  : () => _redeem(campaign),
        ),
      if (isPromo) ...[
        const SizedBox(height: 12),
        Text(
          promoFrequencyLine(PromoCalendar.fromCampaign(campaign)),
          style: const TextStyle(
            fontSize: 13,
            height: 1.4,
            color: FregoColors.neutral500,
          ),
        ),
      ],
      if (isCashback) ..._cashbackLotSections(),
    ];
  }

  List<Widget> _cashbackLotSections() {
    final lots = _cashbackLots;
    if (lots.isEmpty) {
      return [
        const SizedBox(height: 20),
        BalanceLotsSection(
          lots: <Map<String, dynamic>>[],
          title: 'Seus lançamentos',
          subtitle:
              'Cada compra gera um lançamento com a própria validade. O mais antigo é usado primeiro no caixa.',
          emptyLabel: 'Você ainda não ganhou cashback nesta loja.',
        ),
      ];
    }

    final expiring = lots.where(_lotExpiringSoon).toList();
    final rest = lots.where((lot) => !_lotExpiringSoon(lot)).toList();
    final widgets = <Widget>[const SizedBox(height: 20)];

    if (expiring.isNotEmpty) {
      widgets.add(
        BalanceLotsSection(
          lots: expiring,
          title: expiring.length == 1
              ? '1 lançamento expirando'
              : '${expiring.length} lançamentos expirando',
          subtitle:
              'Use no caixa antes destas datas. O mais antigo sai primeiro.',
        ),
      );
    }
    if (rest.isNotEmpty) {
      widgets.add(
        Padding(
          padding: EdgeInsets.only(top: expiring.isEmpty ? 0 : 12),
          child: BalanceLotsSection(
            lots: rest,
            title: expiring.isEmpty
                ? 'Seus lançamentos'
                : 'Outros lançamentos',
            subtitle: expiring.isEmpty
                ? 'Cada compra gera um lançamento com a própria validade. O mais antigo é usado primeiro no caixa.'
                : 'Ainda válidos por mais tempo.',
          ),
        ),
      );
    }
    return widgets;
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
          return daysUntil == 1
              ? 'Libera amanhã'
              : 'Libera em $daysUntil dias';
        }
        return 'Fora da janela de aniversário';
      default:
        return 'Presente de aniversário';
    }
  }

  int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }
}
