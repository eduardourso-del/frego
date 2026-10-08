/// Carimbo totals. One destination stays a single number. Several are listed.
int campaignUnits(
  Map<String, dynamic> campaign, {
  required int stamps,
  required int points,
  int cashbackCents = 0,
}) {
  final type = campaign['type'] as String? ?? 'stamps';
  if (type == 'cashback') {
    return (campaign['cashbackBalanceCents'] as num?)?.toInt() ?? cashbackCents;
  }
  final explicit = campaign['balance'];
  if (explicit is num && (type == 'stamps' || type == 'spend')) {
    return explicit.toInt();
  }
  if (type == 'spend') return points;
  return stamps;
}

List<Map<String, dynamic>> stampDestinationsOf(Map membership) {
  final raw = membership['stampDestinations'];
  if (raw is! List) return const [];
  return [
    for (final item in raw)
      if (item is Map) Map<String, dynamic>.from(item),
  ];
}

bool holdsStamps(Map membership) {
  final rows = stampDestinationsOf(membership);
  if (rows.isNotEmpty) {
    return rows.any((d) => ((d['balance'] as num?)?.toInt() ?? 0) > 0);
  }
  final pools = membership['pools'] as Map?;
  return ((pools?['stamps'] as num?)?.toInt() ?? 0) > 0;
}

/// Label on a stamp Campanha when the shop has more than one destination.
String? stampScopeLabel(
  Map<String, dynamic> campaign, {
  required bool split,
}) {
  final type = campaign['type'] as String? ?? '';
  if (!split || type != 'stamps') return null;
  if (campaign['cartela'] == true) return 'Cartela · só este prêmio';
  return 'Saldo compartilhado';
}

String stampSummary(Map membership) {
  final pools = membership['pools'] as Map?;
  final shared = (pools?['stamps'] as num?)?.toInt() ?? 0;
  final rows = stampDestinationsOf(membership);
  if (rows.length <= 1) {
    final n = rows.isEmpty
        ? shared
        : (rows.first['balance'] as num?)?.toInt() ?? shared;
    return n == 1 ? '1 carimbo' : '$n carimbos';
  }
  return rows
      .map((d) {
        final label = d['label'] as String? ?? 'Carimbos';
        final n = (d['balance'] as num?)?.toInt() ?? 0;
        return '$label $n';
      })
      .join(' · ');
}

/// Cross-shop header. A shop with more than one destination is not folded
/// into the number.
({bool split, int units, bool any}) stampHeader(
  Iterable<Map<String, dynamic>> memberships,
) {
  var units = 0;
  var split = false;
  var any = false;
  for (final m in memberships) {
    if (holdsStamps(m)) any = true;
    final rows = stampDestinationsOf(m);
    if (rows.length > 1) {
      split = true;
      continue;
    }
    if (rows.length == 1) {
      units += (rows.first['balance'] as num?)?.toInt() ?? 0;
    } else {
      final pools = m['pools'] as Map?;
      units += (pools?['stamps'] as num?)?.toInt() ?? 0;
    }
  }
  return (split: split, units: units, any: any);
}
