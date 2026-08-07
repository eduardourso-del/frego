import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({
    super.key,
    required this.phoneE164,
    required this.onCompleted,
  });

  final String phoneE164;
  final VoidCallback onCompleted;

  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final _name = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    if (name.length < 2) {
      setState(() => _error = 'Informe seu nome');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await updateMyCustomer(displayName: name);
      if (!mounted) return;
      widget.onCompleted();
    } catch (e) {
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return FregoPage(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 16),
            const Text(
              'Crie sua conta',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.56,
                color: FregoColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Seus carimbos e pontos do balcão em ${widget.phoneE164} já estão vinculados a este número.',
              style: const TextStyle(
                fontSize: 15,
                color: FregoColors.neutral500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 32),
            FregoTextField(
              controller: _name,
              label: 'Como podemos te chamar?',
              placeholder: 'Seu nome',
              errorText: _error,
              textCapitalization: TextCapitalization.words,
              autofocus: true,
              onSubmitted: (_) => _save(),
            ),
            const Spacer(),
            FregoPrimaryButton(
              label: _loading ? 'Salvando…' : 'Continuar',
              onPressed: _loading ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
