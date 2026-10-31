/// Parse a BR money string ("42", "42,50", "R$ 1.234,56") to cents.
int? parseMoneyToCents(String raw) {
  final trimmed = raw.trim();
  if (trimmed.isEmpty) return null;
  final hasComma = trimmed.contains(',');
  final cleaned = trimmed.replaceAll(RegExp(r'[^\d,.\-]'), '');
  final normalized = hasComma
      ? cleaned.replaceAll('.', '').replaceAll(',', '.')
      : cleaned.replaceAll('.', '');
  if (normalized.isEmpty) return null;
  final n = double.tryParse(normalized);
  if (n == null || !n.isFinite || n <= 0) return null;
  return (n * 100).round();
}

int previewPoints({required int amountCents, required int pointsPerReal}) {
  if (amountCents <= 0 || pointsPerReal <= 0) return 0;
  return (amountCents ~/ 100) ~/ pointsPerReal;
}

/// Ceiling for Usar. No compra yet means the ceiling is the saldo.
int maxCashbackUseCents({
  required int? compraCents,
  required int balanceCents,
  required int? multiple,
}) {
  if (balanceCents <= 0) return 0;
  if (compraCents == null) return balanceCents;
  final compra = compraCents < 0 ? 0 : compraCents;
  final byCompra = balanceCents < compra ? balanceCents : compra;
  if (multiple == null || multiple < 2) return byCompra;
  final byMultiple = compra ~/ multiple;
  return byCompra < byMultiple ? byCompra : byMultiple;
}

bool cashbackMultipleBinds({
  required int? compraCents,
  required int balanceCents,
  required int maxApplyCents,
  required int? multiple,
}) {
  return compraCents != null &&
      multiple != null &&
      multiple >= 2 &&
      balanceCents > 0 &&
      maxApplyCents < balanceCents;
}

String cashbackUseAllLabel({
  required int maxApplyCents,
  required bool binds,
}) {
  if (binds && maxApplyCents > 0) return 'Usar até ${formatBrl(maxApplyCents)}';
  return 'Usar todo o saldo';
}

String cashbackUseSlip({
  required int applyCents,
  required int paidCents,
  required int previewCashback,
  required bool compraTyped,
  required int maxApplyCents,
  required int? multiple,
  required bool binds,
}) {
  if (applyCents <= 0) {
    if (binds && maxApplyCents <= 0 && multiple != null) {
      return 'A compra cobre até $multiple×';
    }
    return 'Marque para usar o saldo todo, ou informe um valor.';
  }
  if (!compraTyped) return '− ${formatBrl(applyCents)} do saldo';
  final atCap = binds && applyCents == maxApplyCents;
  var base = '− ${formatBrl(applyCents)} · a pagar ${formatBrl(paidCents)}';
  if (atCap && multiple != null) base += ' · a compra cobre até $multiple×';
  if (previewCashback > 0) base += ' · entra + ${formatBrl(previewCashback)}';
  return base;
}

int previewCashbackCents({
  required int paidCents,
  required int percent,
}) {
  if (paidCents <= 0 || percent <= 0) return 0;
  return (paidCents * percent) ~/ 100;
}

String formatBrl(int cents) {
  final value = cents / 100;
  return 'R\$ ${value.toStringAsFixed(2).replaceAll('.', ',')}';
}

String formatCentsAsInput(int cents) {
  final whole = cents.abs() ~/ 100;
  final frac = (cents.abs() % 100).toString().padLeft(2, '0');
  final wholeStr = whole.toString().replaceAllMapped(
    RegExp(r'(\d)(?=(\d{3})+$)'),
    (m) => '${m[1]}.',
  );
  return '$wholeStr,$frac';
}

/// Digit-as-cents mask as you type: 1 → 0,01 · 100 → 1,00 · 122222 → 1.222,22
String maskMoneyInput(String raw) {
  var digits = raw.replaceAll(RegExp(r'\D'), '');
  digits = digits.replaceFirst(RegExp(r'^0+(?=\d)'), '');
  if (digits.length > 10) digits = digits.substring(0, 10);
  if (digits.isEmpty) return '';
  final cents = int.tryParse(digits);
  if (cents == null || cents <= 0) return '';
  return formatCentsAsInput(cents);
}
