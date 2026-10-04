import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../config/app_config.dart';
import '../theme/frego_theme.dart';
import 'adaptive.dart';

Future<void> openLegalUrl(BuildContext context, String url) async {
  final uri = Uri.parse(url);
  final ok = await launchUrl(uri, mode: LaunchMode.inAppBrowserView);
  if (!ok && context.mounted) {
    FregoAdaptive.showMessage(context, 'Não foi possível abrir o link');
  }
}

/// Privacy + terms, opened in-app (Safari View Controller on iOS).
class LegalLinks extends StatelessWidget {
  const LegalLinks({super.key, this.prefix});

  final String? prefix;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (prefix != null)
          Text(
            prefix!,
            style: const TextStyle(
              fontSize: 13,
              height: 1.4,
              color: FregoColors.neutral500,
            ),
          ),
        _LegalTextButton(
          label: 'Política de Privacidade',
          onPressed: () => openLegalUrl(context, AppConfig.privacyPolicyUrl),
        ),
        const Text(
          ' e ',
          style: TextStyle(
            fontSize: 13,
            height: 1.4,
            color: FregoColors.neutral500,
          ),
        ),
        _LegalTextButton(
          label: 'Termos de Uso',
          onPressed: () => openLegalUrl(context, AppConfig.termsOfUseUrl),
        ),
        const Text(
          '.',
          style: TextStyle(
            fontSize: 13,
            height: 1.4,
            color: FregoColors.neutral500,
          ),
        ),
      ],
    );
  }
}

class _LegalTextButton extends StatelessWidget {
  const _LegalTextButton({
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Semantics(
        button: true,
        label: label,
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 13,
            height: 1.4,
            fontWeight: FontWeight.w600,
            color: FregoColors.ink,
          ),
        ),
      ),
    );
  }
}
