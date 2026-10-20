import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../terminal/terminal_info.dart';
import '../../theme/frego_theme.dart';

const fregoSupportEmail = 'contato@frego.app.br';

void openSupport(BuildContext context) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(builder: (_) => const SupportPage()),
  );
}

class SupportPage extends StatefulWidget {
  const SupportPage({super.key});

  @override
  State<SupportPage> createState() => _SupportPageState();
}

class _SupportPageState extends State<SupportPage> {
  String? _serial;
  var _readingSerial = true;

  @override
  void initState() {
    super.initState();
    _loadSerial();
  }

  Future<void> _loadSerial() async {
    String? serial;
    for (var i = 0; i < 8; i++) {
      serial = await TerminalInfo.serialNumber();
      if (serial != null) break;
      await Future<void>.delayed(const Duration(milliseconds: 400));
    }
    if (!mounted) return;
    setState(() {
      _serial = serial;
      _readingSerial = false;
    });
  }

  Future<void> _copyEmail() async {
    await Clipboard.setData(const ClipboardData(text: fregoSupportEmail));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('E-mail copiado'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final serial = _readingSerial
        ? 'Lendo o terminal…'
        : _serial ?? 'Indisponível fora da maquininha Get Smart.';
    return Scaffold(
      appBar: AppBar(title: const Text('Fale conosco')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          children: [
            const Text(
              'Problema no PDV ou na maquininha, fale com a Frego.',
              style: TextStyle(
                color: FregoColors.neutral500,
                fontSize: 15,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'E-mail',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: FregoColors.neutral400,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 4),
            SelectableText(
              fregoSupportEmail,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 12),
            Align(
              alignment: Alignment.centerLeft,
              child: OutlinedButton(
                onPressed: _copyEmail,
                child: const Text('Copiar e-mail'),
              ),
            ),
            const SizedBox(height: 28),
            Text(
              'Número de série',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: FregoColors.neutral400,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.6,
              ),
            ),
            const SizedBox(height: 4),
            SelectableText(
              serial,
              style: const TextStyle(fontSize: 16, height: 1.4),
            ),
            const SizedBox(height: 8),
            const Text(
              'Na maquininha Get Smart este é o número da etiqueta atrás do aparelho.',
              style: TextStyle(
                color: FregoColors.neutral500,
                fontSize: 13,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
