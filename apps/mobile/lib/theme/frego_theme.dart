import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:frego_tokens/frego_tokens.dart';
import 'package:google_fonts/google_fonts.dart';

export 'package:frego_tokens/frego_tokens.dart';

/// Theme built on [frego_tokens]. Swap tokens there — this file stays.
abstract final class FregoTheme {
  /// Black status-bar glyphs on Papel. iOS reads [statusBarBrightness];
  /// Android reads [statusBarIconBrightness].
  static const SystemUiOverlayStyle statusBar = SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    statusBarBrightness: Brightness.light,
    systemStatusBarContrastEnforced: false,
  );

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
      seedColor: FregoColors.ink,
      brightness: Brightness.light,
      primary: FregoColors.ink,
      onPrimary: FregoColors.card,
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
      GoogleFonts.instrumentSansTextTheme(base.textTheme).apply(
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
        systemOverlayStyle: statusBar,
        elevation: 0,
        centerTitle: false,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: GoogleFonts.instrumentSans(
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
          return GoogleFonts.instrumentSans(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected ? FregoColors.ink : FregoColors.neutral500,
            decoration: TextDecoration.none,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? FregoColors.ink : FregoColors.neutral500,
          );
        }),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: FregoColors.card,
        hintStyle: GoogleFonts.instrumentSans(color: FregoColors.neutral400),
        labelStyle: GoogleFonts.instrumentSans(color: FregoColors.neutral500),
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
            color: FregoColors.ink,
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
          textStyle: GoogleFonts.instrumentSans(
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
          foregroundColor: FregoColors.ink,
          side: const BorderSide(color: FregoColors.control),
          textStyle: GoogleFonts.instrumentSans(
            fontSize: 14,
            fontWeight: FontWeight.w800,
          ),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(FregoRadius.sm),
          ),
        ),
      ),
      textSelectionTheme: const TextSelectionThemeData(
        cursorColor: FregoColors.ink,
        selectionColor: FregoColors.primary200,
        selectionHandleColor: FregoColors.ink,
      ),
    );
  }

  static ThemeData dark() => light();

  static CupertinoThemeData cupertino(Brightness brightness) {
    final base = GoogleFonts.instrumentSans(
      color: FregoColors.ink,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      decoration: TextDecoration.none,
    ).copyWith(inherit: false);
    final action = base.copyWith(
      color: FregoColors.ink,
      fontWeight: FontWeight.w600,
      fontSize: 17,
    );
    return CupertinoThemeData(
      brightness: Brightness.light,
      primaryColor: FregoColors.ink,
      primaryContrastingColor: FregoColors.onPrimary,
      scaffoldBackgroundColor: FregoColors.neutralBg,
      barBackgroundColor: FregoColors.card,
      textTheme: CupertinoTextThemeData(
        primaryColor: FregoColors.ink,
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
