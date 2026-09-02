import 'package:flutter/material.dart';

import '../theme/frego_icons.dart';
import '../theme/frego_theme.dart';

String _formatBrl(int cents) {
  final v = cents / 100;
  return 'R\$ ${v.toStringAsFixed(2).replaceAll('.', ',')}';
}

/// Lista de lotes restantes do saldo (ganho + validade).
class BalanceLotsSection extends StatelessWidget {
  const BalanceLotsSection({
    super.key,
    required this.lots,
    this.title = 'Saldo e validade',
    this.subtitle =
        'Cada ganho tem a própria validade. O mais antigo é usado primeiro.',
    this.showShopName = false,
    this.emptyLabel,
    this.previewLimit,
    this.onSeeMore,
    this.seeMoreLabel = 'Ver mais',
    this.onLotTap,
  });

  final List<Map<String, dynamic>> lots;
  final String title;
  final String subtitle;
  final bool showShopName;
  final String? emptyLabel;
  /// When set and lots exceed this count, only show this many + "Ver mais".
  final int? previewLimit;
  final VoidCallback? onSeeMore;
  final String seeMoreLabel;
  final ValueChanged<Map<String, dynamic>>? onLotTap;

  @override
  Widget build(BuildContext context) {
    final limit = previewLimit;
    final truncated = limit != null && lots.length > limit;
    final visible = truncated
        ? lots.take(limit).toList(growable: false)
        : lots;
    final showSeeMore = onSeeMore != null && lots.isNotEmpty;

    if (lots.isEmpty) {
      if (emptyLabel == null) return const SizedBox.shrink();
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: title),
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: FregoColors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: FregoColors.hairline),
            ),
            child: Text(
              emptyLabel!,
              style: const TextStyle(
                fontSize: 13,
                color: FregoColors.neutral500,
              ),
            ),
          ),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _SectionHeader(
          title: title,
          trailing: showSeeMore
              ? TextButton(
                  onPressed: onSeeMore,
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    foregroundColor: FregoColors.primary500,
                  ),
                  child: Text(
                    seeMoreLabel,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                )
              : null,
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            fontSize: 13,
            height: 1.35,
            color: FregoColors.neutral500,
          ),
        ),
        const SizedBox(height: 10),
        ...visible.map((lot) {
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: BalanceLotTile(
              lot: lot,
              showShopName: showShopName,
              onTap: onLotTap == null ? null : () => onLotTap!(lot),
            ),
          );
        }),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});

  final String title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.04,
              color: FregoColors.neutral400,
            ),
          ),
        ),
        if (trailing != null) trailing!,
      ],
    );
  }
}

class BalanceLotTile extends StatelessWidget {
  const BalanceLotTile({
    super.key,
    required this.lot,
    this.showShopName = false,
    this.onTap,
  });

  final Map<String, dynamic> lot;
  final bool showShopName;
  final VoidCallback? onTap;

  static const _expiringSoon = Color(0xFFB45309); // amber-700, readable on white
  static const _expiringSoft = Color(0xFFC2410C); // slightly warmer when ≤7 days

  @override
  Widget build(BuildContext context) {
    final unitKind = lot['unitKind'] as String? ?? 'stamps';
    final qty = (lot['quantity'] as num?)?.toInt() ?? 0;
    final earnedAt = lot['earnedAt'] as String?;
    final expiresAt = lot['expiresAt'] as String?;
    final daysLeft = (lot['daysLeft'] as num?)?.toInt();
    final business = lot['business'] as Map<String, dynamic>?;
    final shopName = business?['name'] as String?;

    final isPoints = unitKind == 'points';
    final isCashback = unitKind == 'cashback_cents';
    final unitLabel = isCashback
        ? ''
        : isPoints
            ? (qty == 1 ? 'ponto' : 'pontos')
            : (qty == 1 ? 'carimbo' : 'carimbos');
    final qtyLabel = isCashback
        ? '+${_formatBrl(qty)} cashback'
        : '+$qty $unitLabel';
    final expiring = daysLeft != null && expiresAt != null && daysLeft <= 14;
    final urgent = daysLeft != null && daysLeft <= 7;

    final row = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: urgent
                  ? const Color(0xFFFFFBEB)
                  : FregoColors.primary50,
              borderRadius: BorderRadius.circular(11),
            ),
            child: isCashback
                ? FregoIcons.cashback(
                    size: 20,
                    color: urgent ? _expiringSoon : FregoColors.primary500,
                  )
                : isPoints
                    ? FregoIcons.points(
                        size: 20,
                        color: urgent ? _expiringSoon : FregoColors.primary500,
                      )
                    : FregoIcons.stamp(
                        size: 20,
                        color: urgent ? _expiringSoon : FregoColors.primary500,
                      ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  qtyLabel,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                const SizedBox(height: 2),
                Text.rich(
                  TextSpan(
                    style: const TextStyle(
                      fontSize: 12,
                      height: 1.35,
                      color: FregoColors.neutral500,
                      fontWeight: FontWeight.w400,
                    ),
                    children: _subtitleSpans(
                      shopName: showShopName ? shopName : null,
                      earnedAt: earnedAt,
                      expiresAt: expiresAt,
                      daysLeft: daysLeft,
                      expiring: expiring,
                      urgent: urgent,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (onTap != null)
            const Padding(
              padding: EdgeInsets.only(left: 4, top: 10),
              child: Icon(
                FregoIcons.chevronRight,
                size: 18,
                color: FregoColors.neutral400,
              ),
            ),
        ],
    );

    final body = Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: urgent
              ? const Color(0xFFFDE68A).withValues(alpha: 0.9)
              : FregoColors.hairline,
        ),
      ),
      child: row,
    );

    if (onTap == null) return body;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: body,
      ),
    );
  }

  List<InlineSpan> _subtitleSpans({
    required String? shopName,
    required String? earnedAt,
    required String? expiresAt,
    required int? daysLeft,
    required bool expiring,
    required bool urgent,
  }) {
    final spans = <InlineSpan>[];
    void addPlain(String text) {
      if (spans.isNotEmpty) {
        spans.add(const TextSpan(text: ' · '));
      }
      spans.add(TextSpan(text: text));
    }

    void addExpiry(String text) {
      if (spans.isNotEmpty) {
        spans.add(const TextSpan(text: ' · '));
      }
      spans.add(
        TextSpan(
          text: text,
          style: TextStyle(
            color: urgent ? _expiringSoft : _expiringSoon,
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    if (shopName != null && shopName.isNotEmpty) addPlain(shopName);
    final earned = _formatDate(earnedAt);
    if (earned != null) addPlain('Ganho $earned');

    if (expiresAt == null) {
      addPlain('Não expira');
      return spans;
    }

    final exp = _formatDate(expiresAt);
    if (!expiring) {
      if (exp != null) {
        addPlain('Expira $exp');
        if (daysLeft != null) addPlain('$daysLeft dias');
      } else if (daysLeft != null) {
        addPlain('Expira em $daysLeft dias');
      }
      return spans;
    }

    // Expiring soon — color only date + remaining days.
    if (daysLeft == 0) {
      addExpiry(exp != null ? 'Expira hoje ($exp)' : 'Expira hoje');
    } else if (daysLeft == 1) {
      addExpiry(exp != null ? 'Expira amanhã ($exp)' : 'Expira amanhã');
    } else if (exp != null && daysLeft != null) {
      addExpiry('Expira $exp');
      addExpiry('$daysLeft dias');
    } else if (exp != null) {
      addExpiry('Expira $exp');
    } else if (daysLeft != null) {
      addExpiry('Expira em $daysLeft dias');
    }
    return spans;
  }

  String? _formatDate(String? iso) {
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
}
