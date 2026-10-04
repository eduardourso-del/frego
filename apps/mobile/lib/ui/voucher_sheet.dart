import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../theme/frego_theme.dart';
import 'adaptive.dart';

/// Full-screen / modal confirmation after redeem — code for staff to verify.
Future<void> showRedeemVoucherSheet(
  BuildContext context, {
  required String voucherDisplay,
  required String rewardTitle,
  required String shopName,
  String? shopLogoUrl,
  String? campaignName,
  bool used = false,
  String? usedAt,
  String? expiresAt,
  String? status,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    enableDrag: true,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return RedeemVoucherSheet(
        voucherDisplay: voucherDisplay,
        rewardTitle: rewardTitle,
        shopName: shopName,
        shopLogoUrl: shopLogoUrl,
        campaignName: campaignName,
        used: used || status == 'used',
        usedAt: usedAt,
        expiresAt: expiresAt,
        expired: status == 'expired',
      );
    },
  );
}

class RedeemVoucherSheet extends StatefulWidget {
  const RedeemVoucherSheet({
    super.key,
    required this.voucherDisplay,
    required this.rewardTitle,
    required this.shopName,
    this.shopLogoUrl,
    this.campaignName,
    this.used = false,
    this.usedAt,
    this.expiresAt,
    this.expired = false,
  });

  final String voucherDisplay;
  final String rewardTitle;
  final String shopName;
  final String? shopLogoUrl;
  final String? campaignName;
  final bool used;
  final String? usedAt;
  final String? expiresAt;
  final bool expired;

  @override
  State<RedeemVoucherSheet> createState() => _RedeemVoucherSheetState();
}

class _RedeemVoucherSheetState extends State<RedeemVoucherSheet> {
  bool _boosted = false;

  bool get _inactive => widget.used || widget.expired;

  String get _payload => widget.voucherDisplay
      .replaceAll(RegExp(r'[^0-9A-Za-z]'), '')
      .toUpperCase();

  @override
  void initState() {
    super.initState();
    if (!_inactive) {
      _present();
    }
  }

  Future<void> _present() async {
    try {
      await WakelockPlus.enable();
      await ScreenBrightness.instance.setApplicationScreenBrightness(1);
      _boosted = true;
    } catch (_) {}
  }

  Future<void> _restore() async {
    try {
      await WakelockPlus.disable();
      if (_boosted) {
        await ScreenBrightness.instance.resetApplicationScreenBrightness();
      }
    } catch (_) {}
  }

  Future<void> _copyCodigo() async {
    await Clipboard.setData(ClipboardData(text: widget.voucherDisplay));
    if (!mounted) return;
    FregoAdaptive.showMessage(context, 'Código copiado');
  }

  @override
  void dispose() {
    _restore();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final expiryLine = _formatExpiresAt(widget.expiresAt);
    final remaining = _remainingLabel(widget.expiresAt);
    final letter = widget.shopName.trim().isEmpty
        ? 'L'
        : widget.shopName.trim()[0].toUpperCase();
    final hasLogo =
        widget.shopLogoUrl != null && widget.shopLogoUrl!.trim().isNotEmpty;
    final qrSide = (MediaQuery.sizeOf(context).width - 88).clamp(160.0, 196.0);

    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: const BoxDecoration(
          color: FregoColors.card,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 12, 24, 20 + bottom),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: FregoColors.neutral200,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: 64,
                height: 64,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: widget.used
                      ? FregoColors.neutral100
                      : widget.expired
                          ? const Color(0xFFFFF1E6)
                          : const Color(0xFFE6F6EE),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  widget.used
                      ? '✓'
                      : widget.expired
                          ? '!'
                          : '🎁',
                  style: TextStyle(
                    fontSize: 28,
                    color: widget.used
                        ? FregoColors.success
                        : widget.expired
                            ? const Color(0xFFC45C26)
                            : null,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                widget.used
                    ? 'Voucher usado'
                    : widget.expired
                        ? 'Voucher expirado'
                        : 'Mostre no balcão',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.4,
                  color: FregoColors.ink,
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (hasLogo) ...[
                    Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(7),
                        border: Border.all(color: FregoColors.hairline),
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: Image.network(
                        widget.shopLogoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => ColoredBox(
                          color: FregoColors.primary50,
                          child: Center(
                            child: Text(
                              letter,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: FregoColors.ink,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  Flexible(
                    child: Text(
                      widget.shopName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 15,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding:
                    const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: _inactive
                        ? const [Color(0xFF3F444F), Color(0xFF2A2E37)]
                        : const [Color(0xFF16181D), Color(0xFF2A2E37)],
                  ),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.18),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    if (widget.used || widget.expired) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.14),
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          widget.used ? 'USADO NO BALCÃO' : 'EXPIRADO',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.06,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    Text(
                      widget.rewardTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white
                            .withValues(alpha: _inactive ? 0.75 : 1),
                      ),
                    ),
                    if (widget.campaignName != null &&
                        widget.campaignName!.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        widget.campaignName!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                    if (!_inactive && _payload.length == 6) ...[
                      const SizedBox(height: 18),
                      Center(
                        child: ExcludeSemantics(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: QrImageView(
                                data: _payload,
                                padding: EdgeInsets.zero,
                                backgroundColor: Colors.white,
                                errorCorrectionLevel: QrErrorCorrectLevel.H,
                                eyeStyle: const QrEyeStyle(
                                  eyeShape: QrEyeShape.square,
                                  color: Color(0xFF16181D),
                                ),
                                dataModuleStyle: const QrDataModuleStyle(
                                  dataModuleShape: QrDataModuleShape.square,
                                  color: Color(0xFF16181D),
                                ),
                                size: qrSide,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'A loja pode escanear',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white.withValues(alpha: 0.75),
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          widget.voucherDisplay,
                          style: TextStyle(
                            fontSize: _inactive ? 36 : 24,
                            fontWeight: FontWeight.w700,
                            letterSpacing: _inactive ? 4 : 3,
                            fontFamily: 'Courier',
                            color: Colors.white
                                .withValues(alpha: _inactive ? 0.55 : 1),
                            decoration:
                                _inactive ? TextDecoration.lineThrough : null,
                            decorationColor:
                                Colors.white.withValues(alpha: 0.45),
                          ),
                        ),
                        if (!_inactive)
                          IconButton(
                            onPressed: _copyCodigo,
                            tooltip: 'Copiar',
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.all(8),
                            constraints: const BoxConstraints(
                              minWidth: 44,
                              minHeight: 44,
                            ),
                            icon: Icon(
                              Icons.copy_rounded,
                              size: 20,
                              color: Colors.white.withValues(alpha: 0.9),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      widget.used
                          ? (_formatUsedAt(widget.usedAt) ??
                              'Prêmio já entregue')
                          : widget.expired
                              ? (expiryLine != null
                                  ? 'Expirou $expiryLine'
                                  : 'Validade de 24h esgotada')
                              : 'Código do voucher',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.55),
                      ),
                    ),
                    if (!widget.used && expiryLine != null) ...[
                      const SizedBox(height: 14),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            Text(
                              widget.expired
                                  ? 'Expirou $expiryLine'
                                  : 'Válido até $expiryLine',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: widget.expired
                                    ? const Color(0xFFFDBA74)
                                    : Colors.white.withValues(alpha: 0.92),
                              ),
                            ),
                            if (remaining != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                remaining,
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.white.withValues(alpha: 0.6),
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
              const SizedBox(height: 14),
              Text(
                widget.used
                    ? 'Este voucher já foi confirmado no balcão da loja.'
                    : widget.expired
                        ? 'A validade de 24 horas acabou. Resgate de novo no app se ainda tiver saldo.'
                        : 'Mostre este código no balcão em até 24 horas. '
                            'A loja marca como usado ao entregar o prêmio.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  color: FregoColors.neutral500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _formatUsedAt(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return null;
    return 'Usado em ${_formatDateTime(d)}';
  }

  String? _formatExpiresAt(String? iso) {
    if (iso == null || iso.isEmpty) return null;
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return null;
    return _formatDateTime(d);
  }

  String? _remainingLabel(String? iso) {
    if (iso == null || iso.isEmpty || widget.expired || widget.used) {
      return null;
    }
    final d = DateTime.tryParse(iso)?.toLocal();
    if (d == null) return null;
    final diff = d.difference(DateTime.now());
    if (diff.isNegative) return null;
    final hours = diff.inHours;
    final mins = diff.inMinutes.remainder(60);
    if (hours <= 0) {
      return mins <= 1 ? 'Expira em menos de 1 min' : 'Expira em $mins min';
    }
    if (hours == 1) {
      return mins == 0 ? 'Expira em 1 hora' : 'Expira em 1 h $mins min';
    }
    return mins == 0 ? 'Expira em $hours horas' : 'Expira em $hours h $mins min';
  }

  String _formatDateTime(DateTime d) {
    const months = [
      'jan',
      'fev',
      'mar',
      'abr',
      'mai',
      'jun',
      'jul',
      'ago',
      'set',
      'out',
      'nov',
      'dez',
    ];
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '${d.day} ${months[d.month - 1]} · $h:$m';
  }
}
