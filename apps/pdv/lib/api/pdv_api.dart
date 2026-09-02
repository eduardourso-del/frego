import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/app_config.dart';
import 'api_error.dart';

const _allEarnKinds = ['stamps', 'points', 'cashback'];

List<Map<String, dynamic>> jsonMaps(Object? raw) {
  if (raw is! List) return const [];
  return [
    for (final item in raw)
      if (item is Map) Map<String, dynamic>.from(item),
  ];
}

List<String> parseEarnKinds(Object? raw) {
  if (raw is! List) return const [];
  return [
    for (final item in raw)
      if (item is String && _allEarnKinds.contains(item)) item,
  ];
}

class StaffBusiness {
  const StaffBusiness({
    required this.id,
    required this.name,
    required this.status,
    required this.pointsPerReal,
    this.cashbackPercent = 0,
    this.logoUrl,
    this.role,
    this.primaryColor,
    this.activeEarnKinds = const [],
  });

  final String id;
  final String name;
  final String status;
  final int pointsPerReal;
  final int cashbackPercent;
  final String? logoUrl;
  final String? role;
  final String? primaryColor;
  final List<String> activeEarnKinds;

  bool get isPending => status == 'pending';
  bool get isSuspended => status == 'suspended';
  bool get isActive => status == 'active';

  factory StaffBusiness.fromJson(Map<String, dynamic> json) {
    return StaffBusiness(
      id: json['id'] as String,
      name: json['name'] as String? ?? 'Loja',
      status: json['status'] as String? ?? 'active',
      pointsPerReal: (json['pointsPerReal'] as num?)?.toInt() ?? 1,
      cashbackPercent: (json['cashbackPercent'] as num?)?.toInt() ?? 0,
      logoUrl: json['logoUrl'] as String?,
      role: json['role'] as String?,
      primaryColor: json['primaryColor'] as String?,
      activeEarnKinds: parseEarnKinds(json['activeEarnKinds']),
    );
  }
}

class CustomerMatch {
  const CustomerMatch({
    required this.customerId,
    required this.phoneE164,
    this.displayName,
    this.isVip = false,
    this.membershipId,
    this.associatedHere = true,
  });

  final String customerId;
  final String phoneE164;
  final String? displayName;
  final bool isVip;
  final String? membershipId;
  final bool associatedHere;

  factory CustomerMatch.fromJson(Map<String, dynamic> json) {
    return CustomerMatch(
      customerId: json['customerId'] as String,
      phoneE164: json['phoneE164'] as String,
      displayName: json['displayName'] as String?,
      isVip: json['isVip'] as bool? ?? false,
      membershipId: json['membershipId'] as String?,
      associatedHere: json['associatedHere'] as bool? ?? true,
    );
  }
}

class OpenVoucher {
  const OpenVoucher({
    required this.transactionId,
    required this.voucherCode,
    required this.voucherDisplay,
    required this.rewardTitle,
    this.expiresAt,
  });

  final String transactionId;
  final String voucherCode;
  final String voucherDisplay;
  final String rewardTitle;
  final DateTime? expiresAt;

  factory OpenVoucher.fromJson(Map<String, dynamic> json) {
    final expires = json['expiresAt'];
    return OpenVoucher(
      transactionId:
          json['transactionId'] as String? ?? json['id'] as String? ?? '',
      voucherCode: json['voucherCode'] as String? ?? '',
      voucherDisplay: json['voucherDisplay'] as String? ?? '',
      rewardTitle: json['rewardTitle'] as String? ?? 'Prêmio',
      expiresAt: expires is String
          ? DateTime.tryParse(expires)
          : expires is DateTime
          ? expires
          : null,
    );
  }
}

class CounterSale {
  const CounterSale({
    required this.saleId,
    required this.anchorId,
    required this.summary,
    this.createdAt,
  });

  final String saleId;
  final String anchorId;
  final String summary;
  final DateTime? createdAt;

  bool get isValid => anchorId.isNotEmpty;

  factory CounterSale.fromJson(Map<String, dynamic> json) {
    final anchor =
        json['anchorId'] as String? ?? json['saleId'] as String? ?? '';
    return CounterSale(
      saleId: json['saleId'] as String? ?? anchor,
      anchorId: anchor,
      summary: json['summary'] as String? ?? 'Lançamento',
      createdAt: json['createdAt'] is String
          ? DateTime.tryParse(json['createdAt'] as String)
          : null,
    );
  }

  static CounterSale? tryParse(Object? raw) {
    if (raw is! Map) return null;
    final sale = CounterSale.fromJson(Map<String, dynamic>.from(raw));
    return sale.isValid ? sale : null;
  }
}

List<CounterSale> prependSale(List<CounterSale> current, CounterSale? sale) {
  if (sale == null || !sale.isValid) return current;
  return [
    sale,
    ...current.where(
      (s) => s.saleId != sale.saleId && s.anchorId != sale.anchorId,
    ),
  ].take(8).toList();
}

class LookupResult {
  const LookupResult({
    required this.found,
    this.multiple = false,
    this.last4,
    this.phoneE164,
    this.associatedHere = false,
    this.customerId,
    this.displayName,
    this.membershipId,
    this.isVip = false,
    this.otherShopsCount = 0,
    this.stamps = 0,
    this.points = 0,
    this.cashbackCents = 0,
    this.pointsPerReal,
    this.cashbackPercent,
    this.matches = const [],
    this.openVouchers = const [],
    this.recentSales = const [],
    this.activeEarnKinds = const [],
    this.earnKindsFromApi = false,
  });

  final bool found;
  final bool multiple;
  final String? last4;
  final String? phoneE164;
  final bool associatedHere;
  final String? customerId;
  final String? displayName;
  final String? membershipId;
  final bool isVip;
  final int otherShopsCount;
  final int stamps;
  final int points;
  final int cashbackCents;
  final int? pointsPerReal;
  final int? cashbackPercent;
  final List<CustomerMatch> matches;
  final List<OpenVoucher> openVouchers;
  final List<CounterSale> recentSales;
  final List<String> activeEarnKinds;
  final bool earnKindsFromApi;

  LookupResult copyWith({
    int? stamps,
    int? points,
    int? cashbackCents,
    bool? associatedHere,
    String? membershipId,
    List<OpenVoucher>? openVouchers,
    List<CounterSale>? recentSales,
  }) {
    return LookupResult(
      found: found,
      multiple: multiple,
      last4: last4,
      phoneE164: phoneE164,
      associatedHere: associatedHere ?? this.associatedHere,
      customerId: customerId,
      displayName: displayName,
      membershipId: membershipId ?? this.membershipId,
      isVip: isVip,
      otherShopsCount: otherShopsCount,
      stamps: stamps ?? this.stamps,
      points: points ?? this.points,
      cashbackCents: cashbackCents ?? this.cashbackCents,
      pointsPerReal: pointsPerReal,
      cashbackPercent: cashbackPercent,
      matches: matches,
      openVouchers: openVouchers ?? this.openVouchers,
      recentSales: recentSales ?? this.recentSales,
      activeEarnKinds: activeEarnKinds,
      earnKindsFromApi: earnKindsFromApi,
    );
  }

  factory LookupResult.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    final membership = json['membership'] as Map<String, dynamic>?;
    final pools =
        (json['pools'] as Map<String, dynamic>?) ??
        (json['wallet'] is Map
            ? (json['wallet'] as Map)['pools'] as Map<String, dynamic>?
            : null);
    final cashback = json['cashback'] as Map<String, dynamic>?;
    return LookupResult(
      found: json['found'] == true,
      multiple: json['multiple'] == true,
      last4: json['last4'] as String?,
      phoneE164:
          json['phoneE164'] as String? ?? customer?['phoneE164'] as String?,
      associatedHere: json['associatedHere'] == true,
      customerId: customer?['id'] as String?,
      displayName: customer?['displayName'] as String?,
      membershipId: membership?['id'] as String?,
      isVip: membership?['isVip'] as bool? ?? false,
      otherShopsCount: (json['otherShopsCount'] as num?)?.toInt() ?? 0,
      stamps: (pools?['stamps'] as num?)?.toInt() ?? 0,
      points: (pools?['points'] as num?)?.toInt() ?? 0,
      cashbackCents:
          (pools?['cashbackCents'] as num?)?.toInt() ??
          (cashback?['balanceCents'] as num?)?.toInt() ??
          0,
      pointsPerReal: (json['pointsPerReal'] as num?)?.toInt(),
      cashbackPercent:
          (json['cashbackPercent'] as num?)?.toInt() ??
          (cashback?['percent'] as num?)?.toInt(),
      matches: jsonMaps(json['matches']).map(CustomerMatch.fromJson).toList(),
      openVouchers: jsonMaps(json['openVouchers'])
          .map(OpenVoucher.fromJson)
          .where((v) => v.transactionId.isNotEmpty)
          .toList(),
      recentSales: jsonMaps(json['recentSales'])
          .map(CounterSale.fromJson)
          .where((s) => s.isValid)
          .toList(),
      activeEarnKinds: parseEarnKinds(json['activeEarnKinds']),
      earnKindsFromApi: json.containsKey('activeEarnKinds'),
    );
  }
}

class EarnResult {
  const EarnResult({
    required this.message,
    required this.stamps,
    required this.points,
    this.cashbackCents = 0,
    this.sale,
  });

  final String message;
  final int stamps;
  final int points;
  final int cashbackCents;
  final CounterSale? sale;
}

class ReverseResult {
  const ReverseResult({
    required this.message,
    required this.stamps,
    required this.points,
    this.cashbackCents = 0,
  });

  final String message;
  final int stamps;
  final int points;
  final int cashbackCents;
}

class FulfillResult {
  const FulfillResult({
    required this.kind,
    required this.message,
    this.voucherDisplay,
    this.rewardTitle,
    this.customerName,
    this.expiresAt,
    this.usedAt,
    this.transactionId,
    this.voucherCode,
  });

  final FulfillKind kind;
  final String message;
  final String? voucherDisplay;
  final String? rewardTitle;
  final String? customerName;
  final DateTime? expiresAt;
  final DateTime? usedAt;
  final String? transactionId;
  final String? voucherCode;
}

enum FulfillKind { used, alreadyUsed, expired, notFound, error }

class PdvApi {
  PdvApi(this._headers);

  final Future<Map<String, String>> Function() _headers;

  String get _base => AppConfig.apiBaseUrl;

  Future<List<StaffBusiness>> listBusinesses() async {
    final json = await _get('/me/businesses');
    final list = json['businesses'] as List<dynamic>? ?? const [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(StaffBusiness.fromJson)
        .toList();
  }

  Future<StaffBusiness> fetchBusiness() async {
    final json = await _get('/business');
    return StaffBusiness.fromJson(
      json['business'] as Map<String, dynamic>? ?? const {},
    );
  }

  Future<LookupResult> lookup({String? last4, String? phone}) async {
    final json = await _post(
      '/customers/lookup',
      {'last4': ?last4, 'phone': ?phone},
      allowStatuses: const {404},
    );
    return LookupResult.fromJson(json);
  }

  Future<LookupResult> createCustomer({
    required String phone,
    bool addFirstStamp = false,
  }) async {
    final json = await _post('/customers', {
      'phone': phone,
      'addFirstStamp': addFirstStamp,
    });
    final customer = json['customer'] as Map<String, dynamic>? ?? {};
    final membership = json['membership'] as Map<String, dynamic>?;
    final pools =
        (json['pools'] as Map<String, dynamic>?) ??
        (json['wallet'] is Map
            ? (json['wallet'] as Map)['pools'] as Map<String, dynamic>?
            : null);
    final sale = CounterSale.tryParse(json['sale']);
    return LookupResult(
      found: true,
      associatedHere: true,
      phoneE164: customer['phoneE164'] as String?,
      customerId: customer['id'] as String?,
      displayName: customer['displayName'] as String?,
      membershipId: membership?['id'] as String?,
      isVip: membership?['isVip'] as bool? ?? false,
      stamps: (pools?['stamps'] as num?)?.toInt() ?? 0,
      points: (pools?['points'] as num?)?.toInt() ?? 0,
      cashbackCents: (pools?['cashbackCents'] as num?)?.toInt() ?? 0,
      recentSales: sale != null ? [sale] : const [],
    );
  }

  Future<EarnResult> earn({
    required String membershipId,
    required String unitKind,
    int? quantity,
    int? amountCents,
    int? applyCashbackCents,
  }) async {
    final json = await _post('/transactions', {
      'membershipId': membershipId,
      'type': 'stamp',
      'unitKind': unitKind,
      if (amountCents != null) 'amountCents': amountCents,
      if (unitKind != 'points' && unitKind != 'cashback') 'quantity': quantity ?? 1,
      if (applyCashbackCents != null && applyCashbackCents > 0)
        'applyCashbackCents': applyCashbackCents,
    });
    final pools =
        (json['wallet'] is Map
            ? (json['wallet'] as Map)['pools'] as Map<String, dynamic>?
            : null) ??
        json['pools'] as Map<String, dynamic>?;
    final cashback = json['cashback'] as Map<String, dynamic>?;
    return EarnResult(
      message: json['message'] as String? ?? 'Registrado',
      stamps: (pools?['stamps'] as num?)?.toInt() ?? 0,
      points: (pools?['points'] as num?)?.toInt() ?? 0,
      cashbackCents:
          (cashback?['balanceCents'] as num?)?.toInt() ??
          (pools?['cashbackCents'] as num?)?.toInt() ??
          0,
      sale: CounterSale.tryParse(json['sale']),
    );
  }

  Future<ReverseResult> reverseSale(String anchorId) async {
    final json = await _post('/transactions/$anchorId/reverse', {});
    final pools =
        (json['wallet'] is Map
            ? (json['wallet'] as Map)['pools'] as Map<String, dynamic>?
            : null) ??
        json['pools'] as Map<String, dynamic>?;
    final cashback = json['cashback'] as Map<String, dynamic>?;
    return ReverseResult(
      message: json['message'] as String? ?? 'Lançamento desfeito.',
      stamps: (pools?['stamps'] as num?)?.toInt() ?? 0,
      points: (pools?['points'] as num?)?.toInt() ?? 0,
      cashbackCents:
          (cashback?['balanceCents'] as num?)?.toInt() ??
          (pools?['cashbackCents'] as num?)?.toInt() ??
          0,
    );
  }

  Future<FulfillResult> fulfillVoucher({
    String? voucherCode,
    String? transactionId,
    bool acceptExpired = false,
  }) async {
    final json = await _post(
      '/vouchers/fulfill',
      {
        'voucherCode': ?voucherCode,
        'transactionId': ?transactionId,
        if (acceptExpired) 'acceptExpired': true,
      },
      allowStatuses: const {404, 409},
    );
    final error = json['error'] as String?;
    final voucher = json['voucher'] as Map<String, dynamic>?;
    final customer = json['customer'] as Map<String, dynamic>?;
    if (error == 'VOUCHER_NOT_FOUND') {
      return const FulfillResult(
        kind: FulfillKind.notFound,
        message: 'Voucher não encontrado nesta loja',
      );
    }
    if (error == 'VOUCHER_EXPIRED') {
      return FulfillResult(
        kind: FulfillKind.expired,
        message: json['message'] as String? ?? 'Voucher expirou',
        voucherDisplay: voucher?['voucherDisplay'] as String?,
        rewardTitle: voucher?['rewardTitle'] as String?,
        customerName: customer?['displayName'] as String?,
        expiresAt: voucher?['expiresAt'] != null
            ? DateTime.tryParse(voucher!['expiresAt'] as String)
            : null,
        transactionId: voucher?['transactionId'] as String? ?? transactionId,
        voucherCode: voucher?['voucherCode'] as String? ?? voucherCode,
      );
    }
    if (error != null) {
      throw ApiException(code: error, message: json['message'] as String?);
    }
    return FulfillResult(
      kind: json['alreadyUsed'] == true
          ? FulfillKind.alreadyUsed
          : FulfillKind.used,
      message: json['message'] as String? ?? 'Voucher marcado como usado',
      voucherDisplay: voucher?['voucherDisplay'] as String?,
      rewardTitle: voucher?['rewardTitle'] as String?,
      customerName: customer?['displayName'] as String?,
      usedAt: voucher?['usedAt'] != null
          ? DateTime.tryParse(voucher!['usedAt'] as String)
          : null,
      expiresAt: voucher?['expiresAt'] != null
          ? DateTime.tryParse(voucher!['expiresAt'] as String)
          : null,
    );
  }

  Future<Map<String, dynamic>> _get(String path) async {
    final res = await http.get(
      Uri.parse('$_base$path'),
      headers: await _headers(),
    );
    return _decode(res);
  }

  Future<Map<String, dynamic>> _post(
    String path,
    Map<String, dynamic> body, {
    Set<int> allowStatuses = const {},
  }) async {
    final res = await http.post(
      Uri.parse('$_base$path'),
      headers: await _headers(),
      body: jsonEncode(body),
    );
    return _decode(res, allowStatuses: allowStatuses);
  }

  Map<String, dynamic> _decode(
    http.Response res, {
    Set<int> allowStatuses = const {},
  }) {
    final decoded = jsonDecode(res.body);
    final body = decoded is Map<String, dynamic>
        ? decoded
        : <String, dynamic>{};
    if (res.statusCode >= 400 && !allowStatuses.contains(res.statusCode)) {
      throw ApiException(
        code: body['error'] as String? ?? 'HTTP_${res.statusCode}',
        message: body['message'] as String?,
        statusCode: res.statusCode,
      );
    }
    return body;
  }
}
