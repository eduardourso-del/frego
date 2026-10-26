import 'package:flutter/material.dart';

import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import 'explore_feed.dart';

const explorePlaceCardWidth = 232.0;
const exploreCampaignCardWidth = 200.0;

class ExplorePlaceCard extends StatelessWidget {
  const ExplorePlaceCard({
    super.key,
    required this.place,
    required this.onOpen,
    required this.onFavorite,
    this.favoriteBusy = false,
  });

  final ExplorePlace place;
  final VoidCallback onOpen;
  final VoidCallback onFavorite;
  final bool favoriteBusy;

  @override
  Widget build(BuildContext context) {
    final business = place.business;
    final name = business.name;
    final letter = name.trim().isEmpty ? 'F' : name.trim()[0].toUpperCase();
    final brand = Color(parseHexColor(business.primaryColor) ?? 0xFF070707);
    final hero = business.heroImageUrl;
    final hasHero = hero != null && hero.isNotEmpty;
    final slogan = business.slogan?.trim();

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(17),
                ),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (hasHero)
                        Image.network(
                          hero,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(color: brand),
                        )
                      else
                        ColoredBox(color: brand),
                      if (!hasHero)
                        Center(
                          child: ExploreAvatar(
                            letter: letter,
                            logoUrl: business.logoUrl,
                            color: brand,
                            size: 56,
                          ),
                        ),
                      Positioned(
                        top: 8,
                        right: 8,
                        child: ExploreFavoriteButton(
                          favorite: place.isFavorite,
                          busy: favoriteBusy,
                          onTap: onFavorite,
                        ),
                      ),
                      if (hasHero)
                        Positioned(
                          left: 10,
                          bottom: 10,
                          child: ExploreAvatar(
                            letter: letter,
                            logoUrl: business.logoUrl,
                            color: brand,
                            bordered: true,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: FregoColors.ink,
                      ),
                    ),
                    if (slogan != null && slogan.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          slogan,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 13,
                            height: 1.3,
                            color: FregoColors.neutral500,
                          ),
                        ),
                      ),
                    if (place.hasMembership)
                      const Padding(
                        padding: EdgeInsets.only(top: 8),
                        child: ExploreTag(
                          label: 'Seu clube',
                          fill: FregoColors.mostarda,
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ExploreCampaignCard extends StatelessWidget {
  const ExploreCampaignCard({
    super.key,
    required this.campaign,
    required this.onOpen,
  });

  final ExploreCampaign campaign;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final letter = campaign.businessName.trim().isEmpty
        ? 'F'
        : campaign.businessName.trim()[0].toUpperCase();
    final image = campaign.rewardImageUrl;
    final hasImage = image != null && image.isNotEmpty;
    final accent = Color(parseHexColor(campaign.primaryColor) ?? 0xFF070707);
    final description = campaign.rewardDescription?.trim();
    final showDescription =
        description != null &&
        description.isNotEmpty &&
        description != campaign.line;
    final hasProgress =
        campaign.progressNeeded != null && campaign.progressCurrent != null;

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(17),
                ),
                child: SizedBox(
                  height: 96,
                  child: hasImage
                      ? Image.network(
                          image,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => _logoFill(letter),
                        )
                      : _logoFill(letter),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      campaign.businessName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: FregoColors.neutral500,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _CampaignKindChip(
                      type: campaign.type,
                      label: campaign.kindLabel,
                      accent: accent,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      campaign.line,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 15,
                        height: 1.25,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: FregoColors.ink,
                      ),
                    ),
                    if (campaign.type == 'birthday' &&
                        campaign.detailLine != null) ...[
                      const SizedBox(height: 4),
                      Text(
                        campaign.detailLine!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.3,
                          fontWeight: FontWeight.w500,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ] else if (showDescription) ...[
                      const SizedBox(height: 4),
                      Text(
                        description,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          height: 1.3,
                          fontWeight: FontWeight.w500,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ],
                    if (campaign.showsStamps && hasProgress) ...[
                      const SizedBox(height: 8),
                      _StampProgress(
                        filled: campaign.progressCurrent!,
                        needed: campaign.progressNeeded!,
                        complete: campaign.canRedeem,
                        accent: accent,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        campaign.progressLabel ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: campaign.canRedeem
                              ? FontWeight.w600
                              : FontWeight.w500,
                          color: campaign.canRedeem
                              ? accent
                              : FregoColors.neutral500,
                        ),
                      ),
                    ] else if (hasProgress) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(FregoRadius.pill),
                        child: LinearProgressIndicator(
                          value:
                              campaign.progressCurrent! /
                              campaign.progressNeeded!,
                          minHeight: 6,
                          backgroundColor: FregoColors.neutral100,
                          color: accent,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        campaign.progressLabel ?? '',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: campaign.canRedeem
                              ? FontWeight.w600
                              : FontWeight.w500,
                          color: campaign.canRedeem
                              ? accent
                              : FregoColors.neutral500,
                        ),
                      ),
                    ] else if (campaign.type == 'cashback' &&
                        (campaign.cashbackBalanceCents ?? 0) > 0) ...[
                      const SizedBox(height: 6),
                      Text(
                        'Saldo R\$ ${(campaign.cashbackBalanceCents! / 100).toStringAsFixed(2).replaceAll('.', ',')}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _logoFill(String letter) {
    return ColoredBox(
      color: FregoColors.primary50,
      child: Center(
        child: ExploreAvatar(
          letter: letter,
          logoUrl: campaign.logoUrl,
          color: FregoColors.ink,
          size: 48,
        ),
      ),
    );
  }
}

class _StampProgress extends StatelessWidget {
  const _StampProgress({
    required this.filled,
    required this.needed,
    required this.complete,
    required this.accent,
  });

  final int filled;
  final int needed;
  final bool complete;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final count = needed.clamp(1, 12);
    final shown = complete
        ? count
        : (needed <= count ? filled : ((filled / needed) * (count - 1)).floor())
              .clamp(0, count - 1);
    return Wrap(
      spacing: 4,
      runSpacing: 4,
      children: [
        for (var i = 0; i < count; i++)
          _StampDot(
            filled: complete || i < shown,
            gift: i == count - 1,
            accent: accent,
          ),
      ],
    );
  }
}

class _StampDot extends StatelessWidget {
  const _StampDot({
    required this.filled,
    required this.gift,
    required this.accent,
  });

  final bool filled;
  final bool gift;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 18,
      height: 18,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: filled ? accent : Colors.transparent,
        border: filled
            ? null
            : Border.all(color: FregoColors.neutral200, width: 1.4),
      ),
      child: gift
          ? Icon(
              FregoIcons.gift,
              size: 10,
              color: filled ? FregoColors.white : FregoColors.neutral400,
            )
          : filled
          ? const Icon(
              FregoIcons.stampCheck,
              size: 11,
              color: FregoColors.white,
            )
          : null,
    );
  }
}

class _CampaignKindChip extends StatelessWidget {
  const _CampaignKindChip({
    required this.type,
    required this.label,
    required this.accent,
  });

  final String type;
  final String label;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final isSpend = type == 'spend' || type == 'points';
    final isBirthday = type == 'birthday';
    final isCashback = type == 'cashback';
    final isPromo = type == 'promo';
    final bg = isSpend
        ? const Color(0xFFFFF8E8)
        : isBirthday
        ? const Color(0xFFFDF2F8)
        : isCashback
        ? FregoColors.cashbackBg
        : isPromo
        ? FregoColors.promoBg
        : accent.withValues(alpha: 0.12);
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

class ExploreFavoriteButton extends StatelessWidget {
  const ExploreFavoriteButton({
    super.key,
    required this.favorite,
    required this.onTap,
    this.busy = false,
  });

  final bool favorite;
  final VoidCallback onTap;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: FregoColors.card,
          shape: BoxShape.circle,
          border: Border.all(color: FregoColors.hairline),
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            favorite ? FregoIcons.favoriteFilled : FregoIcons.favorite,
            size: 18,
            color: favorite ? FregoColors.danger : FregoColors.neutral500,
          ),
        ),
      ),
    );
  }
}

class ExploreAvatar extends StatelessWidget {
  const ExploreAvatar({
    super.key,
    required this.letter,
    required this.color,
    this.logoUrl,
    this.size = 36,
    this.bordered = false,
  });

  final String letter;
  final Color color;
  final String? logoUrl;
  final double size;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final radius = size > 56 ? 16.0 : 10.0;
    return Container(
      padding: bordered ? const EdgeInsets.all(2) : EdgeInsets.zero,
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(radius + 2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          width: size,
          height: size,
          color: color,
          alignment: Alignment.center,
          child: logoUrl != null && logoUrl!.isNotEmpty
              ? Image.network(
                  logoUrl!,
                  fit: BoxFit.cover,
                  width: size,
                  height: size,
                )
              : Text(
                  letter,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size * 0.38,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }
}

class ExploreTag extends StatelessWidget {
  const ExploreTag({
    super.key,
    required this.label,
    this.fill = FregoColors.primary50,
    this.foreground = FregoColors.ink,
  });

  final String label;
  final Color fill;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: foreground,
        ),
      ),
    );
  }
}

class ExploreRowHeader extends StatelessWidget {
  const ExploreRowHeader({
    super.key,
    required this.title,
    this.count = 0,
    this.prominent = false,
    this.onSeeAll,
  });

  final String title;
  final int count;
  final bool prominent;
  final VoidCallback? onSeeAll;

  @override
  Widget build(BuildContext context) {
    final titleStyle = TextStyle(
      fontSize: prominent ? FregoType.subSize : FregoType.labelSize,
      fontWeight: FontWeight.w700,
      letterSpacing: prominent ? -0.3 : 0.9,
      height: 1.2,
      color: FregoColors.grafite,
    );
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Flexible(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (prominent) ...[
                  Container(
                    width: 4,
                    height: 16,
                    decoration: BoxDecoration(
                      color: FregoColors.mostarda,
                      borderRadius: BorderRadius.circular(FregoRadius.pill),
                    ),
                  ),
                  const SizedBox(width: 10),
                ],
                Flexible(
                  child: Text(
                    prominent ? title : title.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: titleStyle,
                  ),
                ),
                if (count > 0) ...[
                  const SizedBox(width: 8),
                  Text(
                    '$count',
                    style: TextStyle(
                      fontSize: prominent
                          ? FregoType.supportSize
                          : FregoType.labelSize,
                      fontWeight: FontWeight.w600,
                      color: FregoColors.neutral500,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (onSeeAll != null) ...[
            const SizedBox(width: 12),
            GestureDetector(
              onTap: onSeeAll,
              behavior: HitTestBehavior.opaque,
              child: const Padding(
                padding: EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Ver todas',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: FregoColors.grafite,
                      ),
                    ),
                    Icon(
                      FregoIcons.chevronRight,
                      size: 18,
                      color: FregoColors.grafite,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

int? parseHexColor(String? raw) {
  if (raw == null) return null;
  final cleaned = raw.replaceAll('#', '').trim();
  if (cleaned.length != 6) return null;
  return int.tryParse('FF$cleaned', radix: 16);
}
