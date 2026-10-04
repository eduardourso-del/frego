import 'package:flutter/painting.dart';

/// Design tokens from packages/tokens — keep in sync with tokens.json / css/tokens.css.
/// Mostarda ([primary500]) is an action fill. Text and icons on Papel use [ink].
abstract final class FregoColors {
  static const papel = Color(0xFFF4EFE6);
  static const grafite = Color(0xFF070707);
  static const mostarda = Color(0xFFFFD900);
  static const azul = Color(0xFF0073C8);
  static const white = Color(0xFFFFFFFF);

  static const primary50 = Color(0xFFFFF6C2);
  static const primary100 = Color(0xFFFFEE8A);
  static const primary200 = Color(0xFFF6E27A);
  static const primary500 = mostarda;
  static const primary600 = Color(0xFFE0BE00);
  static const primary800 = grafite;
  static const onPrimary = grafite;

  static const neutralBg = papel;
  static const neutral100 = Color(0xFFEAE4DA);
  static const neutral200 = Color(0xFFD8D1C6);
  static const hairline = Color(0xFFD8D1C6);
  static const control = Color(0xFF82796E);
  static const neutral400 = Color(0xFF82796E);
  static const neutral500 = Color(0xFF5C544A);
  static const neutral700 = Color(0xFF3F3832);
  static const ink = grafite;
  static const card = Color(0xFFFFFCF7);

  static const success = Color(0xFF386143);
  static const successBg = Color(0xFFE8EFE7);
  static const successFill = Color(0xFF386143);
  static const danger = Color(0xFF963D22);
  static const dangerBg = Color(0xFFF8EBE5);
  static const dangerFill = Color(0xFF963D22);
  static const info = Color(0xFF3F505C);
  static const infoBg = Color(0xFFE8EDF0);

  static const stamps = Color(0xFF5C3D86);
  static const stampsBg = Color(0xFFF3EEF8);
  static const stampsRing = Color(0xFFDDD0EC);
  static const points = Color(0xFF8C4A12);
  static const pointsBg = Color(0xFFF8F1E6);
  static const pointsRing = Color(0xFFE6D3B0);
  static const cashback = Color(0xFF1B5E52);
  static const cashbackBg = Color(0xFFE7F3F0);
  static const cashbackRing = Color(0xFFC5DDD6);
  static const promo = Color(0xFF6E3A55);
  static const promoBg = Color(0xFFF7EEF2);
  static const promoRing = Color(0xFFE4CFD8);
}

abstract final class FregoSpace {
  static const xs = 8.0;
  static const sm = 16.0;
  static const md = 24.0;
  static const lg = 32.0;
  static const xl = 48.0;
  static const xxl = 64.0;
  static const xxxl = 96.0;
}

abstract final class FregoRadius {
  static const sm = 8.0;
  static const md = 8.0;
  static const lg = 16.0;
  static const xl = 16.0;
  static const pill = 999.0;
}

abstract final class FregoTouch {
  static const minTarget = 44.0;
}

abstract final class FregoType {
  static const displaySize = 40.0;
  static const titleSize = 32.0;
  static const sectionSize = 24.0;
  static const subSize = 18.0;
  static const bodySize = 16.0;
  static const supportSize = 14.0;
  static const labelSize = 12.0;
  static const numberSize = 32.0;
  static const numberSmSize = 20.0;
}
