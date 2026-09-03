import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../analytics/frego_telemetry.dart';
import '../../api/frego_api.dart';
import '../../notifications/push_service.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/native_splash.dart';
import '../home/customer_shell.dart';
import 'notification_onboarding_page.dart';
import 'phone_entry_page.dart';
import 'profile_setup_page.dart';

/// Decide para onde ir após login: nome, avisos, ou lista de lojas.
class CustomerHomeGate extends StatefulWidget {
  const CustomerHomeGate({super.key});

  @override
  State<CustomerHomeGate> createState() => _CustomerHomeGateState();
}

class _CustomerHomeGateState extends State<CustomerHomeGate> {
  bool _loading = true;
  String? _error;
  bool _needsOnboarding = false;
  bool _needsNotificationPrompt = false;
  String? _phoneE164;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await fetchMyCustomer().timeout(const Duration(seconds: 20));
      final customer = data['customer'] as Map<String, dynamic>;
      final needsOnboarding = data['needsOnboarding'] == true;
      final needsNotificationPrompt = needsOnboarding
          ? false
          : await PushService.shouldShowPrePrompt()
              .timeout(const Duration(seconds: 5), onTimeout: () => false);
      if (!mounted) return;
      setState(() {
        _needsOnboarding = needsOnboarding;
        _needsNotificationPrompt = needsNotificationPrompt;
        _phoneE164 = customer['phoneE164'] as String?;
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

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      removeFregoNativeSplash();
      return const FregoSplash();
    }

    removeFregoNativeSplash();

    if (_error != null) {
      return FregoPage(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Não foi possível sincronizar',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w600,
                  color: FregoColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: FregoColors.neutral500),
              ),
              const SizedBox(height: 24),
              FregoPrimaryButton(
                label: 'Tentar de novo',
                onPressed: _bootstrap,
              ),
              const SizedBox(height: 8),
              FregoSecondaryButton(
                label: 'Sair',
                onPressed: () async {
                  await PushService.stop();
                  await FirebaseAuth.instance.signOut();
                  if (!context.mounted) return;
                  await FregoAdaptive.pushAndRemoveUntil(
                    context,
                    const AuthGate(),
                    rootNavigator: true,
                  );
                },
              ),
            ],
          ),
        ),
      );
    }

    if (_needsOnboarding) {
      return ProfileSetupPage(
        phoneE164: _phoneE164 ?? '',
        onCompleted: () async {
          final showPrompt = await PushService.shouldShowPrePrompt();
          if (!mounted) return;
          setState(() {
            _needsOnboarding = false;
            _needsNotificationPrompt = showPrompt;
          });
        },
      );
    }

    if (_needsNotificationPrompt) {
      return NotificationOnboardingPage(
        onDone: () {
          setState(() => _needsNotificationPrompt = false);
        },
      );
    }

    return CustomerShell(phoneE164: _phoneE164 ?? '');
  }
}

/// Raiz: se já autenticado, entra no app; senão, telefone.
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: FirebaseAuth.instance.authStateChanges(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          removeFregoNativeSplash();
          return const FregoSplash();
        }
        final user = snapshot.data;
        unawaited(FregoTelemetry.setUser(user?.uid));
        if (user != null) {
          return const CustomerHomeGate();
        }
        removeFregoNativeSplash();
        return const PhoneEntryPage(isRoot: true);
      },
    );
  }
}
