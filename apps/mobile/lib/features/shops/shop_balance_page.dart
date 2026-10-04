import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/balance_lots_section.dart';
import '../../ui/campaign_order.dart';
import '../../ui/skeleton.dart';
import 'earn_detail_page.dart';

enum _LotFilter { all, stamps, points, cashback, expiring }

_LotFilter _filterFromUnitKind(String? kind) {
  return switch (kind) {
    'stamps' => _LotFilter.stamps,
    'points' => _LotFilter.points,
    'cashback' || 'cashback_cents' => _LotFilter.cashback,
    _ => _LotFilter.all,
  };
}

/// Full list of remaining balance lots for one shop, with filters.
class ShopBalancePage extends StatefulWidget {
  const ShopBalancePage({
    super.key,
    required this.businessId,
    this.shopName,
    this.initialLots,
    this.initialUnitKind,
  });

  final String businessId;
  final String? shopName;
  final List<Map<String, dynamic>>? initialLots;

  /// `stamps` | `points` | `cashback` from an earn push.
  final String? initialUnitKind;

  @override
  State<ShopBalancePage> createState() => _ShopBalancePageState();
}

class _ShopBalancePageState extends State<ShopBalancePage> {
  bool _loading = true;
  bool _hydrated = false;
  String? _error;
  List<Map<String, dynamic>> _lots = [];
  _LotFilter _filter = _LotFilter.all;

  @override
  void initState() {
    super.initState();
    _filter = _filterFromUnitKind(widget.initialUnitKind);
    if (widget.initialLots != null) {
      _lots = List<Map<String, dynamic>>.from(widget.initialLots!);
      _hydrated = true;
      _loading = false;
    }
    _load();
  }

  Future<void> _load() async {
    final keepContent = _hydrated;
    setState(() {
      if (!keepContent) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final data = await fetchMyWallet(businessId: widget.businessId);
      final wallet = data['wallet'] as Map<String, dynamic>?;
      final lots = (wallet?['lots'] as List<dynamic>? ??
              data['lots'] as List<dynamic>? ??
              [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _lots = lots;
        _loading = false;
        _hydrated = true;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceFirst('Exception: ', '');
      if (keepContent) {
        setState(() => _loading = false);
        FregoAdaptive.showMessage(context, message);
      } else {
        setState(() {
          _error = message;
          _loading = false;
        });
      }
    }
  }

  List<Map<String, dynamic>> get _filtered {
    return _lots.where((lot) {
      final kind = lot['unitKind'] as String? ?? 'stamps';
      final daysLeft = (lot['daysLeft'] as num?)?.toInt();
      final expires = lot['expiresAt'] != null;
      return switch (_filter) {
        _LotFilter.all => true,
        _LotFilter.stamps => kind == 'stamps',
        _LotFilter.points => kind == 'points',
        _LotFilter.cashback => kind == 'cashback_cents',
        _LotFilter.expiring =>
          expires && daysLeft != null && daysLeft <= 14,
      };
    }).toList();
  }

  int get _stampsCount =>
      _lots.where((l) => (l['unitKind'] as String?) == 'stamps').length;
  int get _pointsCount =>
      _lots.where((l) => (l['unitKind'] as String?) == 'points').length;
  int get _cashbackCount =>
      _lots.where((l) => (l['unitKind'] as String?) == 'cashback_cents').length;
  int get _expiringCount => _lots.where((l) {
        final daysLeft = (l['daysLeft'] as num?)?.toInt();
        return l['expiresAt'] != null &&
            daysLeft != null &&
            daysLeft <= 14;
      }).length;

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final filtered = _filtered;

    return FregoPage(
      showNavBar: true,
      title: 'Saldo',
      child: _loading && !_hydrated
          ? const FregoDetailSkeleton()
          : _error != null && !_hydrated
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(_error!),
                    const SizedBox(height: 16),
                    FregoPrimaryButton(
                      label: 'Tentar de novo',
                      onPressed: _load,
                    ),
                  ],
                )
              : _buildBody(cupertino: cupertino, filtered: filtered),
    );
  }

  Widget _buildBody({
    required bool cupertino,
    required List<Map<String, dynamic>> filtered,
  }) {
    final children = <Widget>[
      const Text(
        'Todos os ganhos desta loja',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.3,
          color: FregoColors.ink,
        ),
      ),
      const SizedBox(height: 6),
      const Text(
        'Filtre por tipo ou veja o que está perto de expirar.',
        style: TextStyle(
          fontSize: 14,
          height: 1.35,
          color: FregoColors.neutral500,
        ),
      ),
      const SizedBox(height: 16),
      Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _FilterChip(
            label: 'Todos',
            count: _lots.length,
            selected: _filter == _LotFilter.all,
            onTap: () => setState(() => _filter = _LotFilter.all),
          ),
          if (_stampsCount > 0)
            _FilterChip(
              label: 'Carimbos',
              count: _stampsCount,
              selected: _filter == _LotFilter.stamps,
              onTap: () => setState(() => _filter = _LotFilter.stamps),
            ),
          if (_pointsCount > 0)
            _FilterChip(
              label: 'Pontos',
              count: _pointsCount,
              selected: _filter == _LotFilter.points,
              onTap: () => setState(() => _filter = _LotFilter.points),
            ),
          if (_cashbackCount > 0 || _filter == _LotFilter.cashback)
            _FilterChip(
              label: 'Cashback',
              count: _cashbackCount,
              selected: _filter == _LotFilter.cashback,
              onTap: () => setState(() => _filter = _LotFilter.cashback),
            ),
          _FilterChip(
            label: 'Expirando',
            count: _expiringCount,
            selected: _filter == _LotFilter.expiring,
            onTap: () => setState(() => _filter = _LotFilter.expiring),
          ),
        ],
      ),
      const SizedBox(height: 18),
      if (filtered.isEmpty)
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: FregoColors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: Text(
            _lots.isEmpty
                ? 'Sem saldo nesta loja no momento.'
                : 'Nada neste filtro. Experimente “Todos”.',
            style: const TextStyle(
              fontSize: 14,
              height: 1.4,
              color: FregoColors.neutral500,
            ),
          ),
        )
      else
        ...filtered.map(
          (lot) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: BalanceLotTile(
              lot: lot,
              onTap: () async {
                await FregoAdaptive.push(
                  context,
                  EarnDetailPage(
                    businessId: widget.businessId,
                    unitKind: normalizeEarnKind(lot['unitKind'] as String?),
                    quantity: (lot['quantity'] as num?)?.toInt(),
                  ),
                );
                if (mounted) _load();
              },
            ),
          ),
        ),
      const SizedBox(height: 24),
    ];

    if (cupertino) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          CupertinoSliverRefreshControl(onRefresh: _load),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
            sliver: SliverList(
              delegate: SliverChildListDelegate(children),
            ),
          ),
        ],
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        children: children,
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? FregoColors.primary500 : FregoColors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? FregoColors.primary500 : FregoColors.hairline,
            ),
          ),
          child: Text(
            '$label · $count',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? FregoColors.onPrimary : FregoColors.neutral500,
            ),
          ),
        ),
      ),
    );
  }
}
