import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/voucher_sheet.dart';

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await fetchMyHistory();
      final items = (data['items'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);

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
      else if (_items.isEmpty)
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
      else
        ..._buildGroupedSlivers(),
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

  List<Widget> _buildGroupedSlivers() {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final item in _items) {
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
              onOpenVoucher: (display, reward, shop) {
                showRedeemVoucherSheet(
                  context,
                  voucherDisplay: display,
                  rewardTitle: reward,
                  shopName: shop,
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

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({
    required this.item,
    required this.onOpenVoucher,
  });

  final Map<String, dynamic> item;
  final void Function(String display, String reward, String shop)
      onOpenVoucher;

  @override
  Widget build(BuildContext context) {
    final type = item['type'] as String? ?? 'stamp';
    final isRedeem = type == 'redeem';
    final business = item['business'] as Map<String, dynamic>? ?? {};
    final shop = business['name'] as String? ?? 'Loja';
    final reward = item['rewardTitle'] as String? ??
        (item['campaign'] as Map?)?['rewardTitle'] as String? ??
        'Prêmio';
    final voucher = item['voucherDisplay'] as String?;
    final qty = (item['quantity'] as num?)?.toInt() ?? 1;
    final unit = item['unitKind'] as String?;
    final when = _formatTime(item['createdAt'] as String?);

    final title = isRedeem
        ? 'Resgatou $reward'
        : unit == 'points'
            ? '+$qty ${qty == 1 ? 'ponto' : 'pontos'}'
            : '+$qty ${qty == 1 ? 'carimbo' : 'carimbos'}';

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: isRedeem && voucher != null && voucher.isNotEmpty
            ? () => onOpenVoucher(voucher, reward, shop)
            : null,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isRedeem
                  ? const Color(0xFFB7E4CF)
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
                      ? const Color(0xFFE6F6EE)
                      : FregoColors.primary50,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  isRedeem ? '🎁' : '+',
                  style: TextStyle(
                    fontSize: isRedeem ? 20 : 18,
                    fontWeight: FontWeight.w700,
                    color: FregoColors.primary500,
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
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: FregoColors.ink,
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
                    if (voucher != null && voucher.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      GestureDetector(
                        onLongPress: () async {
                          await Clipboard.setData(ClipboardData(text: voucher));
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
                            color: FregoColors.ink,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            voucher,
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.2,
                              fontFamily: 'Courier',
                              color: Colors.white,
                            ),
                          ),
                        ),
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

  String _formatTime(String? iso) {
    if (iso == null) return '';
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return '';
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}
