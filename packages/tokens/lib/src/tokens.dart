import 'package:flutter/painting.dart';

/// Design tokens from packages/tokens — keep in sync with tokens.json / css/tokens.css.
abstract final class FregoColors {
  static const primary50 = Color(0xFFEEF2FB);
  static const primary100 = Color(0xFFDCE4F7);
  static const primary200 = Color(0xFFB4C4EA);
  static const primary500 = Color(0xFF24479C);
  static const primary600 = Color(0xFF1B3781);
  static const primary800 = Color(0xFF101F45);
  static const onPrimary = Color(0xFFFFFFFF);

  static const neutralBg = Color(0xFFF7F8FA);
  static const neutral100 = Color(0xFFF1F3F6);
  static const neutral200 = Color(0xFFE4E7EC);
  static const hairline = Color(0xFFE4E8EE);
  static const control = Color(0xFF868C96);
  static const neutral400 = Color(0xFF98A0AB);
  static const neutral500 = Color(0xFF5F6672);
  static const neutral700 = Color(0xFF3F444F);
  static const ink = Color(0xFF16181D);
  static const card = Color(0xFFFFFFFF);

  static const success = Color(0xFF12805A);
  static const successBg = Color(0xFFE6F6EE);
  static const successFill = Color(0xFF2BB37E);
  static const danger = Color(0xFFC4342A);
  static const dangerBg = Color(0xFFFDECEB);
  static const dangerFill = Color(0xFFDF4138);
  static const info = Color(0xFF24479C);
  static const infoBg = Color(0xFFEEF2FB);

  static const stamps = Color(0xFF6D28D9);
  static const stampsBg = Color(0xFFF5F3FF);
  static const stampsRing = Color(0xFFDDD6FE);
  static const points = Color(0xFFB45309);
  static const pointsBg = Color(0xFFFFFBEB);
  static const pointsRing = Color(0xFFFDE68A);
  static const cashback = Color(0xFF0F766E);
  static const cashbackBg = Color(0xFFF0FDFA);
  static const cashbackRing = Color(0xFF99F6E4);
  static const promo = Color(0xFF0369A1);
  static const promoBg = Color(0xFFF0F9FF);
  static const promoRing = Color(0xFFBAE6FD);

  static const darkBg = Color(0xFF0C0D10);
  static const darkCard = Color(0xFF15171C);
  static const darkRaised = Color(0xFF1D2026);
  static const darkBorder = Color(0xFF2A2E37);
  static const darkPrimary = Color(0xFF5C82DE);
  static const darkOnPrimary = Color(0xFF0C0D10);
  static const darkText = Color(0xFFE8EAED);
  static const darkTextDim = Color(0xFF9AA0AA);
  static const darkControl = Color(0xFF666D78);
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
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 20.0;
  static const pill = 100.0;
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
