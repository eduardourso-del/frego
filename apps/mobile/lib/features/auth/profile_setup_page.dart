import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../explore/city_picker.dart';

class ProfileSetupPage extends StatefulWidget {
  const ProfileSetupPage({
    super.key,
    required this.phoneE164,
    required this.onCompleted,
  });

  final String phoneE164;
  final void Function({bool citySet}) onCompleted;

  @override
  State<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends State<ProfileSetupPage> {
  final _name = TextEditingController();
  bool _loading = false;
  String? _error;
  String? _cityError;
  CityChoice? _city;

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
    final city = _city;
    if (city == null) {
      setState(() => _cityError = 'Escolha onde você mora');
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
      _cityError = null;
    });
    try {
      await updateMyCustomer(
        displayName: withName && name.isNotEmpty ? name : null,
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
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: _loading
                    ? null
                    : () async {
                        final picked = await pickHomeCity(context, selected: _city);
                        if (picked == null || !mounted) return;
                        setState(() {
                          _city = picked;
                          _cityError = null;
                        });
                      },
                child: Text(
                  _city == null ? 'Onde você mora' : _city!.label,
                ),
              ),
            ),
            if (_cityError != null)
              Padding(
                padding: const EdgeInsets.only(top: 8, left: 4),
                child: Text(
                  _cityError!,
                  style: const TextStyle(
                    fontSize: 13,
                    color: FregoColors.danger,
                  ),
                ),
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
