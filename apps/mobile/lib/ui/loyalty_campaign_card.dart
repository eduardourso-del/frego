import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../theme/frego_icons.dart';
import '../theme/frego_theme.dart';
import 'adaptive.dart';

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
    this.busy = false,
  });

  final String businessName;
  final String? businessLogoUrl;
  final int primary;
  final int primaryDark;
  final String campaignName;
  final String campaignType; // stamps | spend | birthday
  final int unitsNeeded;
  final int currentUnits;
  final String rewardTitle;
  final String? rewardDescription;
  final String? rewardImageUrl;
  final bool canRedeem;
  final String buttonLabel;
  final String? statusHint;
  final int? pointsPerReal;
  final bool busy;
  final VoidCallback? onRedeem;

  bool get _isBirthday => campaignType == 'birthday';
  bool get _isSpend => campaignType == 'spend' || campaignType == 'points';

  @override
  Widget build(BuildContext context) {
    final needed = unitsNeeded <= 0 ? 1 : unitsNeeded;
    final inCycle = _isBirthday
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
    final stampSlots = needed.clamp(2, 8);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FregoColors.hairline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Thin brand accent — identity without painting the whole card
            Container(height: 3, color: accent),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Column(
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
                      _TypeChip(type: campaignType, accent: accent),
                    ],
                  ),
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
                                needed: stampSlots,
                                remaining: remaining,
                                reward: reward,
                                accent: accent,
                                canRedeem: canRedeem,
                                actualNeeded: needed,
                                actualCurrent: currentUnits,
                                showRewardInline: !hasImage,
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (!_isBirthday && !hasImage) ...[
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
                  _CardCta(
                    label: buttonLabel,
                    enabled: canRedeem && !busy && onRedeem != null,
                    onPressed: onRedeem,
                    accent: accent,
                  ),
                ],
              ),
            ),
          ],
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
    final label = isBirthday
        ? 'Aniversário'
        : isSpend
            ? 'Pontos'
            : 'Carimbos';
    final icon = isBirthday
        ? FregoIcons.birthday
        : isSpend
            ? FregoIcons.points
            : FregoIcons.stamp;
    final bg = isSpend
        ? const Color(0xFFFFF8E8)
        : isBirthday
            ? const Color(0xFFFDF2F8)
            : accent.withValues(alpha: 0.1);
    final fg = isSpend
        ? const Color(0xFF92400E)
        : isBirthday
            ? const Color(0xFF9D174D)
            : accent;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11, color: fg),
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

  @override
  Widget build(BuildContext context) {
    final showFilled = canRedeem ? needed : filled.clamp(0, needed - 1);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Wrap(
          spacing: 5,
          runSpacing: 5,
          children: List.generate(needed, (i) {
            final isGift = i == needed - 1;
            final isFilled = i < showFilled || (canRedeem && isGift);
            return Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isFilled || isGift
                    ? accent
                    : Colors.transparent,
                border: isFilled || isGift
                    ? null
                    : Border.all(
                        color: FregoColors.neutral200,
                        width: 1.4,
                      ),
              ),
              child: isGift
                  ? const Icon(
                      FregoIcons.gift,
                      size: 12,
                      color: Colors.white,
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
              : '${pointsPerReal != null ? '$pointsPerReal pt/R\$1 · ' : ''}'
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
