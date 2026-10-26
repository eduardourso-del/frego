import 'package:flutter/material.dart';

import '../theme/frego_icons.dart';
import '../theme/frego_theme.dart';

/// Prêmios the Cliente can Resgatar now, in the same order as the memberships.
List<String> readyRewardLines(List<Map<String, dynamic>> memberships) {
  final lines = <String>[];
  for (final membership in memberships) {
    final business = membership['business'] as Map<String, dynamic>? ?? {};
    final businessName = (business['name'] as String?)?.trim() ?? '';
    final campaigns = membership['campaigns'] as List<dynamic>? ?? const [];
    for (final raw in campaigns) {
      if (raw is! Map) continue;
      final campaign = Map<String, dynamic>.from(raw);
      if (campaign['canRedeem'] != true || campaign['type'] == 'cashback') {
        continue;
      }
      final reward = (campaign['rewardTitle'] as String?)?.trim();
      final name = (campaign['campaignName'] as String?)?.trim();
      final title = reward != null && reward.isNotEmpty
          ? reward
          : name != null && name.isNotEmpty
              ? name
              : 'Prêmio';
      lines.add(businessName.isEmpty ? title : '$title · $businessName');
    }
  }
  return lines;
}

String readyRewardsTitle(int count) {
  if (count == 1) return 'Você tem 1 prêmio pronto';
  return 'Você tem $count prêmios prontos';
}

/// First prêmio, then “e mais N” when others are ready.
String readyRewardsSubtitle(List<String> lines) {
  if (lines.isEmpty) return '';
  if (lines.length == 1) return lines.first;
  final extra = lines.length - 1;
  return '${lines.first} · e mais $extra';
}

/// Gift card shared by Explorar and Lojas. Tap opens Prêmios → Prontos.
class ReadyRewardsCard extends StatelessWidget {
  const ReadyRewardsCard({
    super.key,
    required this.lines,
    required this.onTap,
  });

  final List<String> lines;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF041828).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FregoColors.mostarda,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    FregoIcons.gift,
                    color: FregoColors.ink,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        readyRewardsTitle(lines.length),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                          color: FregoColors.ink,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                      if (lines.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          readyRewardsSubtitle(lines),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.35,
                            color: FregoColors.neutral500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(
                    FregoIcons.chevronRight,
                    size: 18,
                    color: FregoColors.neutral400,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
