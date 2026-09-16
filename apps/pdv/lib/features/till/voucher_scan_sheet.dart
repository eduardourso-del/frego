import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../theme/frego_theme.dart';
import '../../util/voucher.dart';

Future<String?> showVoucherScanSheet(BuildContext context) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: FregoColors.card,
    builder: (_) => const VoucherScanSheet(),
  );
}

class VoucherScanSheet extends StatefulWidget {
  const VoucherScanSheet({super.key});

  @override
  State<VoucherScanSheet> createState() => _VoucherScanSheetState();
}

class _VoucherScanSheetState extends State<VoucherScanSheet> {
  final _controller = MobileScannerController(
    facing: CameraFacing.back,
    formats: const [BarcodeFormat.qrCode],
    torchEnabled: false,
  );
  bool _handled = false;
  String? _junk;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    String? raw;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue;
      if (value != null && value.isNotEmpty) {
        raw = value;
        break;
      }
    }
    if (raw == null) return;
    final code = parseScannedVoucherCodigo(raw);
    if (code == null) {
      if (_junk == null) {
        setState(() => _junk = 'Não é um voucher Frego');
      }
      return;
    }
    _handled = true;
    Navigator.of(context).pop(code);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final height = MediaQuery.sizeOf(context).height * 0.72;
    return SizedBox(
      height: height,
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + bottom),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'Escanear voucher',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: FregoColors.ink,
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Aponte para o código no celular do cliente',
              style: TextStyle(
                fontSize: 13,
                height: 1.35,
                color: FregoColors.neutral500,
              ),
            ),
            const SizedBox(height: 16),
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: MobileScanner(
                  controller: _controller,
                  onDetect: _onDetect,
                  errorBuilder: (context, error) {
                    return const ColoredBox(
                      color: FregoColors.neutral100,
                      child: Center(
                        child: Padding(
                          padding: EdgeInsets.all(24),
                          child: Text(
                            'Sem câmera. Digite o código.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.4,
                              color: FregoColors.neutral500,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
            if (_junk != null) ...[
              const SizedBox(height: 12),
              Text(
                _junk!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: FregoColors.danger,
                ),
              ),
            ],
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pop(),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                foregroundColor: FregoColors.ink,
              ),
              child: const Text('Cancelar'),
            ),
          ],
        ),
      ),
    );
  }
}
