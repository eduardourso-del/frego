import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/balance_lots_section.dart';
import '../../ui/voucher_sheet.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key, this.refreshToken = 0});

  /// Bumped by the shell to reload in the background without remounting.
  final int refreshToken;

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

enum _HistoryFilter { all, vouchers, stamps, points }

class _HistoryPageState extends State<HistoryPage> {
  bool _loading = true;
  bool _hydrated = false;
  String? _error;
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _lots = [];
  _HistoryFilter _filter = _HistoryFilter.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant HistoryPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) {
      _load();
    }
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
      final data = await fetchMyHistory();
      final items = (data['items'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final lots = (data['lots'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _items = items;
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

  bool _isVoucher(Map<String, dynamic> item) =>
      item['type'] == 'redeem' && item['unitKind'] != 'cashback_cents';

  bool _isStampEarn(Map<String, dynamic> item) {
    return item['type'] == 'stamp' &&
        item['unitKind'] != 'points' &&
        item['unitKind'] != 'cashback_cents';
  }

  bool _isPointsEarn(Map<String, dynamic> item) {
    if (item['type'] != 'stamp') return false;
    final unit = item['unitKind'] as String?;
    if (unit == 'points') return true;
    if (unit == 'stamps' || unit == 'cashback_cents') return false;
    return ((item['amountCents'] as num?)?.toInt() ?? 0) > 0;
  }

  List<Map<String, dynamic>> get _filteredItems {
    return _items.where((item) {
      return switch (_filter) {
        _HistoryFilter.all => true,
        _HistoryFilter.vouchers => _isVoucher(item),
        _HistoryFilter.stamps => _isStampEarn(item),
        _HistoryFilter.points => _isPointsEarn(item),
      };
    }).toList();
  }

  int get _voucherCount => _items.where(_isVoucher).length;
  int get _stampsCount => _items.where(_isStampEarn).length;
  int get _pointsCount => _items.where(_isPointsEarn).length;

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final filtered = _filteredItems;
    final showLots = _filter == _HistoryFilter.all && _lots.isNotEmpty;

    final slivers = <Widget>[
      if (cupertino) CupertinoSliverRefreshControl(onRefresh: _load),
      const SliverToBoxAdapter(
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 16, 24, 8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Histórico',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.4,
                  color: FregoColors.ink,
                ),
              ),
              SizedBox(height: 6),
              Text(
                'Carimbos, pontos e vouchers de resgate.',
                style: TextStyle(
                  fontSize: 15,
                  color: FregoColors.neutral500,
                ),
              ),
            ],
          ),
        ),
      ),
      if (_loading)
        const SliverFillRemaining(
          child: Center(child: FregoProgress()),
        )
      else if (_error != null)
        SliverFillRemaining(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_error!, textAlign: TextAlign.center),
                const SizedBox(height: 16),
                FregoPrimaryButton(
                  label: 'Tentar de novo',
                  onPressed: _load,
                  expanded: false,
                ),
              ],
            ),
          ),
        )
      else if (_items.isEmpty && _lots.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 64,
                  height: 64,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FregoColors.primary50,
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: Icon(
                    FregoIcons.historyFilled,
                    color: FregoColors.primary500,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Nada por aqui ainda',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Quando você acumular ou resgatar em uma loja, o movimento aparece aqui com o código do voucher.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    height: 1.4,
                    color: FregoColors.neutral500,
                  ),
                ),
              ],
            ),
          ),
        )
      else ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 4, 24, 0),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _HistoryFilterChip(
                  label: 'Todos',
                  count: _items.length,
                  selected: _filter == _HistoryFilter.all,
                  onTap: () => setState(() => _filter = _HistoryFilter.all),
                ),
                _HistoryFilterChip(
                  label: 'Vouchers',
                  count: _voucherCount,
                  selected: _filter == _HistoryFilter.vouchers,
                  onTap: () =>
                      setState(() => _filter = _HistoryFilter.vouchers),
                ),
                if (_stampsCount > 0)
                  _HistoryFilterChip(
                    label: 'Carimbos',
                    count: _stampsCount,
                    selected: _filter == _HistoryFilter.stamps,
                    onTap: () =>
                        setState(() => _filter = _HistoryFilter.stamps),
                  ),
                if (_pointsCount > 0)
                  _HistoryFilterChip(
                    label: 'Pontos',
                    count: _pointsCount,
                    selected: _filter == _HistoryFilter.points,
                    onTap: () =>
                        setState(() => _filter = _HistoryFilter.points),
                  ),
              ],
            ),
          ),
        ),
        if (showLots)
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
              child: BalanceLotsSection(
                lots: _lots,
                title: 'Saldo com validade',
                subtitle:
                    'Carimbos e pontos que você ainda tem, com a data em que expiram.',
                showShopName: true,
              ),
            ),
          ),
        if (filtered.isNotEmpty)
          ..._buildGroupedSlivers(filtered)
        else
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
              child: Text(
                _filterEmptyMessage(),
                style: const TextStyle(
                  fontSize: 14,
                  height: 1.4,
                  color: FregoColors.neutral500,
                ),
              ),
            ),
          ),
      ],
    ];

    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: slivers,
    );

    return FregoPage(
      child: cupertino
          ? scroll
          : RefreshIndicator(onRefresh: _load, child: scroll),
    );
  }

  String _filterEmptyMessage() {
    return switch (_filter) {
      _HistoryFilter.vouchers =>
        'Nenhum voucher ainda. Quando você resgatar um prêmio, o código aparece aqui.',
      _HistoryFilter.stamps => 'Nenhum carimbo neste histórico.',
      _HistoryFilter.points => 'Nenhum ponto neste histórico.',
      _HistoryFilter.all =>
        'Sem movimentos recentes — seu saldo atual está acima.',
    };
  }

  List<Widget> _buildGroupedSlivers(List<Map<String, dynamic>> items) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final item in items) {
      final key = _groupLabel(item['createdAt'] as String?);
      groups.putIfAbsent(key, () => []).add(item);
    }

    final out = <Widget>[];
    for (final entry in groups.entries) {
      out.add(
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
            child: Text(
              entry.key,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.06,
                color: FregoColors.neutral400,
              ),
            ),
          ),
        ),
      );
      out.add(
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          sliver: SliverList.separated(
            itemCount: entry.value.length,
            separatorBuilder: (_, __) => const SizedBox(height: 10),
            itemBuilder: (context, i) => _HistoryTile(
              item: entry.value[i],
              onOpenVoucher: (
                display,
                reward,
                shop,
                shopLogoUrl,
                used,
                usedAt,
                expiresAt,
                status,
              ) {
                showRedeemVoucherSheet(
                  context,
                  voucherDisplay: display,
                  rewardTitle: reward,
                  shopName: shop,
                  shopLogoUrl: shopLogoUrl,
                  used: used,
                  usedAt: usedAt,
                  expiresAt: expiresAt,
                  status: status,
                );
              },
            ),
          ),
        ),
      );
    }
    out.add(const SliverToBoxAdapter(child: SizedBox(height: 32)));
    return out;
  }

  String _groupLabel(String? iso) {
    if (iso == null) return 'Anteriores';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return 'Anteriores';
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final that = DateTime(d.year, d.month, d.day);
    final diff = today.difference(that).inDays;
    if (diff == 0) return 'HOJE';
    if (diff == 1) return 'ONTEM';
    if (diff < 7) return 'ESTA SEMANA';
    if (d.month == now.month && d.year == now.year) return 'ESTE MÊS';
    return '${d.month.toString().padLeft(2, '0')}/${d.year}';
  }
}

class _HistoryFilterChip extends StatelessWidget {
  const _HistoryFilterChip({
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
              color: selected ? Colors.white : FregoColors.neutral500,
            ),
          ),
        ),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({
    required this.item,
    required this.onOpenVoucher,
  });

  final Map<String, dynamic> item;
  final void Function(
    String display,
    String reward,
    String shop,
    String? shopLogoUrl,
    bool used,
    String? usedAt,
    String? expiresAt,
    String? status,
  ) onOpenVoucher;

  @override
  Widget build(BuildContext context) {
    final type = item['type'] as String? ?? 'stamp';
    final isRedeem = type == 'redeem';
    final business = item['business'] as Map<String, dynamic>? ?? {};
    final shop = business['name'] as String? ?? 'Loja';
    final shopLogoUrl = business['logoUrl'] as String?;
    final reward = item['rewardTitle'] as String? ??
        (item['campaign'] as Map?)?['rewardTitle'] as String? ??
        'Prêmio';
    final voucher = item['voucherDisplay'] as String?;
    final voucherStatus = item['voucherStatus'] as String?;
    final voucherUsed = voucherStatus == 'used' ||
        (item['voucherUsedAt'] as String?)?.isNotEmpty == true;
    final voucherExpired = voucherStatus == 'expired';
    final voucherUsedAt = item['voucherUsedAt'] as String?;
    final voucherExpiresAt = item['voucherExpiresAt'] as String?;
    final qty = (item['quantity'] as num?)?.toInt() ?? 1;
    final unit = item['unitKind'] as String?;
    final when = _formatTime(item['createdAt'] as String?);
    final expiresAt = item['expiresAt'] as String?;

    final money = 'R\$ ${(qty / 100).toStringAsFixed(2).replaceAll('.', ',')}';
    final title = unit == 'cashback_cents'
        ? (isRedeem ? 'Cashback usado · $money' : '+ $money cashback')
        : isRedeem
            ? (voucherUsed
                ? 'Usou $reward'
                : voucherExpired
                    ? 'Expirou · $reward'
                    : 'Resgatou $reward')
            : unit == 'points'
                ? '+$qty ${qty == 1 ? 'ponto' : 'pontos'}'
                : '+$qty ${qty == 1 ? 'carimbo' : 'carimbos'}';

    final expiryLine = !isRedeem ? _formatExpiry(expiresAt) : null;
    final inactive = voucherUsed || voucherExpired;

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: isRedeem &&
                unit != 'cashback_cents' &&
                voucher != null &&
                voucher.isNotEmpty
            ? () => onOpenVoucher(
                  voucher,
                  reward,
                  shop,
                  shopLogoUrl,
                  voucherUsed,
                  voucherUsedAt,
                  voucherExpiresAt,
                  voucherStatus,
                )
            : null,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isRedeem
                  ? (inactive
                      ? FregoColors.neutral200
                      : const Color(0xFFB7E4CF))
                  : FregoColors.hairline,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isRedeem
                      ? (voucherUsed
                          ? FregoColors.neutral100
                          : voucherExpired
                              ? const Color(0xFFFFF1E6)
                              : const Color(0xFFE6F6EE))
                      : FregoColors.primary50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  isRedeem
                      ? (voucherUsed
                          ? '✓'
                          : voucherExpired
                              ? '!'
                              : '🎁')
                      : '+',
                  style: TextStyle(
                    fontSize: isRedeem ? 20 : 18,
                    fontWeight: FontWeight.w700,
                    color: voucherUsed
                        ? FregoColors.success
                        : voucherExpired
                            ? const Color(0xFFC45C26)
                            : FregoColors.primary500,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: inactive
                            ? FregoColors.neutral500
                            : FregoColors.ink,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$shop · $when',
                      style: const TextStyle(
                        fontSize: 12,
                        color: FregoColors.neutral500,
                      ),
                    ),
                    if (isRedeem && voucherExpiresAt != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        voucherUsed
                            ? 'Usado no balcão'
                            : voucherExpired
                                ? 'Expirou (24h)'
                                : 'Válido por 24h · ${_shortExpiry(voucherExpiresAt)}',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: voucherExpired
                              ? const Color(0xFFC45C26)
                              : FregoColors.neutral500,
                        ),
                      ),
                    ],
                    if (expiryLine != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        expiryLine.text,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: expiryLine.expiring
                              ? FontWeight.w600
                              : FontWeight.w500,
                          color: expiryLine.expiring
                              ? const Color(0xFFB45309)
                              : FregoColors.neutral500,
                        ),
                      ),
                    ],
                    if (voucher != null && voucher.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          GestureDetector(
                            onLongPress: inactive
                                ? null
                                : () async {
                                    await Clipboard.setData(
                                      ClipboardData(text: voucher),
                                    );
                                    if (!context.mounted) return;
                                    FregoAdaptive.showMessage(
                                      context,
                                      'Código copiado',
                                    );
                                  },
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 6,
                              ),
                              decoration: BoxDecoration(
                                color: inactive
                                    ? FregoColors.neutral200
                                    : FregoColors.ink,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                voucher,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 1.2,
                                  fontFamily: 'Courier',
                                  color: inactive
                                      ? FregoColors.neutral500
                                      : Colors.white,
                                  decoration: inactive
                                      ? TextDecoration.lineThrough
                                      : null,
                                ),
                              ),
                            ),
                          ),
                          if (inactive) ...[
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: voucherUsed
                                    ? const Color(0xFFE6F6EE)
                                    : const Color(0xFFFFF1E6),
                                borderRadius: BorderRadius.circular(999),
                              ),
                              child: Text(
                                voucherUsed ? 'Usado' : 'Expirado',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: voucherUsed
                                      ? FregoColors.success
                                      : const Color(0xFFC45C26),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              if (isRedeem && voucher != null)
                const Icon(
                  FregoIcons.chevronRight,
                  size: 18,
                  color: FregoColors.neutral400,
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _shortExpiry(String iso) {
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return 'até $h:$m';
  }

  ({String text, bool expiring})? _formatExpiry(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return null;
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
    final today = DateTime.now().toUtc();
    final todayDate = DateTime.utc(today.year, today.month, today.day);
    final expDate = DateTime.utc(d.year, d.month, d.day);
    final daysLeft = expDate.difference(todayDate).inDays;
    final expiring = daysLeft >= 0 && daysLeft <= 14;
    final label = daysLeft == 0
        ? 'Validade hoje · ${d.day} ${months[d.month - 1]}'
        : daysLeft == 1
            ? 'Validade amanhã · ${d.day} ${months[d.month - 1]}'
            : daysLeft > 0 && daysLeft <= 14
                ? 'Validade até ${d.day} ${months[d.month - 1]} · $daysLeft dias'
                : 'Validade até ${d.day} ${months[d.month - 1]}';
    return (text: label, expiring: expiring);
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}
