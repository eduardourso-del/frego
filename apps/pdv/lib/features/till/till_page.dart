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
  bool _applyCashback = false;
  String? _error;
  LookupResult? _lookup;
  FulfillResult? _voucherResult;
  String? _fulfillingId;
  CounterSale? _lastSale;
  String? _reversingId;
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
      (!_canEarn && _cashbackBalance > 0);

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
    if (!mounted) return;
    if (_applyCashback && _maxApplyCents > 0) {
      final typed = parseMoneyToCents(_applyAmount.text);
      if (typed != null && typed > _maxApplyCents) {
        final next = formatCentsAsInput(_maxApplyCents);
        if (_applyAmount.text != next) {
          _applyAmount.value = TextEditingValue(
            text: next,
            selection: TextSelection.collapsed(offset: next.length),
          );
          return;
        }
      }
    }
    setState(() {});
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

  void _rememberSale(CounterSale? sale) {
    if (sale == null || !sale.isValid) return;
    setState(() {
      _lastSale = sale;
    });
  }

  Future<void> _reverseSale(CounterSale sale) async {
    setState(() {
      _reversingId = sale.anchorId;
      _error = null;
    });
    try {
      final result = await _api.reverseSale(sale.anchorId);
      if (!mounted) return;
      setState(() {
        _lookup = _lookup?.copyWith(
          stamps: result.stamps,
          points: result.points,
          cashbackCents: result.cashbackCents,
          recentSales: (_lookup?.recentSales ?? const [])
              .where(
                (s) =>
                    s.saleId != sale.saleId && s.anchorId != sale.anchorId,
              )
              .toList(),
        );
        if (_lastSale != null &&
            (_lastSale!.saleId == sale.saleId ||
                _lastSale!.anchorId == sale.anchorId)) {
          _lastSale = null;
        }
      });
      if (_lookup != null) _remember(_lookup!);
      _toast(result.message);
    } catch (e) {
      if (mounted) {
        final message = humanizeError(e);
        setState(() => _error = message);
        _toast(message);
      }
    } finally {
      if (mounted) setState(() => _reversingId = null);
    }
  }

  Future<void> _askReverse(CounterSale sale) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Desfazer lançamento?'),
        content: Text(
          '${sale.summary}\n\nSó funciona se o cliente ainda não usou o benefício.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: FregoColors.danger),
            child: const Text('Desfazer'),
          ),
        ],
      ),
    );
    if (ok == true && mounted) await _reverseSale(sale);
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
      _lastSale = null;
      _applyCashback = false;
      _applyAmount.clear();
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
      final firstSale = created.recentSales.isNotEmpty
          ? created.recentSales.first
          : null;
      _rememberSale(firstSale);
      if (firstSale == null) {
        if (withEarn && _mode == EarnMode.stamps) {
          _toast('Carimbo adicionado — saldo ${created.stamps}');
        } else {
          _toast('Cliente adicionado à loja');
        }
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
    final applyingLeftover = _saleMode && _applyCents > 0;
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
          recentSales: prependSale(_lookup?.recentSales ?? const [], result.sale),
        );
        _amount.clear();
        _applyAmount.clear();
        _applyCashback = false;
      });
      if (_lookup != null) _remember(_lookup!);
      _rememberSale(result.sale);
      if (result.sale == null) _toast(result.message);
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
      _lastSale = null;
      _applyCashback = false;
      _fullPhone.clear();
      _query.clear();
      _applyAmount.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final business = _session.business;
    final title = _availableModes.isEmpty
        ? 'Balcão'
        : _mode == EarnMode.points
            ? 'Pontos'
            : _mode == EarnMode.cashback
                ? 'Cashback'
                : 'Carimbos';
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Balcão · ${business?.name ?? 'funcionário'}',
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.4,
            color: FregoColors.neutral400,
          ),
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
            Text(
              title,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.6,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Digite os 4 últimos dígitos do celular. O acúmulo vai para o saldo do cliente — ele escolhe a campanha no aplicativo. Prêmios resgatados no app são confirmados aqui na entrega.',
              style: TextStyle(
                fontSize: 15,
                height: 1.45,
                color: FregoColors.neutral500,
              ),
            ),
            const SizedBox(height: 20),
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
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: FregoColors.neutral100,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Nenhuma campanha ativa para registrar no caixa. Crie carimbos, pontos ou cashback em Campanhas.',
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.35,
                      color: FregoColors.neutral500,
                    ),
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
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: Text(_loading ? 'Buscando…' : 'Buscar'),
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
                recentSales: _lookup!.recentSales,
                reversingId: _reversingId,
                onUndo: _askReverse,
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: _lastSale == null
          ? null
          : _UndoBar(
              sale: _lastSale!,
              busy: _reversingId == _lastSale!.anchorId,
              onUndo: () => _askReverse(_lastSale!),
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
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: FregoColors.hairline),
      ),
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
              icon: FregoIcons.stamp(
                size: 16,
                color: mode == EarnMode.stamps
                    ? Colors.white
                    : FregoColors.neutral700,
              ),
              onTap: () => onChanged(EarnMode.stamps),
            ),
          if (modes.contains(EarnMode.points))
            _chip(
              label: 'Pontos',
              selected: mode == EarnMode.points,
              color: FregoColors.points,
              icon: FregoIcons.points(
                size: 16,
                color: mode == EarnMode.points
                    ? Colors.white
                    : FregoColors.neutral700,
              ),
              onTap: () => onChanged(EarnMode.points),
            ),
          if (modes.contains(EarnMode.cashback))
            _chip(
              label: 'Cashback',
              selected: mode == EarnMode.cashback,
              color: FregoColors.cashback,
              icon: FregoIcons.cashback(
                size: 16,
                color: mode == EarnMode.cashback
                    ? Colors.white
                    : FregoColors.neutral700,
              ),
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
    required Widget icon,
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
            height: 44,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  icon,
                  const SizedBox(width: 6),
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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              isLast4 ? 'ÚLTIMOS 4 DÍGITOS' : 'TELEFONE',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: FregoColors.neutral700,
              ),
            ),
            const SizedBox(height: 8),
            TextField(
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
                hintText: isLast4 ? '4321' : '(11) 98765-4321',
                filled: true,
                fillColor: FregoColors.card,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ],
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
    this.recentSales = const [],
    this.reversingId,
    this.onUndo,
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
  final List<CounterSale> recentSales;
  final String? reversingId;
  final ValueChanged<CounterSale>? onUndo;

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
                      ring: FregoColors.stampsRing,
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
                      ring: FregoColors.pointsRing,
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
              ring: FregoColors.cashbackRing,
              caption: cashbackPercent > 0 && mode == EarnMode.cashback
                  ? '$cashbackPercent% do valor pago'
                  : null,
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
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                            color: FregoColors.cashbackRing,
                          ),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(8),
                          borderSide: const BorderSide(
                            color: FregoColors.cashback,
                            width: 1.5,
                          ),
                        ),
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
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              mode == EarnMode.cashback
                  ? 'O pagamento acontece no caixa da loja. Aqui só registramos o valor e o cashback usado.'
                  : 'O resgate de carimbos e pontos é no aplicativo do cliente. Confirme o voucher abaixo ao entregar o prêmio.',
              style: const TextStyle(
                fontSize: 13,
                height: 1.4,
                color: FregoColors.neutral500,
              ),
            ),
          ),
          if (lookup.openVouchers.isNotEmpty) ...[
            const SizedBox(height: 12),
            _OpenVouchers(
              vouchers: lookup.openVouchers,
              fulfillingId: fulfillingId,
              onFulfill: onFulfill,
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
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: Text(primary),
            ),
          ),
          if (recentSales.isNotEmpty) ...[
            const SizedBox(height: 18),
            const Divider(height: 1),
            const SizedBox(height: 14),
            const Text(
              'Lançamentos deste cliente',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.4,
                color: FregoColors.neutral400,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Errou o valor ou o carimbo? Desfaça. Só funciona se o cliente ainda não usou o benefício.',
              style: TextStyle(
                fontSize: 12,
                height: 1.35,
                color: FregoColors.neutral500,
              ),
            ),
            const SizedBox(height: 10),
            ...recentSales.map((sale) {
              final busy = reversingId == sale.anchorId;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                  decoration: BoxDecoration(
                    color: FregoColors.neutralBg,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: FregoColors.hairline),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              sale.summary,
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            if (sale.createdAt != null)
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(
                                  formatSaleClock(sale.createdAt!),
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: FregoColors.neutral400,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      TextButton.icon(
                        onPressed: reversingId != null
                            ? null
                            : () => onUndo?.call(sale),
                        icon: FregoIcons.undo(
                          size: 16,
                          color: FregoColors.neutral500,
                        ),
                        label: Text(busy ? '…' : 'Desfazer'),
                        style: TextButton.styleFrom(
                          foregroundColor: FregoColors.neutral500,
                          minimumSize: const Size(0, 36),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
          ],
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
    required this.ring,
    this.caption,
  });

  final String label;
  final String value;
  final Color color;
  final Color background;
  final Color ring;
  final String? caption;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: ring),
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
          if (caption != null && caption!.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                caption!,
                style: TextStyle(fontSize: 12, color: color),
              ),
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
            side: const BorderSide(color: FregoColors.hairline),
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
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: FregoColors.neutral400,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Digite o código que o cliente mostra no app e marque como usado.',
            style: TextStyle(
              fontSize: 13,
              height: 1.35,
              color: FregoColors.neutral500,
            ),
          ),
          const SizedBox(height: 12),
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
                  minimumSize: const Size(72, 44),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  fulfilling ? '…' : 'Usar',
                  style: const TextStyle(fontSize: 14),
                ),
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
        bg = FregoColors.successBg;
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

class _OpenVouchers extends StatelessWidget {
  const _OpenVouchers({
    required this.vouchers,
    required this.fulfillingId,
    required this.onFulfill,
  });

  final List<OpenVoucher> vouchers;
  final String? fulfillingId;
  final ValueChanged<OpenVoucher> onFulfill;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: FregoColors.neutralBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FregoColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Vouchers em aberto · ${vouchers.length}'.toUpperCase(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: FregoColors.neutral400,
            ),
          ),
          const SizedBox(height: 8),
          ...vouchers.map((v) {
            final busy = fulfillingId == v.transactionId;
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Container(
                padding: const EdgeInsets.fromLTRB(12, 10, 10, 10),
                decoration: BoxDecoration(
                  color: FregoColors.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: FregoColors.hairline),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            v.rewardTitle,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Text(
                            v.voucherDisplay,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 13,
                              letterSpacing: 0.8,
                              color: FregoColors.neutral500,
                            ),
                          ),
                          if (v.expiresAt != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Text(
                                'Válido até ${formatVoucherUntil(v.expiresAt!)} · 24h',
                                style: const TextStyle(
                                  fontSize: 11,
                                  color: FregoColors.neutral400,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: fulfillingId != null
                          ? null
                          : () => onFulfill(v),
                      style: FilledButton.styleFrom(
                        backgroundColor: FregoColors.success,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(0, 36),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      child: Text(busy ? '…' : 'Confirmar'),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }
}

String formatVoucherUntil(DateTime at) {
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
  final local = at.toLocal();
  final day = local.day.toString().padLeft(2, '0');
  final time =
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  return '$day de ${months[local.month - 1]}., $time';
}

String formatSaleClock(DateTime at) {
  final local = at.toLocal();
  final now = DateTime.now();
  final sameDay =
      local.year == now.year && local.month == now.month && local.day == now.day;
  final time =
      '${local.hour.toString().padLeft(2, '0')}:${local.minute.toString().padLeft(2, '0')}';
  if (sameDay) return 'Hoje, $time';
  final day = local.day.toString().padLeft(2, '0');
  final month = local.month.toString().padLeft(2, '0');
  return '$day/$month · $time';
}

class _UndoBar extends StatelessWidget {
  const _UndoBar({
    required this.sale,
    required this.busy,
    required this.onUndo,
  });

  final CounterSale sale;
  final bool busy;
  final VoidCallback onUndo;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: FregoColors.ink,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Registrado',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.4,
                        color: Colors.white.withValues(alpha: 0.6),
                      ),
                    ),
                    Text(
                      sale.summary,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
              TextButton.icon(
                onPressed: busy ? null : onUndo,
                icon: FregoIcons.undo(size: 16, color: Colors.white),
                label: Text(
                  busy ? '…' : 'Desfazer',
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
