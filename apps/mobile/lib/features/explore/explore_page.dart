import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/empty_state.dart';
import '../../ui/header_straddle.dart';
import '../../ui/ready_rewards_card.dart';
import '../shops/campaign_detail_page.dart';
import '../shops/shop_detail_page.dart';
import 'city_picker.dart';
import 'explore_all_page.dart';
import 'explore_cards.dart';
import 'explore_feed.dart';

const _statusBarOnAzul = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemStatusBarContrastEnforced: false,
);

class ExplorePage extends StatefulWidget {
  const ExplorePage({
    super.key,
    this.refreshToken = 0,
    this.onOpenReadyRewards,
  });

  final int refreshToken;
  final VoidCallback? onOpenReadyRewards;

  @override
  State<ExplorePage> createState() => _ExplorePageState();
}

class _ExplorePageState extends State<ExplorePage> {
  final _search = TextEditingController();
  bool _loading = true;
  String? _error;
  CityChoice? _browsing;
  ExploreSnapshot _feed = ExploreSnapshot.empty;
  List<String> _readyLines = const [];
  ExploreRelation _relation = ExploreRelation.all;
  final Map<String, int> _favoriteEpoch = {};

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
      _loading = _feed.sections.isEmpty;
      _error = null;
    });
    final membershipsFuture = fetchMyMemberships();
    try {
      final body = await fetchExploration();
      final ready = await _readyLinesFrom(membershipsFuture);
      if (!mounted) return;
      setState(() {
        _browsing = CityChoice.fromMap(
          body['browsing'] as Map<String, dynamic>?,
        );
        _feed = parseExplorationFeed(body);
        _readyLines = ready;
        _loading = false;
      });
    } catch (e) {
      try {
        await membershipsFuture;
      } catch (_) {}
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<List<String>> _readyLinesFrom(
    Future<Map<String, dynamic>> membershipsFuture,
  ) async {
    try {
      final res = await membershipsFuture;
      return readyRewardLines(
        (res['memberships'] as List<dynamic>? ?? [])
            .whereType<Map<String, dynamic>>()
            .toList(),
      );
    } catch (_) {
      return _readyLines;
    }
  }

  Future<void> _changeCity() async {
    final picked = await pickCity(context, selected: _browsing);
    if (picked == null || !mounted) return;
    _search.clear();
    setState(() => _relation = ExploreRelation.all);
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

  void _clearFilters() {
    _search.clear();
    setState(() => _relation = ExploreRelation.all);
  }

  void _toggleFavorite(ExplorePlace place) {
    final businessId = place.businessId;
    if (businessId.isEmpty) return;
    final next = !place.isFavorite;
    final epoch = (_favoriteEpoch[businessId] ?? 0) + 1;
    _favoriteEpoch[businessId] = epoch;
    setState(() => _feed = _feed.withFavorite(businessId, next));
    _saveFavorite(businessId, next, epoch);
  }

  Future<void> _saveFavorite(String businessId, bool next, int epoch) async {
    try {
      await setFavorite(businessId: businessId, isFavorite: next);
      if (!mounted || _favoriteEpoch[businessId] != epoch) return;
      await _load();
    } catch (e) {
      if (!mounted || _favoriteEpoch[businessId] != epoch) return;
      setState(() => _feed = _feed.withFavorite(businessId, !next));
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  Future<void> _openPlace(ExplorePlace place) async {
    final browsing = _browsing;
    if (browsing == null) return;
    await FregoAdaptive.push(
      context,
      ShopDetailPage(
        businessId: place.businessId,
        explorationCity: browsing.city,
        explorationState: browsing.state,
      ),
    );
    if (mounted) _load();
  }

  Future<void> _openCampaign(ExploreCampaign campaign) async {
    final browsing = _browsing;
    if (browsing == null) return;
    await FregoAdaptive.push(
      context,
      CampaignDetailPage(
        businessId: campaign.businessId,
        campaignId: campaign.campaignId,
        explorationCity: browsing.city,
        explorationState: browsing.state,
      ),
    );
    if (mounted) _load();
  }

  Future<void> _openAll({
    required String title,
    List<ExplorePlace> places = const [],
    List<ExploreCampaign> campaigns = const [],
  }) async {
    final browsing = _browsing;
    if (browsing == null) return;
    await FregoAdaptive.push(
      context,
      ExploreAllPage(
        title: title,
        browsing: browsing,
        places: places,
        campaigns: campaigns,
      ),
    );
    if (mounted) _load();
  }

  int get _favoriteCount => _feed.sections
      .expand((section) => section.places)
      .where((place) => place.isFavorite)
      .length;

  int get _clubCount => _feed.sections
      .expand((section) => section.places)
      .where((place) => place.hasMembership)
      .length;

  @override
  Widget build(BuildContext context) {
    final browsing = _browsing;
    final initialLoad = _loading && _feed.sections.isEmpty && _error == null;
    final visible = visibleSections(
      _feed,
      query: _search.text,
      relation: _relation,
    );
    final placeCount = _feed.placeCount;
    final cityLine = browsing == null
        ? 'Escolha uma cidade'
        : placeCount == 0
            ? browsing.label
            : placeCount == 1
                ? '1 lugar em ${browsing.label}'
                : '$placeCount lugares em ${browsing.label}';
    final showTools = !initialLoad &&
        _error == null &&
        browsing != null &&
        _feed.sections.isNotEmpty;

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
              toolbarHeight: 124,
              expandedHeight: 124,
              titleSpacing: 20,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const FregoWordmark(height: 26, negative: true),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      const Expanded(
                        child: Text(
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
                      ),
                      const SizedBox(width: 12),
                      _AzulAction(
                        label: browsing == null ? 'Escolher' : 'Trocar',
                        onTap: _changeCity,
                      ),
                    ],
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
            if (showTools && _readyLines.isNotEmpty)
              SliverToBoxAdapter(
                child: HeaderStraddle(
                  topGap: 16,
                  bottomGap: 12,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                    child: ReadyRewardsCard(
                      lines: _readyLines,
                      onTap: widget.onOpenReadyRewards ?? () {},
                    ),
                  ),
                ),
              ),
            if (showTools)
              SliverPersistentHeader(
                pinned: true,
                delegate: _PinnedExploreSearchDelegate(
                  controller: _search,
                  onChanged: () => setState(() {}),
                  onClear: () {
                    _search.clear();
                    setState(() {});
                  },
                ),
              ),
            if (showTools)
              SliverToBoxAdapter(
                child: _ExploreFilters(
                  filter: _relation,
                  favoriteCount: _favoriteCount,
                  clubCount: _clubCount,
                  discoverCount: placeCount - _clubCount,
                  onChanged: (value) => setState(() => _relation = value),
                ),
              ),
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
            else if (_feed.sections.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: FregoEmptyState(
                  title: 'Ainda não chegamos\nem ${browsing.city}',
                  body:
                      'Quando um estabelecimento de ${browsing.city} entrar, ele aparece aqui.',
                  badge: FregoIcons.location,
                ),
              )
            else if (visible.isEmpty)
              SliverFillRemaining(
                hasScrollBody: false,
                child: _Message(
                  title: _emptyTitle(),
                  body: 'Ajuste a busca ou o filtro para ver outros lugares.',
                  action: 'Limpar filtros',
                  onAction: _clearFilters,
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.only(bottom: 36),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _SectionBlock(
                      section: visible[index],
                      onOpenPlace: _openPlace,
                      onOpenCampaign: _openCampaign,
                      onFavorite: _toggleFavorite,
                      onSeeAllPlaces: (section) => _openAll(
                        title: placeRowTitle(section.type),
                        places: section.places,
                      ),
                      onSeeAllCampaigns: (section) => _openAll(
                        title: campaignAllTitle(section.type),
                        campaigns: section.campaigns,
                      ),
                    ),
                    childCount: visible.length,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _emptyTitle() {
    final q = _search.text.trim();
    if (q.isNotEmpty) return 'Nenhum lugar para “$q”';
    return switch (_relation) {
      ExploreRelation.favorites => 'Nenhum favorito nesta cidade',
      ExploreRelation.club => 'Nenhum clube seu nesta cidade',
      ExploreRelation.discover => 'Nenhum lugar novo nesta cidade',
      ExploreRelation.all => 'Nenhum lugar visível',
    };
  }
}

class _SectionBlock extends StatelessWidget {
  const _SectionBlock({
    required this.section,
    required this.onOpenPlace,
    required this.onOpenCampaign,
    required this.onFavorite,
    required this.onSeeAllPlaces,
    required this.onSeeAllCampaigns,
  });

  final VisibleSection section;
  final ValueChanged<ExplorePlace> onOpenPlace;
  final ValueChanged<ExploreCampaign> onOpenCampaign;
  final ValueChanged<ExplorePlace> onFavorite;
  final ValueChanged<VisibleSection> onSeeAllPlaces;
  final ValueChanged<VisibleSection> onSeeAllCampaigns;

  @override
  Widget build(BuildContext context) {
    final places = section.places;
    final campaigns = section.campaigns;
    final placePreview = previewOf(places);
    final campaignPreview = previewOf(campaigns);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ExploreRowHeader(
          title: placeRowTitle(section.type),
          count: places.length,
          prominent: true,
          onSeeAll: showsSeeAll(places.length)
              ? () => onSeeAllPlaces(section)
              : null,
        ),
        if (places.isNotEmpty)
          _HorizontalRow(
            children: [
              for (final place in placePreview)
                SizedBox(
                  width: explorePlaceCardWidth,
                  child: ExplorePlaceCard(
                    place: place,
                    onOpen: () => onOpenPlace(place),
                    onFavorite: () => onFavorite(place),
                  ),
                ),
            ],
          ),
        if (campaigns.isNotEmpty) ...[
          ExploreRowHeader(
            title: 'Campanhas',
            count: campaigns.length,
            onSeeAll: showsSeeAll(campaigns.length)
                ? () => onSeeAllCampaigns(section)
                : null,
          ),
          _HorizontalRow(
            children: [
              for (final campaign in campaignPreview)
                SizedBox(
                  width: exploreCampaignCardWidth,
                  child: ExploreCampaignCard(
                    campaign: campaign,
                    onOpen: () => onOpenCampaign(campaign),
                  ),
                ),
            ],
          ),
        ],
      ],
    );
  }
}

class _HorizontalRow extends StatelessWidget {
  const _HorizontalRow({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(width: 12),
            children[i],
          ],
        ],
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

class _PinnedExploreSearchDelegate extends SliverPersistentHeaderDelegate {
  _PinnedExploreSearchDelegate({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final VoidCallback onChanged;
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
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
          child: _ExploreSearch(
            controller: controller,
            onChanged: onChanged,
            onClear: onClear,
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _PinnedExploreSearchDelegate oldDelegate) =>
      false;
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

  final ExploreRelation filter;
  final int favoriteCount;
  final int clubCount;
  final int discoverCount;
  final ValueChanged<ExploreRelation> onChanged;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 4),
      child: Row(
        children: [
          _FilterChip(
            label: 'Todos',
            selected: filter == ExploreRelation.all,
            onTap: () => onChanged(ExploreRelation.all),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: favoriteCount > 0 ? 'Favoritos ($favoriteCount)' : 'Favoritos',
            icon: FregoIcons.favoriteFilled,
            selected: filter == ExploreRelation.favorites,
            onTap: () => onChanged(ExploreRelation.favorites),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: clubCount > 0 ? 'Seu clube ($clubCount)' : 'Seu clube',
            selected: filter == ExploreRelation.club,
            onTap: () => onChanged(ExploreRelation.club),
          ),
          const SizedBox(width: 8),
          _FilterChip(
            label: discoverCount > 0 ? 'Novos ($discoverCount)' : 'Novos',
            selected: filter == ExploreRelation.discover,
            onTap: () => onChanged(ExploreRelation.discover),
          ),
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
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: selected ? FregoColors.mostarda : FregoColors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? FregoColors.mostarda : FregoColors.neutral200,
          ),
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
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: FregoColors.ink,
                ),
              ),
            ],
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
