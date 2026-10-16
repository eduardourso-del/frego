import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

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
  /// Stable stream. Creating a new one on every build can emit null before
  /// the persisted cashier is restored.
  late final Stream<User?> _auth = FirebaseAuth.instance.authStateChanges();

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: _auth,
      builder: (context, snap) {
        final pending = snap.connectionState == ConnectionState.waiting &&
            !snap.hasData &&
            FirebaseAuth.instance.currentUser == null;
        if (pending) {
          removeFregoNativeSplash();
          return const FregoSplash();
        }
        // A null event while Firebase still holds the user is not a sign-out.
        // Signing in on another device does not clear this one.
        final user = snap.data ?? FirebaseAuth.instance.currentUser;
        if (user == null) {
          removeFregoNativeSplash();
          return const LoginPage();
        }
        return BusinessGate(key: ValueKey(user.uid), user: user);
      },
    );
  }
}
