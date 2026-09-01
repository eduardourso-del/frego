/// Digits only (strips mask).
String digitsOnly(String value) => value.replaceAll(RegExp(r'\D'), '');

String _clipPhone(String value) {
  final d = digitsOnly(value);
  return d.length > 11 ? d.substring(0, 11) : d;
}

/// Máscara BR com DDD: (11) 98765-4321 ou (11) 3456-7890
String formatPhoneBr(String value) {
  final d = _clipPhone(value);
  if (d.isEmpty) return '';
  if (d.length <= 2) return '($d';
  if (d.length <= 6) return '(${d.substring(0, 2)}) ${d.substring(2)}';
  if (d.length <= 10) {
    return '(${d.substring(0, 2)}) ${d.substring(2, 6)}-${d.substring(6)}';
  }
  return '(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}';
}

/// Valor pronto para a API (só dígitos com DDD).
String phoneDigitsForApi(String value) => _clipPhone(value);
