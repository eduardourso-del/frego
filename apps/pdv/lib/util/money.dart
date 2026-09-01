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
