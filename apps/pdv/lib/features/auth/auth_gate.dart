import 'package:flutter/material.dart';

import '../../session/staff_auth.dart';
import '../../theme/frego_theme.dart';
import '../../ui/native_splash.dart';
import 'business_gate.dart';
import 'login_page.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  @override
  void initState() {
    super.initState();
    StaffAuth.instance.restore();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: StaffAuth.instance,
      builder: (context, _) {
        removeFregoNativeSplash();
        final auth = StaffAuth.instance;
        if (!auth.ready) return const FregoSplash();
        final user = auth.currentUser;
        if (user == null) return const LoginPage();
        return BusinessGate(key: ValueKey(user.uid), user: user);
      },
    );
  }
}
