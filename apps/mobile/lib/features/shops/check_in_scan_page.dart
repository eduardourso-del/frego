import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../notifications/check_in_links.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'check_in_page.dart';

Future<void> openCheckInScanner(
  BuildContext context, {
  VoidCallback? onRecorded,
}) {
  return FregoAdaptive.push(
    context,
    CheckInScanPage(onRecorded: onRecorded),
  );
}

class CheckInFab extends StatelessWidget {
  const CheckInFab({super.key, this.onRecorded});

  final VoidCallback? onRecorded;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Fazer check-in',
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF041828).withValues(alpha: 0.22),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Material(
          color: FregoColors.mostarda,
          borderRadius: BorderRadius.circular(28),
          child: InkWell(
            onTap: () => openCheckInScanner(context, onRecorded: onRecorded),
            borderRadius: BorderRadius.circular(28),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 18, 12),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  FregoIcons.checkIn(size: 22, color: FregoColors.ink),
                  const SizedBox(width: 8),
                  const Text(
                    'Check-in',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: FregoColors.ink,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class CheckInScanPage extends StatefulWidget {
  const CheckInScanPage({super.key, this.onRecorded});

  final VoidCallback? onRecorded;

  @override
  State<CheckInScanPage> createState() => _CheckInScanPageState();
}

class _CheckInScanPageState extends State<CheckInScanPage> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
  );
  final _paste = TextEditingController();
  bool _locked = false;
  bool _cameraFailed = false;
  String? _hint;

  @override
  void dispose() {
    _paste.dispose();
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    final raw = capture.barcodes
        .map((code) => code.rawValue)
        .whereType<String>()
        .firstOrNull;
    if (raw == null) return;
    _openToken(CheckInLinks.tokenFromScan(raw), fromCamera: true);
  }

  void _openToken(String? token, {required bool fromCamera}) {
    if (_locked) return;
    if (token == null) {
      setState(() {
        _hint = fromCamera
            ? 'Esse QR não é de check-in.'
            : 'Cole o link do QR do check-in.';
      });
      return;
    }
    _locked = true;
    final page = CheckInPage(token: token, onRecorded: widget.onRecorded);
    final route = FregoAdaptive.useCupertino(context)
        ? CupertinoPageRoute<void>(builder: (_) => page)
        : MaterialPageRoute<void>(builder: (_) => page);
    Navigator.of(context).pushReplacement(route);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FregoColors.ink,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (!_cameraFailed)
            MobileScanner(
              controller: _controller,
              onDetect: _onDetect,
              errorBuilder: (context, error) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (mounted && !_cameraFailed) {
                    setState(() => _cameraFailed = true);
                  }
                });
                return const SizedBox.expand();
              },
            ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: IconButton(
                    onPressed: () => Navigator.of(context).maybePop(),
                    icon: const Icon(Icons.close_rounded, color: Colors.white),
                  ),
                ),
                if (_cameraFailed)
                  Expanded(child: _pastePanel())
                else ...[
                  const Spacer(),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
                    child: Column(
                      children: [
                        FregoIcons.checkIn(size: 28, color: FregoColors.mostarda),
                        const SizedBox(height: 12),
                        const Text(
                          'Aponte para o QR',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        if (_hint != null) ...[
                          const SizedBox(height: 8),
                          Text(
                            _hint!,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.8),
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _pastePanel() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          FregoIcons.checkIn(size: 28, color: FregoColors.mostarda),
          const SizedBox(height: 16),
          const Text(
            'A câmera não abriu neste aparelho.',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Cole o link do QR para registrar o check-in.',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.8),
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _paste,
            style: const TextStyle(color: FregoColors.ink),
            decoration: const InputDecoration(
              filled: true,
              fillColor: Colors.white,
              hintText: 'https://…/c/…',
            ),
            onSubmitted: (value) =>
                _openToken(CheckInLinks.tokenFromScan(value), fromCamera: false),
          ),
          const SizedBox(height: 12),
          FregoPrimaryButton(
            label: 'Registrar check-in',
            onPressed: () => _openToken(
              CheckInLinks.tokenFromScan(_paste.text),
              fromCamera: false,
            ),
          ),
          if (_hint != null) ...[
            const SizedBox(height: 12),
            Text(
              _hint!,
              style: TextStyle(color: Colors.white.withValues(alpha: 0.8)),
            ),
          ],
        ],
      ),
    );
  }
}
