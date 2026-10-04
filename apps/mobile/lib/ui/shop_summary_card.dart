import 'package:flutter/material.dart';

import '../theme/frego_icons.dart';
import '../theme/frego_theme.dart';

/// Compact, tappable shop identity — logo, name, type, address.
class ShopSummaryCard extends StatelessWidget {
  const ShopSummaryCard({
    super.key,
    required this.business,
    required this.onTap,
  });

  final Map<String, dynamic>? business;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (business == null) return const SizedBox.shrink();

    final name = (business!['name'] as String?)?.trim();
    if (name == null || name.isEmpty) return const SizedBox.shrink();

    final slogan = (business!['slogan'] as String?)?.trim();
    final typeLabel = FregoBusinessTypes.labelOf(business!['type'] as String?);
    final logoUrl = business!['logoUrl'] as String?;
    final letter = name[0].toUpperCase();
    final accent = Color(
      _parseHex(business!['primaryColor'] as String?) ?? 0xFF070707,
    );
    final address = _primaryAddressLine(
      (business!['locations'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>(),
    );

    final info = Padding(
      padding: const EdgeInsets.fromLTRB(12, 12, 8, 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _Logo(letter: letter, logoUrl: logoUrl, color: accent),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  typeLabel,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.04,
                    color: FregoColors.neutral400,
                  ),
                ),
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
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ),
                if (address != null) ...[
                  const SizedBox(height: 6),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.only(top: 1),
                        child: Icon(
                          FregoIcons.location,
                          size: 13,
                          color: FregoColors.neutral400,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          address,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.3,
                            color: FregoColors.neutral500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const Icon(
            FregoIcons.chevronRight,
            color: FregoColors.neutral400,
          ),
        ],
      ),
    );

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          decoration: BoxDecoration(
            color: FregoColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: FregoColors.hairline),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.045),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: info,
        ),
      ),
    );
  }

  static String? _primaryAddressLine(List<Map<String, dynamic>> locations) {
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

  static int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }
}

class _Logo extends StatelessWidget {
  const _Logo({
    required this.letter,
    required this.color,
    this.logoUrl,
  });

  final String letter;
  final Color color;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 52,
        height: 52,
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
      ),
    );
  }

  Widget _fallback() {
    return ColoredBox(
      color: color,
      child: Center(
        child: Text(
          letter,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 22,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
