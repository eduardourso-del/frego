import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'phone_auth.dart';

class OtpPage extends StatefulWidget {
  const OtpPage({
    super.key,
    required this.phoneE164,
    this.challenge,
  });

  final String phoneE164;
  final PhoneAuthChallenge? challenge;

  @override
  State<OtpPage> createState() => _OtpPageState();
}

class _OtpPageState extends State<OtpPage> {
  final _controllers = List.generate(6, (_) => TextEditingController());
  final _focus = List.generate(6, (_) => FocusNode());
  bool _loading = false;
  bool _applying = false;
  String? _error;

  /// Leave AuthGate as the root so authStateChanges can drive login/home.
  void _returnToAuthGate() {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focus) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(String code) async {
    final challenge = widget.challenge;
    if (challenge == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await challenge.confirm(code);
      if (!mounted) return;
      _returnToAuthGate();
    } catch (e) {
      setState(() {
        _error = 'Código inválido';
        _loading = false;
      });
    }
  }

  void _onChanged(int index, String value) {
    if (_applying) return;
    final digits = value.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      if (index > 0) _focus[index - 1].requestFocus();
      return;
    }

    // iOS SMS suggestion / paste dumps the whole code into one box.
    _applying = true;
    var writeAt = index;
    for (final digit in digits.split('')) {
      if (writeAt >= 6) break;
      _controllers[writeAt].value = TextEditingValue(
        text: digit,
        selection: const TextSelection.collapsed(offset: 1),
      );
      writeAt++;
    }
    _applying = false;

    if (writeAt >= 6) {
      _focus[5].unfocus();
    } else {
      _focus[writeAt].requestFocus();
    }

    if (_controllers.every((c) => c.text.length == 1)) {
      _submit(_controllers.map((c) => c.text).join());
    }
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);

    return FregoPage(
      showNavBar: true,
      leading: cupertino
          ? CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () => Navigator.of(context).pop(),
              child: const Icon(FregoIcons.back),
            )
          : IconButton(
              icon: const Icon(FregoIcons.back),
              onPressed: () => Navigator.of(context).pop(),
            ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Digite o código',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.56,
                color: FregoColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Enviado para ${widget.phoneE164}',
              style: const TextStyle(
                fontSize: 15,
                color: FregoColors.neutral500,
              ),
            ),
            const SizedBox(height: 32),
            AutofillGroup(
              child: Row(
                children: List.generate(6, (i) {
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(
                        left: i == 0 ? 0 : 4,
                        right: i == 5 ? 0 : 4,
                      ),
                      child: SizedBox(
                        height: 58,
                        child: FregoTextField(
                          controller: _controllers[i],
                          focusNode: _focus[i],
                          enabled: !_loading,
                          autofocus: i == 0,
                          textAlign: TextAlign.center,
                          keyboardType: TextInputType.number,
                          autofillHints: const [AutofillHints.oneTimeCode],
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: FregoColors.ink,
                          ),
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          onChanged: (v) => _onChanged(i, v),
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: FregoColors.danger, fontSize: 13),
              ),
            ],
            if (_loading) ...[
              const SizedBox(height: 24),
              const Center(child: FregoProgress()),
            ],
          ],
        ),
      ),
    );
  }
}
