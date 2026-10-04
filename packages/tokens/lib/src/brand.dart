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

/// Splash while Flutter is booting.
/// [fregues] frames the mark in Céu Azul with the Mostarda logo.
/// Lojista stays on Papel with the Grafite logo.
class FregoSplash extends StatelessWidget {
  const FregoSplash({super.key, this.wordmarkHeight = 78, this.fregues = false});

  final double wordmarkHeight;
  final bool fregues;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: fregues ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      child: ColoredBox(
        color: fregues ? FregoColors.azul : FregoColors.papel,
        child: Center(
          child: FregoWordmark(height: wordmarkHeight, negative: fregues),
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
