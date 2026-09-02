import 'package:flutter/cupertino.dart';
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

  Future<void> _continue({required bool withName}) async {
    final name = _name.text.trim();
    if (withName && name.isNotEmpty && name.length < 2) {
      setState(() => _error = 'Informe um nome com pelo menos 2 letras');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await updateMyCustomer(
        displayName: withName && name.isNotEmpty ? name : null,
      );
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
    final cupertino = FregoAdaptive.useCupertino(context);
    return FregoPage(
      child: Padding(
        padding: const EdgeInsets.all(24),
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
              'Seus carimbos e pontos do balcão em ${widget.phoneE164} já estão nesta conta. O nome é opcional.',
              style: const TextStyle(
                fontSize: 15,
                color: FregoColors.neutral500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 32),
            FregoTextField(
              controller: _name,
              label: 'Nome (opcional)',
              placeholder: 'Seu nome',
              errorText: _error,
              textCapitalization: TextCapitalization.words,
              autofocus: true,
              onChanged: (_) {
                if (_error != null) setState(() => _error = null);
              },
              onSubmitted: (_) => _continue(withName: true),
            ),
            const Spacer(),
            FregoPrimaryButton(
              label: _loading ? 'Salvando…' : 'Continuar',
              onPressed: _loading ? null : () => _continue(withName: true),
            ),
            const SizedBox(height: 8),
            cupertino
                ? SizedBox(
                    width: double.infinity,
                    child: CupertinoButton(
                      onPressed:
                          _loading ? null : () => _continue(withName: false),
                      child: const Text(
                        'Agora não',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ),
                  )
                : SizedBox(
                    width: double.infinity,
                    child: TextButton(
                      onPressed:
                          _loading ? null : () => _continue(withName: false),
                      child: const Text('Agora não'),
                    ),
                  ),
          ],
        ),
      ),
    );
  }
}
