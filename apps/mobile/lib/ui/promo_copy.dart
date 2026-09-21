// Copy and calendar for Promoção in the customer app.

const kPromoWeekdayLabels = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
];

const _periodLabel = {
  'day': 'por dia',
  'week': 'por semana',
  'month': 'por mês',
  'year': 'por ano',
  'campaign': 'nesta campanha',
};

class PromoCalendar {
  const PromoCalendar({
    this.startsOn,
    this.endsOn,
    this.weekdays = const [],
    this.redeemMax,
    this.redeemPeriod,
  });

  final String? startsOn;
  final String? endsOn;
  final List<int> weekdays;
  final int? redeemMax;
  final String? redeemPeriod;

  factory PromoCalendar.fromCampaign(Map<String, dynamic> c) {
    return PromoCalendar(
      startsOn: _ymd(c['startsOn']),
      endsOn: _ymd(c['endsOn']),
      weekdays: parsePromoWeekdays(c['weekdays']),
      redeemMax: (c['redeemMax'] as num?)?.toInt(),
      redeemPeriod: c['redeemPeriod'] as String?,
    );
  }

  bool get restrictsWeekdays => weekdays.isNotEmpty && weekdays.length < 7;
}

List<int> parsePromoWeekdays(dynamic raw) {
  if (raw is! List) return const [];
  final days = raw
      .whereType<num>()
      .map((n) => n.toInt())
      .where((d) => d >= 0 && d <= 6)
      .toSet()
      .toList()
    ..sort();
  return days;
}

String? promoEndsLine(PromoCalendar calendar) {
  final when = _formatUnlockDate(calendar.endsOn);
  if (when == null) return null;
  return 'Válida até $when';
}

String promoWeekdaysLine(PromoCalendar calendar) {
  if (!calendar.restrictsWeekdays) return 'Todos os dias';
  return calendar.weekdays.map((d) => kPromoWeekdayLabels[d]).join(', ');
}

String promoFrequencyLine(PromoCalendar calendar) {
  final n = calendar.redeemMax;
  if (n == null) return 'Sem limite de resgates';
  final period = _periodLabel[calendar.redeemPeriod ?? 'campaign'] ?? 'nesta campanha';
  return '$n resgate${n == 1 ? '' : 's'} $period';
}

String promoStatusLine({
  required String? lockedReason,
  required bool canRedeem,
  String? unlocksAt,
}) {
  if (canRedeem) return 'Disponível agora · resgate na loja';
  switch (lockedReason) {
    case 'outside_dates':
      final when = _formatUnlockDate(unlocksAt);
      return when != null
          ? 'Fora do período · libera $when'
          : 'Fora do período desta promoção';
    case 'wrong_weekday':
      final when = _formatUnlockDate(unlocksAt);
      return when != null
          ? 'Não vale hoje · próximo dia $when'
          : 'Não vale neste dia da semana';
    case 'quota_exhausted':
      final when = _formatUnlockDate(unlocksAt);
      return when != null
          ? 'Já resgatado neste período · libera $when'
          : 'Você já resgatou esta promoção';
    case 'open_voucher':
      return 'Você já tem um código aberto';
    case 'audience':
      return 'Promo exclusiva para outro perfil de cliente';
    default:
      return 'Promoção da casa';
  }
}

String promoButtonLabel({
  required String? lockedReason,
  required bool canRedeem,
}) {
  if (canRedeem) return 'Resgatar e mostrar';
  switch (lockedReason) {
    case 'open_voucher':
      return 'Código aberto';
    case 'quota_exhausted':
      return 'Já resgatado';
    case 'audience':
      return 'Indisponível pra você';
    default:
      return 'Ainda não liberou';
  }
}

String? _ymd(dynamic value) {
  if (value == null) return null;
  final s = value.toString();
  if (s.length < 10) return null;
  return s.substring(0, 10);
}

String? _formatUnlockDate(String? iso) {
  if (iso == null || iso.isEmpty) return null;
  if (iso.length >= 10) {
    final parts = iso.substring(0, 10).split('-');
    if (parts.length == 3) {
      final year = int.tryParse(parts[0]);
      final month = int.tryParse(parts[1]);
      final day = int.tryParse(parts[2]);
      if (year != null &&
          month != null &&
          day != null &&
          month >= 1 &&
          month <= 12) {
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
        final stamp = '$day ${months[month - 1]}';
        return year == DateTime.now().year ? stamp : '$stamp $year';
      }
    }
  }
  return null;
}
