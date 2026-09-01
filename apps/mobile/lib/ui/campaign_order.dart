int _cashbackRank(Map<String, dynamic> c) {
  if (c['type'] == 'cashback') {
    if (c['lockedReason'] == 'audience') return 2;
    return 0;
  }
  return 1;
}

int _cashbackPercent(Map<String, dynamic> c) =>
    (c['cashbackPercent'] as num?)?.toInt() ?? 0;

String? earnKindFromCampaignType(String? type) {
  if (type == 'stamps' || type == 'visits') return 'stamps';
  if (type == 'spend') return 'points';
  if (type == 'cashback') return 'cashback';
  return null;
}

Set<String> earnKindsFromCampaigns(Iterable<Map<String, dynamic>> campaigns) {
  final kinds = <String>{};
  for (final c in campaigns) {
    final kind = earnKindFromCampaignType(c['type'] as String?);
    if (kind != null) kinds.add(kind);
  }
  return kinds;
}

/// Cashback elegível primeiro (maior %), depois o resto, travadas por último.
List<T> sortCampaignsForCustomer<T>(
  Iterable<T> raw, {
  required Map<String, dynamic> Function(T item) campaignOf,
}) {
  final list = raw.toList();
  list.sort((a, b) {
    final ca = campaignOf(a);
    final cb = campaignOf(b);
    final ra = _cashbackRank(ca);
    final rb = _cashbackRank(cb);
    if (ra != rb) return ra.compareTo(rb);
    if (ra == 0) {
      return _cashbackPercent(cb).compareTo(_cashbackPercent(ca));
    }
    return 0;
  });
  return list;
}
