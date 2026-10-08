import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/balance_lots_section.dart';
import '../../ui/campaign_order.dart';
import '../../ui/shop_summary_card.dart';
import '../../ui/skeleton.dart';
import '../../ui/stamp_balance.dart';
import 'campaign_detail_page.dart';
import 'shop_detail_page.dart';

/// One earn (carimbo / ponto / cashback) — opened from a push or Histórico.
class EarnDetailPage extends StatefulWidget {
  const EarnDetailPage({
    super.key,
    required this.businessId,
    this.unitKind,
    this.transactionId,
    this.quantity,
  });

  final String businessId;
  final String? unitKind;
  final String? transactionId;
  final int? quantity;

  @override
  State<EarnDetailPage> createState() => _EarnDetailPageState();
}

class _EarnDetailPageState extends State<EarnDetailPage> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _wallet;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      if (_wallet == null) {
        _loading = true;
        _error = null;
      }
    });
    try {
      final results = await Future.wait([
        fetchMyWallet(businessId: widget.businessId),
        fetchMyHistory(),
      ]);
      if (!mounted) return;
      final history = results[1];
      setState(() {
        _wallet = results[0];
        _items = (history['items'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  String get _earnKind {
    return normalizeEarnKind(widget.unitKind) ??
        normalizeEarnKind(_item?['unitKind'] as String?) ??
        'stamps';
  }

  Map<String, dynamic>? get _item {
    if (widget.transactionId != null && widget.transactionId!.isNotEmpty) {
      for (final item in _items) {
        if (item['id'] == widget.transactionId) return item;
      }
    }
    final want = lotKindFromEarn(
      normalizeEarnKind(widget.unitKind) ?? 'stamps',
    );
    for (final item in _items) {
      if (item['type'] == 'redeem') continue;
      final biz = item['business'] as Map<String, dynamic>?;
      if (biz?['id'] != widget.businessId) continue;
      final kind = lotKindFromEarn(
        normalizeEarnKind(item['unitKind'] as String?) ?? 'stamps',
      );
      if (kind == want) return item;
    }
    return null;
  }

  List<Map<String, dynamic>> get _lots {
    final lots = ((_wallet?['wallet'] as Map<String, dynamic>?)?['lots']
                as List<dynamic>? ??
            _wallet?['lots'] as List<dynamic>? ??
            [])
        .cast<Map<String, dynamic>>();
    final want = lotKindFromEarn(_earnKind);
    return lots.where((lot) => (lot['unitKind'] as String?) == want).toList();
  }

  List<Map<String, dynamic>> get _relatedCampaigns {
    final campaigns = ((_wallet?['campaigns'] as List<dynamic>?) ??
            (_wallet?['wallet'] as Map<String, dynamic>?)?['campaigns']
                as List<dynamic>? ??
            [])
        .cast<Map<String, dynamic>>();
    return campaigns
        .where((c) => earnKindFromCampaignType(c['type'] as String?) == _earnKind)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final business = _wallet?['business'] as Map<String, dynamic>? ??
        (_item?['business'] as Map<String, dynamic>?);

    return FregoPage(
      showNavBar: true,
      title: 'Você ganhou',
      child: _loading && _wallet == null
          ? const FregoDetailSkeleton()
          : _error != null && _wallet == null
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(_error!),
                    const SizedBox(height: 16),
                    FregoPrimaryButton(label: 'Tentar de novo', onPressed: _load),
                  ],
                )
              : _body(business),
    );
  }

  Future<void> _openShop() async {
    await FregoAdaptive.push(
      context,
      ShopDetailPage(businessId: widget.businessId),
    );
    if (mounted) _load();
  }

  Widget _body(Map<String, dynamic>? business) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final children = _bodyChildren(business);
    if (cupertino) {
      return CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        slivers: [
          CupertinoSliverRefreshControl(onRefresh: _load),
          SliverPadding(
            padding: const EdgeInsets.all(24),
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
        padding: const EdgeInsets.all(24),
        children: children,
      ),
    );
  }

  List<Widget> _bodyChildren(Map<String, dynamic>? business) {
    final kind = _earnKind;
    final item = _item;
    final qty = widget.quantity ??
        (item?['quantity'] as num?)?.toInt() ??
        0;
    final style = _kindStyle(kind);
    final hero = _heroLabel(kind, qty, item);
    final when = _formatWhen(item?['createdAt'] as String?);
    final expiry = _formatExpiry(
      item?['expiresAt'] as String? ??
          (_lots.isNotEmpty ? _lots.first['expiresAt'] as String? : null),
    );
    final pools = (_wallet?['pools'] as Map<String, dynamic>?) ??
        (_wallet?['wallet'] as Map<String, dynamic>?)?['pools']
            as Map<String, dynamic>? ??
        {};
    final balanceLine = _balanceLine(kind, pools, _wallet);
    final location = (item?['location'] as Map?)?['name'] as String?;
    final actor = item?['actorName'] as String?;

    return [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
        decoration: BoxDecoration(
          color: style.bg,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: style.ring),
        ),
        child: Column(
          children: [
            Container(
              width: 56,
              height: 56,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: style.icon,
            ),
            const SizedBox(height: 14),
            Text(
              hero,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.4,
                color: style.color,
              ),
            ),
            if (when != null || expiry != null) ...[
              const SizedBox(height: 8),
              Text(
                [
                  ?when,
                  ?expiry,
                ].join(' · '),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.35,
                  color: FregoColors.neutral500,
                ),
              ),
            ],
            if (location != null || actor != null) ...[
              const SizedBox(height: 4),
              Text(
                [
                  ?location,
                  if (actor != null) 'por $actor',
                ].join(' · '),
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  color: FregoColors.neutral400,
                ),
              ),
            ],
          ],
        ),
      ),
      const SizedBox(height: 16),
      ShopSummaryCard(
        business: business,
        onTap: _openShop,
      ),
      if (balanceLine != null) ...[
        const SizedBox(height: 20),
        const Text(
          'Seu saldo agora',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.04,
            color: FregoColors.neutral400,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          balanceLine,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.3,
            color: FregoColors.ink,
          ),
        ),
      ],
      if (_lots.isNotEmpty) ...[
        const SizedBox(height: 20),
        BalanceLotsSection(
          lots: _lots,
          title: 'Validade deste saldo',
          subtitle: 'O mais antigo é usado primeiro.',
        ),
      ],
      if (_relatedCampaigns.isNotEmpty) ...[
        const SizedBox(height: 12),
        const Text(
          'Campanhas',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.04,
            color: FregoColors.neutral400,
          ),
        ),
        const SizedBox(height: 8),
        ..._relatedCampaigns.map((c) {
          final campaignId = c['campaignId'] as String? ?? '';
          final name = c['campaignName'] as String? ?? 'Campanha';
          final reward = c['rewardTitle'] as String?;
          return Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Material(
              color: FregoColors.card,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: campaignId.isEmpty
                    ? null
                    : () async {
                        await FregoAdaptive.push(
                          context,
                          CampaignDetailPage(
                            businessId: widget.businessId,
                            campaignId: campaignId,
                          ),
                        );
                        if (mounted) _load();
                      },
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: FregoColors.hairline),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: FregoColors.ink,
                              ),
                            ),
                            if (reward != null && reward.isNotEmpty) ...[
                              const SizedBox(height: 2),
                              Text(
                                reward,
                                style: const TextStyle(
                                  fontSize: 13,
                                  color: FregoColors.neutral500,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const Icon(
                        FregoIcons.chevronRight,
                        color: FregoColors.neutral400,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }),
      ],
    ];
  }

  String _heroLabel(String kind, int qty, Map<String, dynamic>? item) {
    if (kind == 'cashback') {
      final cents = qty > 0
          ? qty
          : (item?['quantity'] as num?)?.toInt() ?? 0;
      return '+ ${_formatBrl(cents)} cashback';
    }
    if (kind == 'points') {
      return qty == 1 ? '+1 ponto' : '+$qty pontos';
    }
    if (qty <= 0) {
      return kind == 'points' ? 'Pontos' : 'Carimbos';
    }
    return qty == 1 ? '+1 carimbo' : '+$qty carimbos';
  }

  String? _balanceLine(
    String kind,
    Map<String, dynamic> pools,
    Map<String, dynamic>? wallet,
  ) {
    if (kind == 'cashback') {
      final cents = (pools['cashbackCents'] as num?)?.toInt() ?? 0;
      return _formatBrl(cents);
    }
    if (kind == 'points') {
      final n = (pools['points'] as num?)?.toInt() ?? 0;
      return n == 1 ? '1 ponto' : '$n pontos';
    }
    final nested = wallet?['wallet'];
    final source = wallet != null && wallet['stampDestinations'] is List
        ? wallet
        : nested is Map
            ? Map<String, dynamic>.from(nested)
            : wallet;
    if (source != null && stampDestinationsOf(source).length > 1) {
      return stampSummary(source);
    }
    final n = (pools['stamps'] as num?)?.toInt() ?? 0;
    return n == 1 ? '1 carimbo' : '$n carimbos';
  }

  String _formatBrl(int cents) {
    return 'R\$ ${(cents / 100).toStringAsFixed(2).replaceAll('.', ',')}';
  }

  String? _formatWhen(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return null;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final that = DateTime(d.year, d.month, d.day);
    final diff = today.difference(that).inDays;
    final hm =
        '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    if (diff == 0) return 'Hoje às $hm';
    if (diff == 1) return 'Ontem às $hm';
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')} às $hm';
  }

  String? _formatExpiry(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso);
    if (d == null) return null;
    const months = [
      'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
      'jul', 'ago', 'set', 'out', 'nov', 'dez',
    ];
    return 'válido até ${d.day} ${months[d.month - 1]}';
  }

  _KindStyle _kindStyle(String kind) {
    return switch (kind) {
      'points' => _KindStyle(
          icon: FregoIcons.points(size: 28, color: FregoColors.points),
          color: FregoColors.points,
          bg: FregoColors.pointsBg,
          ring: FregoColors.pointsRing,
        ),
      'cashback' => _KindStyle(
          icon: FregoIcons.cashback(size: 28, color: FregoColors.cashback),
          color: FregoColors.cashback,
          bg: FregoColors.cashbackBg,
          ring: FregoColors.cashbackRing,
        ),
      _ => _KindStyle(
          icon: FregoIcons.stamp(size: 28, color: FregoColors.stamps),
          color: FregoColors.stamps,
          bg: FregoColors.stampsBg,
          ring: FregoColors.stampsRing,
        ),
    };
  }
}

class _KindStyle {
  const _KindStyle({
    required this.icon,
    required this.color,
    required this.bg,
    required this.ring,
  });

  final Widget icon;
  final Color color;
  final Color bg;
  final Color ring;
}
