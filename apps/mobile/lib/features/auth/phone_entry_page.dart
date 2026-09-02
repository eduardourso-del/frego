import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import '../../ui/legal_links.dart';
import 'otp_page.dart';
import 'phone_auth.dart';

class PhoneEntryPage extends StatefulWidget {
  const PhoneEntryPage({super.key, this.isRoot = false});

  final bool isRoot;

  @override
  State<PhoneEntryPage> createState() => _PhoneEntryPageState();
}

class _PhoneEntryPageState extends State<PhoneEntryPage> {
  final _controller = TextEditingController();
  String? _error;
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  String _formatBr(String raw) {
    var d = raw.replaceAll(RegExp(r'\D'), '');
    if (d.length > 11) d = d.substring(0, 11);
    if (d.isEmpty) return '';
    if (d.length <= 2) return '($d';
    if (d.length <= 6) return '(${d.substring(0, 2)}) ${d.substring(2)}';
    if (d.length <= 10) {
      return '(${d.substring(0, 2)}) ${d.substring(2, 6)}-${d.substring(6)}';
    }
    return '(${d.substring(0, 2)}) ${d.substring(2, 7)}-${d.substring(7)}';
  }

  Future<void> _continue() async {
    final digits = _controller.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) {
      setState(() => _error = 'Informe um celular com DDD');
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    final e164 = '+55$digits';
    try {
      final challenge = await sendPhoneOtp(
        phoneE164: e164,
        onAutoVerified: (credential) async {
          // AuthGate listens to authStateChanges and shows home.
          await FirebaseAuth.instance.signInWithCredential(credential);
        },
        onFailed: (e) {
          if (!mounted) return;
          setState(() {
            _error = _otpSendMessage(e);
            _loading = false;
          });
        },
      );
      if (!mounted) return;
      if (FirebaseAuth.instance.currentUser != null) {
        setState(() => _loading = false);
        return;
      }
      setState(() => _loading = false);
      await FregoAdaptive.push(
        context,
        OtpPage(phoneE164: e164, challenge: challenge),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e is FirebaseAuthException
            ? _otpSendMessage(e)
            : 'Falha na verificação';
        _loading = false;
      });
    }
  }

  String _otpSendMessage(FirebaseAuthException e) {
    final raw = (e.message ?? '').toLowerCase();
    if (e.code == 'too-many-requests') {
      return 'Muitas tentativas. Tente de novo em instantes.';
    }
    if (e.code == 'invalid-phone-number') {
      return 'Número inválido. Confira o DDD.';
    }
    if (e.code == 'app-not-authorized' ||
        raw.contains('invalid token') ||
        raw.contains('play_integrity') ||
        e.code == 'invalid-app-credential' ||
        e.code == 'missing-client-identifier') {
      return 'No emulador o SMS real não funciona. Use (11) 98765-4321 e o código 123456.';
    }
    return 'Falha na verificação';
  }

  @override
  Widget build(BuildContext context) {
    final cupertino = FregoAdaptive.useCupertino(context);

    return FregoPage(
      showNavBar: !widget.isRoot,
      leading: widget.isRoot
          ? null
          : (cupertino
              ? CupertinoButton(
                  padding: EdgeInsets.zero,
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Icon(FregoIcons.back),
                )
              : IconButton(
                  icon: const Icon(FregoIcons.back),
                  onPressed: () => Navigator.of(context).pop(),
                )),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (widget.isRoot) ...[
              const SizedBox(height: 24),
              const FregoWordmark(height: 28),
              const SizedBox(height: 24),
            ],
            const Text(
              'Seu número',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w600,
                letterSpacing: -0.56,
                color: FregoColors.ink,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Enviaremos um código por SMS. Carimbos e pontos do balcão neste telefone entram automaticamente na sua conta.',
              style: TextStyle(
                fontSize: 15,
                color: FregoColors.neutral500,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 32),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  height: 52,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: FregoColors.card,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: FregoColors.neutral200),
                  ),
                  child: const Text(
                    '+55',
                    style: TextStyle(
                      fontSize: 17,
                      color: FregoColors.ink,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: FregoTextField(
                    controller: _controller,
                    placeholder: '(11) 98765-4321',
                    errorText: _error,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[\d()\s-]')),
                      LengthLimitingTextInputFormatter(16),
                    ],
                    onChanged: (value) {
                      final formatted = _formatBr(value);
                      if (formatted != value) {
                        _controller.value = TextEditingValue(
                          text: formatted,
                          selection: TextSelection.collapsed(
                            offset: formatted.length,
                          ),
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
            const Spacer(),
            FregoPrimaryButton(
              label: _loading ? 'Enviando…' : 'Continuar',
              onPressed: _loading ? null : _continue,
            ),
            const SizedBox(height: 16),
            const LegalLinks(
              prefix: 'Ao continuar, você concorda com a ',
            ),
          ],
        ),
      ),
    );
  }
}
