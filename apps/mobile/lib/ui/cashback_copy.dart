/// Múltiplo from 2 up. Anything smaller is off.
int? readCashbackUseMultiple(Object? raw) {
  final n = raw is num ? raw.toInt() : null;
  if (n == null || n < 2) return null;
  return n;
}

int? cashbackUseMultipleOf(Iterable<Map<String, dynamic>> campaigns) {
  for (final campaign in campaigns) {
    if (campaign['type'] != 'cashback') continue;
    final multiple = readCashbackUseMultiple(campaign['cashbackUseMultiple']);
    if (multiple != null) return multiple;
  }
  return null;
}

String cashbackMultipleOffer(int multiple) => 'Em compras de $multiple× o valor';
