import 'package:flutter/material.dart';

import 'loyalty_campaign_card.dart';
import 'promo_copy.dart';
import 'stamp_balance.dart';

/// The Prêmios card, built from the full Campanha record on a Clube.
class RewardCampaignCard extends StatelessWidget {
  const RewardCampaignCard({
    super.key,
    required this.business,
    required this.campaign,
    required this.stamps,
    required this.points,
    required this.stampSplit,
    this.stampsExpireDays,
    this.pointsExpireDays,
    this.busy = false,
    this.onRedeem,
    this.onOpenShop,
    this.onOpen,
  });

  final Map<String, dynamic> business;
  final Map<String, dynamic> campaign;
  final int stamps;
  final int points;
  final bool stampSplit;
  final int? stampsExpireDays;
  final int? pointsExpireDays;
  final bool busy;
  final VoidCallback? onRedeem;
  final VoidCallback? onOpenShop;
  final VoidCallback? onOpen;

  String get _type => campaign['type'] as String? ?? 'stamps';

  bool get _canRedeem => campaign['canRedeem'] == true;

  int get _needed => (campaign['unitsNeeded'] as num?)?.toInt() ?? 0;

  int get _pool {
    if (_type == 'spend') return points;
    if (_type == 'birthday' || _type == 'promo') return _canRedeem ? 1 : 0;
    if (_type == 'cashback') {
      return (campaign['cashbackBalanceCents'] as num?)?.toInt() ?? 0;
    }
    final explicit = campaign['balance'];
    if (explicit is num) return explicit.toInt();
    return stamps;
  }

  @override
  Widget build(BuildContext context) {
    final name = business['name'] as String? ?? 'Loja';
    final type = _type;
    final needed = _needed <= 0 ? 1 : _needed;
    final canRedeem = _canRedeem;
    final audienceEligible = campaign['audienceEligible'] == true;
    final audienceLocked = campaign['lockedReason'] == 'audience';
    final unlockMessage = campaign['audienceUnlockMessage'] as String?;
    final primary = _parseHex(business['primaryColor'] as String?) ?? 0xFF070707;
    final statusHint = joinHints([
      if (type != 'promo')
        outsideDatesLine(
          lockedReason: campaign['lockedReason'] as String?,
          unlocksAt: campaign['unlocksAt'] as String?,
        ),
      if (audienceLocked) 'Promo exclusiva para outro perfil',
      if (!audienceLocked && unlockMessage != null) unlockMessage,
      if (campaign['lockedReason'] != 'outside_dates')
        type == 'birthday' ? _birthdayStatusLine(campaign) : null,
      if (type == 'promo')
        promoStatusLine(
          lockedReason: campaign['lockedReason'] as String?,
          canRedeem: canRedeem,
          unlocksAt: campaign['unlocksAt'] as String?,
        ),
      if (type == 'stamps')
        stampQuotaStatusLine(
          lockedReason: campaign['lockedReason'] as String?,
          unlocksAt: campaign['unlocksAt'] as String?,
        ),
      if (type == 'stamps' &&
          campaign['lockedReason'] != 'quota_exhausted' &&
          campaign['lockedReason'] != 'outside_dates')
        stampFrequencyLine(campaign),
      if (!audienceLocked &&
          type != 'promo' &&
          type != 'birthday' &&
          campaign['lockedReason'] != 'outside_dates')
        _expireHint(type),
    ]);

    return LoyaltyCampaignCard(
      businessName: name,
      businessLogoUrl: business['logoUrl'] as String?,
      primary: primary,
      primaryDark: _parseHex(business['primaryColorDark'] as String?) ?? primary,
      campaignName: campaign['campaignName'] as String? ??
          campaign['name'] as String? ??
          'Campanha',
      campaignType: type,
      unitsNeeded: needed,
      currentUnits: _pool,
      rewardTitle: campaign['rewardTitle'] as String? ?? 'Prêmio',
      rewardDescription: campaign['rewardDescription'] as String?,
      rewardImageUrl: campaign['rewardImageUrl'] as String?,
      canRedeem: canRedeem,
      buttonLabel: _buttonLabel(
        type: type,
        canRedeem: canRedeem,
        needed: needed,
        audienceLocked: audienceLocked,
      ),
      statusHint: statusHint == null || statusHint.isEmpty ? null : statusHint,
      pointsPerReal: (business['pointsPerReal'] as num?)?.toInt(),
      cashbackPercent: (campaign['cashbackPercent'] as num?)?.toInt(),
      cashbackBalanceCents: _pool,
      cashbackUseMultiple: (campaign['cashbackUseMultiple'] as num?)?.toInt(),
      busy: busy,
      promoCalendar: PromoCalendar.fromCampaign(campaign),
      audienceUnlocked: audienceEligible && !audienceLocked,
      audienceLabel: unlockMessage ??
          (audienceEligible ? 'Conquista liberada pra você' : null),
      scopeLabel: stampScopeLabel(campaign, split: stampSplit),
      onRedeem: type == 'cashback' || !canRedeem || busy ? null : onRedeem,
      onOpenShop: onOpenShop,
      onOpen: onOpen,
    );
  }

  String _buttonLabel({
    required String type,
    required bool canRedeem,
    required int needed,
    required bool audienceLocked,
  }) {
    late String label;
    if (type == 'birthday') {
      final locked = campaign['lockedReason'] as String?;
      label = canRedeem
          ? 'Resgatar e mostrar'
          : locked == 'no_birthday'
              ? 'Informe seu aniversário'
              : locked == 'already_redeemed'
                  ? 'Já resgatado este ano'
                  : 'Ainda não liberou';
    } else if (type == 'promo') {
      label = promoButtonLabel(
        lockedReason: campaign['lockedReason'] as String?,
        canRedeem: canRedeem,
      );
    } else if (type == 'cashback') {
      label = audienceLocked ? 'Indisponível pra você' : 'Use no caixa';
    } else if (audienceLocked) {
      label = 'Indisponível pra você';
    } else if (campaign['lockedReason'] == 'quota_exhausted') {
      label = 'Já resgatado';
    } else {
      label = canRedeem
          ? 'Resgatar e mostrar'
          : needed > _pool
              ? 'Ainda falta ${needed - _pool}'
              : 'Continuar acumulando';
    }
    if (type != 'promo' &&
        type != 'cashback' &&
        campaign['lockedReason'] == 'outside_dates') {
      label = 'Fora do período';
    }
    return label;
  }

  String? _expireHint(String type) {
    if (type == 'spend') {
      final days = pointsExpireDays;
      if (days == null) return null;
      return 'Pontos válidos por $days ${_daysWord(days)}';
    }
    final days = stampsExpireDays;
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
          return daysUntil == 1 ? 'Libera amanhã' : 'Libera em $daysUntil dias';
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
