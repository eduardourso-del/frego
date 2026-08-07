import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../history/history_page.dart';
import '../profile/profile_page.dart';
import '../shops/shops_page.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

/// Shell do app do cliente: lojas + histórico + perfil.
class CustomerShell extends StatefulWidget {
  const CustomerShell({super.key, required this.phoneE164});

  final String phoneE164;

  @override
  State<CustomerShell> createState() => _CustomerShellState();
}

class _CustomerShellState extends State<CustomerShell> {
  int _index = 0;
  int _shopsEpoch = 0;
  int _historyEpoch = 0;
  late final CupertinoTabController _cupertinoTabs;

  @override
  void initState() {
    super.initState();
    _cupertinoTabs = CupertinoTabController(initialIndex: 0);
  }

  @override
  void dispose() {
    _cupertinoTabs.dispose();
    super.dispose();
  }

  void _onTab(int i) {
    setState(() {
      _index = i;
      if (i == 0) _shopsEpoch++;
      if (i == 1) _historyEpoch++;
    });
  }

  Widget _pageAt(int index) {
    switch (index) {
      case 1:
        return HistoryPage(key: ValueKey('history-$_historyEpoch'));
      case 2:
        return ProfilePage(
          phoneE164: widget.phoneE164,
          onProfileSaved: () {
            setState(() => _shopsEpoch++);
          },
        );
      case 0:
      default:
        return ShopsPage(
          key: ValueKey('shops-$_shopsEpoch'),
          phoneE164: widget.phoneE164,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      return CupertinoTabScaffold(
        controller: _cupertinoTabs,
        tabBar: CupertinoTabBar(
          backgroundColor: FregoColors.card.withValues(alpha: 0.94),
          activeColor: FregoColors.primary500,
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
          _pageAt(0),
          HistoryPage(key: ValueKey('history-$_historyEpoch')),
          ProfilePage(
            phoneE164: widget.phoneE164,
            onProfileSaved: () {
              setState(() => _shopsEpoch++);
            },
          ),
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
