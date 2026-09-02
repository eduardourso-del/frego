import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'assets.dart';
import 'tokens.dart';

/// Wordmark (assinatura). Minimum ~72 logical px wide on screen.
class FregoWordmark extends StatelessWidget {
  const FregoWordmark({
    super.key,
    this.height = 22,
    this.negative = false,
    this.mono = false,
  });

  final double height;
  final bool negative;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final asset = negative
        ? (mono ? FregoAssets.assinaturaMonoClara : FregoAssets.assinaturaNegativa)
        : (mono ? FregoAssets.assinaturaMonoEscura : FregoAssets.assinatura);
    return SvgPicture.asset(
      asset,
      height: height,
      fit: BoxFit.contain,
      semanticsLabel: 'Frego',
    );
  }
}

/// Matches the native light splash while Flutter is still booting.
class FregoSplash extends StatelessWidget {
  const FregoSplash({super.key, this.wordmarkHeight = 78});

  final double wordmarkHeight;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: ColoredBox(
        color: FregoColors.neutralBg,
        child: Center(
          child: FregoWordmark(height: wordmarkHeight),
        ),
      ),
    );
  }
}

/// App mark (anel). Use 20+ logical px.
class FregoMark extends StatelessWidget {
  const FregoMark({
    super.key,
    this.size = 28,
    this.negative = false,
  });

  final double size;
  final bool negative;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      negative ? FregoAssets.iconeNegativo : FregoAssets.icone,
      width: size,
      height: size,
      fit: BoxFit.contain,
      semanticsLabel: 'Frego',
    );
  }
}
