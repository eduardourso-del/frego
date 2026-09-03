import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:frego_tokens/frego_tokens.dart';
import 'package:google_fonts/google_fonts.dart';

export 'package:frego_tokens/frego_tokens.dart';

/// Theme built on [frego_tokens]. Swap tokens there — this file stays.
abstract final class FregoTheme {
  static TextTheme _scale(TextTheme theme) {
    TextStyle? t(
      TextStyle? style, {
      required FontWeight weight,
      double? letterSpacing,
    }) {
      if (style == null) return null;
      return style.copyWith(
        fontWeight: weight,
        letterSpacing: letterSpacing,
        decoration: TextDecoration.none,
      );
    }

    return theme.copyWith(
      displayLarge: t(theme.displayLarge, weight: FontWeight.w800, letterSpacing: -1.2),
      displayMedium: t(theme.displayMedium, weight: FontWeight.w800, letterSpacing: -0.8),
      displaySmall: t(theme.displaySmall, weight: FontWeight.w800, letterSpacing: -0.5),
      headlineLarge: t(theme.headlineLarge, weight: FontWeight.w800, letterSpacing: -0.4),
      headlineMedium: t(theme.headlineMedium, weight: FontWeight.w800, letterSpacing: -0.3),
      headlineSmall: t(theme.headlineSmall, weight: FontWeight.w800),
      titleLarge: t(theme.titleLarge, weight: FontWeight.w800, letterSpacing: -0.2),
      titleMedium: t(theme.titleMedium, weight: FontWeight.w600),
      titleSmall: t(theme.titleSmall, weight: FontWeight.w600),
      bodyLarge: t(theme.bodyLarge, weight: FontWeight.w400),
      bodyMedium: t(theme.bodyMedium, weight: FontWeight.w400),
      bodySmall: t(theme.bodySmall, weight: FontWeight.w400),
      labelLarge: t(theme.labelLarge, weight: FontWeight.w800, letterSpacing: 0.14),
      labelMedium: t(theme.labelMedium, weight: FontWeight.w600, letterSpacing: 0.96),
      labelSmall: t(theme.labelSmall, weight: FontWeight.w600, letterSpacing: 0.96),
    );
  }

  static ThemeData light({bool forWeb = false}) {
    final colorScheme = ColorScheme.fromSeed(
      seedColor: FregoColors.primary500,
      brightness: Brightness.light,
      primary: FregoColors.primary500,
      onPrimary: FregoColors.onPrimary,
      surface: FregoColors.neutralBg,
      onSurface: FregoColors.ink,
    );

    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: FregoColors.neutralBg,
      canvasColor: FregoColors.neutralBg,
    );

    final textTheme = _scale(
      GoogleFonts.archivoTextTheme(base.textTheme).apply(
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
        titleTextStyle: GoogleFonts.archivo(
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
          return GoogleFonts.archivo(
            fontSize: 12,
            fontWeight: FontWeight.w600,
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
        hintStyle: GoogleFonts.archivo(color: FregoColors.neutral400),
        labelStyle: GoogleFonts.archivo(color: FregoColors.neutral500),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(FregoRadius.sm),
          borderSide: const BorderSide(color: FregoColors.control),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(FregoRadius.sm),
          borderSide: const BorderSide(color: FregoColors.control),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(FregoRadius.sm),
          borderSide: const BorderSide(
            color: FregoColors.primary500,
            width: 1.5,
          ),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(FregoRadius.sm),
          borderSide: const BorderSide(color: FregoColors.danger),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(FregoTouch.minTarget, FregoTouch.minTarget),
          backgroundColor: FregoColors.primary500,
          foregroundColor: FregoColors.onPrimary,
          disabledBackgroundColor: FregoColors.neutral100,
          disabledForegroundColor: FregoColors.neutral400,
          textStyle: GoogleFonts.archivo(
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(FregoRadius.sm),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(FregoTouch.minTarget, FregoTouch.minTarget),
          foregroundColor: FregoColors.primary500,
          side: const BorderSide(color: FregoColors.control),
          textStyle: GoogleFonts.archivo(
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(FregoRadius.sm),
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
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: FregoColors.darkBg,
      colorScheme: const ColorScheme.dark(
        primary: FregoColors.darkPrimary,
        onPrimary: FregoColors.darkOnPrimary,
        surface: FregoColors.darkBg,
        onSurface: FregoColors.darkText,
      ),
    );
  }

  static CupertinoThemeData cupertino(Brightness brightness) {
    final base = GoogleFonts.archivo(
      color: FregoColors.ink,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      decoration: TextDecoration.none,
    ).copyWith(inherit: false);
    final action = base.copyWith(
      color: FregoColors.primary500,
      fontWeight: FontWeight.w600,
      fontSize: 17,
    );
    return CupertinoThemeData(
      brightness: Brightness.light,
      primaryColor: FregoColors.primary500,
      primaryContrastingColor: FregoColors.onPrimary,
      scaffoldBackgroundColor: FregoColors.neutralBg,
      barBackgroundColor: FregoColors.card,
      textTheme: CupertinoTextThemeData(
        primaryColor: FregoColors.primary500,
        textStyle: base,
        actionTextStyle: action,
        actionSmallTextStyle: action.copyWith(fontSize: 14),
        navActionTextStyle: action,
        navTitleTextStyle: base.copyWith(
          fontSize: 17,
          fontWeight: FontWeight.w600,
        ),
        navLargeTitleTextStyle: base.copyWith(
          fontSize: 34,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.4,
        ),
        tabLabelTextStyle: base.copyWith(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: FregoColors.neutral500,
        ),
        pickerTextStyle: base.copyWith(fontSize: 21),
        dateTimePickerTextStyle: base.copyWith(fontSize: 21),
      ),
    );
  }
}
