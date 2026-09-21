class ApiException implements Exception {
  ApiException({required this.code, this.message, this.statusCode = 400});

  final String code;
  final String? message;
  final int statusCode;

  String get humanMessage {
    switch (code) {
      case 'LOCATION_REQUIRED':
        return 'Seu usuário precisa estar vinculado a uma unidade. '
            'Peça ao dono para definir no painel.';
      case 'NOT_A_TEAM_MEMBER':
        return 'Este e-mail não está em nenhuma loja Frego';
      case 'AMOUNT_REQUIRED':
      case 'AMOUNT_TOO_SMALL':
        return 'Informe um valor de compra maior';
      case 'BUSINESS_NOT_ACTIVE':
        return 'Esta loja não está ativa';
      case 'MEMBERSHIP_NOT_FOUND':
        return 'Cliente não encontrado nesta loja';
      case 'INVALID_LOCATION':
        return 'Unidade inválida para este usuário';
      case 'VOUCHER_NOT_FOUND':
        return 'Voucher não encontrado nesta loja';
      case 'VOUCHER_EXPIRED':
        return message ?? 'Voucher expirou (válido por 24h)';
      case 'ALREADY_REVERSED':
        return message ?? 'Este lançamento já foi desfeito.';
      case 'REVERSE_USED':
      case 'REVERSE_EXPIRED':
      case 'REVERSE_VOUCHER':
      case 'REVERSE_NOT_STAFF':
        return message ?? 'Não foi possível desfazer.';
      case 'INVALID_VOUCHER':
        return 'Voucher inválido';
      case 'AUTH':
        return message ?? 'Sessão expirada. Entre de novo.';
      default:
        return message ?? code;
    }
  }

  @override
  String toString() => humanMessage;
}

String humanizeError(Object error) {
  if (error is ApiException) return error.humanMessage;
  return error.toString().replaceFirst('Exception: ', '');
}
