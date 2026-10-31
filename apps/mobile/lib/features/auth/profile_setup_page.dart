import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../explore/city_picker.dart';

class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({
    super.key,
    required this.phoneE164,
    required this.onCompleted,
    this.pickCity,
  });

  final String phoneE164;
  final void Function({bool citySet}) onCompleted;

  /// Defaults to the full municipality list. Tests can supply a picker.
  final Future<CityChoice?> Function(
    BuildContext context, {
    CityChoice? selected,
  })?
  pickCity;

  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final _name = TextEditingController();
  bool _loading = false;
  String? _error;
  CityChoice? _city;
  DateTime? _birthday;

  bool get _nameDone => _name.text.trim().length >= 2;
  bool get _birthdayDone => _birthday != null;
  bool get _cityDone => _city != null;
  bool get _ready => _nameDone && _birthdayDone && _cityDone;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
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

  Widget _completionMark(bool done) {
    return ExcludeSemantics(
      child: Icon(
        done ? Icons.check_circle_rounded : Icons.circle_outlined,
        size: 22,
        color: done ? FregoColors.success : FregoColors.neutral200,
      ),
    );
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
    setState(() => _birthday = picked);
  }

  Future<void> _pickCity() async {
    final pick = widget.pickCity ?? pickHomeCity;
    final picked = await pick(context, selected: _city);
    if (picked == null || !mounted) return;
    setState(() => _city = picked);
  }

  Future<void> _continue() async {
    final name = _name.text.trim();
    final city = _city;
    final birthday = _birthday;
    if (name.length < 2 || city == null || birthday == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await updateMyCustomer(
        displayName: name,
        birthday: _toApiDate(birthday),
        city: city.city,
        state: city.state,
      );
      if (!mounted) return;
      widget.onCompleted(citySet: true);
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Widget _choiceButton({
    required String label,
    required bool done,
    required IconData icon,
    required VoidCallback? onPressed,
  }) {
    final tone = done ? FregoColors.ink : FregoColors.neutral500;
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          alignment: Alignment.centerLeft,
          foregroundColor: tone,
          padding: const EdgeInsets.symmetric(horizontal: 14),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: tone),
            const SizedBox(width: 8),
            Expanded(child: Text(label, textAlign: TextAlign.start)),
            _completionMark(done),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ready = _ready && !_loading;
    return FregoPage(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 16),
                    const Text(
                      'Como te chamamos?',
                      style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.56,
                        color: FregoColors.ink,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Seus carimbos e pontos do balcão em ${widget.phoneE164} já estão nesta conta. Complete nome, aniversário e cidade para continuar.',
                      style: const TextStyle(
                        fontSize: 15,
                        color: FregoColors.neutral500,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 32),
                    FregoTextField(
                      controller: _name,
                      label: 'Nome',
                      placeholder: 'Seu nome',
                      errorText: _error,
                      textCapitalization: TextCapitalization.words,
                      autofocus: true,
                      enabled: !_loading,
                      suffix: _completionMark(_nameDone),
                      onChanged: (_) {
                        setState(() {
                          if (_error != null) _error = null;
                        });
                      },
                      onSubmitted: (_) {
                        if (_ready && !_loading) _continue();
                      },
                    ),
                    const SizedBox(height: 16),
                    _choiceButton(
                      label: _birthday == null
                          ? 'Aniversário'
                          : _formatBrDate(_birthday!),
                      done: _birthdayDone,
                      icon: FregoIcons.calendar,
                      onPressed: _loading ? null : _pickBirthday,
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Lojas com presente de aniversário só liberam o prêmio se você informar a data.',
                      style: TextStyle(
                        fontSize: 12,
                        height: 1.4,
                        color: FregoColors.neutral500,
                      ),
                    ),
                    const SizedBox(height: 16),
                    _choiceButton(
                      label: _city == null ? 'Onde você mora' : _city!.label,
                      done: _cityDone,
                      icon: FregoIcons.location,
                      onPressed: _loading ? null : _pickCity,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            FregoPrimaryButton(
              label: _loading ? 'Salvando…' : 'Continuar',
              onPressed: ready ? _continue : null,
            ),
          ],
        ),
      ),
    );
  }
}
