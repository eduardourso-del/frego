import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../notifications/push_service.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

class NotificationSettingsPage extends StatefulWidget {
  const NotificationSettingsPage({super.key});

  @override
  State<NotificationSettingsPage> createState() =>
      _NotificationSettingsPageState();
}

class _NotificationSettingsPageState extends State<NotificationSettingsPage> {
  bool _loading = true;
  String? _error;
  bool _notificationsEnabled = true;
  bool _boasVindasEnabled = true;
  bool _entradaEnabled = true;
  bool _savingNotifications = false;
  bool _savingBoasVindas = false;
  bool _savingEntrada = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool quiet = false}) async {
    if (!quiet) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final data = await fetchMyCustomer();
      final customer = data['customer'] as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _notificationsEnabled = customer['notificationsEnabled'] != false;
        _boasVindasEnabled = customer['boasVindasEnabled'] != false;
        _entradaEnabled = customer['entradaEnabled'] != false;
        _loading = false;
        _error = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _setNotificationsEnabled(bool value) async {
    if (_savingNotifications) return;
    final previous = _notificationsEnabled;
    setState(() {
      _notificationsEnabled = value;
      _savingNotifications = true;
      _error = null;
    });
    try {
      await updateMyCustomer(notificationsEnabled: value);
      if (value) {
        await PushService.start();
      } else {
        await PushService.stop();
      }
      if (!mounted) return;
      setState(() => _savingNotifications = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _notificationsEnabled = previous;
        _savingNotifications = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _setBoasVindasEnabled(bool value) async {
    if (_savingBoasVindas) return;
    final previous = _boasVindasEnabled;
    setState(() {
      _boasVindasEnabled = value;
      _savingBoasVindas = true;
      _error = null;
    });
    try {
      await updateMyCustomer(boasVindasEnabled: value);
      if (!mounted) return;
      setState(() => _savingBoasVindas = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _boasVindasEnabled = previous;
        _savingBoasVindas = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _setEntradaEnabled(bool value) async {
    if (_savingEntrada) return;
    final previous = _entradaEnabled;
    setState(() {
      _entradaEnabled = value;
      _savingEntrada = true;
      _error = null;
    });
    try {
      await updateMyCustomer(entradaEnabled: value);
      if (!mounted) return;
      setState(() => _savingEntrada = false);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _entradaEnabled = previous;
        _savingEntrada = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    return FregoLargeTitlePage(
      title: 'Notificações',
      onRefresh: () => _load(quiet: true),
      leading: cupertino
          ? CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () => Navigator.of(context).maybePop(),
              child: const Icon(FregoIcons.back),
            )
          : IconButton(
              icon: const Icon(FregoIcons.back),
              onPressed: () => Navigator.of(context).maybePop(),
            ),
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(
            FregoLargeTitlePage.gutter,
            8,
            FregoLargeTitlePage.gutter,
            32,
          ),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              if (_loading)
                Padding(
                  padding: const EdgeInsets.only(top: 48),
                  child: Center(
                    child: cupertino
                        ? const CupertinoActivityIndicator()
                        : const CircularProgressIndicator(),
                  ),
                )
              else ...[
                _NotificationToggle(
                  title: 'Notificações',
                  subtitle:
                      'Compras, campanhas, lembretes e lugares novos neste celular.',
                  value: _notificationsEnabled,
                  enabled: !_savingNotifications,
                  onChanged: _setNotificationsEnabled,
                ),
                const SizedBox(height: 8),
                _NotificationToggle(
                  title: 'Boas-vindas',
                  subtitle:
                      'Quando você passar a fazer parte de um estabelecimento.',
                  value: _boasVindasEnabled,
                  enabled: !_savingBoasVindas,
                  onChanged: _setBoasVindasEnabled,
                ),
                const SizedBox(height: 8),
                _NotificationToggle(
                  title: 'Lugares novos',
                  subtitle:
                      'Quando um estabelecimento chegar na sua cidade.',
                  value: _entradaEnabled,
                  enabled: !_savingEntrada,
                  onChanged: _setEntradaEnabled,
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(
                    color: FregoColors.danger,
                    fontSize: 13,
                  ),
                ),
              ],
            ]),
          ),
        ),
      ],
    );
  }
}

class _NotificationToggle extends StatelessWidget {
  const _NotificationToggle({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final String title;
  final String subtitle;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(14, 12, 10, 12),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: FregoColors.neutral200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 13,
                    height: 1.35,
                    color: FregoColors.neutral500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          cupertino
              ? CupertinoSwitch(
                  value: value,
                  activeTrackColor: FregoColors.ink,
                  onChanged: enabled ? onChanged : null,
                )
              : Switch(
                  value: value,
                  activeThumbColor: FregoColors.card,
                  activeTrackColor: FregoColors.ink,
                  onChanged: enabled ? onChanged : null,
                ),
        ],
      ),
    );
  }
}
