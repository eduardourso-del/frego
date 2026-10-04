import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../history/history_page.dart';
import '../profile/profile_page.dart';
import '../rewards/rewards_page.dart';
import '../shops/campaign_detail_page.dart';
import '../shops/earn_detail_page.dart';
import '../shops/shop_detail_page.dart';
import '../shops/shops_page.dart';
import '../../analytics/frego_telemetry.dart';
import '../../notifications/push_service.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

/// Shell do app do cliente: lojas + prêmios + histórico + perfil.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.phoneE164});

  final String phoneE164;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  static const _tabScreens = ['shops', 'rewards', 'history', 'profile'];

  int _index = 0;
  int _shopsRefresh = 0;
  int _rewardsRefresh = 0;
  int _historyRefresh = 0;
  late final CupertinoTabController _cupertinoTabs;

  @override
  void initState() {
    super.initState();
    _cupertinoTabs = CupertinoTabController(initialIndex: 0);
    PendingPushOpen.target.addListener(_openPendingPush);
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
      if (i == 1) _rewardsRefresh++;
      if (i == 2) _historyRefresh++;
    });
    unawaited(FregoTelemetry.screen(_tabScreens[i]));
  }

  Widget _shopsPage() => ShopsPage(
        phoneE164: widget.phoneE164,
        refreshToken: _shopsRefresh,
      );

  Widget _rewardsPage() => RewardsPage(refreshToken: _rewardsRefresh);

  Widget _historyPage() => HistoryPage(refreshToken: _historyRefresh);

  Widget _profilePage() => ProfilePage(
        phoneE164: widget.phoneE164,
        onProfileSaved: () {
          setState(() {
            _shopsRefresh++;
            _rewardsRefresh++;
          });
        },
      );

  Widget _pageAt(int index) {
    switch (index) {
      case 1:
        return _rewardsPage();
      case 2:
        return _historyPage();
      case 3:
        return _profilePage();
      case 0:
      default:
        return _shopsPage();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
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

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          _shopsPage(),
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
