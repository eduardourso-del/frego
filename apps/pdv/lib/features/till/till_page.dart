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
import 'voucher_scan_sheet.dart';

enum EarnMode { stamps, points, cashback }

enum _TillTask { earn, voucher }

enum _TillFocus { none, voucher, phone, fullPhone, amount, apply }

class _TillCta {
  const _TillCta({
    required this.label,
    this.onPressed,
    this.enabled = true,
    this.background,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool enabled;
  final Color? background;
}

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
  final _displayName = TextEditingController();
  final _amount = TextEditingController();
  final _applyAmount = TextEditingController();
  final _voucher = TextEditingController();
  final _voucherAmount = TextEditingController();
  final _voucherFocus = FocusNode();
  final _voucherAmountFocus = FocusNode();
  final _queryFocus = FocusNode();
  final _fullPhoneFocus = FocusNode();
  final _displayNameFocus = FocusNode();
  final _amountFocus = FocusNode();
  final _applyFocus = FocusNode();

  EarnMode _mode = EarnMode.stamps;
  _TillTask _task = _TillTask.earn;
  List<String> _earnKinds = const [];
  List<CustomerTag> _catalog = const [];
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

  int? get _fulfillAmountCents =>
      parseMoneyToCents(_voucherAmount.text) ?? _amountCents;

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
    _query.addListener(_refreshChrome);
    _fullPhone.addListener(_refreshChrome);
    _voucher.addListener(_refreshChrome);
    _voucherAmount.addListener(_refreshChrome);
    for (final node in [
      _voucherFocus,
      _voucherAmountFocus,
      _queryFocus,
      _fullPhoneFocus,
      _displayNameFocus,
      _amountFocus,
      _applyFocus,
    ]) {
      node.addListener(_onFocusChanged);
    }
    _earnKinds = _session.business?.activeEarnKinds ?? _earnKinds;
    _snapMode();
    _refreshEarnKinds();
  }

  void _refreshChrome() {
    if (mounted) setState(() {});
  }

  void _onFocusChanged() {
    if (mounted) setState(() {});
  }

  void _setTask(_TillTask next) {
    if (next == _task) return;
    FocusScope.of(context).unfocus();
    setState(() => _task = next);
    if (next == _TillTask.voucher) {
      _prefillVoucherAmount();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _voucherFocus.requestFocus();
      });
    }
  }

  void _snapMode() {
    final modes = _availableModes;
    if (modes.isEmpty) return;
    if (!modes.contains(_mode)) _mode = modes.first;
  }

  Future<void> _refreshEarnKinds() async {
    try {
      final business = await _api.fetchBusiness();
      final tags = await _api.listTags();
      if (!mounted) return;
      setState(() {
        _earnKinds = business.activeEarnKinds;
        _catalog = tags;
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
    _query.removeListener(_refreshChrome);
    _fullPhone.removeListener(_refreshChrome);
    _voucher.removeListener(_refreshChrome);
    _voucherAmount.removeListener(_refreshChrome);
    for (final node in [
      _voucherFocus,
      _voucherAmountFocus,
      _queryFocus,
      _fullPhoneFocus,
      _displayNameFocus,
      _amountFocus,
      _applyFocus,
    ]) {
      node.removeListener(_onFocusChanged);
      node.dispose();
    }
    _query.dispose();
    _fullPhone.dispose();
    _displayName.dispose();
    _amount.dispose();
    _applyAmount.dispose();
    _voucher.dispose();
    _voucherAmount.dispose();
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
      _displayName.clear();
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
        // Prefill create phone when the search already had the full number.
        if (!result.found && !result.multiple && digits.length >= 10) {
          _fullPhone.text = formatPhoneBr(digits);
        } else if (!result.found && !result.multiple) {
          _fullPhone.clear();
        }
      });
      if (mounted && !result.multiple) {
        _queryFocus.unfocus();
        if (!result.found && digits.length < 10) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _fullPhoneFocus.requestFocus();
          });
        }
      }
      if (result.multiple) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _openMatchesSheet();
        });
      }
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  _TillFocus get _focus {
    if (_task == _TillTask.voucher &&
        (_voucherFocus.hasFocus || _voucherAmountFocus.hasFocus)) {
      return _TillFocus.voucher;
    }
    if (_task == _TillTask.earn) {
      if (_queryFocus.hasFocus) return _TillFocus.phone;
      if (_fullPhoneFocus.hasFocus) return _TillFocus.fullPhone;
      if (_amountFocus.hasFocus) return _TillFocus.amount;
      if (_applyFocus.hasFocus) return _TillFocus.apply;
    }
    return _TillFocus.none;
  }

  bool get _voucherExpired => _voucherResult?.kind == FulfillKind.expired;

  Future<void> _submitVoucher() async {
    final code = normalizeVoucherCode(_voucher.text);
    if (code.length < 4 || _fulfillingId != null) return;
    setState(() {
      _fulfillingId = code;
      _error = null;
      _voucherResult = null;
    });
    try {
      final json = await _api.lookupVoucher(code);
      if (!mounted) return;
      final voucher = json['voucher'] as Map<String, dynamic>?;
      final status = voucher?['status'] as String?;
      if (json['error'] != null || status != 'open') {
        setState(() => _fulfillingId = null);
        await _fulfill(voucherCode: code);
        return;
      }
      final customer = json['customer'] as Map<String, dynamic>?;
      final display =
          voucher?['voucherDisplay'] as String? ?? formatVoucherInput(code);
      final reward = voucher?['rewardTitle'] as String? ?? 'Prêmio';
      final name = (customer?['displayName'] as String?)?.trim();
      final phone = (customer?['phoneE164'] as String?) ?? '';
      final digits = phone.replaceAll(RegExp(r'\D'), '');
      final tail = digits.length >= 4 ? digits.substring(digits.length - 4) : null;
      setState(() => _fulfillingId = null);
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Confirmar este voucher?'),
          content: Text(
            '$display\n$reward · ${name == null || name.isEmpty ? 'Cliente sem nome' : name}'
            '${tail != null ? ' · final $tail' : ''}\n\n'
            'Confira se é o cliente na sua frente. Confirmar entrega o prêmio.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirmar'),
            ),
          ],
        ),
      );
      if (ok == true && mounted) {
        await _fulfill(voucherCode: code);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = humanizeError(e);
          _fulfillingId = null;
        });
      }
    }
  }

  Future<void> _openVoucherScan() async {
    FocusScope.of(context).unfocus();
    final code = await showVoucherScanSheet(context);
    if (!mounted || code == null) return;
    final formatted = formatVoucherInput(code);
    setState(() {
      _voucher.value = TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
      _voucherAmount.clear();
      _voucherResult = null;
    });
  }

  void _acceptExpired() {
    final r = _voucherResult;
    if (r == null) return;
    _fulfill(
      transactionId: r.transactionId,
      voucherCode: r.voucherCode,
      acceptExpired: true,
    );
  }

  void _onPrimaryEarn() {
    final lookup = _lookup;
    if (lookup == null) return;
    if (lookup.associatedHere && lookup.membershipId != null) {
      if (_canEarn || _cashbackBalance > 0) _earn();
    } else {
      _createCustomer(withEarn: _canEarn);
    }
  }

  String get _notFoundCtaLabel {
    if (!_hasFullPhoneForCreate) return 'Informe o telefone';
    if (!_canEarn) return 'Criar cliente';
    return _mode == EarnMode.points
        ? 'Criar e registrar gasto'
        : _mode == EarnMode.cashback
        ? 'Criar e registrar cashback'
        : 'Criar e carimbar';
  }

  /// Full phone already known from the search query (not just last-4).
  bool get _queryIsFullPhone => digitsOnly(_query.text).length >= 10;

  bool get _hasFullPhoneForCreate {
    if (digitsOnly(_fullPhone.text).length >= 10) return true;
    if (_queryIsFullPhone) return true;
    return digitsOnly(_lookup?.phoneE164 ?? '').length >= 10;
  }

  String get _createPhoneDigits {
    final full = phoneDigitsForApi(_fullPhone.text);
    if (digitsOnly(full).length >= 10) return full;
    final query = phoneDigitsForApi(_query.text);
    if (digitsOnly(query).length >= 10) return query;
    return phoneDigitsForApi(_lookup?.phoneE164 ?? '');
  }

  String? get _optionalCreateName {
    final name = _displayName.text.trim();
    if (name.isEmpty) return null;
    return name.length > 80 ? name.substring(0, 80) : name;
  }

  String get _createBenefitSummary {
    if (!_canEarn) return 'cadastrar o cliente nesta loja';
    return switch (_mode) {
      EarnMode.points => 'cadastrar e registrar o gasto em pontos',
      EarnMode.cashback => 'cadastrar e registrar o cashback',
      EarnMode.stamps => 'cadastrar e dar o primeiro carimbo',
    };
  }

  String _earnCtaLabel(LookupResult lookup) {
    if (!lookup.associatedHere) {
      if (!_canEarn) return 'Adicionar à loja';
      return _mode == EarnMode.points
          ? 'Adicionar à loja e registrar'
          : _mode == EarnMode.cashback
          ? 'Adicionar à loja e registrar cashback'
          : 'Adicionar à loja e carimbar';
    }
    if (!_canEarn) {
      return lookup.cashbackCents > 0 ? 'Usar cashback' : 'Sem campanha ativa';
    }
    return _mode == EarnMode.points
        ? 'Registrar gasto'
        : _mode == EarnMode.cashback
        ? 'Registrar cashback'
        : 'Carimbar';
  }

  _TillCta get _buscarCta {
    final digits = digitsOnly(_query.text);
    final ok = digits.length == 4 || digits.length >= 10;
    return _TillCta(
      label: _loading ? 'Buscando…' : 'Buscar',
      onPressed: (_loading || !ok) ? null : _lookupByQuery,
      enabled: !_loading && ok,
    );
  }

  _TillCta get _primaryCta {
    if (_task == _TillTask.voucher) {
      if (_voucherExpired) {
        return _TillCta(
          label: _fulfillingId != null ? '…' : 'Aceitar mesmo assim',
          onPressed: _fulfillingId != null ? null : _acceptExpired,
          enabled: _fulfillingId == null,
        );
      }
      return _TillCta(
        label: _fulfillingId != null ? '…' : 'Usar',
        onPressed: _fulfillingId != null ? null : _submitVoucher,
        enabled:
            _fulfillingId == null &&
            normalizeVoucherCode(_voucher.text).length >= 4,
      );
    }
    final lookup = _lookup;
    final customerResolved =
        lookup != null && lookup.found && !lookup.multiple;
    final awaitingCreate =
        lookup != null && !lookup.found && !lookup.multiple;
    final focus = _focus;
    // Keep Buscar above the keyboard only while the search is still open.
    if (focus == _TillFocus.phone && !customerResolved && !awaitingCreate) {
      return _buscarCta;
    }
    if (focus == _TillFocus.fullPhone || awaitingCreate) {
      return _TillCta(
        label: _loading ? '…' : _notFoundCtaLabel,
        onPressed: _loading ? null : _confirmCreateNotFound,
        enabled: !_loading,
        background: _createActionColor(),
      );
    }

    if (lookup == null || lookup.multiple) return _buscarCta;
    if (!lookup.found) {
      return _TillCta(
        label: _loading ? '…' : _notFoundCtaLabel,
        onPressed: _loading ? null : _confirmCreateNotFound,
        enabled: !_loading,
        background: _createActionColor(),
      );
    }
    final earnDisabled =
        _loading ||
        (lookup.associatedHere && !_canEarn && lookup.cashbackCents <= 0);
    return _TillCta(
      label: _earnCtaLabel(lookup),
      onPressed: earnDisabled ? null : _onPrimaryEarn,
      enabled: !earnDisabled,
      background: _earnActionColor(lookup),
    );
  }

  Color? _createActionColor() {
    if (!_canEarn) return null;
    return switch (_mode) {
      EarnMode.points => FregoColors.points,
      EarnMode.cashback => FregoColors.cashback,
      EarnMode.stamps => FregoColors.stamps,
    };
  }

  Color? _earnActionColor(LookupResult lookup) {
    if (!_canEarn) {
      return lookup.cashbackCents > 0 ? FregoColors.cashback : null;
    }
    return switch (_mode) {
      EarnMode.points => FregoColors.points,
      EarnMode.cashback => FregoColors.cashback,
      EarnMode.stamps => FregoColors.stamps,
    };
  }

  Future<void> _openMatchesSheet() async {
    final lookup = _lookup;
    if (lookup == null || !lookup.multiple) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: FregoColors.card,
      builder: (ctx) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: _MatchesList(
              last4: lookup.last4,
              matches: lookup.matches,
              onSelect: (m) {
                Navigator.pop(ctx);
                _selectMatch(m);
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _openVouchersSheet(List<OpenVoucher> vouchers) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: FregoColors.card,
      builder: (ctx) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: _OpenVouchers(
              vouchers: vouchers,
              fulfillingId: _fulfillingId,
              onFulfill: (v) {
                Navigator.pop(ctx);
                _fulfill(transactionId: v.transactionId);
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _openSalesSheet(List<CounterSale> sales) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: FregoColors.card,
      builder: (ctx) {
        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
            child: _SalesList(
              sales: sales,
              reversingId: _reversingId,
              onUndo: (sale) {
                Navigator.pop(ctx);
                _askReverse(sale);
              },
            ),
          ),
        );
      },
    );
  }

  Future<void> _openTagsSheet() async {
    final lookup = _lookup;
    if (lookup == null ||
        !lookup.associatedHere ||
        lookup.customerId == null ||
        _catalog.isEmpty) {
      return;
    }
    final selected = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: FregoColors.card,
      builder: (ctx) {
        return _TagPickerSheet(
          catalog: _catalog,
          selectedIds: lookup.tags.map((t) => t.id).toSet(),
        );
      },
    );
    if (selected == null || !mounted) return;
    try {
      final tags = await _api.patchCustomerTags(
        customerId: lookup.customerId!,
        tagIds: selected.toList(),
      );
      if (!mounted) return;
      setState(() {
        _lookup = lookup.copyWith(tags: tags);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message ?? e.code);
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
      if (result.found && !result.multiple && mounted) {
        _queryFocus.unfocus();
      }
    } catch (e) {
      setState(() => _error = humanizeError(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirmCreateNotFound() async {
    if (!_hasFullPhoneForCreate) {
      setState(() => _error = 'Informe o telefone completo com DDD');
      _fullPhoneFocus.requestFocus();
      return;
    }
    if (_canEarn &&
        (_mode == EarnMode.points || _mode == EarnMode.cashback) &&
        _amountCents == null) {
      setState(() => _error = 'Informe o valor da compra');
      _amountFocus.requestFocus();
      return;
    }
    final phone = _createPhoneDigits;
    final display = formatPhoneBr(digitsOnly(phone));
    final nameCtrl = TextEditingController(text: _displayName.text);
    try {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Criar cliente?'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Não encontramos $display nesta loja.\n\n'
                  'Confirma $_createBenefitSummary?',
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: nameCtrl,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.done,
                  maxLength: 80,
                  decoration: const InputDecoration(
                    labelText: 'Nome (opcional)',
                    hintText: 'Como o cliente se chama',
                    counterText: '',
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancelar'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Confirmar'),
            ),
          ],
        ),
      );
      if (ok == true && mounted) {
        _displayName.text = nameCtrl.text;
        if (_fullPhone.text.isEmpty && digitsOnly(phone).length >= 10) {
          _fullPhone.text = formatPhoneBr(digitsOnly(phone));
        }
        await _resolveFullPhoneAndEarn();
      }
    } finally {
      nameCtrl.dispose();
    }
  }

  Future<void> _resolveFullPhoneAndEarn() async {
    final phone = _createPhoneDigits;
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
        displayName: _optionalCreateName,
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

  void _prefillVoucherAmount() {
    if (_voucherAmount.text.isNotEmpty) return;
    if (_amount.text.isEmpty) return;
    _voucherAmount.text = _amount.text;
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
      _prefillVoucherAmount();
      final result = await _api.fulfillVoucher(
        voucherCode: voucherCode,
        transactionId: transactionId,
        acceptExpired: acceptExpired,
        amountCents: _fulfillAmountCents,
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
      _displayName.clear();
      _applyAmount.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final business = _session.business;
    final voucherTask = _task == _TillTask.voucher;
    final title = voucherTask
        ? 'Confirmar voucher'
        : _availableModes.isEmpty
            ? 'Balcão'
            : _mode == EarnMode.points
                ? 'Pontos'
                : _mode == EarnMode.cashback
                    ? 'Cashback'
                    : 'Carimbos';
    final searchSettled = _lookup != null && !voucherTask;
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    return Scaffold(
      // Lift the action ourselves so it floats on the keyboard. Scaffold
      // resize leaves the bar under the IME on some Android devices.
      resizeToAvoidBottomInset: false,
      appBar: AppBar(
        title: Row(
          children: [
            _BusinessMark(
              name: business?.name ?? '',
              logoUrl: business?.logoUrl,
              color:
                  _parseTagColor(business?.primaryColor) ??
                  FregoColors.primary500,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Balcão · ${business?.name ?? 'funcionário'}',
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                  color: FregoColors.neutral400,
                ),
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
            Text(
              title,
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.6,
                height: 1.15,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              voucherTask
                  ? 'Código que o cliente mostra no app.'
                  : 'Últimos 4 dígitos do celular.',
              style: const TextStyle(
                fontSize: 14,
                height: 1.4,
                color: FregoColors.neutral500,
              ),
            ),
            SizedBox(height: searchSettled ? 12 : 16),
            _TaskToggle(
              task: _task,
              onChanged: _setTask,
            ),
            const SizedBox(height: 16),
            if (voucherTask) ...[
              _VoucherSection(
                controller: _voucher,
                focusNode: _voucherFocus,
                amount: _voucherAmount,
                amountFocus: _voucherAmountFocus,
                fulfilling: _fulfillingId != null,
                result: _voucherResult,
                onSubmit: _submitVoucher,
                onScan: _openVoucherScan,
                onAcceptExpired: _acceptExpired,
                onDismiss: () => setState(() => _voucherResult = null),
              ),
            ] else ...[
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
            if (_lookup == null)
              _PhoneField(
                controller: _query,
                focusNode: _queryFocus,
                onSubmitted: _lookupByQuery,
              ),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: FregoColors.danger, fontSize: 13),
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
              ..._recents.take(4).map(
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
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _openMatchesSheet,
                        child: Text(
                          'Ver ${_lookup!.matches.length} clientes',
                        ),
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
                      'Cliente não encontrado',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _queryIsFullPhone || _hasFullPhoneForCreate
                          ? 'Ninguém com este telefone nesta loja. Confirme para cadastrar e registrar o benefício.'
                          : 'Busca pelos 4 dígitos não achou. Informe o telefone completo com DDD para cadastrar.',
                      style: const TextStyle(color: FregoColors.neutral500),
                    ),
                    if (_queryIsFullPhone ||
                        digitsOnly(_fullPhone.text).length >= 10) ...[
                      const SizedBox(height: 12),
                      Text(
                        formatPhoneBr(
                          digitsOnly(
                            _fullPhone.text.isNotEmpty
                                ? _fullPhone.text
                                : _query.text,
                          ),
                        ),
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 20,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ] else ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _fullPhone,
                        focusNode: _fullPhoneFocus,
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.next,
                        style: TextStyle(
                          fontSize:
                              MediaQuery.sizeOf(context).shortestSide >= 600
                              ? 31
                              : 23,
                          fontWeight: FontWeight.w600,
                        ),
                        onSubmitted: (_) =>
                            _displayNameFocus.requestFocus(),
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
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: _displayName,
                      focusNode: _displayNameFocus,
                      textCapitalization: TextCapitalization.words,
                      textInputAction: _showAmount
                          ? TextInputAction.next
                          : TextInputAction.done,
                      maxLength: 80,
                      onSubmitted: (_) {
                        if (_showAmount) {
                          _amountFocus.requestFocus();
                        } else {
                          _confirmCreateNotFound();
                        }
                      },
                      decoration: const InputDecoration(
                        labelText: 'Nome (opcional)',
                        hintText: 'Como o cliente se chama',
                        counterText: '',
                      ),
                    ),
                    if (_showAmount)
                      _AmountField(
                        controller: _amount,
                        focusNode: _amountFocus,
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
                  ],
                ),
              ),
            ],
            if (_lookup != null && _lookup!.found && !(_lookup!.multiple)) ...[
              const SizedBox(height: 16),
              _CustomerCard(
                lookup: _lookup!,
                catalog: _catalog,
                onEditTags: _openTagsSheet,
                mode: _mode,
                earnKinds: _earnKinds,
                amount: _amount,
                amountFocus: _amountFocus,
                applyAmount: _applyAmount,
                applyFocus: _applyFocus,
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
                onFulfill: (v) => _fulfill(transactionId: v.transactionId),
                onSeeAllVouchers: () =>
                    _openVouchersSheet(_lookup!.openVouchers),
                recentSales: _lookup!.recentSales,
                reversingId: _reversingId,
                onUndo: _askReverse,
                onSeeAllSales: () => _openSalesSheet(_lookup!.recentSales),
              ),
            ],
            ],
          ],
        ),
      ),
      bottomNavigationBar: AnimatedPadding(
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        padding: EdgeInsets.only(bottom: keyboardInset),
        child: _StickyActionBar(
          cta: _primaryCta,
          sale: _lastSale,
          undoBusy: _lastSale != null && _reversingId == _lastSale!.anchorId,
          onUndo: _lastSale == null ? null : () => _askReverse(_lastSale!),
          onNewSearch: searchSettled
              ? () {
                  FocusScope.of(context).unfocus();
                  _resetLookup();
                  WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) _queryFocus.requestFocus();
                  });
                }
              : null,
          compact: keyboardInset > 0,
        ),
      ),
    );
  }
}

extension on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class _TaskToggle extends StatelessWidget {
  const _TaskToggle({required this.task, required this.onChanged});

  final _TillTask task;
  final ValueChanged<_TillTask> onChanged;

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
          _chip(
            label: 'Registrar',
            selected: task == _TillTask.earn,
            onTap: () => onChanged(_TillTask.earn),
          ),
          _chip(
            label: 'Voucher',
            selected: task == _TillTask.voucher,
            onTap: () => onChanged(_TillTask.voucher),
          ),
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: Material(
        color: selected ? FregoColors.card : Colors.transparent,
        elevation: selected ? 1 : 0,
        shadowColor: Colors.black26,
        borderRadius: BorderRadius.circular(11),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(11),
          child: SizedBox(
            height: 44,
            child: Center(
              child: Text(
                label,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: selected
                      ? FregoColors.ink
                      : FregoColors.neutral500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
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
  const _PhoneField({
    required this.controller,
    required this.onSubmitted,
    this.focusNode,
  });

  final TextEditingController controller;
  final VoidCallback onSubmitted;
  final FocusNode? focusNode;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: controller,
      builder: (context, value, _) {
        final d = digitsOnly(value.text);
        final isLast4 = d.length <= 4;
        final wide = MediaQuery.sizeOf(context).shortestSide >= 600;
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
              focusNode: focusNode,
              keyboardType: TextInputType.number,
              textInputAction: TextInputAction.search,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: wide ? 39 : 27,
                fontWeight: FontWeight.w600,
                letterSpacing: isLast4 ? 6 : 0,
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
                contentPadding: EdgeInsets.symmetric(
                  vertical: wide ? 22 : 16,
                ),
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
    this.focusNode,
    this.previewCashback = 0,
    this.cashbackPercent = 0,
    this.applyCents = 0,
    this.paidCents = 0,
    this.showPointsRate = true,
  });

  final TextEditingController controller;
  final FocusNode? focusNode;
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
            focusNode: focusNode,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w600),
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
    required this.catalog,
    required this.onEditTags,
    required this.mode,
    required this.earnKinds,
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
    required this.onFulfill,
    this.amountFocus,
    this.applyFocus,
    this.onSeeAllVouchers,
    this.recentSales = const [],
    this.reversingId,
    this.onUndo,
    this.onSeeAllSales,
  });

  final LookupResult lookup;
  final List<CustomerTag> catalog;
  final VoidCallback onEditTags;
  final EarnMode mode;
  final List<String> earnKinds;
  final TextEditingController amount;
  final FocusNode? amountFocus;
  final TextEditingController applyAmount;
  final FocusNode? applyFocus;
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
  final ValueChanged<OpenVoucher> onFulfill;
  final VoidCallback? onSeeAllVouchers;
  final List<CounterSale> recentSales;
  final String? reversingId;
  final ValueChanged<CounterSale>? onUndo;
  final VoidCallback? onSeeAllSales;

  @override
  Widget build(BuildContext context) {
    final showStamps = earnKinds.contains('stamps') || lookup.stamps > 0;
    final showPoints = earnKinds.contains('points') || lookup.points > 0;
    final showCashback =
        earnKinds.contains('cashback') ||
        lookup.cashbackCents > 0 ||
        cashbackPercent > 0;
    final voucherPreview = lookup.openVouchers.take(2).toList();
    final salePreview = recentSales.take(3).toList();
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
          if (catalog.isNotEmpty && lookup.associatedHere) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                if (lookup.isVip)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: FregoColors.primary50,
                      borderRadius: BorderRadius.circular(99),
                    ),
                    child: const Text(
                      'VIP',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: FregoColors.primary500,
                      ),
                    ),
                  ),
                ...lookup.tags.map(
                  (tag) => _TagChip(tag: tag),
                ),
                GestureDetector(
                  onTap: onEditTags,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(99),
                      border: Border.all(color: FregoColors.neutral200),
                    ),
                    child: const Text(
                      '+ Etiqueta',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
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
                      focusNode: applyFocus,
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
          if (showAmount &&
              (mode == EarnMode.points || mode == EarnMode.cashback))
            _AmountField(
              controller: amount,
              focusNode: amountFocus,
              previewPoints: previewPoints,
              pointsPerReal: pointsPerReal,
              previewCashback: previewCashback,
              cashbackPercent: cashbackPercent,
              applyCents: applyCents,
              paidCents: paidCents,
              showPointsRate: mode == EarnMode.points,
            ),
          if (lookup.openVouchers.isNotEmpty) ...[
            const SizedBox(height: 12),
            _OpenVouchers(
              vouchers: voucherPreview,
              fulfillingId: fulfillingId,
              onFulfill: onFulfill,
            ),
            if (lookup.openVouchers.length > 2)
              TextButton(
                onPressed: onSeeAllVouchers,
                child: Text(
                  'Ver todos os ${lookup.openVouchers.length} vouchers',
                ),
              ),
          ],
          if (showAmount &&
              mode != EarnMode.points &&
              mode != EarnMode.cashback)
            _AmountField(
              controller: amount,
              focusNode: amountFocus,
              previewPoints: previewPoints,
              pointsPerReal: pointsPerReal,
              previewCashback: previewCashback,
              cashbackPercent: cashbackPercent,
              applyCents: applyCents,
              paidCents: paidCents,
              showPointsRate: mode == EarnMode.points,
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
              'Errou? Desfaça se o cliente ainda não usou o benefício.',
              style: TextStyle(
                fontSize: 12,
                height: 1.35,
                color: FregoColors.neutral500,
              ),
            ),
            const SizedBox(height: 10),
            ...salePreview.map((sale) {
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
            if (recentSales.length > 3)
              TextButton(
                onPressed: onSeeAllSales,
                child: Text('Ver ${recentSales.length} lançamentos'),
              ),
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
    required this.onScan,
    required this.onAcceptExpired,
    required this.onDismiss,
    required this.amount,
    this.focusNode,
    this.amountFocus,
  });

  final TextEditingController controller;
  final TextEditingController amount;
  final FocusNode? focusNode;
  final FocusNode? amountFocus;
  final bool fulfilling;
  final FulfillResult? result;
  final VoidCallback onSubmit;
  final VoidCallback onScan;
  final VoidCallback onAcceptExpired;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Código do prêmio',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
              color: FregoColors.neutral400,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Digite o código que o cliente mostra no app.',
            style: TextStyle(
              fontSize: 13,
              height: 1.35,
              color: FregoColors.neutral500,
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: controller,
            focusNode: focusNode,
            textCapitalization: TextCapitalization.characters,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: MediaQuery.sizeOf(context).shortestSide >= 600
                  ? 39
                  : 31,
              fontWeight: FontWeight.w600,
              letterSpacing: 2,
            ),
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
            decoration: InputDecoration(
              hintText: 'K7M-2PQ',
              contentPadding: EdgeInsets.symmetric(
                vertical: MediaQuery.sizeOf(context).shortestSide >= 600
                    ? 22
                    : 18,
              ),
            ),
            onSubmitted: (_) => onSubmit(),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: fulfilling ? null : onScan,
            icon: const Icon(Icons.qr_code_scanner, size: 22),
            label: const Text('Escanear QR'),
            style: OutlinedButton.styleFrom(
              minimumSize: const Size.fromHeight(56),
              foregroundColor: FregoColors.ink,
              textStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
              side: const BorderSide(color: FregoColors.neutral200),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: amount,
            focusNode: amountFocus,
            keyboardType: TextInputType.number,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: MediaQuery.sizeOf(context).shortestSide >= 600 ? 31 : 23,
              fontWeight: FontWeight.w600,
            ),
            onChanged: (raw) {
              final next = maskMoneyInput(raw);
              if (next != raw) {
                amount.value = TextEditingValue(
                  text: next,
                  selection: TextSelection.collapsed(offset: next.length),
                );
              }
            },
            decoration: const InputDecoration(
              labelText: 'Valor desta compra (R\$)',
              hintText: 'Opcional',
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Opcional · retorno da campanha',
            style: TextStyle(
              fontSize: 12,
              height: 1.35,
              color: FregoColors.neutral400,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [
              for (final cents in const [2000, 4000, 6000, 10000])
                OutlinedButton(
                  onPressed: () {
                    final next = formatCentsAsInput(cents);
                    amount.value = TextEditingValue(
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
          if (result.amountCents != null)
            Text(
              result.amountCents == 0
                  ? 'Sem valor nesta compra'
                  : '${formatBrl(result.amountCents!)} nesta compra',
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

class _StickyActionBar extends StatelessWidget {
  const _StickyActionBar({
    required this.cta,
    this.sale,
    this.undoBusy = false,
    this.onUndo,
    this.onNewSearch,
    this.compact = false,
  });

  final _TillCta cta;
  final CounterSale? sale;
  final bool undoBusy;
  final VoidCallback? onUndo;
  final VoidCallback? onNewSearch;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final showUndo = !compact && sale != null;
    return Material(
      color: FregoColors.card,
      elevation: 12,
      child: SafeArea(
        top: false,
        // When the keyboard is open, Scaffold already lifts this bar; skip the
        // bottom inset so Buscar sits flush on top of the keyboard.
        bottom: !compact,
        child: Padding(
          padding: EdgeInsets.fromLTRB(16, compact ? 8 : 10, 16, compact ? 8 : 12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (showUndo) ...[
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        sale!.summary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ),
                    TextButton.icon(
                      onPressed: undoBusy ? null : onUndo,
                      icon: FregoIcons.undo(
                        size: 16,
                        color: FregoColors.neutral500,
                      ),
                      label: Text(undoBusy ? '…' : 'Desfazer'),
                      style: TextButton.styleFrom(
                        foregroundColor: FregoColors.neutral500,
                        minimumSize: const Size(44, 44),
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
              ],
              Row(
                children: [
                  if (onNewSearch != null) ...[
                    Expanded(
                      flex: 38,
                      child: OutlinedButton(
                        onPressed: onNewSearch,
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(52),
                          foregroundColor: FregoColors.ink,
                          backgroundColor: FregoColors.neutralBg,
                          textStyle: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                          side: const BorderSide(color: FregoColors.neutral200),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                        ),
                        child: const Text(
                          'Nova busca',
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Expanded(
                    flex: onNewSearch == null ? 1 : 62,
                    child: FilledButton(
                      onPressed: cta.enabled ? cta.onPressed : null,
                      style: FilledButton.styleFrom(
                        minimumSize: const Size.fromHeight(52),
                        backgroundColor: cta.background,
                        foregroundColor:
                            cta.background == null ? null : Colors.white,
                        disabledBackgroundColor: FregoColors.neutral100,
                        disabledForegroundColor: FregoColors.neutral400,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                      ),
                      child: Text(cta.label, textAlign: TextAlign.center),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MatchesList extends StatelessWidget {
  const _MatchesList({
    required this.matches,
    required this.onSelect,
    this.last4,
  });

  final String? last4;
  final List<CustomerMatch> matches;
  final ValueChanged<CustomerMatch> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          last4 == null ? 'Vários clientes' : 'Terminam em $last4',
          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        const Text(
          'Qual cliente está no caixa?',
          style: TextStyle(color: FregoColors.neutral500),
        ),
        const SizedBox(height: 12),
        ...matches.map(
          (m) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: FregoColors.neutralBg,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () => onSelect(m),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 16,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              [
                                m.displayName ?? 'Cliente',
                                if (m.isVip) 'VIP',
                                if (!m.associatedHere) 'outra loja/app',
                              ].join(' · '),
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              m.phoneE164,
                              style: const TextStyle(
                                fontFamily: 'monospace',
                                color: FregoColors.neutral500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: FregoColors.neutral400,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _SalesList extends StatelessWidget {
  const _SalesList({
    required this.sales,
    required this.onUndo,
    this.reversingId,
  });

  final List<CounterSale> sales;
  final String? reversingId;
  final ValueChanged<CounterSale> onUndo;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Lançamentos',
          style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 12),
        ...sales.map((sale) {
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
                          Text(
                            formatSaleClock(sale.createdAt!),
                            style: const TextStyle(
                              fontSize: 12,
                              color: FregoColors.neutral400,
                            ),
                          ),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: reversingId != null ? null : () => onUndo(sale),
                    child: Text(busy ? '…' : 'Desfazer'),
                  ),
                ],
              ),
            ),
          );
        }),
      ],
    );
  }
}

class _BusinessMark extends StatelessWidget {
  const _BusinessMark({
    required this.name,
    required this.logoUrl,
    required this.color,
  });

  final String name;
  final String? logoUrl;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final letter = trimmed.isEmpty ? '?' : trimmed[0].toUpperCase();
    final url = logoUrl?.trim();
    final fallback = Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        letter,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 13,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
    if (url == null || url.isEmpty) return fallback;
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: Image.network(
        url,
        width: 28,
        height: 28,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback,
      ),
    );
  }
}

Color? _parseTagColor(String? hex) {
  if (hex == null || hex.length != 7 || !hex.startsWith('#')) return null;
  final value = int.tryParse(hex.substring(1), radix: 16);
  if (value == null) return null;
  return Color(0xFF000000 | value);
}

class _TagChip extends StatelessWidget {
  const _TagChip({required this.tag});

  final CustomerTag tag;

  @override
  Widget build(BuildContext context) {
    final color = _parseTagColor(tag.color) ?? FregoColors.primary500;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(99),
      ),
      child: Text(
        tag.name,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

class _TagPickerSheet extends StatefulWidget {
  const _TagPickerSheet({
    required this.catalog,
    required this.selectedIds,
  });

  final List<CustomerTag> catalog;
  final Set<String> selectedIds;

  @override
  State<_TagPickerSheet> createState() => _TagPickerSheetState();
}

class _TagPickerSheetState extends State<_TagPickerSheet> {
  late Set<String> _selected = {...widget.selectedIds};

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Etiquetas',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            const Text(
              'Adicione as que fizerem sentido nesta visita.',
              style: TextStyle(color: FregoColors.neutral500),
            ),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 360),
              child: ListView(
                shrinkWrap: true,
                children: [
                  for (final tag in widget.catalog)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Material(
                        color: _selected.contains(tag.id)
                            ? FregoColors.primary50
                            : FregoColors.neutralBg,
                        borderRadius: BorderRadius.circular(14),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () {
                            setState(() {
                              final next = {..._selected};
                              if (next.contains(tag.id)) {
                                next.remove(tag.id);
                              } else {
                                next.add(tag.id);
                              }
                              _selected = next;
                            });
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 16,
                            ),
                            child: Row(
                              children: [
                                _TagChip(tag: tag),
                                const Spacer(),
                                Text(
                                  _selected.contains(tag.id)
                                      ? 'Adicionada'
                                      : 'Toque para adicionar',
                                  style: const TextStyle(
                                    fontSize: 12,
                                    color: FregoColors.neutral500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton(
                onPressed: () => Navigator.pop(context, _selected),
                child: const Text('Pronto'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
