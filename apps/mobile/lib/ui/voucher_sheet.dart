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
  String? campaignName,
}) {
  final page = RedeemVoucherSheet(
    voucherDisplay: voucherDisplay,
    rewardTitle: rewardTitle,
    shopName: shopName,
    campaignName: campaignName,
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
    this.campaignName,
  });

  final String voucherDisplay;
  final String rewardTitle;
  final String shopName;
  final String? campaignName;

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.paddingOf(context).bottom;
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
                  color: const Color(0xFFE6F6EE),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text('🎁', style: TextStyle(fontSize: 28)),
              ),
              const SizedBox(height: 16),
              const Text(
                'Mostre no balcão',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.4,
                  color: FregoColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                shopName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  color: FregoColors.neutral500,
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 22, horizontal: 16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF16181D), Color(0xFF2A2E37)],
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
                    Text(
                      rewardTitle,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
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
                      style: const TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        fontFamily: 'Courier',
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Código do voucher',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: Colors.white.withValues(alpha: 0.55),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text(
                'A loja confere este código no histórico do cliente. '
                'Guarde até entregar o prêmio.',
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
}
