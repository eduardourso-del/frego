import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../config/app_config.dart';
import '../../notifications/push_service.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/legal_links.dart';
import '../../ui/skeleton.dart';
import '../auth/auth_gate.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({
    super.key,
    required this.phoneE164,
    this.onProfileSaved,
  });

  final String phoneE164;
  final VoidCallback? onProfileSaved;

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _name = TextEditingController();
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _success;
  DateTime? _birthday;
  int _membershipCount = 0;
  Map<String, dynamic>? _stats;
  bool _notificationsEnabled = true;
  bool _savingNotifications = false;
  bool _deleting = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  DateTime? _parseBirthday(dynamic raw) {
    if (raw == null) return null;
    if (raw is String && raw.isNotEmpty) {
      return DateTime.tryParse(raw);
    }
    return null;
  }

  String _formatBrDate(DateTime d) {
    final day = d.day.toString().padLeft(2, '0');
    final month = d.month.toString().padLeft(2, '0');
    return '$day/$month/${d.year}';
  }

  String _toApiDate(DateTime d) {
    final month = d.month.toString().padLeft(2, '0');
    final day = d.day.toString().padLeft(2, '0');
    return '${d.year}-$month-$day';
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _success = null;
    });
    try {
      final results = await Future.wait([
        fetchMyCustomer(),
        fetchMyStats(),
      ]);
      final data = results[0];
      final customer = data['customer'] as Map<String, dynamic>;
      if (!mounted) return;
      _name.text = (customer['displayName'] as String?) ?? '';
      setState(() {
        _birthday = _parseBirthday(customer['birthday']);
        _membershipCount = (data['membershipCount'] as num?)?.toInt() ?? 0;
        _notificationsEnabled = customer['notificationsEnabled'] != false;
        _stats = results[1];
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

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.isNotEmpty && name.length < 2) {
      setState(() {
        _error = 'Informe um nome com pelo menos 2 letras, ou deixe em branco';
        _success = null;
      });
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });
    try {
      await updateMyCustomer(
        displayName: name,
        birthday: _birthday != null ? _toApiDate(_birthday!) : null,
        clearBirthday: _birthday == null,
      );
      if (!mounted) return;
      setState(() {
        _saving = false;
        _success = 'Perfil atualizado';
      });
      widget.onProfileSaved?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _pickBirthday() async {
    final now = DateTime.now();
    final initial = _birthday ?? DateTime(now.year - 25, now.month, now.day);
    final picked = await FregoAdaptive.pickDate(
      context,
      initialDate: initial,
      firstDate: DateTime(1920),
      lastDate: now,
    );
    if (picked == null || !mounted) return;
    setState(() {
      _birthday = picked;
      _success = null;
    });
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

  Future<void> _logout() async {
    await PushService.stop();
    await FirebaseAuth.instance.signOut();
    if (!mounted) return;
    // Reset root stack so AuthGate is always present (OTP used to remove it).
    await FregoAdaptive.pushAndRemoveUntil(
      context,
      const AuthGate(),
      rootNavigator: true,
    );
  }

  Future<void> _deleteAccount() async {
    if (_deleting) return;
    final confirmed = await FregoAdaptive.confirm(
      context,
      title: 'Excluir conta?',
      message:
          'Isso apaga seu telefone, nome e o acesso à carteira neste app. '
          'Carimbos, pontos e prêmios não resgatados serão perdidos. '
          'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir conta',
      cancelLabel: 'Cancelar',
      isDestructive: true,
    );
    if (!confirmed || !mounted) return;
    setState(() {
      _deleting = true;
      _error = null;
    });
    try {
      await deleteMyAccount();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _deleting = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
      return;
    }
    await PushService.stop();
    try {
      await FirebaseAuth.instance.signOut();
    } catch (_) {}
    if (!mounted) return;
    await FregoAdaptive.pushAndRemoveUntil(
      context,
      const AuthGate(),
      rootNavigator: true,
    );
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);
    final initial = _name.text.trim().isNotEmpty
        ? _name.text.trim()[0].toUpperCase()
        : '?';
    final canSave = !_loading && !_saving && !_deleting;

    return FregoLargeTitlePage(
      title: 'Perfil',
      trailing: cupertino
          ? CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: canSave ? _save : null,
              child: _saving
                  ? const CupertinoActivityIndicator()
                  : Text(
                      'Salvar',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: canSave
                            ? FregoColors.ink
                            : FregoColors.neutral400,
                      ),
                    ),
            )
          : TextButton(
              onPressed: canSave ? _save : null,
              child: Text(_saving ? 'Salvando…' : 'Salvar'),
            ),
      slivers: [
        if (_loading)
          const SliverToBoxAdapter(child: FregoProfileSkeleton())
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(
              FregoLargeTitlePage.gutter,
              8,
              FregoLargeTitlePage.gutter,
              32,
            ),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                const Text(
                  'Seus dados na Frego. O telefone é a chave da conta.',
                  style: TextStyle(
                    fontSize: 14,
                    color: FregoColors.neutral500,
                  ),
                ),
                const SizedBox(height: 28),
                Center(
                  child: Container(
                    width: 72,
                    height: 72,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: FregoColors.ink,
                      borderRadius: BorderRadius.circular(22),
                    ),
                    child: Text(
                      initial,
                      style: const TextStyle(
                        color: FregoColors.card,
                        fontSize: 28,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Center(
                  child: Text(
                    _membershipCount == 1
                        ? '1 loja'
                        : '$_membershipCount lojas',
                    style: const TextStyle(
                      fontSize: 13,
                      color: FregoColors.neutral500,
                    ),
                  ),
                ),
                if (_stats != null) ...[
                  const SizedBox(height: 20),
                  _ProfileStats(
                    redeems: (_stats!['redeems'] as num?)?.toInt() ?? 0,
                    visits: (_stats!['visits'] as num?)?.toInt() ?? 0,
                    stampsEarned:
                        (_stats!['stampsEarned'] as num?)?.toInt() ?? 0,
                    pointsEarned:
                        (_stats!['pointsEarned'] as num?)?.toInt() ?? 0,
                    cashbackEarnedCents:
                        (_stats!['cashbackEarnedCents'] as num?)?.toInt() ?? 0,
                  ),
                ],
                const SizedBox(height: 28),
                FregoTextField(
                  controller: _name,
                  label: 'Nome (opcional)',
                  placeholder: 'Opcional',
                  textCapitalization: TextCapitalization.words,
                  onChanged: (_) {
                    if (_success != null || _error != null) {
                      setState(() {
                        _success = null;
                        _error = null;
                      });
                    } else {
                      setState(() {});
                    }
                  },
                ),
                const SizedBox(height: 16),
                _ReadonlyField(
                  label: 'Telefone',
                  value: widget.phoneE164,
                ),
                const SizedBox(height: 16),
                GestureDetector(
                  onTap: _pickBirthday,
                  child: _ReadonlyField(
                    label: 'Aniversário (opcional)',
                    value: _birthday == null
                        ? 'Toque para escolher'
                        : _formatBrDate(_birthday!),
                    muted: _birthday == null,
                    trailing: Icon(
                      FregoIcons.calendar,
                      size: 18,
                      color: FregoColors.neutral500,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _birthday == null
                      ? 'Lojas com presente de aniversário só liberam o prêmio se você informar a data.'
                      : 'Com esta data, você pode resgatar presentes de aniversário nas lojas participantes.',
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: FregoColors.neutral500,
                  ),
                ),
                if (_birthday != null) ...[
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: cupertino
                        ? CupertinoButton(
                            padding: EdgeInsets.zero,
                            onPressed: () {
                              setState(() {
                                _birthday = null;
                                _success = null;
                              });
                            },
                            child: const Text(
                              'Remover aniversário',
                              style: TextStyle(
                                fontSize: 14,
                                color: FregoColors.danger,
                              ),
                            ),
                          )
                        : TextButton(
                            onPressed: () {
                              setState(() {
                                _birthday = null;
                                _success = null;
                              });
                            },
                            child: const Text('Remover aniversário'),
                          ),
                  ),
                ],
                const SizedBox(height: 20),
                _NotificationToggle(
                  value: _notificationsEnabled,
                  enabled: !_savingNotifications,
                  onChanged: _setNotificationsEnabled,
                ),
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
                if (_success != null) ...[
                  const SizedBox(height: 12),
                  Text(
                    _success!,
                    style: const TextStyle(
                      color: FregoColors.success,
                      fontSize: 13,
                    ),
                  ),
                ],
                const SizedBox(height: 28),
                const _SettingsLabel('Conta'),
                const SizedBox(height: 8),
                _SettingsGroup(
                  children: [
                    _SettingsRow(
                      label: 'Ajuda',
                      onTap: _deleting
                          ? null
                          : () => openLegalUrl(context, AppConfig.supportUrl),
                    ),
                    _SettingsRow(
                      label: 'Política de Privacidade',
                      onTap: _deleting
                          ? null
                          : () => openLegalUrl(
                                context,
                                AppConfig.privacyPolicyUrl,
                              ),
                    ),
                    _SettingsRow(
                      label: 'Termos de Uso',
                      onTap: _deleting
                          ? null
                          : () => openLegalUrl(
                                context,
                                AppConfig.termsOfUseUrl,
                              ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _SettingsGroup(
                  children: [
                    _SettingsRow(
                      label: 'Sair',
                      showChevron: false,
                      onTap: _deleting ? null : _logout,
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                _SettingsGroup(
                  children: [
                    _SettingsRow(
                      label: _deleting ? 'Excluindo…' : 'Excluir conta',
                      color: FregoColors.danger,
                      showChevron: false,
                      onTap: _deleting ? null : _deleteAccount,
                    ),
                  ],
                ),
              ]),
            ),
          ),
      ],
    );
  }
}

class _SettingsLabel extends StatelessWidget {
  const _SettingsLabel(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 4),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.04,
          color: FregoColors.neutral400,
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FregoColors.hairline),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              const Divider(
                height: 1,
                thickness: 0.5,
                indent: 16,
                color: FregoColors.hairline,
              ),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _SettingsRow extends StatelessWidget {
  const _SettingsRow({
    required this.label,
    required this.onTap,
    this.color,
    this.showChevron = true,
  });

  final String label;
  final VoidCallback? onTap;
  final Color? color;
  final bool showChevron;

  @override
  Widget build(BuildContext context) {
    final ink = color ?? FregoColors.ink;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: ink,
                  ),
                ),
              ),
              if (showChevron)
                Icon(
                  FregoIcons.chevronRight,
                  size: 20,
                  color: FregoColors.neutral400,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationToggle extends StatelessWidget {
  const _NotificationToggle({
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

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
              children: const [
                Text(
                  'Notificações',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Avisos quando uma loja lançar uma campanha para você.',
                  style: TextStyle(
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
                  onChanged: enabled ? onChanged : null,
                ),
        ],
      ),
    );
  }
}

class _StatItem {
  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
  });

  final Widget icon;
  final String value;
  final String label;
}

class _ProfileStats extends StatelessWidget {
  const _ProfileStats({
    required this.redeems,
    required this.visits,
    required this.stampsEarned,
    required this.pointsEarned,
    this.cashbackEarnedCents = 0,
  });

  final int redeems;
  final int visits;
  final int stampsEarned;
  final int pointsEarned;
  final int cashbackEarnedCents;

  List<_StatItem> get _items => [
        _StatItem(
          icon: const Icon(
            FregoIcons.trophy,
            size: 18,
            color: FregoColors.ink,
          ),
          value: '$redeems',
          label: redeems == 1 ? 'prêmio' : 'prêmios',
        ),
        _StatItem(
          icon: const Icon(
            FregoIcons.visits,
            size: 18,
            color: FregoColors.ink,
          ),
          value: '$visits',
          label: visits == 1 ? 'visita' : 'visitas',
        ),
        if (stampsEarned > 0)
          _StatItem(
            icon: FregoIcons.stamp(
              size: 18,
              color: FregoColors.ink,
            ),
            value: '$stampsEarned',
            label: 'carimbos',
          ),
        if (pointsEarned > 0)
          _StatItem(
            icon: FregoIcons.points(
              size: 18,
              color: FregoColors.ink,
            ),
            value: '$pointsEarned',
            label: 'pontos',
          ),
        if (cashbackEarnedCents > 0)
          _StatItem(
            icon: FregoIcons.cashback(
              size: 18,
              color: FregoColors.ink,
            ),
            value:
                'R\$ ${(cashbackEarnedCents / 100).toStringAsFixed(2).replaceAll('.', ',')}',
            label: 'cashback',
          ),
      ];

  @override
  Widget build(BuildContext context) {
    final items = _items;
    final int columns;
    if (items.length <= 3) {
      columns = items.isEmpty ? 1 : items.length;
    } else if (items.length == 4) {
      columns = 2;
    } else {
      columns = 3;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FregoColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(4, 0, 4, 4),
            child: Text(
              'Seu histórico na Frego',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.04,
                color: FregoColors.neutral400,
              ),
            ),
          ),
          LayoutBuilder(
            builder: (context, constraints) {
              final cellWidth = constraints.maxWidth / columns;
              return Wrap(
                alignment: items.length > columns
                    ? WrapAlignment.center
                    : WrapAlignment.start,
                runSpacing: 12,
                children: [
                  for (final item in items)
                    SizedBox(
                      width: cellWidth,
                      child: _StatCell(item: item),
                    ),
                ],
              );
            },
          ),
          if (redeems > 0) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Text(
                redeems == 1
                    ? 'Você já resgatou 1 prêmio — continue acumulando.'
                    : 'Você já resgatou $redeems prêmios — continue acumulando.',
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.35,
                  color: FregoColors.neutral500,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.item});

  final _StatItem item;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
      child: Column(
        children: [
          item.icon,
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              item.value,
              maxLines: 1,
              softWrap: false,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.3,
                color: FregoColors.ink,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            item.label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 11,
              color: FregoColors.neutral500,
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadonlyField extends StatelessWidget {
  const _ReadonlyField({
    required this.label,
    required this.value,
    this.muted = false,
    this.trailing,
  });

  final String label;
  final String value;
  final bool muted;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 6),
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: FregoColors.neutral500,
            ),
          ),
        ),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          decoration: BoxDecoration(
            color: muted ? FregoColors.card : FregoColors.neutral100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: FregoColors.neutral200),
          ),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 17,
                    color: muted ? FregoColors.neutral400 : FregoColors.ink,
                  ),
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ],
    );
  }
}
