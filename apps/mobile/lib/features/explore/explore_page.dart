import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/empty_state.dart';
import '../shops/shop_detail_page.dart';
import 'city_picker.dart';

const _statusBarOnAzul = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemStatusBarContrastEnforced: false,
);

enum _ExploreFilter { all, favorites, club, discover }

class ExplorePage extends StatefulWidget {
  const ExplorePage({super.key, this.refreshToken = 0});

  final int refreshToken;

  @override
  State<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends State<ExplorePage> {
  final _search = TextEditingController();
  bool _loading = true;
  String? _error;
  CityChoice? _browsing;
  List<Map<String, dynamic>> _places = const [];
  final Set<String> _toggling = {};
  _ExploreFilter _filter = _ExploreFilter.all;
  String? _type;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant ExplorePage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshToken != widget.refreshToken) _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = _places.isEmpty;
      _error = null;
    });
    try {
      final body = await fetchExploration();
      if (!mounted) return;
      setState(() {
        _browsing = CityChoice.fromMap(
          body['browsing'] as Map<String, dynamic>?,
        );
        _places = (body['places'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
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

  Future<void> _changeCity() async {
    final picked = await pickCity(context, selected: _browsing);
    if (picked == null || !mounted) return;
    try {
      await setBrowseCity(city: picked.city, state: picked.state);
      await _load();
    } catch (e) {
      if (!mounted) return;
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _toggleFavorite(Map<String, dynamic> place) async {
    final businessId = place['businessId'] as String?;
    if (businessId == null || _toggling.contains(businessId)) return;
    final next = place['isFavorite'] != true;
    setState(() {
      _toggling.add(businessId);
      final i = _places.indexWhere((item) => item['businessId'] == businessId);
      if (i >= 0) {
        _places[i] = {..._places[i], 'isFavorite': next};
        _places.sort((a, b) {
          final af = a['isFavorite'] == true;
          final bf = b['isFavorite'] == true;
          if (af != bf) return af ? -1 : 1;
          final an = ((a['business'] as Map?)?['name'] as String?) ?? '';
          final bn = ((b['business'] as Map?)?['name'] as String?) ?? '';
          return an.compareTo(bn);
        });
      }
    });
    try {
      await setFavorite(businessId: businessId, isFavorite: next);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        final i =
            _places.indexWhere((item) => item['businessId'] == businessId);
        if (i >= 0) {
          _places[i] = {..._places[i], 'isFavorite': !next};
        }
      });
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    } finally {
      if (mounted) setState(() => _toggling.remove(businessId));
    }
  }

  int get _favoriteCount =>
      _places.where((place) => place['isFavorite'] == true).length;

  int get _clubCount =>
      _places.where((place) => place['hasMembership'] == true).length;

  List<String> get _types {
    final seen = <String>{};
    final types = <String>[];
    for (final place in _places) {
      final business = place['business'] as Map<String, dynamic>? ?? {};
      final type = business['type'] as String?;
      if (type == null || type.isEmpty || !seen.add(type)) continue;
      types.add(type);
    }
    return types;
  }

  void _clearFilters() {
    _search.clear();
    setState(() {
      _filter = _ExploreFilter.all;
      _type = null;
    });
  }

  List<Map<String, dynamic>> get _filtered {
    final q = _search.text.trim().toLowerCase();
    return _places.where((place) {
      final business = place['business'] as Map<String, dynamic>? ?? {};
      final favorite = place['isFavorite'] == true;
      final club = place['hasMembership'] == true;
      final type = business['type'] as String?;
      if (_filter == _ExploreFilter.favorites && !favorite) return false;
      if (_filter == _ExploreFilter.club && !club) return false;
      if (_filter == _ExploreFilter.discover && club) return false;
      if (_type != null && type != _type) return false;
      if (q.isEmpty) return true;
      final name = (business['name'] as String? ?? '').toLowerCase();
      final slogan = (business['slogan'] as String? ?? '').toLowerCase();
      final typeKey = (type ?? '').toLowerCase();
      final typeLabel = FregoBusinessTypes.labelOf(type).toLowerCase();
      final lead = (place['leadLine'] as String? ?? '').toLowerCase();
      return name.contains(q) ||
          slogan.contains(q) ||
          typeKey.contains(q) ||
          typeLabel.contains(q) ||
          lead.contains(q);
    }).toList();
  }

  Future<void> _open(Map<String, dynamic> place) async {
    final businessId = place['businessId'] as String?;
    final browsing = _browsing;
    if (businessId == null || browsing == null) return;
    await FregoAdaptive.push(
      context,
      ShopDetailPage(
        businessId: businessId,
        explorationCity: browsing.city,
        explorationState: browsing.state,
      ),
    );
    if (mounted) _load();
  }

  String get _sectionTitle {
    if (_search.text.trim().isNotEmpty) return 'Resultados';
    return switch (_filter) {
      _ExploreFilter.favorites => 'Favoritos',
      _ExploreFilter.club => 'Seus clubes',
      _ExploreFilter.discover => 'Novos',
      _ExploreFilter.all => 'Lugares',
    };
  }

  String _emptyTitle() {
    final q = _search.text.trim();
    if (q.isNotEmpty) return 'Nenhum lugar para “$q”';
    if (_type != null) {
      return 'Nenhum ${FregoBusinessTypes.labelOf(_type).toLowerCase()} aqui';
    }
    return switch (_filter) {
      _ExploreFilter.favorites => 'Nenhum favorito nesta cidade',
      _ExploreFilter.club => 'Nenhum clube seu nesta cidade',
      _ExploreFilter.discover => 'Nenhum lugar novo nesta cidade',
      _ExploreFilter.all => 'Nenhum lugar visível',
    };
  }

  @override
  Widget build(BuildContext context) {
    final browsing = _browsing;
    final initialLoad = _loading && _places.isEmpty && _error == null;
    final items = _filtered;
    final placeCount = _places.length;
    final cityLine = browsing == null
        ? 'Escolha uma cidade'
        : placeCount == 0
            ? browsing.label
            : placeCount == 1
                ? '1 lugar em ${browsing.label}'
                : '$placeCount lugares em ${browsing.label}';

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _statusBarOnAzul,
      child: ColoredBox(
        color: FregoColors.neutralBg,
        child: CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(
        parent: BouncingScrollPhysics(),
      ),
      slivers: [
        SliverAppBar(
                primary: true,
                pinned: true,
                stretch: true,
                stretchTriggerOffset: 60,
                onStretchTrigger: () => fregoStretchRefresh(_load),
                automaticallyImplyLeading: false,
                elevation: 0,
                scrolledUnderElevation: 0,
                shadowColor: Colors.transparent,
                surfaceTintColor: Colors.transparent,
                backgroundColor: FregoColors.azul,
                foregroundColor: FregoColors.white,
                systemOverlayStyle: _statusBarOnAzul,
                toolbarHeight: 78,
                expandedHeight: 78,
                titleSpacing: 20,
                actions: [
                  Padding(
                    padding: const EdgeInsets.only(right: 16),
                    child: Center(
                      child: _AzulAction(
                        label: browsing == null ? 'Escolher' : 'Trocar',
                        onTap: _changeCity,
                      ),
                    ),
                  ),
                ],
                title: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Text(
                      'Explorar',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 32,
                        height: 1.1,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.6,
                        color: FregoColors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      initialLoad ? 'Carregando lugares' : cityLine,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.2,
                        fontWeight: FontWeight.w400,
                        color: FregoColors.white.withValues(alpha: 0.92),
                      ),
                    ),
                  ],
                ),
              ),
              if (!initialLoad &&
                  _error == null &&
                  browsing != null &&
                  _places.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
                    child: _ExploreSearch(
                      controller: _search,
                      onChanged: () => setState(() {}),
                      onClear: () {
                        _search.clear();
                        setState(() {});
                      },
                    ),
                  ),
                ),
              if (!initialLoad &&
                  _error == null &&
                  browsing != null &&
                  _places.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: _ExploreFilters(
                    filter: _filter,
                    favoriteCount: _favoriteCount,
                    clubCount: _clubCount,
                    discoverCount: _places.length - _clubCount,
                    onChanged: (value) => setState(() => _filter = value),
                  ),
                ),
                if (_types.length > 1)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: _TypeFilters(
                        types: _types,
                        selected: _type,
                        onChanged: (value) => setState(() => _type = value),
                      ),
                    ),
                  ),
              ],
              if (initialLoad)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: FregoProgress()),
                )
              else if (_error != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _Message(
                    title: 'Não foi possível carregar',
                    body: _error!,
                    action: 'Tentar de novo',
                    onAction: _load,
                  ),
                )
              else if (browsing == null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _Message(
                    title: 'Escolha uma cidade',
                    body:
                        'A exploração lista os estabelecimentos de uma cidade. Nada aparece antes dessa escolha.',
                    action: 'Escolher cidade',
                    onAction: _changeCity,
                  ),
                )
              else if (_places.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: FregoEmptyState(
                    title: 'Ainda não chegamos\nem ${browsing.city}',
                    body:
                        'Quando um estabelecimento de ${browsing.city} entrar, ele aparece aqui.',
                    badge: FregoIcons.location,
                  ),
                )
              else if (items.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: _Message(
                    title: _emptyTitle(),
                    body: 'Ajuste a busca ou o filtro para ver outros lugares.',
                    action: 'Limpar filtros',
                    onAction: _clearFilters,
                  ),
                )
              else ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
                    child: Text(
                      _sectionTitle,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.2,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 28),
                  sliver: SliverList.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final place = items[index];
                      return _PlaceCard(
                        place: place,
                        onOpen: () => _open(place),
                        onFavorite: () => _toggleFavorite(place),
                      );
                    },
                  ),
                ),
              ],
      ],
        ),
      ),
    );
  }
}

class _AzulAction extends StatelessWidget {
  const _AzulAction({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: FregoColors.mostarda,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: FregoColors.ink,
            ),
          ),
        ),
      ),
    );
  }
}

class _ExploreSearch extends StatelessWidget {
  const _ExploreSearch({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final VoidCallback onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      return CupertinoSearchTextField(
        controller: controller,
        placeholder: 'Nome, tipo ou prêmio',
        style: const TextStyle(fontSize: 16, color: FregoColors.ink),
        placeholderStyle: const TextStyle(
          fontSize: 16,
          color: FregoColors.neutral400,
        ),
        backgroundColor: FregoColors.card,
        borderRadius: BorderRadius.circular(14),
        prefixIcon: const Icon(
          FregoIcons.search,
          color: FregoColors.neutral400,
          size: 20,
        ),
        onChanged: (_) => onChanged(),
        onSuffixTap: onClear,
      );
    }

    return TextField(
      controller: controller,
      onChanged: (_) => onChanged(),
      textInputAction: TextInputAction.search,
      style: const TextStyle(fontSize: 16, color: FregoColors.ink),
      decoration: InputDecoration(
        hintText: 'Nome, tipo ou prêmio',
        hintStyle: const TextStyle(color: FregoColors.neutral400),
        filled: true,
        fillColor: FregoColors.card,
        prefixIcon: const Icon(FregoIcons.search, color: FregoColors.neutral400),
        suffixIcon: ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (context, value, _) {
            if (value.text.isEmpty) return const SizedBox.shrink();
            return IconButton(
              onPressed: onClear,
              icon: const Icon(FregoIcons.clear, color: FregoColors.neutral400),
            );
          },
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FregoColors.hairline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: FregoColors.hairline),
        ),
      ),
    );
  }
}

class _ExploreFilters extends StatelessWidget {
  const _ExploreFilters({
    required this.filter,
    required this.favoriteCount,
    required this.clubCount,
    required this.discoverCount,
    required this.onChanged,
  });

  final _ExploreFilter filter;
  final int favoriteCount;
  final int clubCount;
  final int discoverCount;
  final ValueChanged<_ExploreFilter> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
      child: Row(
        children: [
          _FilterChip(
            label: 'Todos',
            selected: filter == _ExploreFilter.all,
            onTap: () => onChanged(_ExploreFilter.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: favoriteCount > 0 ? 'Favoritos ($favoriteCount)' : 'Favoritos',
            icon: FregoIcons.favoriteFilled,
            selected: filter == _ExploreFilter.favorites,
            onTap: () => onChanged(_ExploreFilter.favorites),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: clubCount > 0 ? 'Seu clube ($clubCount)' : 'Seu clube',
            selected: filter == _ExploreFilter.club,
            onTap: () => onChanged(_ExploreFilter.club),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: discoverCount > 0 ? 'Novos ($discoverCount)' : 'Novos',
            selected: filter == _ExploreFilter.discover,
            onTap: () => onChanged(_ExploreFilter.discover),
          ),
        ],
      ),
    );
  }
}

class _TypeFilters extends StatelessWidget {
  const _TypeFilters({
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
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          for (var i = 0; i < types.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            _FilterChip(
              label: FregoBusinessTypes.labelOf(types[i]),
              selected: selected == types[i],
              quiet: true,
              onTap: () => onChanged(selected == types[i] ? null : types[i]),
            ),
          ],
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
    this.icon,
    this.quiet = false,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;
  final bool quiet;

  @override
  Widget build(BuildContext context) {
    final fill = selected
        ? (quiet ? FregoColors.primary50 : FregoColors.mostarda)
        : FregoColors.card;
    final border = selected
        ? (quiet ? FregoColors.primary200 : FregoColors.mostarda)
        : FregoColors.neutral200;
    final foreground = selected && !quiet ? FregoColors.ink : FregoColors.ink;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: fill,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: border),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 14, color: FregoColors.ink),
                const SizedBox(width: 6),
              ],
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PlaceCard extends StatelessWidget {
  const _PlaceCard({
    required this.place,
    required this.onOpen,
    required this.onFavorite,
  });

  final Map<String, dynamic> place;
  final VoidCallback onOpen;
  final VoidCallback onFavorite;

  @override
  Widget build(BuildContext context) {
    final business = place['business'] as Map<String, dynamic>? ?? {};
    final name = business['name'] as String? ?? 'Estabelecimento';
    final slogan = business['slogan'] as String?;
    final lead = place['leadLine'] as String?;
    final favorite = place['isFavorite'] == true;
    final hasMembership = place['hasMembership'] == true;
    final letter = name.trim().isEmpty ? 'F' : name.trim()[0].toUpperCase();
    final brand = Color(_parseHex(business['primaryColor'] as String?) ?? 0xFF070707);
    final hero = business['heroImageUrl'] as String?;
    final hasHero = hero != null && hero.isNotEmpty;
    final cashback = lead != null && lead.toLowerCase().contains('cashback');

    return Material(
      color: FregoColors.card,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(18),
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: FregoColors.hairline),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(17),
                ),
                child: AspectRatio(
                  aspectRatio: 16 / 9,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (hasHero)
                        Image.network(
                          hero,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) => ColoredBox(color: brand),
                        )
                      else
                        ColoredBox(color: brand),
                      if (!hasHero)
                        Center(
                          child: _Avatar(
                            letter: letter,
                            logoUrl: business['logoUrl'] as String?,
                            color: brand,
                            size: 72,
                          ),
                        ),
                      Positioned(
                        top: 10,
                        right: 10,
                        child: _FavoriteButton(
                          favorite: favorite,
                          onTap: onFavorite,
                        ),
                      ),
                      if (hasHero)
                        Positioned(
                          left: 12,
                          bottom: 12,
                          child: _Avatar(
                            letter: letter,
                            logoUrl: business['logoUrl'] as String?,
                            color: brand,
                            bordered: true,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      FregoBusinessTypes.labelOf(business['type'] as String?),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: FregoColors.neutral400,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      name,
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                        color: FregoColors.ink,
                      ),
                    ),
                    if (slogan != null && slogan.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          slogan,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            height: 1.3,
                            color: FregoColors.neutral500,
                          ),
                        ),
                      ),
                    if (hasMembership || (lead != null && lead.isNotEmpty))
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: [
                            if (hasMembership)
                              const _Tag(
                                label: 'Seu clube',
                                fill: FregoColors.mostarda,
                              ),
                            if (lead != null && lead.isNotEmpty)
                              _Tag(
                                label: lead,
                                fill: cashback
                                    ? FregoColors.cashbackBg
                                    : FregoColors.primary50,
                                foreground: cashback
                                    ? FregoColors.cashback
                                    : FregoColors.ink,
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({required this.favorite, required this.onTap});

  final bool favorite;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: FregoColors.card,
          shape: BoxShape.circle,
          border: Border.all(color: FregoColors.hairline),
        ),
        child: Padding(
          padding: const EdgeInsets.all(8),
          child: Icon(
            favorite ? FregoIcons.favoriteFilled : FregoIcons.favorite,
            size: 18,
            color: favorite ? FregoColors.danger : FregoColors.neutral500,
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    this.fill = FregoColors.primary50,
    this.foreground = FregoColors.ink,
  });

  final String label;
  final Color fill;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: fill,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: foreground,
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({
    required this.letter,
    required this.color,
    this.logoUrl,
    this.size = 44,
    this.bordered = false,
  });

  final String letter;
  final Color color;
  final String? logoUrl;
  final double size;
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final radius = size > 56 ? 18.0 : 12.0;
    return Container(
      padding: bordered ? const EdgeInsets.all(2) : EdgeInsets.zero,
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(radius + 2),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(radius),
        child: Container(
          width: size,
          height: size,
          color: color,
          alignment: Alignment.center,
          child: logoUrl != null && logoUrl!.isNotEmpty
              ? Image.network(
                  logoUrl!,
                  fit: BoxFit.cover,
                  width: size,
                  height: size,
                )
              : Text(
                  letter,
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: size * 0.38,
                    fontWeight: FontWeight.w700,
                  ),
                ),
        ),
      ),
    );
  }
}

class _Message extends StatelessWidget {
  const _Message({
    required this.title,
    required this.body,
    this.action,
    this.onAction,
  });

  final String title;
  final String body;
  final String? action;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: FregoColors.ink,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              height: 1.4,
              color: FregoColors.neutral500,
            ),
          ),
          if (action != null && onAction != null) ...[
            const SizedBox(height: 16),
            FregoPrimaryButton(label: action!, onPressed: onAction),
          ],
        ],
      ),
    );
  }
}

int? _parseHex(String? raw) {
  if (raw == null) return null;
  final cleaned = raw.replaceAll('#', '').trim();
  if (cleaned.length != 6) return null;
  return int.tryParse('FF$cleaned', radix: 16);
}
