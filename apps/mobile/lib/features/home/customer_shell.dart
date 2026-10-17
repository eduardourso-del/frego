import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../explore/cidade_gate_page.dart';
import '../explore/explore_page.dart';
import '../history/history_page.dart';
import '../profile/profile_page.dart';
import '../rewards/rewards_page.dart';
import '../shops/campaign_detail_page.dart';
import '../shops/earn_detail_page.dart';
import '../shops/pesquisa_page.dart';
import '../shops/shop_detail_page.dart';
import '../shops/shops_page.dart';
import '../../analytics/frego_telemetry.dart';
import '../../api/frego_api.dart';
import '../../notifications/push_service.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

/// Shell do app do cliente: lojas + prêmios + histórico + perfil.
class CustomerShell extends StatefulWidget {
  const CustomerShell({
    super.key,
    required this.phoneE164,
    this.deferCidade = false,
  });

  final String phoneE164;

  /// This session skipped Cidade during onboarding. The gate waits for the next open.
  final bool deferCidade;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  static const _tabScreens = [
    'shops',
    'explore',
    'rewards',
    'history',
    'profile',
  ];

  int _index = 0;
  int _shopsRefresh = 0;
  int _exploreRefresh = 0;
  int _rewardsRefresh = 0;
  int _historyRefresh = 0;
  bool _checkingCidade = false;
  bool _needsCidade = false;
  late final CupertinoTabController _cupertinoTabs;

  @override
  void initState() {
    super.initState();
    _cupertinoTabs = CupertinoTabController(initialIndex: 0);
    PendingPushOpen.target.addListener(_openPendingPush);
    if (!widget.deferCidade) {
      _checkingCidade = true;
      unawaited(_checkCidade());
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(PushService.syncIfAuthorized());
      _openPendingPush();
    });
    unawaited(FregoTelemetry.screen(_tabScreens[_index]));
  }

  @override
  void dispose() {
    PendingPushOpen.target.removeListener(_openPendingPush);
    _cupertinoTabs.dispose();
    super.dispose();
  }

  Future<void> _checkCidade() async {
    try {
      final data = await fetchMyCustomer();
      final customer = data['customer'] as Map<String, dynamic>?;
      final city = (customer?['city'] as String?)?.trim();
      if (!mounted) return;
      setState(() {
        _checkingCidade = false;
        _needsCidade = city == null || city.isEmpty;
      });
    } catch (_) {
      if (mounted) setState(() => _checkingCidade = false);
    }
  }

  void _openPendingPush() {
    final target = PendingPushOpen.take();
    if (target == null || !mounted) return;
    debugPrint(
      'CustomerShell open push ${target.type} ${target.businessId}',
    );
    final page = switch (target.type) {
      'campaign_new' when target.campaignId != null &&
          target.campaignId!.isNotEmpty =>
        CampaignDetailPage(
          businessId: target.businessId,
          campaignId: target.campaignId!,
        ),
      'pesquisa' => PesquisaPage(businessId: target.businessId),
      'earn' => EarnDetailPage(
          businessId: target.businessId,
          unitKind: target.unitKind,
          transactionId: target.transactionId,
          quantity: target.quantity,
        ),
      _ => ShopDetailPage(businessId: target.businessId),
    };
    FregoAdaptive.push(context, page, rootNavigator: true);
  }

  void _onTab(int i) {
    setState(() {
      _index = i;
      // Soft-refresh in the background — keep the page mounted so content
      // does not flash away.
      if (i == 0) _shopsRefresh++;
      if (i == 1) _exploreRefresh++;
      if (i == 2) _rewardsRefresh++;
      if (i == 3) _historyRefresh++;
    });
    unawaited(FregoTelemetry.screen(_tabScreens[i]));
  }

  Widget _shopsPage() => ShopsPage(
        phoneE164: widget.phoneE164,
        refreshToken: _shopsRefresh,
      );

  Widget _explorePage() => ExplorePage(refreshToken: _exploreRefresh);

  Widget _rewardsPage() => RewardsPage(refreshToken: _rewardsRefresh);

  Widget _historyPage() => HistoryPage(refreshToken: _historyRefresh);

  Widget _profilePage() => ProfilePage(
        phoneE164: widget.phoneE164,
        onProfileSaved: () {
          setState(() {
            _shopsRefresh++;
            _exploreRefresh++;
            _rewardsRefresh++;
          });
        },
      );

  Widget _pageAt(int index) {
    switch (index) {
      case 1:
        return _explorePage();
      case 2:
        return _rewardsPage();
      case 3:
        return _historyPage();
      case 4:
        return _profilePage();
      case 0:
      default:
        return _shopsPage();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_checkingCidade) {
      return const FregoSplash(fregues: true);
    }
    final home = FregoAdaptive.useCupertino(context)
        ? _cupertinoHome()
        : _materialHome();
    if (!_needsCidade) return home;
    return PopScope(
      canPop: false,
      child: Stack(
        fit: StackFit.expand,
        children: [
          home,
          CidadeGatePage(
            onPicked: () => setState(() => _needsCidade = false),
          ),
        ],
      ),
    );
  }

  Widget _cupertinoHome() {
      return CupertinoTabScaffold(
        controller: _cupertinoTabs,
        tabBar: CupertinoTabBar(
          backgroundColor: FregoColors.card,
          activeColor: FregoColors.ink,
          inactiveColor: FregoColors.neutral500,
          border: const Border(
            top: BorderSide(color: FregoColors.hairline, width: 0.5),
          ),
          onTap: (i) {
            _cupertinoTabs.index = i;
            _onTab(i);
          },
          items: const [
            BottomNavigationBarItem(
              icon: Icon(FregoIcons.shops),
              activeIcon: Icon(FregoIcons.shopsFilled),
              label: 'Lojas',
            ),
            BottomNavigationBarItem(
              icon: Icon(FregoIcons.explore),
              activeIcon: Icon(FregoIcons.exploreFilled),
              label: 'Explorar',
            ),
            BottomNavigationBarItem(
              icon: Icon(FregoIcons.rewards),
              activeIcon: Icon(FregoIcons.rewardsFilled),
              label: 'Prêmios',
            ),
            BottomNavigationBarItem(
              icon: Icon(FregoIcons.history),
              activeIcon: Icon(FregoIcons.historyFilled),
              label: 'Histórico',
            ),
            BottomNavigationBarItem(
              icon: Icon(FregoIcons.profile),
              activeIcon: Icon(FregoIcons.profileFilled),
              label: 'Perfil',
            ),
          ],
        ),
        tabBuilder: (context, index) {
          return CupertinoTabView(
            builder: (_) => _pageAt(index),
          );
        },
      );
  }

  Widget _materialHome() {
    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          _shopsPage(),
          _explorePage(),
          _rewardsPage(),
          _historyPage(),
          _profilePage(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _onTab,
        backgroundColor: FregoColors.card,
        indicatorColor: FregoColors.primary50,
        destinations: const [
          NavigationDestination(
            icon: Icon(FregoIcons.shops),
            selectedIcon: Icon(FregoIcons.shopsFilled),
            label: 'Lojas',
          ),
          NavigationDestination(
            icon: Icon(FregoIcons.explore),
            selectedIcon: Icon(FregoIcons.exploreFilled),
            label: 'Explorar',
          ),
          NavigationDestination(
            icon: Icon(FregoIcons.rewards),
            selectedIcon: Icon(FregoIcons.rewardsFilled),
            label: 'Prêmios',
          ),
          NavigationDestination(
            icon: Icon(FregoIcons.history),
            selectedIcon: Icon(FregoIcons.historyFilled),
            label: 'Histórico',
          ),
          NavigationDestination(
            icon: Icon(FregoIcons.profile),
            selectedIcon: Icon(FregoIcons.profileFilled),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }
}
