import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../theme/frego_icons.dart';
import '../theme/frego_theme.dart';
import 'adaptive.dart';
import 'promo_copy.dart';

/// Compact loyalty card — light surface, brand color as accent only.
class LoyaltyCampaignCard extends StatelessWidget {
  const LoyaltyCampaignCard({
    super.key,
    required this.businessName,
    required this.primary,
    required this.primaryDark,
    required this.campaignName,
    required this.campaignType,
    required this.unitsNeeded,
    required this.currentUnits,
    required this.rewardTitle,
    required this.canRedeem,
    required this.buttonLabel,
    required this.onRedeem,
    this.businessLogoUrl,
    this.rewardDescription,
    this.rewardImageUrl,
    this.statusHint,
    this.pointsPerReal,
    this.cashbackPercent,
    this.cashbackBalanceCents,
    this.busy = false,
    this.audienceUnlocked = false,
    this.audienceLabel,
    this.onOpenShop,
    this.onOpen,
    this.promoCalendar,
  });

  final String businessName;
  final String? businessLogoUrl;
  final int primary;
  final int primaryDark;
  final String campaignName;
  final String campaignType; // stamps | spend | birthday | cashback | promo
  final int unitsNeeded;
  final int currentUnits;
  final String rewardTitle;
  final String? rewardDescription;
  final String? rewardImageUrl;
  final bool canRedeem;
  final String buttonLabel;
  final String? statusHint;
  final int? pointsPerReal;
  final int? cashbackPercent;
  final int? cashbackBalanceCents;
  final bool busy;
  final VoidCallback? onRedeem;
  /// Exclusive audience unlock chip (matched segment promo).
  final bool audienceUnlocked;
  final String? audienceLabel;
  /// Optional “Ver loja” link next to the store name (e.g. Prêmios list).
  final VoidCallback? onOpenShop;

  /// Opens the campaign detail. The redeem button still handles its own tap.
  final VoidCallback? onOpen;

  /// Promoção calendar (dates + weekdays) as the customer should see it.
  final PromoCalendar? promoCalendar;

  bool get _isBirthday => campaignType == 'birthday';
  bool get _isPromo => campaignType == 'promo';
  bool get _isSpend => campaignType == 'spend' || campaignType == 'points';
  bool get _isCashback => campaignType == 'cashback';

  @override
  Widget build(BuildContext context) {
    final needed = unitsNeeded <= 0 ? 1 : unitsNeeded;
    final inCycle = _isBirthday || _isPromo
        ? (canRedeem ? needed : 0)
        : (canRedeem ? needed : currentUnits % needed);
    final remaining = (needed - inCycle).clamp(0, needed);
    final letter =
        businessName.trim().isEmpty ? 'V' : businessName.trim()[0].toUpperCase();
    final reward =
        rewardTitle.trim().isEmpty ? 'Recompensa' : rewardTitle.trim();
    final accent = Color(primary);
    final hasImage =
        rewardImageUrl != null && rewardImageUrl!.trim().isNotEmpty;

    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
                  Row(
                    children: [
                      _BizMark(
                        letter: letter,
                        logoUrl: businessLogoUrl,
                        accent: accent,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Row(
                          children: [
                            Flexible(
                              child: Text(
                                businessName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: FregoColors.neutral500,
                                ),
                              ),
                            ),
                            if (onOpenShop != null) ...[
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: onOpenShop,
                                behavior: HitTestBehavior.opaque,
                                child: const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 2),
                                  child: Text(
                                    'Ver loja',
                                    style: TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: FregoColors.primary500,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      _TypeChip(type: campaignType, accent: accent),
                    ],
                  ),
                  if (audienceUnlocked) ...[
                    const SizedBox(height: 8),
                    _AudienceUnlockChip(
                      label: audienceLabel?.trim().isNotEmpty == true
                          ? audienceLabel!.trim()
                          : 'Conquista liberada pra você',
                      accent: accent,
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (hasImage) ...[
                        _RewardThumb(imageUrl: rewardImageUrl!),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              campaignName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.2,
                                color: FregoColors.ink,
                              ),
                            ),
                            const SizedBox(height: 8),
                            if (_isBirthday)
                              _BirthdayBody(
                                reward: reward,
                                statusHint: statusHint,
                                showReward: !hasImage,
                                accent: accent,
                              )
                            else if (_isPromo)
                              _PromoBody(
                                reward: reward,
                                statusHint: statusHint,
                                showReward: !hasImage,
                                calendar: promoCalendar,
                              )
                            else if (_isCashback)
                              _CashbackBody(
                                balanceCents: cashbackBalanceCents ?? 0,
                                percent: cashbackPercent ?? 0,
                              )
                            else if (_isSpend)
                              _PointsBody(
                                current: inCycle,
                                needed: needed,
                                remaining: remaining,
                                reward: reward,
                                pointsPerReal: pointsPerReal,
                                canRedeem: canRedeem,
                                showRewardInline: !hasImage,
                                accent: accent,
                              )
                            else
                              _StampsBody(
                                filled: inCycle,
                                needed: needed,
                                remaining: remaining,
                                reward: reward,
                                accent: accent,
                                canRedeem: canRedeem,
                                actualNeeded: needed,
                                actualCurrent: currentUnits,
                                showRewardInline: !hasImage,
                                statusHint: statusHint,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (!_isBirthday && !_isPromo && !_isCashback && !hasImage) ...[
                    const SizedBox(height: 8),
                    Text(
                      reward,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  if (_isCashback)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 10,
                        horizontal: 12,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(11),
                        border: Border.all(color: FregoColors.cashbackRing),
                      ),
                      child: const Text(
                        'Peça no caixa para usar este saldo',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: FregoColors.cashback,
                        ),
                      ),
                    )
                  else
                    _CardCta(
                      label: buttonLabel,
                      enabled: canRedeem && !busy && onRedeem != null,
                      onPressed: onRedeem,
                      accent: accent,
                    ),
      ],
    );

    return Material(
      color: _isCashback ? FregoColors.cashbackBg : Colors.white,
      borderRadius: BorderRadius.circular(16),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(16),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color:
                  _isCashback ? FregoColors.cashbackRing : FregoColors.hairline,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: _isCashback ? 0.04 : 0.06),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                height: 3,
                color: _isCashback ? FregoColors.cashback : accent,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
                child: content,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RewardThumb extends StatelessWidget {
  const _RewardThumb({required this.imageUrl});

  final String imageUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 56,
        height: 56,
        child: Stack(
          fit: StackFit.expand,
          children: [
            const ColoredBox(color: FregoColors.neutral200),
            Image.network(
              imageUrl,
              fit: BoxFit.cover,
              loadingBuilder: (context, child, progress) {
                if (progress == null) return child;
                return const Center(
                  child: Icon(
                    FregoIcons.image,
                    size: 20,
                    color: FregoColors.neutral400,
                  ),
                );
              },
              errorBuilder: (_, __, ___) => const Center(
                child: Icon(
                  FregoIcons.image,
                  size: 20,
                  color: FregoColors.neutral400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BizMark extends StatelessWidget {
  const _BizMark({
    required this.letter,
    required this.accent,
    this.logoUrl,
  });

  final String letter;
  final Color accent;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(7),
      child: SizedBox(
        width: 24,
        height: 24,
        child: logoUrl != null && logoUrl!.isNotEmpty
            ? Image.network(
                logoUrl!,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => _fallback(),
              )
            : _fallback(),
      ),
    );
  }

  Widget _fallback() {
    return ColoredBox(
      color: accent.withValues(alpha: 0.12),
      child: Center(
        child: Text(
          letter,
          style: TextStyle(
            color: accent,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _TypeChip extends StatelessWidget {
  const _TypeChip({required this.type, required this.accent});

  final String type;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final isSpend = type == 'spend' || type == 'points';
    final isBirthday = type == 'birthday';
    final isCashback = type == 'cashback';
    final isPromo = type == 'promo';
    final label = isBirthday
        ? 'Aniversário'
        : isSpend
            ? 'Pontos'
            : isCashback
                ? 'Cashback'
                : isPromo
                    ? 'Promoção'
                    : 'Carimbos';
    final bg = isSpend
        ? const Color(0xFFFFF8E8)
        : isBirthday
            ? const Color(0xFFFDF2F8)
            : isCashback
                ? FregoColors.cashbackBg
                : isPromo
                    ? FregoColors.promoBg
                    : accent.withValues(alpha: 0.1);
    final fg = isSpend
        ? const Color(0xFF92400E)
        : isBirthday
            ? const Color(0xFF9D174D)
            : isCashback
                ? FregoColors.cashback
                : isPromo
                    ? FregoColors.promo
                    : accent;
    final icon = isBirthday
        ? FregoIcons.birthday(size: 11, color: fg)
        : isSpend
            ? FregoIcons.points(size: 11, color: fg)
            : isCashback
                ? FregoIcons.cashback(size: 11, color: fg)
                : isPromo
                    ? FregoIcons.promo(size: 11, color: fg)
                    : FregoIcons.stamp(size: 11, color: fg);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          icon,
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
  }
}

class _AudienceUnlockChip extends StatelessWidget {
  const _AudienceUnlockChip({required this.label, required this.accent});

  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: accent.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: accent.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          FregoIcons.points(size: 14, color: accent),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              label,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                height: 1.25,
                color: accent,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CashbackBody extends StatelessWidget {
  const _CashbackBody({
    required this.balanceCents,
    required this.percent,
  });

  final int balanceCents;
  final int percent;

  String get _balance {
    final v = balanceCents / 100;
    return 'R\$ ${v.toStringAsFixed(2).replaceAll('.', ',')}';
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (percent > 0) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: FregoColors.cashbackRing),
            ),
            child: Text(
              '$percent% de volta',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: FregoColors.cashback,
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
        Text(
          _balance,
          style: const TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.6,
            height: 1.1,
            color: FregoColors.cashback,
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Saldo para usar no caixa',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w500,
            color: FregoColors.neutral500,
          ),
        ),
      ],
    );
  }
}

class _StampsBody extends StatelessWidget {
  const _StampsBody({
    required this.filled,
    required this.needed,
    required this.remaining,
    required this.reward,
    required this.accent,
    required this.canRedeem,
    required this.actualNeeded,
    required this.actualCurrent,
    required this.showRewardInline,
    this.statusHint,
  });

  final int filled;
  final int needed;
  final int remaining;
  final String reward;
  final Color accent;
  final bool canRedeem;
  final int actualNeeded;
  final int actualCurrent;
  final bool showRewardInline;
  final String? statusHint;

  @override
  Widget build(BuildContext context) {
    // Progress circles match real stamp goal. Last slot is the gift and only
    // fills when the reward is ready.
    final stampCount = needed.clamp(1, 24);
    final hasFullSet = actualCurrent >= actualNeeded && actualNeeded > 0;
    final showComplete = canRedeem || hasFullSet;
    final showFilled = showComplete
        ? stampCount
        : filled.clamp(0, stampCount - 1);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 5,
          runSpacing: 5,
          children: List.generate(stampCount, (i) {
            final isGift = i == stampCount - 1;
            final isFilled = showComplete ? true : i < showFilled;
            return Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isFilled ? accent : Colors.transparent,
                border: isFilled
                    ? null
                    : Border.all(
                        color: FregoColors.neutral200,
                        width: 1.4,
                      ),
              ),
              child: isGift
                  ? Icon(
                      FregoIcons.gift,
                      size: 12,
                      color: isFilled ? Colors.white : FregoColors.neutral400,
                    )
                  : isFilled
                      ? const Icon(
                          FregoIcons.stampCheck,
                          size: 12,
                          color: Colors.white,
                        )
                      : null,
            );
          }),
        ),
        const SizedBox(height: 6),
        Text(
          canRedeem
              ? (showRewardInline ? 'Pronto · $reward' : 'Pronto para resgatar')
              : hasFullSet
                  ? '$actualNeeded/$actualNeeded'
                  : '${actualCurrent.clamp(0, actualNeeded)}/$actualNeeded'
                      '${remaining > 0 ? ' · faltam $remaining' : ''}',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11,
            fontWeight: canRedeem ? FontWeight.w600 : FontWeight.w500,
            color: canRedeem ? accent : FregoColors.neutral500,
          ),
        ),
        if (statusHint != null && statusHint!.trim().isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            statusHint!,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: FregoColors.neutral500,
            ),
          ),
        ],
      ],
    );
  }
}

class _PointsBody extends StatelessWidget {
  const _PointsBody({
    required this.current,
    required this.needed,
    required this.remaining,
    required this.reward,
    required this.canRedeem,
    required this.showRewardInline,
    required this.accent,
    this.pointsPerReal,
  });

  final int current;
  final int needed;
  final int remaining;
  final String reward;
  final bool canRedeem;
  final bool showRewardInline;
  final Color accent;
  final int? pointsPerReal;

  @override
  Widget build(BuildContext context) {
    final pct = needed <= 0
        ? 0.0
        : (canRedeem ? 1.0 : (current / needed).clamp(0.0, 1.0));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              '${canRedeem ? needed : current}',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.5,
                height: 1,
                color: canRedeem ? accent : FregoColors.ink,
              ),
            ),
            const SizedBox(width: 4),
            const Text(
              '/ ',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: FregoColors.neutral400,
              ),
            ),
            Text(
              '$needed pts',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: FregoColors.neutral500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: pct,
            minHeight: 6,
            backgroundColor: FregoColors.neutral100,
            color: accent,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          canRedeem
              ? (showRewardInline ? 'Pronto · $reward' : 'Pronto para resgatar')
              : '${pointsPerReal != null ? 'R\$ $pointsPerReal → 1 pt · ' : ''}'
                  'faltam $remaining',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 11,
            fontWeight: canRedeem ? FontWeight.w600 : FontWeight.w500,
            color: canRedeem ? accent : FregoColors.neutral500,
          ),
        ),
      ],
    );
  }
}

class _BirthdayBody extends StatelessWidget {
  const _BirthdayBody({
    required this.reward,
    required this.accent,
    this.statusHint,
    this.showReward = true,
  });

  final String reward;
  final Color accent;
  final String? statusHint;
  final bool showReward;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFFDF2F8),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Text('🎂', style: TextStyle(fontSize: 14)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              showReward
                  ? '$reward · ${statusHint ?? '1× ao ano'}'
                  : (statusHint ?? 'No aniversário · 1× ao ano'),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: Color(0xFF9D174D),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PromoBody extends StatelessWidget {
  const _PromoBody({
    required this.reward,
    this.statusHint,
    this.showReward = true,
    this.calendar,
  });

  final String reward;
  final String? statusHint;
  final bool showReward;
  final PromoCalendar? calendar;

  @override
  Widget build(BuildContext context) {
    final ends = calendar != null ? promoEndsLine(calendar!) : null;
    final days = calendar?.weekdays ?? const <int>[];
    final restricted = calendar?.restrictsWeekdays == true;
    final weekdaysText =
        calendar != null ? promoWeekdaysLine(calendar!) : null;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: FregoColors.promoBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FregoIcons.promo(size: 14, color: FregoColors.promo),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  showReward
                      ? '$reward · ${statusHint ?? 'Resgate na loja'}'
                      : (statusHint ?? 'Promoção · resgate na loja'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: FregoColors.promo,
                  ),
                ),
              ),
            ],
          ),
          if (ends != null) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(
                  FregoIcons.calendar,
                  size: 12,
                  color: FregoColors.promo,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    ends,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: FregoColors.promo,
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 6),
          if (restricted)
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                for (final d in days)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: FregoColors.promoRing),
                    ),
                    child: Text(
                      kPromoWeekdayLabels[d],
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: FregoColors.promo,
                      ),
                    ),
                  ),
              ],
            )
          else
            Text(
              weekdaysText ?? 'Todos os dias',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: FregoColors.promo,
              ),
            ),
        ],
      ),
    );
  }
}

class _CardCta extends StatelessWidget {
  const _CardCta({
    required this.label,
    required this.enabled,
    required this.accent,
    this.onPressed,
  });

  final String label;
  final bool enabled;
  final Color accent;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    if (cupertino) {
      return SizedBox(
        width: double.infinity,
        child: CupertinoButton(
          padding: const EdgeInsets.symmetric(vertical: 9),
          borderRadius: BorderRadius.circular(11),
          color: enabled ? accent : FregoColors.neutral100,
          onPressed: enabled ? onPressed : null,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: enabled ? Colors.white : FregoColors.neutral400,
            ),
          ),
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      child: FilledButton(
        onPressed: enabled ? onPressed : null,
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: Colors.white,
          disabledBackgroundColor: FregoColors.neutral100,
          disabledForegroundColor: FregoColors.neutral400,
          minimumSize: const Size.fromHeight(36),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(11),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
      ),
    );
  }
}
