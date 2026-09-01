import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/api_error.dart';
import '../../api/pdv_api.dart';
import '../../session/staff_session.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../util/money.dart';
import '../../util/phone.dart';
import '../../util/voucher.dart';

enum EarnMode { stamps, points, cashback }

class RecentCustomer {
  const RecentCustomer({
    required this.phoneE164,
    required this.displayName,
    required this.stamps,
    required this.points,
  });

  final String phoneE164;
  final String? displayName;
  final int stamps;
  final int points;
}

class TillPage extends StatefulWidget {
  const TillPage({super.key, required this.session});

  final StaffSession session;

  @override
  State<TillPage> createState() => _TillPageState();
}

class _TillPageState extends State<TillPage> {
  final _query = TextEditingController();
  final _fullPhone = TextEditingController();
  final _amount = TextEditingController();
  final _applyAmount = TextEditingController();
  final _voucher = TextEditingController();

  EarnMode _mode = EarnMode.stamps;
  List<String> _earnKinds = const [];
  bool _loading = false;
  bool _applyCashback = true;
  String? _error;
  LookupResult? _lookup;
  FulfillResult? _voucherResult;
  String? _fulfillingId;
  final List<RecentCustomer> _recents = [];

  StaffSession get _session => widget.session;
  PdvApi get _api => _session.api;

  int get _pointsPerReal =>
      _lookup?.pointsPerReal ?? _session.business?.pointsPerReal ?? 1;

  int get _cashbackPercent => _lookup?.cashbackPercent ?? 0;

  int get _cashbackBalance => _lookup?.cashbackCents ?? 0;

  bool get _canEarnCashback => _earnKinds.contains('cashback');

  bool get _canEarn => _earnKinds.isNotEmpty;

  List<EarnMode> get _availableModes => [
        if (_earnKinds.contains('stamps')) EarnMode.stamps,
        if (_earnKinds.contains('points')) EarnMode.points,
        if (_earnKinds.contains('cashback')) EarnMode.cashback,
      ];

  bool get _saleMode =>
      _mode == EarnMode.points ||
      _mode == EarnMode.cashback ||
      !_canEarn;

  bool get _showAmount => _saleMode;

  int? get _amountCents => parseMoneyToCents(_amount.text);

  int get _maxApplyCents {
    if (_cashbackBalance <= 0) return 0;
    final sale = _amountCents;
    if (sale == null) return _cashbackBalance;
    return sale < _cashbackBalance ? sale : _cashbackBalance;
  }

  int get _applyCents {
    if (!_saleMode || !_applyCashback || _maxApplyCents <= 0) return 0;
    final typed = parseMoneyToCents(_applyAmount.text);
    final raw = typed ?? _maxApplyCents;
    return raw < _maxApplyCents ? raw : _maxApplyCents;
  }

  int get _previewPoints {
    final cents = _amountCents;
    if (_mode != EarnMode.points || cents == null) return 0;
    return previewPoints(amountCents: cents, pointsPerReal: _pointsPerReal);
  }

  int get _previewCashback {
    final cents = _amountCents;
    if (cents == null ||
        _mode != EarnMode.cashback ||
        !_canEarnCashback ||
        _cashbackPercent <= 0) return 0;
    final paid = cents - _applyCents;
    return previewCashbackCents(paidCents: paid, percent: _cashbackPercent);
  }

  @override
  void initState() {
    super.initState();
    _amount.addListener(_onMoneyChanged);
    _applyAmount.addListener(_onMoneyChanged);
    _earnKinds = _session.business?.activeEarnKinds ?? _earnKinds;
    _snapMode();
    _refreshEarnKinds();
  }

  void _snapMode() {
    final modes = _availableModes;
    if (modes.isEmpty) return;
    if (!modes.contains(_mode)) _mode = modes.first;
  }

  Future<void> _refreshEarnKinds() async {
    try {
      final business = await _api.fetchBusiness();
      if (!mounted) return;
      setState(() {
        _earnKinds = business.activeEarnKinds;
        _snapMode();
      });
    } catch (_) {
      // Keep kinds from session / lookup.
    }
  }

  void _onMoneyChanged() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _amount.removeListener(_onMoneyChanged);
    _applyAmount.removeListener(_onMoneyChanged);
    _query.dispose();
    _fullPhone.dispose();
    _amount.dispose();
    _applyAmount.dispose();
    _voucher.dispose();
    super.dispose();
  }

  void _remember(LookupResult lookup) {
    final phone = lookup.phoneE164;
    if (phone == null || phone.isEmpty) return;
    _recents.removeWhere((r) => r.phoneE164 == phone);
    _recents.insert(
      0,
      RecentCustomer(
        phoneE164: phone,
        displayName: lookup.displayName,
        stamps: lookup.stamps,
        points: lookup.points,
      ),
    );
    if (_recents.length > 8) _recents.removeRange(8, _recents.length);
  }

  Future<void> _lookupByQuery() async {
    final digits = digitsOnly(_query.text);
    if (digits.length != 4 && digits.length < 10) {
      setState(() {
        _error = 'Digite os 4 últimos dígitos ou o telefone completo';
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _lookup = null;
      _voucherResult = null;
    });
    try {
      final result = digits.length == 4
          ? await _api.lookup(last4: digits)
          : await _api.lookup(phone: phoneDigitsForApi(_query.text));
      setState(() {
        _lookup = result;
        if (result.earnKindsFromApi) {
          _earnKinds = result.activeEarnKinds;
          _snapMode();
        }
        if (result.found && !result.multiple) _remember(result);
      });
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _selectMatch(CustomerMatch match) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.lookup(phone: match.phoneE164);
      setState(() {
        _lookup = result;
        if (result.earnKindsFromApi) {
          _earnKinds = result.activeEarnKinds;
          _snapMode();
        }
        if (result.found) _remember(result);
      });
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _resolveFullPhoneAndEarn() async {
    final phone = phoneDigitsForApi(_fullPhone.text);
    if (digitsOnly(phone).length < 10) {
      setState(() => _error = 'Informe o telefone completo com DDD');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.lookup(phone: phone);
      if (result.found && result.customerId != null) {
        setState(() {
          _lookup = result;
          _fullPhone.clear();
        });
        if (result.associatedHere && result.membershipId != null) {
          await _earn(result.membershipId);
        } else {
          await _createCustomer(withEarn: _canEarn, phoneOverride: phone);
        }
        return;
      }
      await _createCustomer(withEarn: _canEarn, phoneOverride: phone);
    } catch (e) {
      if (mounted) setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _createCustomer({
    required bool withEarn,
    String? phoneOverride,
  }) async {
    final phone =
        phoneOverride ??
        phoneDigitsForApi(
          _fullPhone.text,
        ).ifEmpty(_lookup?.phoneE164 ?? phoneDigitsForApi(_query.text));
    if (digitsOnly(phone).length < 10) {
      setState(() {
        _error = 'Para criar cliente, informe o telefone completo com DDD';
        _loading = false;
      });
      return;
    }
    if (withEarn &&
        (_mode == EarnMode.points || _mode == EarnMode.cashback) &&
        _amountCents == null) {
      setState(() {
        _error = 'Informe o valor da compra';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final created = await _api.createCustomer(
        phone: phone,
        addFirstStamp: _mode == EarnMode.stamps && withEarn && _amountCents == null,
      );
      setState(
        () => _lookup = created.copyWith(
          points: created.points,
          stamps: created.stamps,
        ),
      );
      if (withEarn &&
          created.membershipId != null &&
          (_mode == EarnMode.points || _mode == EarnMode.cashback)) {
        await _earn(created.membershipId);
        return;
      }
      _remember(created);
      if (withEarn && _mode == EarnMode.stamps) {
        _toast('Carimbo adicionado — saldo ${created.stamps}');
      } else {
        _toast('Cliente adicionado à loja');
      }
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _earn([String? membershipId]) async {
    final mid = membershipId ?? _lookup?.membershipId;
    if (mid == null) return;
    final earning = _canEarn && _availableModes.contains(_mode);
    final unitKind = earning
        ? switch (_mode) {
            EarnMode.points => 'points',
            EarnMode.cashback => 'cashback',
            EarnMode.stamps => 'stamps',
          }
        : 'cashback';
    final applyingLeftover = unitKind != 'stamps' && _applyCents > 0;
    if (!earning && !applyingLeftover) {
      setState(() {
        _error = 'Nenhuma campanha ativa para registrar no caixa.';
        _loading = false;
      });
      return;
    }
    if ((unitKind == 'points' ||
            unitKind == 'cashback' ||
            applyingLeftover) &&
        _amountCents == null) {
      setState(() {
        _error = 'Informe o valor da compra';
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _api.earn(
        membershipId: mid,
        unitKind: unitKind,
        amountCents: unitKind == 'stamps' ? null : _amountCents,
        quantity: unitKind == 'stamps' ? 1 : null,
        applyCashbackCents: applyingLeftover ? _applyCents : null,
      );
      setState(() {
        _lookup = _lookup?.copyWith(
          associatedHere: true,
          membershipId: mid,
          stamps: result.stamps,
          points: result.points,
          cashbackCents: result.cashbackCents,
        );
        _amount.clear();
        _applyAmount.clear();
      });
      if (_lookup != null) _remember(_lookup!);
      _toast(result.message);
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _fulfill({
    String? voucherCode,
    String? transactionId,
    bool acceptExpired = false,
  }) async {
    setState(() {
      _fulfillingId = transactionId ?? voucherCode ?? 'code';
      _error = null;
      _voucherResult = null;
    });
    try {
      final result = await _api.fulfillVoucher(
        voucherCode: voucherCode,
        transactionId: transactionId,
        acceptExpired: acceptExpired,
      );
      setState(() {
        _voucherResult = result;
        if (result.kind != FulfillKind.expired) _voucher.clear();
      });
      if (result.kind == FulfillKind.used) {
        _toast(result.message);
      }
      final phone = _lookup?.phoneE164;
      if (phone != null && result.kind != FulfillKind.notFound) {
        final refreshed = await _api.lookup(phone: phone);
        if (mounted) setState(() => _lookup = refreshed);
      }
    } catch (e) {
      setState(() {
        _error = humanizeError(e);
        _voucherResult = FulfillResult(
          kind: FulfillKind.error,
          message: humanizeError(e),
        );
      });
    } finally {
      if (mounted) setState(() => _fulfillingId = null);
    }
  }

  void _toast(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  void _resetLookup() {
    setState(() {
      _lookup = null;
      _error = null;
      _voucherResult = null;
      _fullPhone.clear();
      _query.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final business = _session.business;
    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              business?.name ?? 'Frego PDV',
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              _mode == EarnMode.points
                  ? 'Pontos'
                  : _mode == EarnMode.cashback
                  ? 'Cashback'
                  : 'Carimbos',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: FregoColors.neutral500,
              ),
            ),
          ],
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(FregoIcons.more),
            onSelected: (value) {
              if (value == 'switch') _session.showPicker();
              if (value == 'out') _session.signOut();
            },
            itemBuilder: (context) => [
              if (_session.businesses.length > 1)
                const PopupMenuItem(
                  value: 'switch',
                  child: Text('Trocar loja'),
                ),
              const PopupMenuItem(value: 'out', child: Text('Sair')),
            ],
          ),
        ],
      ),
      body: AbsorbPointer(
        absorbing: _loading,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            _VoucherSection(
              controller: _voucher,
              fulfilling: _fulfillingId != null,
              result: _voucherResult,
              onSubmit: () {
                final code = normalizeVoucherCode(_voucher.text);
                if (code.length < 4) return;
                _fulfill(voucherCode: code);
              },
              onAcceptExpired: () {
                final r = _voucherResult;
                if (r == null) return;
                _fulfill(
                  transactionId: r.transactionId,
                  voucherCode: r.voucherCode,
                  acceptExpired: true,
                );
              },
              onDismiss: () => setState(() => _voucherResult = null),
            ),
            const SizedBox(height: 16),
            if (_availableModes.length > 1) ...[
              _ModeToggle(
                mode: _mode,
                modes: _availableModes,
                onChanged: (mode) => setState(() => _mode = mode),
              ),
              const SizedBox(height: 16),
            ] else if (_availableModes.isEmpty) ...[
              Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Text(
                  'Nenhuma campanha ativa para registrar no caixa. Crie carimbos, pontos ou cashback em Campanhas.',
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    color: FregoColors.neutral500,
                  ),
                ),
              ),
            ],
            _PhoneField(controller: _query, onSubmitted: _lookupByQuery),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: FregoColors.danger, fontSize: 13),
              ),
            ],
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _loading ? null : _lookupByQuery,
                child: Text(_loading ? 'Consultando…' : 'Buscar'),
              ),
            ),
            if (_lookup != null) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: _resetLookup,
                child: const Text('Nova busca'),
              ),
            ],
            if (_recents.isNotEmpty && _lookup == null) ...[
              const SizedBox(height: 20),
              const Text(
                'Neste turno',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: FregoColors.neutral400,
                ),
              ),
              const SizedBox(height: 8),
              ..._recents.map(
                (r) => _RecentTile(
                  recent: r,
                  onTap: () {
                    _query.text = r.phoneE164;
                    _selectMatch(
                      CustomerMatch(
                        customerId: r.phoneE164,
                        phoneE164: r.phoneE164,
                        displayName: r.displayName,
                      ),
                    );
                  },
                ),
              ),
            ],
            if (_lookup?.multiple == true) ...[
              const SizedBox(height: 16),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Vários clientes',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      'Terminam em ${_lookup!.last4}. Qual é?',
                      style: const TextStyle(color: FregoColors.neutral500),
                    ),
                    const SizedBox(height: 8),
                    ..._lookup!.matches.map(
                      (m) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(
                          [
                            m.displayName ?? 'Cliente',
                            if (m.isVip) 'VIP',
                            if (!m.associatedHere) 'outra loja/app',
                          ].join(' · '),
                        ),
                        subtitle: Text(
                          m.phoneE164,
                          style: const TextStyle(fontFamily: 'monospace'),
                        ),
                        onTap: () => _selectMatch(m),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_lookup != null && !_lookup!.found && !(_lookup!.multiple)) ...[
              const SizedBox(height: 16),
              _Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Não encontrado nesta loja',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Informe o telefone completo para localizar ou cadastrar.',
                      style: TextStyle(color: FregoColors.neutral500),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _fullPhone,
                      keyboardType: TextInputType.phone,
                      onChanged: (v) {
                        final formatted = formatPhoneBr(v);
                        if (formatted != v) {
                          _fullPhone.value = TextEditingValue(
                            text: formatted,
                            selection: TextSelection.collapsed(
                              offset: formatted.length,
                            ),
                          );
                        }
                      },
                      decoration: const InputDecoration(
                        labelText: 'Telefone completo',
                        hintText: '(19) 99488-5914',
                      ),
                    ),
                    if (_showAmount)
                      _AmountField(
                        controller: _amount,
                        previewPoints: _previewPoints,
                        pointsPerReal: _pointsPerReal,
                        previewCashback: _previewCashback,
                        cashbackPercent: _cashbackPercent,
                        applyCents: _applyCents,
                        paidCents: (_amountCents ?? 0) - _applyCents < 0
                            ? 0
                            : (_amountCents ?? 0) - _applyCents,
                        showPointsRate: _mode == EarnMode.points,
                      ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _loading ? null : _resolveFullPhoneAndEarn,
                        child: Text(
                          _mode == EarnMode.points
                              ? 'Buscar / criar e registrar gasto'
                              : _mode == EarnMode.cashback
                              ? 'Buscar / criar e registrar cashback'
                              : 'Buscar / criar e dar primeiro carimbo',
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (_lookup != null && _lookup!.found && !(_lookup!.multiple)) ...[
              const SizedBox(height: 16),
              _CustomerCard(
                lookup: _lookup!,
                mode: _mode,
                earnKinds: _earnKinds,
                canEarn: _canEarn,
                loading: _loading,
                amount: _amount,
                applyAmount: _applyAmount,
                previewPoints: _previewPoints,
                pointsPerReal: _pointsPerReal,
                previewCashback: _previewCashback,
                cashbackPercent: _cashbackPercent,
                applyCashback: _applyCashback,
                applyCents: _applyCents,
                paidCents: (_amountCents ?? 0) - _applyCents < 0
                    ? 0
                    : (_amountCents ?? 0) - _applyCents,
                maxApplyCents: _maxApplyCents,
                showAmount: _showAmount,
                fulfillingId: _fulfillingId,
                onApplyChanged: (v) => setState(() => _applyCashback = v),
                onEarn: () {
                  if (_lookup!.associatedHere &&
                      _lookup!.membershipId != null) {
                    if (_canEarn || _cashbackBalance > 0) _earn();
                  } else {
                    _createCustomer(withEarn: _canEarn);
                  }
                },
                onFulfill: (v) => _fulfill(transactionId: v.transactionId),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class _Card extends StatelessWidget {
  const _Card({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(16),
      child: Padding(padding: const EdgeInsets.all(16), child: child),
    );
  }
}

class _ModeToggle extends StatelessWidget {
  const _ModeToggle({
    required this.mode,
    required this.modes,
    required this.onChanged,
  });

  final EarnMode mode;
  final List<EarnMode> modes;
  final ValueChanged<EarnMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: FregoColors.neutral100,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          if (modes.contains(EarnMode.stamps))
            _chip(
              label: 'Carimbos',
              selected: mode == EarnMode.stamps,
              color: FregoColors.stamps,
              icon: FregoIcons.stampFilled,
              onTap: () => onChanged(EarnMode.stamps),
            ),
          if (modes.contains(EarnMode.points))
            _chip(
              label: 'Pontos',
              selected: mode == EarnMode.points,
              color: FregoColors.points,
              icon: FregoIcons.pointsFilled,
              onTap: () => onChanged(EarnMode.points),
            ),
          if (modes.contains(EarnMode.cashback))
            _chip(
              label: 'Cashback',
              selected: mode == EarnMode.cashback,
              color: FregoColors.cashback,
              icon: FregoIcons.cashbackFilled,
              onTap: () => onChanged(EarnMode.cashback),
            ),
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required Color color,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Material(
        color: selected ? color : Colors.transparent,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(11),
          child: SizedBox(
            height: 48,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    icon,
                    size: 16,
                    color: selected ? Colors.white : FregoColors.neutral700,
                  ),
                  const SizedBox(width: 4),
                  Flexible(
                    child: Text(
                      label,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: selected
                            ? Colors.white
                            : FregoColors.neutral700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PhoneField extends StatelessWidget {
  const _PhoneField({required this.controller, required this.onSubmitted});

  final TextEditingController controller;
  final VoidCallback onSubmitted;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final d = digitsOnly(value.text);
        final isLast4 = d.length <= 4;
        return TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.w600,
            letterSpacing: isLast4 ? 4 : 0,
          ),
          onChanged: (raw) {
            final digits = digitsOnly(raw);
            final next = digits.length <= 4 ? digits : formatPhoneBr(digits);
            if (next != raw) {
              controller.value = TextEditingValue(
                text: next,
                selection: TextSelection.collapsed(offset: next.length),
              );
            }
          },
          onSubmitted: (_) => onSubmitted(),
          decoration: InputDecoration(
            labelText: isLast4 ? 'Últimos 4 dígitos' : 'Telefone',
            hintText: isLast4 ? '4321' : '(11) 98765-4321',
          ),
        );
      },
    );
  }
}

class _AmountField extends StatelessWidget {
  const _AmountField({
    required this.controller,
    required this.previewPoints,
    required this.pointsPerReal,
    this.previewCashback = 0,
    this.cashbackPercent = 0,
    this.applyCents = 0,
    this.paidCents = 0,
    this.showPointsRate = true,
  });

  final TextEditingController controller;
  final int previewPoints;
  final int pointsPerReal;
  final int previewCashback;
  final int cashbackPercent;
  final int applyCents;
  final int paidCents;
  final bool showPointsRate;

  @override
  Widget build(BuildContext context) {
    const chips = [2000, 4000, 6000, 10000];
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: controller,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600),
            onChanged: (raw) {
              final next = maskMoneyInput(raw);
              if (next != raw) {
                controller.value = TextEditingValue(
                  text: next,
                  selection: TextSelection.collapsed(offset: next.length),
                );
              }
            },
            decoration: const InputDecoration(
              labelText: 'Valor da compra (R\$)',
              hintText: '0,00',
            ),
          ),
          const SizedBox(height: 6),
          if (showPointsRate)
            Text(
              'Taxa da loja: R\$ $pointsPerReal → 1 pt',
              style: const TextStyle(fontSize: 12, color: FregoColors.neutral400),
            ),
          if (cashbackPercent > 0)
            Text(
              'Cashback $cashbackPercent%',
              style: const TextStyle(fontSize: 12, color: FregoColors.cashback),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final cents in chips)
                OutlinedButton(
                  onPressed: () {
                    final next = formatCentsAsInput(cents);
                    controller.value = TextEditingValue(
                      text: next,
                      selection: TextSelection.collapsed(offset: next.length),
                    );
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 40),
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                  ),
                  child: Text(formatBrl(cents)),
                ),
            ],
          ),
          if (applyCents > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: Text(
                  '−${formatBrl(applyCents)} cashback · a pagar ${formatBrl(paidCents)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: FregoColors.cashback,
                  ),
                ),
              ),
            ),
          if (previewPoints > 0)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Center(
                child: Text(
                  '+$previewPoints pts',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: FregoColors.primary600,
                  ),
                ),
              ),
            ),
          if (previewCashback > 0)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Center(
                child: Text(
                  '+${formatBrl(previewCashback)} de cashback',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: FregoColors.cashback,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({
    required this.lookup,
    required this.mode,
    required this.earnKinds,
    required this.canEarn,
    required this.loading,
    required this.amount,
    required this.applyAmount,
    required this.previewPoints,
    required this.pointsPerReal,
    required this.previewCashback,
    required this.cashbackPercent,
    required this.applyCashback,
    required this.applyCents,
    required this.paidCents,
    required this.maxApplyCents,
    required this.showAmount,
    required this.fulfillingId,
    required this.onApplyChanged,
    required this.onEarn,
    required this.onFulfill,
  });

  final LookupResult lookup;
  final EarnMode mode;
  final List<String> earnKinds;
  final bool canEarn;
  final bool loading;
  final TextEditingController amount;
  final TextEditingController applyAmount;
  final int previewPoints;
  final int pointsPerReal;
  final int previewCashback;
  final int cashbackPercent;
  final bool applyCashback;
  final int applyCents;
  final int paidCents;
  final int maxApplyCents;
  final bool showAmount;
  final String? fulfillingId;
  final ValueChanged<bool> onApplyChanged;
  final VoidCallback onEarn;
  final ValueChanged<OpenVoucher> onFulfill;

  @override
  Widget build(BuildContext context) {
    final showStamps = earnKinds.contains('stamps') || lookup.stamps > 0;
    final showPoints = earnKinds.contains('points') || lookup.points > 0;
    final showCashback =
        earnKinds.contains('cashback') ||
        lookup.cashbackCents > 0 ||
        cashbackPercent > 0;
    final primary = !canEarn
        ? (lookup.associatedHere
            ? (lookup.cashbackCents > 0
                ? 'Usar cashback'
                : 'Sem campanha ativa')
            : 'Adicionar à loja')
        : lookup.associatedHere
        ? (mode == EarnMode.points
              ? 'Registrar gasto'
              : mode == EarnMode.cashback
              ? 'Registrar cashback'
              : 'Carimbar')
        : (mode == EarnMode.points
              ? 'Adicionar à loja e registrar'
              : mode == EarnMode.cashback
              ? 'Adicionar à loja e registrar cashback'
              : 'Adicionar à loja e carimbar');
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            lookup.displayName ?? 'Cliente',
            style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
          ),
          Text(
            lookup.phoneE164 ?? '',
            style: const TextStyle(
              fontFamily: 'monospace',
              color: FregoColors.neutral500,
            ),
          ),
          if (!lookup.associatedHere) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: FregoColors.primary50,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                lookup.otherShopsCount > 0
                    ? 'Já está no Frego — ativo em ${lookup.otherShopsCount} outro(s) estabelecimento(s). Adicione a esta loja para carimbar.'
                    : 'Já está no Frego (app). Ainda não associado a esta loja — adicione para carimbar.',
                style: const TextStyle(
                  color: FregoColors.primary800,
                  fontSize: 13,
                ),
              ),
            ),
          ],
          const SizedBox(height: 12),
          if (showStamps || showPoints)
            Row(
              children: [
                if (showStamps)
                  Expanded(
                    child: _PoolTile(
                      label: 'Carimbos',
                      value: '${lookup.stamps}',
                      color: FregoColors.stamps,
                      background: FregoColors.stampsBg,
                    ),
                  ),
                if (showStamps && showPoints) const SizedBox(width: 8),
                if (showPoints)
                  Expanded(
                    child: _PoolTile(
                      label: 'Pontos',
                      value: '${lookup.points}',
                      color: FregoColors.points,
                      background: FregoColors.pointsBg,
                    ),
                  ),
              ],
            ),
          if (showCashback) ...[
            const SizedBox(height: 8),
            _PoolTile(
              label: 'Cashback',
              value: formatBrl(lookup.cashbackCents),
              color: FregoColors.cashback,
              background: FregoColors.cashbackBg,
            ),
            if (lookup.cashbackCents > 0 && mode != EarnMode.stamps)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CheckboxListTile(
                    contentPadding: EdgeInsets.zero,
                    dense: true,
                    value: applyCashback,
                    onChanged: (v) => onApplyChanged(v ?? false),
                    title: const Text(
                      'Usar cashback nesta compra',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  if (applyCashback) ...[
                    TextField(
                      controller: applyAmount,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w600,
                      ),
                      onTap: () {
                        if (applyAmount.text.isEmpty && maxApplyCents > 0) {
                          applyAmount.text = formatCentsAsInput(maxApplyCents);
                        }
                      },
                      onChanged: (raw) {
                        final next = maskMoneyInput(raw);
                        if (next != raw) {
                          applyAmount.value = TextEditingValue(
                            text: next,
                            selection: TextSelection.collapsed(
                              offset: next.length,
                            ),
                          );
                        }
                      },
                      decoration: InputDecoration(
                        labelText: 'Valor a usar (R\$)',
                        hintText: maxApplyCents > 0
                            ? formatCentsAsInput(maxApplyCents)
                            : '0,00',
                      ),
                    ),
                    const SizedBox(height: 6),
                  ],
                  Text(
                    applyCashback && applyCents > 0
                        ? 'Remove ${formatBrl(applyCents)} da carteira. O caixa de vocês cobra ${formatBrl(paidCents)}.'
                        : 'Saldo disponível ${formatBrl(lookup.cashbackCents)}. Informe quanto o outro sistema descontou.',
                    style: const TextStyle(
                      fontSize: 12,
                      color: FregoColors.cashback,
                    ),
                  ),
                ],
              ),
          ],
          if (lookup.openVouchers.isNotEmpty) ...[
            const SizedBox(height: 14),
            Text(
              'Vouchers abertos · ${lookup.openVouchers.length}',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: FregoColors.neutral400,
              ),
            ),
            const SizedBox(height: 8),
            ...lookup.openVouchers.map(
              (v) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            v.rewardTitle,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            v.voucherDisplay,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              color: FregoColors.neutral500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    FilledButton(
                      onPressed: fulfillingId != null
                          ? null
                          : () => onFulfill(v),
                      style: FilledButton.styleFrom(
                        backgroundColor: FregoColors.success,
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      child: Text(
                        fulfillingId == v.transactionId ? '…' : 'Usar',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          if (showAmount)
            _AmountField(
              controller: amount,
              previewPoints: previewPoints,
              pointsPerReal: pointsPerReal,
              previewCashback: previewCashback,
              cashbackPercent: cashbackPercent,
              applyCents: applyCents,
              paidCents: paidCents,
              showPointsRate: mode == EarnMode.points,
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: loading ||
                      (lookup.associatedHere &&
                          !canEarn &&
                          lookup.cashbackCents <= 0)
                  ? null
                  : onEarn,
              child: Text(primary),
            ),
          ),
        ],
      ),
    );
  }
}

class _PoolTile extends StatelessWidget {
  const _PoolTile({
    required this.label,
    required this.value,
    required this.color,
    required this.background,
  });

  final String label;
  final String value;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _RecentTile extends StatelessWidget {
  const _RecentTile({required this.recent, required this.onTap});

  final RecentCustomer recent;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          onTap: onTap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          title: Text(recent.displayName ?? 'Cliente'),
          subtitle: Text(recent.phoneE164),
          trailing: Text(
            '${recent.stamps} · ${recent.points} pts',
            style: const TextStyle(fontSize: 12, color: FregoColors.neutral500),
          ),
        ),
      ),
    );
  }
}

class _VoucherSection extends StatelessWidget {
  const _VoucherSection({
    required this.controller,
    required this.fulfilling,
    required this.result,
    required this.onSubmit,
    required this.onAcceptExpired,
    required this.onDismiss,
  });

  final TextEditingController controller;
  final bool fulfilling;
  final FulfillResult? result;
  final VoidCallback onSubmit;
  final VoidCallback onAcceptExpired;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'CONFIRMAR VOUCHER',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: FregoColors.neutral400,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  textCapitalization: TextCapitalization.characters,
                  inputFormatters: [
                    TextInputFormatter.withFunction((old, next) {
                      final formatted = formatVoucherInput(next.text);
                      return TextEditingValue(
                        text: formatted,
                        selection: TextSelection.collapsed(
                          offset: formatted.length,
                        ),
                      );
                    }),
                  ],
                  decoration: const InputDecoration(hintText: 'K7M-2PQ'),
                  onSubmitted: (_) => onSubmit(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: fulfilling ? null : onSubmit,
                style: FilledButton.styleFrom(
                  backgroundColor: FregoColors.ink,
                  minimumSize: const Size(72, 52),
                ),
                child: const Text('Usar'),
              ),
            ],
          ),
          if (result != null) ...[
            const SizedBox(height: 12),
            _VoucherResultBanner(
              result: result!,
              fulfilling: fulfilling,
              onAcceptExpired: onAcceptExpired,
              onDismiss: onDismiss,
            ),
          ],
        ],
      ),
    );
  }
}

class _VoucherResultBanner extends StatelessWidget {
  const _VoucherResultBanner({
    required this.result,
    required this.fulfilling,
    required this.onAcceptExpired,
    required this.onDismiss,
  });

  final FulfillResult result;
  final bool fulfilling;
  final VoidCallback onAcceptExpired;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    String fmt(DateTime d) {
      final local = d.toLocal();
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
      String two(int n) => n.toString().padLeft(2, '0');
      return '${two(local.day)} ${months[local.month - 1]} '
          '${two(local.hour)}:${two(local.minute)}';
    }

    late Color border;
    late Color bg;
    late String title;
    switch (result.kind) {
      case FulfillKind.used:
        border = FregoColors.success.withValues(alpha: 0.3);
        bg = const Color(0xFFECFDF5);
        title = 'Voucher confirmado';
      case FulfillKind.alreadyUsed:
        border = FregoColors.neutral200;
        bg = FregoColors.neutral100;
        title = 'Voucher já foi usado';
      case FulfillKind.expired:
        border = const Color(0xFFF5C6A5);
        bg = const Color(0xFFFFF7ED);
        title = 'Voucher expirado';
      case FulfillKind.notFound:
      case FulfillKind.error:
        border = FregoColors.danger.withValues(alpha: 0.25);
        bg = const Color(0xFFFEF2F2);
        title = result.kind == FulfillKind.notFound ? 'Não encontrado' : 'Erro';
    }
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        border: Border.all(color: border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              if (result.kind != FulfillKind.expired)
                GestureDetector(
                  onTap: onDismiss,
                  child: const Icon(FregoIcons.clear, size: 18),
                ),
            ],
          ),
          if (result.voucherDisplay != null)
            Text(
              result.voucherDisplay!,
              style: const TextStyle(
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
          if (result.rewardTitle != null)
            Text(
              [
                result.rewardTitle,
                if (result.customerName != null) result.customerName,
              ].join(' · '),
              style: const TextStyle(
                fontSize: 13,
                color: FregoColors.neutral500,
              ),
            ),
          if (result.kind == FulfillKind.expired && result.expiresAt != null)
            Text(
              'Expirou em ${fmt(result.expiresAt!)} · validade de 24h',
              style: const TextStyle(fontSize: 12, color: Color(0xFFC45C26)),
            ),
          if (result.kind == FulfillKind.expired) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                FilledButton(
                  onPressed: fulfilling ? null : onAcceptExpired,
                  style: FilledButton.styleFrom(
                    backgroundColor: FregoColors.ink,
                    minimumSize: const Size(0, 40),
                  ),
                  child: Text(fulfilling ? '…' : 'Aceitar mesmo assim'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: onDismiss,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, 40),
                  ),
                  child: const Text('Cancelar'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
