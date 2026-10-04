import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/skeleton.dart';
import 'campaign_detail_page.dart';
import 'shop_detail_page.dart';

class ShopsPage extends StatefulWidget {
  const ShopsPage({
    super.key,
    required this.phoneE164,
    this.refreshToken = 0,
  });

  final String phoneE164;

  /// Bumped by the shell to reload in the background without remounting.
  final int refreshToken;

  @override
  State<ShopsPage> createState() => _ShopsPageState();
}

enum _ShopFilter { all, favorites, ready, close }

/// White glyphs while the Céu Azul band sits under the status bar.
const _statusBarOnAzul = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemStatusBarContrastEnforced: false,
);

class _ListRow {
  const _ListRow.header(this.header) : membership = null;
  const _ListRow.shop(this.membership) : header = null;

  final String? header;
  final Map<String, dynamic>? membership;

  bool get isHeader => header != null;
}

class _ShopsPageState extends State<ShopsPage> {
  final _search = TextEditingController();
  final _searchFieldKey = GlobalKey();
  bool _loading = true;
  bool _hydrated = false;
  String? _error;
  List<Map<String, dynamic>> _memberships = [];
  String? _displayName;
  Map<String, dynamic>? _stats;
  _ShopFilter _filter = _ShopFilter.all;
  String? _category;
  final Set<String> _togglingFavorite = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ShopsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) {
      _load();
    }
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
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
      final membershipsRes = await fetchMyMemberships();
      final memberships =
          (membershipsRes['memberships'] as List<dynamic>? ?? [])
              .cast<Map<String, dynamic>>();

      Map<String, dynamic>? customer;
      Map<String, dynamic>? stats;
      try {
        final extras = await Future.wait([
          fetchMyCustomer(),
          fetchMyStats(),
        ]);
        customer = extras[0]['customer'] as Map<String, dynamic>?;
        stats = extras[1];
      } catch (_) {
        // Stats/perfil são extras — lojas ainda devem aparecer.
        try {
          final c = await fetchMyCustomer();
          customer = c['customer'] as Map<String, dynamic>?;
        } catch (_) {}
      }

      if (!mounted) return;
      setState(() {
        _memberships = memberships;
        _displayName = customer?['displayName'] as String?;
        _stats = stats;
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
    final q = _search.text.trim().toLowerCase();
    return _memberships.where((m) {
      final business = m['business'] as Map<String, dynamic>? ?? {};
      final name = (business['name'] as String? ?? '').toLowerCase();
      final slogan = (business['slogan'] as String? ?? '').toLowerCase();
      final type = (business['type'] as String? ?? '').toLowerCase();
      final typeLabel =
          FregoBusinessTypes.labelOf(business['type'] as String?).toLowerCase();
      if (q.isNotEmpty &&
          !name.contains(q) &&
          !slogan.contains(q) &&
          !type.contains(q) &&
          !typeLabel.contains(q)) {
        return false;
      }
      if (_category != null && (business['type'] as String?) != _category) {
        return false;
      }

      final favorite = m['isFavorite'] == true;
      final redeemable = (m['redeemableCampaigns'] as num?)?.toInt() ?? 0;
      final progress = m['progress'] as Map<String, dynamic>?;
      final remaining = (progress?['remaining'] as num?)?.toInt();
      final needed = (progress?['needed'] as num?)?.toInt() ?? 0;
      final close = progress != null &&
          progress['canRedeem'] != true &&
          remaining != null &&
          remaining > 0 &&
          (remaining <= 3 || (needed > 0 && remaining <= (needed / 2).ceil()));

      return switch (_filter) {
        _ShopFilter.all => true,
        _ShopFilter.favorites => favorite,
        _ShopFilter.ready => redeemable > 0,
        _ShopFilter.close => close,
      };
    }).toList();
  }

  List<String> get _presentCategories {
    final seen = <String>{};
    for (final m in _memberships) {
      final type = (m['business'] as Map?)?['type'] as String?;
      if (type != null && type.isNotEmpty) seen.add(type);
    }
    final list = seen.toList()
      ..sort(
        (a, b) => FregoBusinessTypes.sortIndex(a)
            .compareTo(FregoBusinessTypes.sortIndex(b)),
      );
    return list;
  }

  List<_ListRow> get _rows {
    final items = _filtered;
    if (items.isEmpty) return const [];
    final types = <String>{
      for (final m in items)
        (m['business'] as Map?)?['type'] as String? ?? '',
    };
    final group = _category == null && types.length >= 2;
    if (!group) {
      return [for (final m in items) _ListRow.shop(m)];
    }
    final ordered = types.toList()
      ..sort(
        (a, b) => FregoBusinessTypes.sortIndex(a)
            .compareTo(FregoBusinessTypes.sortIndex(b)),
      );
    final rows = <_ListRow>[];
    for (final type in ordered) {
      final shops = items
          .where(
            (m) => ((m['business'] as Map?)?['type'] as String? ?? '') == type,
          )
          .toList();
      if (shops.isEmpty) continue;
      rows.add(
        _ListRow.header(
          FregoBusinessTypes.pluralOf(type.isEmpty ? null : type),
        ),
      );
      rows.addAll(shops.map(_ListRow.shop));
    }
    return rows;
  }

  int get _redeemableNow {
    final fromStats = (_stats?['redeemableNow'] as num?)?.toInt();
    if (fromStats != null) return fromStats;
    return _memberships.fold<int>(
      0,
      (sum, m) => sum + ((m['redeemableCampaigns'] as num?)?.toInt() ?? 0),
    );
  }

  Map<String, dynamic>? get _nextReward =>
      _stats?['nextReward'] as Map<String, dynamic>?;

  List<_BalanceChip> _balanceChips() {
    var stamps = 0;
    var points = 0;
    var cashbackCents = 0;
    for (final m in _memberships) {
      final pools = m['pools'] as Map<String, dynamic>?;
      if (pools == null) continue;
      stamps += (pools['stamps'] as num?)?.toInt() ?? 0;
      points += (pools['points'] as num?)?.toInt() ?? 0;
      cashbackCents += (pools['cashbackCents'] as num?)?.toInt() ?? 0;
    }
    return [
      if (stamps > 0)
        _BalanceChip(
          icon: FregoIcons.stamp(size: 15, color: FregoColors.white),
          label: stamps == 1 ? '1 carimbo' : '$stamps carimbos',
        ),
      if (points > 0)
        _BalanceChip(
          icon: FregoIcons.points(size: 15, color: FregoColors.white),
          label: points == 1 ? '1 ponto' : '$points pontos',
        ),
      if (cashbackCents > 0)
        _BalanceChip(
          icon: FregoIcons.cashback(size: 15, color: FregoColors.white),
          label: _reais(cashbackCents),
        ),
    ];
  }

  String _reais(int cents) {
    final abs = cents.abs();
    final reais = abs ~/ 100;
    final centavos = (abs % 100).toString().padLeft(2, '0');
    final body = '$reais,$centavos';
    return cents < 0 ? '-R\$ $body' : 'R\$ $body';
  }

  int get _favoritesCount =>
      _memberships.where((m) => m['isFavorite'] == true).length;

  int get _readyCount => _memberships
      .where((m) => ((m['redeemableCampaigns'] as num?)?.toInt() ?? 0) > 0)
      .length;

  int get _closeCount => _memberships.where((m) {
        final progress = m['progress'] as Map<String, dynamic>?;
        final remaining = (progress?['remaining'] as num?)?.toInt();
        final needed = (progress?['needed'] as num?)?.toInt() ?? 0;
        return progress != null &&
            progress['canRedeem'] != true &&
            remaining != null &&
            remaining > 0 &&
            (remaining <= 3 ||
                (needed > 0 && remaining <= (needed / 2).ceil()));
      }).length;

  Map<String, dynamic>? _birthdayHint() {
    for (final m in _memberships) {
      final b = m['birthday'] as Map<String, dynamic>?;
      if (b == null) continue;
      if (b['canRedeem'] == true) {
        return {
          ...b,
          'businessId': m['businessId'],
          'businessName': (m['business'] as Map?)?['name'],
        };
      }
      final days = (b['daysUntilBirthday'] as num?)?.toInt();
      if (days != null && days <= 14) {
        return {
          ...b,
          'businessId': m['businessId'],
          'businessName': (m['business'] as Map?)?['name'],
        };
      }
    }
    return null;
  }

  Future<void> _openShop(String businessId) async {
    await FregoAdaptive.push(
      context,
      ShopDetailPage(businessId: businessId),
    );
    _load();
  }

  Future<void> _openCampaign({
    required String businessId,
    String? campaignId,
  }) async {
    if (campaignId != null && campaignId.isNotEmpty) {
      await FregoAdaptive.push(
        context,
        CampaignDetailPage(
          businessId: businessId,
          campaignId: campaignId,
        ),
      );
    } else {
      await FregoAdaptive.push(
        context,
        ShopDetailPage(businessId: businessId),
      );
    }
    if (mounted) _load();
  }

  Future<void> _toggleFavorite(Map<String, dynamic> membership) async {
    final businessId = membership['businessId'] as String?;
    if (businessId == null || _togglingFavorite.contains(businessId)) return;
    final next = membership['isFavorite'] != true;
    setState(() {
      _togglingFavorite.add(businessId);
      final i = _memberships.indexWhere((m) => m['businessId'] == businessId);
      if (i >= 0) {
        _memberships[i] = {..._memberships[i], 'isFavorite': next};
        _memberships.sort((a, b) {
          final af = a['isFavorite'] == true;
          final bf = b['isFavorite'] == true;
          if (af != bf) return af ? -1 : 1;
          final ar = (a['redeemableCampaigns'] as num?)?.toInt() ?? 0;
          final br = (b['redeemableCampaigns'] as num?)?.toInt() ?? 0;
          return br.compareTo(ar);
        });
      }
    });
    try {
      await setMembershipFavorite(businessId: businessId, isFavorite: next);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        final i =
            _memberships.indexWhere((m) => m['businessId'] == businessId);
        if (i >= 0) {
          _memberships[i] = {..._memberships[i], 'isFavorite': !next};
        }
      });
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) {
        setState(() => _togglingFavorite.remove(businessId));
      }
    }
  }

  String? get _firstName {
    final name = _displayName?.trim();
    if (name == null || name.isEmpty) return null;
    return name.split(RegExp(r'\s+')).first;
  }

  @override
  Widget build(BuildContext context) {
    final firstName = _firstName;

    final top = MediaQuery.paddingOf(context).top;
    final expanded = MediaQuery.sizeOf(context).height / 3;
    const toolbar = 56.0;
    final greeting = firstName != null ? 'Olá, $firstName' : 'Olá';
    final balances = _loading && !_hydrated ? const <_BalanceChip>[] : _balanceChips();
    final summary = _loading && !_hydrated
        ? const _PrizeSummaryPlaceholder()
        : _InsightStrip(
            redeemableNow: _redeemableNow,
            nextReward: _nextReward,
            birthday: _birthdayHint(),
            onOpenShop: _openShop,
            onOpenCampaign: _openCampaign,
          );

    final slivers = <Widget>[
      SliverAppBar(
        primary: true,
        pinned: true,
        stretch: true,
        automaticallyImplyLeading: false,
        automaticallyImplyActions: false,
        elevation: 0,
        scrolledUnderElevation: 0,
        shadowColor: Colors.transparent,
        surfaceTintColor: Colors.transparent,
        backgroundColor: FregoColors.azul,
        foregroundColor: FregoColors.white,
        systemOverlayStyle: _statusBarOnAzul,
        toolbarHeight: toolbar,
        expandedHeight: expanded - top,
        centerTitle: false,
        titleSpacing: 20,
        stretchTriggerOffset: 90,
        onStretchTrigger: _load,
        titleTextStyle: (Theme.of(context).textTheme.headlineSmall ??
                const TextStyle())
            .copyWith(
          fontSize: 32,
          height: 1.1,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.6,
          color: FregoColors.white,
        ),
        title: Text(greeting, maxLines: 1, overflow: TextOverflow.ellipsis),
        flexibleSpace: _FreguesHomeHeader(
          toolbarHeight: toolbar,
          balances: balances,
          summary: summary,
        ),
      ),
      if (_memberships.isNotEmpty)
        SliverPersistentHeader(
          pinned: true,
          delegate: _PinnedSearchDelegate(
            controller: _search,
            fieldKey: _searchFieldKey,
            onClear: () {
              _search.clear();
              setState(() {});
            },
          ),
        ),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (_memberships.isNotEmpty) ...[
                _FilterChips(
                  filter: _filter,
                  favoritesCount: _favoritesCount,
                  readyCount: _readyCount,
                  closeCount: _closeCount,
                  onChanged: (f) => setState(() => _filter = f),
                ),
                if (_presentCategories.length > 1) ...[
                  const SizedBox(height: 10),
                  _CategoryChips(
                    types: _presentCategories,
                    selected: _category,
                    onChanged: (value) => setState(() => _category = value),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
      ListenableBuilder(
        listenable: _search,
        builder: (context, _) {
          final items = _filtered;
          return SliverMainAxisGroup(
            slivers: [
              if (_loading && !_hydrated)
        const SliverToBoxAdapter(child: FregoShopsSkeleton())
      else if (_error != null)
        SliverFillRemaining(
          child: Padding(
            padding: const EdgeInsets.all(FregoLargeTitlePage.gutter),
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
      else if (_memberships.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(FregoLargeTitlePage.gutter),
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
                    FregoIcons.shopsFilled,
                    color: FregoColors.ink,
                    size: 28,
                  ),
                ),
                const SizedBox(height: 20),
                const Text(
                  'Nenhuma loja ainda',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Peça um carimbo ou pontos no balcão. Quando a loja registrar seu telefone, ela aparece aqui com o saldo.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 15,
                    color: FregoColors.neutral500,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Puxe para atualizar',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13,
                    color: FregoColors.neutral400,
                  ),
                ),
              ],
            ),
          ),
        )
      else if (items.isEmpty)
        SliverFillRemaining(
          hasScrollBody: false,
          child: Padding(
            padding: const EdgeInsets.all(FregoLargeTitlePage.gutter),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  _filter == _ShopFilter.favorites
                      ? FregoIcons.favorite
                      : FregoIcons.search,
                  size: 36,
                  color: FregoColors.neutral400,
                ),
                const SizedBox(height: 16),
                Text(
                  _search.text.trim().isNotEmpty
                      ? 'Nenhuma loja para “${_search.text.trim()}”'
                      : _category != null
                          ? 'Nenhuma ${FregoBusinessTypes.labelOf(_category!).toLowerCase()} aqui'
                          : switch (_filter) {
                          _ShopFilter.favorites => 'Nenhuma favorita ainda',
                          _ShopFilter.ready => 'Nenhum prêmio pronto',
                          _ShopFilter.close => 'Nenhuma loja perto do prêmio',
                          _ShopFilter.all => 'Nenhuma loja',
                        },
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _search.text.trim().isNotEmpty ||
                  _filter != _ShopFilter.all ||
                  _category != null
                      ? 'Ajuste a busca ou o filtro para ver outras lojas.'
                      : 'Suas fidelidades aparecem aqui.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    color: FregoColors.neutral500,
                  ),
                ),
                if (_filter != _ShopFilter.all ||
                    _search.text.trim().isNotEmpty ||
                    _category != null) ...[
                  const SizedBox(height: 16),
                  FregoSecondaryButton(
                    label: 'Limpar filtros',
                    onPressed: () {
                      _search.clear();
                      setState(() {
                        _filter = _ShopFilter.all;
                        _category = null;
                      });
                    },
                    expanded: false,
                  ),
                ],
              ],
            ),
          ),
        )
      else ...[
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              FregoLargeTitlePage.gutter,
              20,
              FregoLargeTitlePage.gutter,
              8,
            ),
            child: Text(
              items.length == 1 ? '1 loja' : '${items.length} lojas',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.04,
                color: FregoColors.neutral400,
              ),
            ),
          ),
        ),
        SliverPadding(
              padding: const EdgeInsets.fromLTRB(FregoLargeTitlePage.gutter, 8, FregoLargeTitlePage.gutter, 32),
              sliver: SliverList.separated(
                itemCount: _rows.length,
                separatorBuilder: (context, index) {
                  final next = _rows[index + 1];
                  if (next.isHeader) return const SizedBox(height: 18);
                  if (_rows[index].isHeader) return const SizedBox(height: 8);
                  return const SizedBox(height: 12);
                },
                itemBuilder: (context, index) {
                  final row = _rows[index];
                  if (row.isHeader) {
                    return Padding(
                      padding: EdgeInsets.only(top: index == 0 ? 0 : 4),
                      child: Text(
                        row.header!,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.1,
                          color: FregoColors.ink,
                        ),
                      ),
                    );
                  }
                  final m = row.membership!;
                  final business =
                      m['business'] as Map<String, dynamic>? ?? {};
                  final pools = m['pools'] as Map<String, dynamic>? ??
                      {'stamps': 0, 'points': 0};
                  final stamps = (pools['stamps'] as num?)?.toInt() ?? 0;
                  final points = (pools['points'] as num?)?.toInt() ?? 0;
                  final redeemable =
                      (m['redeemableCampaigns'] as num?)?.toInt() ?? 0;
                  final isFavorite = m['isFavorite'] == true;
                  final progress = m['progress'] as Map<String, dynamic>?;
                  final remaining =
                      (progress?['remaining'] as num?)?.toInt();
                  final canRedeemProgress = progress?['canRedeem'] == true;
                  final progressType = progress?['type'] as String?;
                  final rewardTitle = progress?['rewardTitle'] as String?;
                  final primary = _parseHex(
                    business['primaryColor'] as String?,
                  );
                  final name = business['name'] as String? ?? 'Loja';
                  final letter = name.trim().isEmpty
                      ? 'V'
                      : name.trim()[0].toUpperCase();
                  final businessId = m['businessId'] as String;
                  final badges = (m['badges'] as List<dynamic>? ?? [])
                      .cast<Map<String, dynamic>>();
                  final badgeTitle = badges.isNotEmpty
                      ? (badges.first['badgeTitle'] as String?)
                      : null;

                  return Material(
                    color: FregoColors.card,
                    borderRadius: BorderRadius.circular(18),
                    child: InkWell(
                      onTap: () => _openShop(businessId),
                      borderRadius: BorderRadius.circular(18),
                      child: Container(
                        padding: const EdgeInsets.fromLTRB(16, 16, 4, 16),
                        decoration: BoxDecoration(
                          color: FregoColors.card,
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: redeemable > 0
                                ? const Color(0xFFB7E4CF)
                                : FregoColors.hairline,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.045),
                              blurRadius: 18,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _ShopAvatar(
                              letter: letter,
                              logoUrl: business['logoUrl'] as String?,
                              color: Color(primary ?? 0xFF070707),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    FregoBusinessTypes.labelOf(
                                      business['type'] as String?,
                                    ),
                                    style: const TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      letterSpacing: 0.04,
                                      color: FregoColors.neutral400,
                                    ),
                                  ),
                                  Text(
                                    name,
                                    style: const TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: -0.2,
                                      color: FregoColors.ink,
                                    ),
                                  ),
                                  if ((business['slogan'] as String?)
                                          ?.isNotEmpty ==
                                      true)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 2),
                                      child: Text(
                                        business['slogan'] as String,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          color: FregoColors.neutral500,
                                        ),
                                      ),
                                    ),
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: [
                                      if (badgeTitle != null &&
                                          badgeTitle.isNotEmpty)
                                        _Pill(
                                          label: badgeTitle,
                                          tone: _PillTone.badge,
                                          icon: FregoIcons.trophy,
                                        ),
                                      if (redeemable > 0)
                                        _Pill(
                                          label: redeemable == 1
                                              ? 'Resgatar agora'
                                              : '$redeemable prêmios prontos',
                                          tone: _PillTone.ready,
                                          onTap: progress?['campaignId'] == null
                                              ? null
                                              : () => _openCampaign(
                                                    businessId: businessId,
                                                    campaignId: progress![
                                                        'campaignId'] as String?,
                                                  ),
                                        )
                                      else if (progress?['lockedReason'] ==
                                          'quota_exhausted')
                                        _Pill(
                                          label: 'Já resgatado neste período',
                                          tone: _PillTone.stamps,
                                          onTap: progress?['campaignId'] == null
                                              ? null
                                              : () => _openCampaign(
                                                    businessId: businessId,
                                                    campaignId: progress![
                                                        'campaignId'] as String?,
                                                  ),
                                        )
                                      else if (remaining != null &&
                                          progress != null &&
                                          !canRedeemProgress)
                                        _Pill(
                                          label: _progressLabel(
                                            remaining: remaining,
                                            type: progressType,
                                            rewardTitle: rewardTitle,
                                          ),
                                          tone: progressType == 'spend'
                                              ? _PillTone.points
                                              : progressType == 'promo'
                                                  ? _PillTone.badge
                                                  : _PillTone.stamps,
                                          onTap: progress['campaignId'] == null
                                              ? null
                                              : () => _openCampaign(
                                                    businessId: businessId,
                                                    campaignId: progress[
                                                        'campaignId'] as String?,
                                                  ),
                                        )
                                      else ...[
                                        _Pill(
                                          label: '$stamps carimbos',
                                          tone: _PillTone.stamps,
                                        ),
                                        if (points > 0)
                                          _Pill(
                                            label: '$points pts',
                                            tone: _PillTone.points,
                                          ),
                                      ],
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              onPressed: () => _toggleFavorite(m),
                              tooltip: isFavorite
                                  ? 'Remover dos favoritos'
                                  : 'Favoritar',
                              icon: Icon(
                                isFavorite
                                    ? FregoIcons.favoriteFilled
                                    : FregoIcons.favorite,
                                color: isFavorite
                                    ? FregoColors.danger
                                    : FregoColors.neutral400,
                                size: 22,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
            ],
          );
        },
      ),
    ];

    final bottomClearance = MediaQuery.paddingOf(context).bottom;
    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        ...slivers,
        if (bottomClearance > 0)
          SliverToBoxAdapter(child: SizedBox(height: bottomClearance)),
      ],
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _statusBarOnAzul,
      child: ColoredBox(
        color: FregoColors.neutralBg,
        child: scroll,
      ),
    );
  }

  int? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    final cleaned = hex.replaceFirst('#', '');
    if (cleaned.length != 6) return null;
    return int.tryParse('FF$cleaned', radix: 16);
  }

  String _progressLabel({
    required int remaining,
    required String? type,
    required String? rewardTitle,
  }) {
    final reward = (rewardTitle != null && rewardTitle.trim().isNotEmpty)
        ? rewardTitle.trim()
        : 'prêmio';
    if (type == 'promo') return reward;
    if (type == 'birthday') return reward;
    final unit = type == 'spend' ? 'pts' : 'carimbos';
    return 'Faltam $remaining $unit · $reward';
  }
}

enum _PillTone { stamps, points, ready, badge }

class _ShopSearchField extends StatelessWidget {
  const _ShopSearchField({
    super.key,
    required this.controller,
    required this.onClear,
  });

  final TextEditingController controller;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      return CupertinoSearchTextField(
        controller: controller,
        placeholder: 'Buscar loja',
        style: const TextStyle(fontSize: 16, color: FregoColors.ink),
        backgroundColor: FregoColors.card,
        borderRadius: BorderRadius.circular(14),
        prefixIcon: const Icon(
          FregoIcons.search,
          color: FregoColors.neutral400,
          size: 20,
        ),
        suffixIcon: const Icon(
          FregoIcons.clear,
          color: FregoColors.neutral400,
          size: 18,
        ),
        onSuffixTap: onClear,
      );
    }

    return Material(
      color: Colors.transparent,
      child: TextField(
        controller: controller,
        textInputAction: TextInputAction.search,
        style: const TextStyle(fontSize: 16, color: FregoColors.ink),
        decoration: InputDecoration(
          hintText: 'Buscar loja',
          hintStyle: const TextStyle(color: FregoColors.neutral400),
          prefixIcon: const Icon(
            FregoIcons.search,
            color: FregoColors.neutral400,
            size: 22,
          ),
          suffixIcon: ValueListenableBuilder<TextEditingValue>(
            valueListenable: controller,
            builder: (context, value, _) {
              if (value.text.isEmpty) return const SizedBox.shrink();
              return IconButton(
                onPressed: onClear,
                icon: const Icon(
                  FregoIcons.clear,
                  size: 18,
                  color: FregoColors.neutral400,
                ),
              );
            },
          ),
          filled: true,
          fillColor: FregoColors.card,
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: FregoColors.neutral200),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: FregoColors.neutral200),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(
              color: FregoColors.ink,
              width: 1.5,
            ),
          ),
        ),
      ),
    );
  }
}

class _FilterChips extends StatelessWidget {
  const _FilterChips({
    required this.filter,
    required this.favoritesCount,
    required this.readyCount,
    required this.closeCount,
    required this.onChanged,
  });

  final _ShopFilter filter;
  final int favoritesCount;
  final int readyCount;
  final int closeCount;
  final ValueChanged<_ShopFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: FregoLargeTitlePage.gutter),
      child: Row(
        children: [
          _chip(
            label: 'Todas',
            selected: filter == _ShopFilter.all,
            onTap: () => onChanged(_ShopFilter.all),
          ),
          const SizedBox(width: 8),
          _chip(
            label: favoritesCount > 0
                ? 'Favoritas ($favoritesCount)'
                : 'Favoritas',
            selected: filter == _ShopFilter.favorites,
            icon: FregoIcons.favoriteFilled,
            onTap: () => onChanged(_ShopFilter.favorites),
          ),
          const SizedBox(width: 8),
          _chip(
            label: readyCount > 0 ? 'Prontos ($readyCount)' : 'Prontos',
            selected: filter == _ShopFilter.ready,
            icon: FregoIcons.gift,
            onTap: () => onChanged(_ShopFilter.ready),
          ),
          const SizedBox(width: 8),
          _chip(
            label: closeCount > 0 ? 'Quase lá ($closeCount)' : 'Quase lá',
            selected: filter == _ShopFilter.close,
            icon: FregoIcons.trending,
            onTap: () => onChanged(_ShopFilter.close),
          ),
        ],
      ),
    );
  }

  Widget _chip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
    IconData? icon,
  }) {
    return Material(
      color: selected ? FregoColors.primary500 : FregoColors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? FregoColors.primary500 : FregoColors.neutral200,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(
                  icon,
                  size: 14,
                  color: selected ? FregoColors.onPrimary : FregoColors.neutral500,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? FregoColors.onPrimary : FregoColors.ink,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({
    required this.types,
    required this.selected,
    required this.onChanged,
  });

  final List<String> types;
  final String? selected;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: FregoLargeTitlePage.gutter),
      child: Row(
        children: [
          for (var i = 0; i < types.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            _catChip(
              label: FregoBusinessTypes.labelOf(types[i]),
              selected: selected == types[i],
              onTap: () =>
                  onChanged(selected == types[i] ? null : types[i]),
            ),
          ],
        ],
      ),
    );
  }

  Widget _catChip({
    required String label,
    required bool selected,
    required VoidCallback onTap,
  }) {
    return Material(
      color: selected ? FregoColors.primary50 : FregoColors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? FregoColors.primary200 : FregoColors.neutral200,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: selected ? FregoColors.primary600 : FregoColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.tone,
    this.icon,
    this.onTap,
  });

  final String label;
  final _PillTone tone;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = switch (tone) {
      _PillTone.points => (
          const Color(0xFFFFFBEB),
          const Color(0xFF92400E),
        ),
      _PillTone.ready => (
          const Color(0xFFE6F6EE),
          FregoColors.success,
        ),
      _PillTone.stamps => (
          FregoColors.stampsBg,
          FregoColors.stamps,
        ),
      _PillTone.badge => (
          const Color(0xFFFFF8E1),
          const Color(0xFF8A5A00),
        ),
    };
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
        border: tone == _PillTone.badge
            ? Border.all(color: const Color(0xFFF0C43A).withValues(alpha: 0.45))
            : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: fg,
            ),
          ),
        ],
      ),
    );
    if (onTap == null) return pill;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: pill,
    );
  }
}

class _PinnedSearchDelegate extends SliverPersistentHeaderDelegate {
  _PinnedSearchDelegate({
    required this.controller,
    required this.fieldKey,
    required this.onClear,
  });

  final TextEditingController controller;
  final Key fieldKey;
  final VoidCallback onClear;

  static const double height = 64;

  @override
  double get minExtent => height;

  @override
  double get maxExtent => height;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlapsContent) {
    return SizedBox(
      height: height,
      width: double.infinity,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: FregoColors.neutralBg,
          boxShadow: overlapsContent
              ? [
                  BoxShadow(
                    color: const Color(0xFF041828).withValues(alpha: 0.08),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
            FregoLargeTitlePage.gutter,
            10,
            FregoLargeTitlePage.gutter,
            8,
          ),
          child: _ShopSearchField(
            key: fieldKey,
            controller: controller,
            onClear: onClear,
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedSearchDelegate oldDelegate) => false;
}

/// Top third of the home: Céu Azul, white greeting, prize summary on card.
class _BalanceChip {
  const _BalanceChip({required this.icon, required this.label});

  final Widget icon;
  final String label;
}

class _FreguesHomeHeader extends StatelessWidget {
  const _FreguesHomeHeader({
    required this.toolbarHeight,
    required this.summary,
    this.balances = const [],
  });

  final double toolbarHeight;
  final Widget summary;
  final List<_BalanceChip> balances;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return SizedBox.expand(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final height = constraints.maxHeight;
          final expanded = MediaQuery.sizeOf(context).height / 3;
          final room = height - top - toolbarHeight - 16;
          final fullRoom = expanded - top - toolbarHeight - 16;
          final fade = fullRoom <= 0
              ? 1.0
              : (room / (fullRoom * 0.55)).clamp(0.0, 1.0);
          return ColoredBox(
            color: FregoColors.azul,
            child: room < 8
                ? const SizedBox.expand()
                : Padding(
                    padding: EdgeInsets.fromLTRB(20, top + toolbarHeight, 20, 16),
                    child: ClipRect(
                      child: OverflowBox(
                        alignment: Alignment.bottomCenter,
                        minHeight: 0,
                        maxHeight: double.infinity,
                        child: Opacity(
                          opacity: fade,
                          child: IgnorePointer(
                            ignoring: fade < 0.5,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Suas fidelidades em um só lugar',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w400,
                                    color: FregoColors.white,
                                  ),
                                ),
                                if (balances.isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  _BalanceChipRow(items: balances),
                                ],
                                const SizedBox(height: 14),
                                summary,
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
          );
        },
      ),
    );
  }
}

class _BalanceChipRow extends StatelessWidget {
  const _BalanceChipRow({required this.items});

  final List<_BalanceChip> items;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: [
          for (var i = 0; i < items.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            DecoratedBox(
              decoration: BoxDecoration(
                color: FregoColors.white.withValues(alpha: 0.16),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(
                  color: FregoColors.white.withValues(alpha: 0.28),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    items[i].icon,
                    const SizedBox(width: 6),
                    Text(
                      items[i].label,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: FregoColors.white,
                        letterSpacing: -0.1,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PrizeSummaryPlaceholder extends StatelessWidget {
  const _PrizeSummaryPlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 72,
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(16),
      ),
    );
  }
}

/// Destaques acionáveis: prêmio pronto, progresso ou aniversário.
class _InsightStrip extends StatelessWidget {
  const _InsightStrip({
    required this.redeemableNow,
    required this.nextReward,
    required this.birthday,
    required this.onOpenShop,
    required this.onOpenCampaign,
  });

  final int redeemableNow;
  final Map<String, dynamic>? nextReward;
  final Map<String, dynamic>? birthday;
  final Future<void> Function(String businessId) onOpenShop;
  final Future<void> Function({
    required String businessId,
    String? campaignId,
  }) onOpenCampaign;

  VoidCallback? _tap({required String? shopId, String? campaignId}) {
    if (shopId == null) return null;
    if (campaignId != null && campaignId.isNotEmpty) {
      return () => onOpenCampaign(businessId: shopId, campaignId: campaignId);
    }
    return () => onOpenShop(shopId);
  }

  @override
  Widget build(BuildContext context) {
    if (redeemableNow > 0) {
      final shopId = nextReward?['businessId'] as String?;
      final shopName = nextReward?['businessName'] as String?;
      final reward = nextReward?['rewardTitle'] as String?;
      return _InsightCard(
        icon: Icon(FregoIcons.gift, color: FregoColors.ink, size: 22),
        title: redeemableNow == 1
            ? 'Você tem 1 prêmio pronto'
            : 'Você tem $redeemableNow prêmios prontos',
        subtitle: reward != null && reward.isNotEmpty
            ? (shopName != null ? '$reward · $shopName' : reward)
            : (shopName != null
                ? 'Toque para resgatar em $shopName'
                : 'Toque numa loja para resgatar'),
        onTap: _tap(
          shopId: shopId,
          campaignId: nextReward?['campaignId'] as String?,
        ),
      );
    }

    if (birthday != null && birthday!['canRedeem'] == true) {
      final shopId = birthday!['businessId'] as String?;
      final shopName = birthday!['businessName'] as String?;
      return _InsightCard(
        icon: FregoIcons.birthday(
          size: 22,
          color: FregoColors.ink,
        ),
        title: 'Presente de aniversário liberado',
        subtitle: shopName != null
            ? 'Resgate em $shopName'
            : 'Resgate na loja participante',
        onTap: _tap(
          shopId: shopId,
          campaignId: birthday!['campaignId'] as String?,
        ),
      );
    }

    if (birthday != null) {
      final days = (birthday!['daysUntilBirthday'] as num?)?.toInt();
      final shopId = birthday!['businessId'] as String?;
      final shopName = birthday!['businessName'] as String?;
      if (days != null && days <= 14) {
        return _InsightCard(
          icon: FregoIcons.birthday(
            size: 22,
            color: FregoColors.ink,
          ),
          title: days == 0
              ? 'Seu aniversário é hoje'
              : days == 1
                  ? 'Aniversário amanhã'
                  : 'Aniversário em $days dias',
          subtitle: shopName != null
              ? 'Presente disponível em $shopName'
              : 'Prepare-se para resgatar o presente',
          onTap: _tap(
            shopId: shopId,
            campaignId: birthday!['campaignId'] as String?,
          ),
        );
      }
    }

    final next = nextReward;
    if (next != null && next['canRedeem'] != true) {
      final remaining = (next['remaining'] as num?)?.toInt() ?? 0;
      final type = next['type'] as String?;
      final shopId = next['businessId'] as String?;
      final shopName = next['businessName'] as String?;
      final reward = next['rewardTitle'] as String?;
      if (type == 'promo') {
        return _InsightCard(
          icon: FregoIcons.promo(size: 22, color: FregoColors.ink),
          title: reward != null && reward.isNotEmpty
              ? reward
              : 'Promoção da casa',
          subtitle: [
            'Promoção',
            if (shopName != null) shopName,
          ].join(' · '),
          onTap: _tap(
            shopId: shopId,
            campaignId: next['campaignId'] as String?,
          ),
        );
      }
      if (next['lockedReason'] == 'quota_exhausted') {
        return _InsightCard(
          icon: const Icon(
            FregoIcons.trending,
            color: FregoColors.ink,
            size: 22,
          ),
          title: 'Já resgatado neste período',
          subtitle: [
            if (reward != null && reward.isNotEmpty) reward,
            if (shopName != null) shopName,
          ].join(' · '),
          onTap: _tap(
            shopId: shopId,
            campaignId: next['campaignId'] as String?,
          ),
        );
      }
      final unit = type == 'spend' ? 'pontos' : 'carimbos';
      return _InsightCard(
        icon: const Icon(
          FregoIcons.trending,
          color: FregoColors.ink,
          size: 22,
        ),
        title: remaining == 1
            ? 'Falta 1 $unit para o prêmio'
            : 'Faltam $remaining $unit para o prêmio',
        subtitle: [
          if (reward != null && reward.isNotEmpty) reward,
          if (shopName != null) shopName,
        ].join(' · '),
        onTap: _tap(
          shopId: shopId,
          campaignId: next['campaignId'] as String?,
        ),
      );
    }

    return const _InsightCard(
      icon: Icon(FregoIcons.gift, color: FregoColors.ink, size: 22),
      title: 'Nenhum prêmio pronto',
      subtitle: 'Peça um carimbo no balcão para começar.',
    );
  }
}

class _InsightCard extends StatelessWidget {
  const _InsightCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final Widget icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF041828).withValues(alpha: 0.22),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FregoColors.mostarda,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: ColorFiltered(
                    colorFilter: const ColorFilter.mode(
                      FregoColors.ink,
                      BlendMode.srcIn,
                    ),
                    child: icon,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: FregoColors.ink,
                          letterSpacing: -0.2,
                        ),
                      ),
                      if (subtitle.isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          subtitle,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.35,
                            color: FregoColors.neutral500,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                if (onTap != null)
                  const Icon(
                    FregoIcons.chevronRight,
                    size: 18,
                    color: FregoColors.neutral400,
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ShopAvatar extends StatelessWidget {
  const _ShopAvatar({
    required this.letter,
    required this.color,
    this.logoUrl,
  });

  final String letter;
  final Color color;
  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        width: 48,
        height: 48,
        child: logoUrl != null && logoUrl!.isNotEmpty
            ? Image.network(
                logoUrl!,
                fit: BoxFit.cover,
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const ColoredBox(color: FregoColors.neutral200);
                },
                errorBuilder: (_, __, ___) => _fallback(),
              )
            : _fallback(),
      ),
    );
  }

  Widget _fallback() {
    return ColoredBox(
      color: color,
      child: Center(
        child: Text(
          letter,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
