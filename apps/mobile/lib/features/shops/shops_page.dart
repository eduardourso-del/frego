import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
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

class _ListRow {
  const _ListRow.header(this.header) : membership = null;
  const _ListRow.shop(this.membership) : header = null;

  final String? header;
  final Map<String, dynamic>? membership;

  bool get isHeader => header != null;
}

class _ShopsPageState extends State<ShopsPage> {
  final _search = TextEditingController();
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
    _search.addListener(() => setState(() {}));
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

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final greet = _displayName?.trim().isNotEmpty == true
        ? _displayName!.trim().split(' ').first
        : 'você';
    final items = _filtered;

    final slivers = <Widget>[
      if (cupertino)
        CupertinoSliverRefreshControl(onRefresh: _load),
      SliverToBoxAdapter(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Olá, $greet',
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -0.4,
                  color: FregoColors.ink,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Suas fidelidades em um só lugar',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w400,
                  color: FregoColors.neutral500,
                ),
              ),
              if (_memberships.isNotEmpty) ...[
                const SizedBox(height: 20),
                _InsightStrip(
                  redeemableNow: _redeemableNow,
                  nextReward: _nextReward,
                  birthday: _birthdayHint(),
                  onOpenShop: _openShop,
                ),
                const SizedBox(height: 16),
                _ShopSearchField(
                  controller: _search,
                  onClear: () {
                    _search.clear();
                    setState(() {});
                  },
                ),
                const SizedBox(height: 12),
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
      if (_memberships.isNotEmpty)
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 8),
            child: Text(
              _filtered.isEmpty
                  ? 'Nenhuma loja'
                  : items.length == 1
                      ? '1 loja'
                      : '${items.length} lojas',
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.04,
                color: FregoColors.neutral400,
              ),
            ),
          ),
        )
      else
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 24, 24, 8),
            child: Text(
              'Suas lojas',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.04,
                color: FregoColors.neutral400,
              ),
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
      else if (_memberships.isEmpty)
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
                    FregoIcons.shopsFilled,
                    color: FregoColors.primary500,
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
            padding: const EdgeInsets.all(24),
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
      else
        SliverPadding(
              padding: const EdgeInsets.fromLTRB(24, 8, 24, 32),
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
                              color: Color(primary ?? 0xFF3B5BDB),
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
                                              : _PillTone.stamps,
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
    final unit = type == 'spend' ? 'pts' : 'carimbos';
    final reward = (rewardTitle != null && rewardTitle.trim().isNotEmpty)
        ? rewardTitle.trim()
        : 'prêmio';
    return 'Faltam $remaining $unit · $reward';
  }
}

enum _PillTone { stamps, points, ready, badge }

class _ShopSearchField extends StatelessWidget {
  const _ShopSearchField({
    required this.controller,
    required this.onClear,
  });

  final TextEditingController controller;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final hasText = controller.text.isNotEmpty;

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
        onSuffixTap: hasText ? onClear : null,
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
          suffixIcon: hasText
              ? IconButton(
                  onPressed: onClear,
                  icon: const Icon(
                    FregoIcons.clear,
                    size: 18,
                    color: FregoColors.neutral400,
                  ),
                )
              : null,
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
              color: FregoColors.primary500,
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
                  color: selected ? Colors.white : FregoColors.neutral500,
                ),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: selected ? Colors.white : FregoColors.ink,
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
  });

  final String label;
  final _PillTone tone;
  final IconData? icon;

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
          const Color(0xFFF0FDFA),
          const Color(0xFF115E59),
        ),
      _PillTone.badge => (
          const Color(0xFFFFF8E1),
          const Color(0xFF8A5A00),
        ),
    };
    return Container(
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
  }
}

/// Destaques acionáveis: prêmio pronto, progresso ou aniversário.
class _InsightStrip extends StatelessWidget {
  const _InsightStrip({
    required this.redeemableNow,
    required this.nextReward,
    required this.birthday,
    required this.onOpenShop,
  });

  final int redeemableNow;
  final Map<String, dynamic>? nextReward;
  final Map<String, dynamic>? birthday;
  final Future<void> Function(String businessId) onOpenShop;

  @override
  Widget build(BuildContext context) {
    if (redeemableNow > 0) {
      final shopId = nextReward?['businessId'] as String?;
      final shopName = nextReward?['businessName'] as String?;
      final reward = nextReward?['rewardTitle'] as String?;
      return _InsightCard(
        icon: FregoIcons.gift,
        tint: FregoColors.success,
        soft: const Color(0xFFE6F6EE),
        title: redeemableNow == 1
            ? 'Você tem 1 prêmio pronto'
            : 'Você tem $redeemableNow prêmios prontos',
        subtitle: reward != null && reward.isNotEmpty
            ? (shopName != null ? '$reward · $shopName' : reward)
            : (shopName != null
                ? 'Toque para resgatar em $shopName'
                : 'Toque numa loja para resgatar'),
        onTap: shopId != null ? () => onOpenShop(shopId) : null,
      );
    }

    if (birthday != null && birthday!['canRedeem'] == true) {
      final shopId = birthday!['businessId'] as String?;
      final shopName = birthday!['businessName'] as String?;
      return _InsightCard(
        icon: FregoIcons.birthdayFilled,
        tint: const Color(0xFF9D174D),
        soft: const Color(0xFFFDF2F8),
        title: 'Presente de aniversário liberado',
        subtitle: shopName != null
            ? 'Resgate em $shopName'
            : 'Resgate na loja participante',
        onTap: shopId != null ? () => onOpenShop(shopId) : null,
      );
    }

    if (birthday != null) {
      final days = (birthday!['daysUntilBirthday'] as num?)?.toInt();
      final shopId = birthday!['businessId'] as String?;
      final shopName = birthday!['businessName'] as String?;
      if (days != null && days <= 14) {
        return _InsightCard(
          icon: FregoIcons.birthday,
          tint: const Color(0xFF9D174D),
          soft: const Color(0xFFFDF2F8),
          title: days == 0
              ? 'Seu aniversário é hoje'
              : days == 1
                  ? 'Aniversário amanhã'
                  : 'Aniversário em $days dias',
          subtitle: shopName != null
              ? 'Presente disponível em $shopName'
              : 'Prepare-se para resgatar o presente',
          onTap: shopId != null ? () => onOpenShop(shopId) : null,
        );
      }
    }

    final next = nextReward;
    if (next != null && next['canRedeem'] != true) {
      final remaining = (next['remaining'] as num?)?.toInt() ?? 0;
      final type = next['type'] as String?;
      final unit = type == 'spend' ? 'pontos' : 'carimbos';
      final shopId = next['businessId'] as String?;
      final shopName = next['businessName'] as String?;
      final reward = next['rewardTitle'] as String?;
      return _InsightCard(
        icon: FregoIcons.trending,
        tint: FregoColors.primary500,
        soft: FregoColors.primary50,
        title: remaining == 1
            ? 'Falta 1 $unit para o prêmio'
            : 'Faltam $remaining $unit para o prêmio',
        subtitle: [
          if (reward != null && reward.isNotEmpty) reward,
          if (shopName != null) shopName,
        ].join(' · '),
        onTap: shopId != null ? () => onOpenShop(shopId) : null,
      );
    }

    return const SizedBox.shrink();
  }
}

class _InsightCard extends StatelessWidget {
  const _InsightCard({
    required this.icon,
    required this.tint,
    required this.soft,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final Color tint;
  final Color soft;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: soft,
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
                  color: Colors.white.withValues(alpha: 0.85),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: tint, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: tint,
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
                          color: FregoColors.neutral700,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (onTap != null)
                Icon(FregoIcons.chevronRight, size: 18, color: tint),
            ],
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
