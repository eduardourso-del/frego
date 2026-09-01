import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
  final page = RedeemVoucherSheet(
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

  if (FregoAdaptive.useCupertino(context)) {
    return showCupertinoModalPopup<void>(
      context: context,
      builder: (_) => page,
    );
  }
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => page,
  );
}

class RedeemVoucherSheet extends StatelessWidget {
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

  bool get _inactive => used || expired;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
    final expiryLine = _formatExpiresAt(expiresAt);
    final remaining = _remainingLabel(expiresAt);
    final letter =
        shopName.trim().isEmpty ? 'L' : shopName.trim()[0].toUpperCase();
    final hasLogo = shopLogoUrl != null && shopLogoUrl!.trim().isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(top: 48),
      decoration: const BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.fromLTRB(24, 12, 24, 16 + bottom),
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
                  color: used
                      ? FregoColors.neutral100
                      : expired
                          ? const Color(0xFFFFF1E6)
                          : const Color(0xFFE6F6EE),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  used
                      ? '✓'
                      : expired
                          ? '!'
                          : '🎁',
                  style: TextStyle(
                    fontSize: 28,
                    color: used
                        ? FregoColors.success
                        : expired
                            ? const Color(0xFFC45C26)
                            : null,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                used
                    ? 'Voucher usado'
                    : expired
                        ? 'Voucher expirado'
                        : 'Mostre no balcão',
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
                        shopLogoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => ColoredBox(
                          color: FregoColors.primary50,
                          child: Center(
                            child: Text(
                              letter,
                              style: const TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: FregoColors.primary500,
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
                      shopName,
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
                    if (used || expired) ...[
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
                          used ? 'USADO NO BALCÃO' : 'EXPIRADO',
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
                      rewardTitle,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white
                            .withValues(alpha: _inactive ? 0.75 : 1),
                      ),
                    ),
                    if (campaignName != null &&
                        campaignName!.trim().isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        campaignName!,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.white.withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                    const SizedBox(height: 18),
                    Text(
                      voucherDisplay,
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        fontFamily: 'Courier',
                        color:
                            Colors.white.withValues(alpha: _inactive ? 0.55 : 1),
                        decoration:
                            _inactive ? TextDecoration.lineThrough : null,
                        decorationColor:
                            Colors.white.withValues(alpha: 0.45),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      used
                          ? (_formatUsedAt(usedAt) ?? 'Prêmio já entregue')
                          : expired
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
                    if (!used && expiryLine != null) ...[
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
                              expired
                                  ? 'Expirou $expiryLine'
                                  : 'Válido até $expiryLine',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: expired
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
                used
                    ? 'Este voucher já foi confirmado no balcão da loja.'
                    : expired
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
              const SizedBox(height: 20),
              Row(
                children: [
                  if (!_inactive) ...[
                    Expanded(
                      child: FregoSecondaryButton(
                        label: 'Copiar',
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(text: voucherDisplay),
                          );
                          if (!context.mounted) return;
                          FregoAdaptive.showMessage(context, 'Código copiado');
                        },
                      ),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: FregoPrimaryButton(
                      label: 'Feito',
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                ],
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
    if (iso == null || iso.isEmpty || expired || used) return null;
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
