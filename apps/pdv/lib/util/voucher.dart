/// Matches API display: K7M-2PQ
String normalizeVoucherCode(String raw) {
  return raw.replaceAll(RegExp(r'[^0-9A-Za-z]'), '').toUpperCase();
}

String formatVoucherInput(String raw) {
  final clean = normalizeVoucherCode(raw);
  final clipped = clean.length <= 6 ? clean : clean.substring(0, 6);
  if (clipped.length <= 3) return clipped;
  return '${clipped.substring(0, 3)}-${clipped.substring(3)}';
}
