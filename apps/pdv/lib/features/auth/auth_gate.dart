import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../theme/frego_theme.dart';
import '../../ui/native_splash.dart';
import 'business_gate.dart';
import 'login_page.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
          return const FregoSplash();
        }
        final user = snap.data;
        if (user == null) {
          removeFregoNativeSplash();
          return const LoginPage();
        }
        return BusinessGate(key: ValueKey(user.uid), user: user);
      },
    );
  }
}
