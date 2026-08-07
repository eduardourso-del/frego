import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Design tokens from packages/tokens — keep in sync with CSS variables.
abstract final class FregoColors {
  static const primary50 = Color(0xFFEEF1FD);
  static const primary200 = Color(0xFFC7D2F7);
  static const primary500 = Color(0xFF3B5BDB);
  static const primary600 = Color(0xFF2F49C4);
  static const primary800 = Color(0xFF1E2F8A);

  static const neutralBg = Color(0xFFF7F8FA);
  static const neutral100 = Color(0xFFF1F3F6);
  static const neutral200 = Color(0xFFE4E7EC);
  static const hairline = Color(0xFFEEF0F3);
  static const neutral400 = Color(0xFF9AA0AA);
  static const neutral500 = Color(0xFF6B7280);
  static const neutral700 = Color(0xFF3F444F);
  static const ink = Color(0xFF16181D);
  static const card = Color(0xFFFFFFFF);

  static const success = Color(0xFF1F9D6B);
  static const danger = Color(0xFFDF4138);

  static const darkBg = Color(0xFF0C0D10);
  static const darkCard = Color(0xFF15171C);
  static const darkRaised = Color(0xFF1D2026);
  static const darkBorder = Color(0xFF2A2E37);
  static const darkPrimary = Color(0xFF5B78E8);
  static const darkText = Color(0xFFE8EAED);
}

abstract final class FregoTheme {
  static TextTheme _soften(TextTheme theme) {
    TextStyle? soft(TextStyle? style, {FontWeight weight = FontWeight.w500}) {
      if (style == null) return null;
      return style.copyWith(
        fontWeight: weight,
        decoration: TextDecoration.none,
      );
    }

    return theme.copyWith(
      displayLarge: soft(theme.displayLarge, weight: FontWeight.w600),
      displayMedium: soft(theme.displayMedium, weight: FontWeight.w600),
      displaySmall: soft(theme.displaySmall, weight: FontWeight.w600),
      headlineLarge: soft(theme.headlineLarge, weight: FontWeight.w600),
      headlineMedium: soft(theme.headlineMedium, weight: FontWeight.w600),
      headlineSmall: soft(theme.headlineSmall, weight: FontWeight.w600),
      titleLarge: soft(theme.titleLarge, weight: FontWeight.w600),
      titleMedium: soft(theme.titleMedium, weight: FontWeight.w500),
      titleSmall: soft(theme.titleSmall, weight: FontWeight.w500),
      bodyLarge: soft(theme.bodyLarge, weight: FontWeight.w400),
      bodyMedium: soft(theme.bodyMedium, weight: FontWeight.w400),
      bodySmall: soft(theme.bodySmall, weight: FontWeight.w400),
      labelLarge: soft(theme.labelLarge, weight: FontWeight.w500),
      labelMedium: soft(theme.labelMedium, weight: FontWeight.w500),
      labelSmall: soft(theme.labelSmall, weight: FontWeight.w500),
    );
  }

  static ThemeData light({bool forWeb = false}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: FregoColors.primary500,
      brightness: Brightness.light,
      primary: FregoColors.primary500,
      surface: FregoColors.neutralBg,
      onSurface: FregoColors.ink,
      onPrimary: Colors.white,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: FregoColors.neutralBg,
      canvasColor: FregoColors.neutralBg,
    );

    // Plus Jakarta Sans — lighter than SF Pro Bold defaults.
    final textTheme = _soften(
      GoogleFonts.plusJakartaSansTextTheme(base.textTheme).apply(
        bodyColor: FregoColors.ink,
        displayColor: FregoColors.ink,
      ),
    );

    return base.copyWith(
      textTheme: textTheme,
      primaryTextTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: FregoColors.neutralBg,
        foregroundColor: FregoColors.ink,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.plusJakartaSans(
          fontSize: 17,
          fontWeight: FontWeight.w600,
          color: FregoColors.ink,
          decoration: TextDecoration.none,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: FregoColors.card,
        indicatorColor: FregoColors.primary50,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? FregoColors.primary500 : FregoColors.neutral500,
            decoration: TextDecoration.none,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? FregoColors.primary500 : FregoColors.neutral500,
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: FregoColors.card,
        hintStyle: GoogleFonts.plusJakartaSans(color: FregoColors.neutral400),
        labelStyle: GoogleFonts.plusJakartaSans(color: FregoColors.neutral500),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: FregoColors.neutral200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: FregoColors.neutral200),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(
            color: FregoColors.primary500,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: FregoColors.danger),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(44, 44),
          backgroundColor: FregoColors.primary500,
          foregroundColor: Colors.white,
          disabledBackgroundColor: FregoColors.primary200,
          disabledForegroundColor: Colors.white70,
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: FregoColors.ink,
          side: const BorderSide(color: FregoColors.neutral200),
          textStyle: GoogleFonts.plusJakartaSans(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: FregoColors.primary500,
        selectionColor: FregoColors.primary200,
        selectionHandleColor: FregoColors.primary500,
      ),
    );
  }

  static ThemeData dark() {
    // Kept for future; app currently forces light.
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: FregoColors.darkBg,
      colorScheme: const ColorScheme.dark(
        primary: FregoColors.darkPrimary,
        surface: FregoColors.darkBg,
        onSurface: FregoColors.darkText,
      ),
    );
  }

  static CupertinoThemeData cupertino(Brightness brightness) {
    final base = GoogleFonts.plusJakartaSans(
      color: FregoColors.ink,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      decoration: TextDecoration.none,
    );
    return CupertinoThemeData(
      brightness: Brightness.light,
      primaryColor: FregoColors.primary500,
      scaffoldBackgroundColor: FregoColors.neutralBg,
      barBackgroundColor: FregoColors.card,
      textTheme: CupertinoTextThemeData(
        primaryColor: FregoColors.ink,
        textStyle: base,
        navTitleTextStyle: base.copyWith(
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
        navLargeTitleTextStyle: base.copyWith(
          fontSize: 28,
          fontWeight: FontWeight.w600,
          letterSpacing: -0.4,
        ),
        actionTextStyle: base.copyWith(
          color: FregoColors.primary500,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
