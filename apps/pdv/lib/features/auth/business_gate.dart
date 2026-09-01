import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../../api/api_error.dart';
import '../../api/pdv_api.dart';
import '../../session/staff_session.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../till/till_page.dart';

class BusinessGate extends StatefulWidget {
  const BusinessGate({super.key, required this.user});

  final User user;

  @override
  State<BusinessGate> createState() => _BusinessGateState();
}

class _BusinessGateState extends State<BusinessGate> {
  late final StaffSession _session = StaffSession(user: widget.user);

  @override
  void initState() {
    super.initState();
    _session.load();
  }

  @override
  void dispose() {
    _session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _session,
      builder: (context, _) {
        if (_session.loading) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        if (_session.error != null && _session.businesses.isEmpty) {
          return _StatusScaffold(
            title: 'Sem loja',
            body: humanizeError(_session.error!),
            actionLabel: 'Sair',
            onAction: _session.signOut,
          );
        }

        if (_session.picking || _session.business == null) {
          return _BusinessPicker(session: _session);
        }

        final business = _session.business!;
        if (business.isPending) {
          return _StatusScaffold(
            title: 'Aguardando aprovação',
            body:
                '${business.name} foi cadastrado e está na fila da equipe Frego. '
                'Depois da aprovação, o PDV libera.',
            actionLabel: 'Sair',
            onAction: _session.signOut,
            extra: _session.businesses.length > 1
                ? TextButton(
                    onPressed: _session.showPicker,
                    child: const Text('Trocar loja'),
                  )
                : null,
          );
        }
        if (business.isSuspended) {
          return _StatusScaffold(
            title: 'Estabelecimento suspenso',
            body:
                'O cadastro de ${business.name} não está ativo. Fale com o suporte Frego.',
            actionLabel: 'Sair',
            onAction: _session.signOut,
            extra: _session.businesses.length > 1
                ? TextButton(
                    onPressed: _session.showPicker,
                    child: const Text('Trocar loja'),
                  )
                : null,
          );
        }

        return TillPage(key: ValueKey(business.id), session: _session);
      },
    );
  }
}

class _BusinessPicker extends StatelessWidget {
  const _BusinessPicker({required this.session});

  final StaffSession session;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Escolher loja'),
        actions: [
          IconButton(
            tooltip: 'Sair',
            onPressed: session.signOut,
            icon: const Icon(FregoIcons.logout),
          ),
        ],
      ),
      body: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: session.businesses.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final b = session.businesses[i];
          return Material(
            color: FregoColors.card,
            borderRadius: BorderRadius.circular(14),
            child: InkWell(
              borderRadius: BorderRadius.circular(14),
              onTap: () => session.setBusinessId(b.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 16,
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: FregoColors.primary50,
                      foregroundColor: FregoColors.primary600,
                      child: Text(
                        b.name.isEmpty ? '?' : b.name[0].toUpperCase(),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            b.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w600,
                              fontSize: 16,
                            ),
                          ),
                          Text(
                            _statusLabel(b),
                            style: const TextStyle(
                              color: FregoColors.neutral500,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Icon(FregoIcons.store, color: FregoColors.neutral400),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  String _statusLabel(StaffBusiness b) {
    if (b.isPending) return 'Aguardando aprovação';
    if (b.isSuspended) return 'Suspenso';
    return b.role ?? 'Ativo';
  }
}

class _StatusScaffold extends StatelessWidget {
  const _StatusScaffold({
    required this.title,
    required this.body,
    required this.actionLabel,
    required this.onAction,
    this.extra,
  });

  final String title;
  final String body;
  final String actionLabel;
  final VoidCallback onAction;
  final Widget? extra;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                title,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(
                body,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: FregoColors.neutral500,
                  fontSize: 15,
                  height: 1.45,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: onAction,
                  child: Text(actionLabel),
                ),
              ),
              ?extra,
            ],
          ),
        ),
      ),
    );
  }
}
