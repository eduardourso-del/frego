import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../theme/frego_theme.dart';
import '../auth/auth_gate.dart';
import '../counter/counter_lookup_page.dart';

/// Shell de desenvolvimento (opcional): cliente ou balcão.
/// O app abre direto no [AuthGate]; esta tela fica disponível se você
/// quiser testar o balcão mobile.
class HomeShell extends StatelessWidget {
  const HomeShell({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: FregoColors.primary500,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Text(
                  'V',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Frego',
                style: TextStyle(
                  fontSize: 40,
                  fontWeight: FontWeight.w600,
                  letterSpacing: -1.2,
                  color: FregoColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'O telefone é a conta de fidelidade.',
                style: TextStyle(fontSize: 17, color: FregoColors.neutral500),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      CupertinoPageRoute<void>(
                        builder: (_) => const AuthGate(),
                      ),
                    );
                  },
                  child: const Text('Cliente — entrar com telefone'),
                ),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(44, 44),
                    side: const BorderSide(color: FregoColors.neutral200),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onPressed: () {
                    Navigator.of(context).push(
                      CupertinoPageRoute<void>(
                        builder: (_) => const CounterLookupPage(),
                      ),
                    );
                  },
                  child: const Text('Funcionário — carimbar (dev)'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
