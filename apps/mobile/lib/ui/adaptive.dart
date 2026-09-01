import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/frego_theme.dart';

/// Preferência de UI nativa: Cupertino no iOS/macOS, Material no Android/web.
abstract final class FregoAdaptive {
  static bool useCupertino([BuildContext? context]) {
    if (kIsWeb) return false;
    final platform = context != null
        ? Theme.of(context).platform
        : defaultTargetPlatform;
    return platform == TargetPlatform.iOS || platform == TargetPlatform.macOS;
  }

  static Future<T?> push<T>(BuildContext context, Widget page) {
    if (useCupertino(context)) {
      return Navigator.of(context).push<T>(
        CupertinoPageRoute<T>(builder: (_) => page),
      );
    }
    return Navigator.of(context).push<T>(
      MaterialPageRoute<T>(builder: (_) => page),
    );
  }

  static Future<T?> pushAndRemoveUntil<T>(
    BuildContext context,
    Widget page, {
    bool rootNavigator = false,
  }) {
    final route = useCupertino(context)
        ? CupertinoPageRoute<T>(builder: (_) => page)
        : MaterialPageRoute<T>(builder: (_) => page);
    return Navigator.of(context, rootNavigator: rootNavigator)
        .pushAndRemoveUntil<T>(route, (_) => false);
  }

  static void showMessage(BuildContext context, String message) {
    if (useCupertino(context)) {
      showCupertinoDialog<void>(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          content: Text(message),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  static Future<DateTime?> pickDate(
    BuildContext context, {
    required DateTime initialDate,
    required DateTime firstDate,
    required DateTime lastDate,
  }) async {
    if (useCupertino(context)) {
      DateTime temp = initialDate;
      return showCupertinoModalPopup<DateTime>(
        context: context,
        builder: (ctx) => Container(
          height: 280,
          color: CupertinoColors.systemBackground.resolveFrom(ctx),
          child: Column(
            children: [
              SizedBox(
                height: 44,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    CupertinoButton(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: const Text('Cancelar'),
                    ),
                    CupertinoButton(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      onPressed: () => Navigator.of(ctx).pop(temp),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              ),
              Expanded(
                child: CupertinoDatePicker(
                  mode: CupertinoDatePickerMode.date,
                  initialDateTime: initialDate,
                  minimumDate: firstDate,
                  maximumDate: lastDate,
                  onDateTimeChanged: (d) => temp = d,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return showDatePicker(
      context: context,
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      helpText: 'Data de nascimento',
      cancelText: 'Cancelar',
      confirmText: 'OK',
      locale: const Locale('pt', 'BR'),
    );
  }
}

class FregoPage extends StatelessWidget {
  const FregoPage({
    super.key,
    required this.child,
    this.title,
    this.leading,
    this.trailing,
    this.showNavBar = false,
    this.backgroundColor,
  });

  final Widget child;
  final String? title;
  final Widget? leading;
  final Widget? trailing;
  final bool showNavBar;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? FregoColors.neutralBg;
    if (FregoAdaptive.useCupertino(context)) {
      final navStyle = CupertinoTheme.of(context).textTheme.navTitleTextStyle;
      return CupertinoPageScaffold(
        backgroundColor: bg,
        navigationBar: showNavBar || title != null || leading != null
            ? CupertinoNavigationBar(
                backgroundColor: bg.withValues(alpha: 0.92),
                border: const Border(
                  bottom: BorderSide(color: FregoColors.hairline, width: 0.5),
                ),
                middle: title != null
                    ? Text(title!, style: navStyle)
                    : null,
                leading: leading,
                trailing: trailing,
              )
            : null,
        child: SafeArea(child: child),
      );
    }

    return Scaffold(
      backgroundColor: bg,
      appBar: showNavBar || title != null || leading != null
          ? AppBar(
              title: title != null ? Text(title!) : null,
              leading: leading,
              actions: trailing != null ? [trailing!] : null,
              backgroundColor: bg,
              foregroundColor: FregoColors.ink,
              elevation: 0,
              surfaceTintColor: Colors.transparent,
            )
          : null,
      body: SafeArea(child: child),
    );
  }
}

class FregoProgress extends StatelessWidget {
  const FregoProgress({super.key});

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      return const CupertinoActivityIndicator(radius: 14);
    }
    return const CircularProgressIndicator();
  }
}

class FregoPrimaryButton extends StatelessWidget {
  const FregoPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.expanded = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      final button = CupertinoButton.filled(
        onPressed: onPressed,
        borderRadius: BorderRadius.circular(FregoRadius.sm),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            inherit: false,
            color: FregoColors.onPrimary,
            decoration: TextDecoration.none,
          ),
        ),
      );
      return expanded ? SizedBox(width: double.infinity, child: button) : button;
    }

    final button = FilledButton(
      onPressed: onPressed,
      child: Text(label),
    );
    return expanded ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class FregoSecondaryButton extends StatelessWidget {
  const FregoSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.expanded = true,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      final child = icon == null
          ? Text(label)
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18),
                const SizedBox(width: 8),
                Text(label),
              ],
            );
      final button = CupertinoButton(
        onPressed: onPressed,
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(FregoRadius.sm),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        child: DefaultTextStyle(
          style: const TextStyle(
            color: FregoColors.primary500,
            fontSize: 14,
            fontWeight: FontWeight.w800,
            decoration: TextDecoration.none,
            inherit: false,
          ),
          child: child,
        ),
      );
      return expanded ? SizedBox(width: double.infinity, child: button) : button;
    }

    final button = icon == null
        ? OutlinedButton(onPressed: onPressed, child: Text(label))
        : OutlinedButton.icon(
            onPressed: onPressed,
            icon: Icon(icon),
            label: Text(label),
          );
    return expanded ? SizedBox(width: double.infinity, child: button) : button;
  }
}

class FregoTextField extends StatelessWidget {
  const FregoTextField({
    super.key,
    required this.controller,
    this.placeholder,
    this.label,
    this.errorText,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.autofocus = false,
    this.enabled = true,
    this.maxLength,
    this.textAlign = TextAlign.start,
    this.focusNode,
    this.inputFormatters,
    this.onChanged,
    this.onSubmitted,
    this.obscureText = false,
    this.readOnly = false,
    this.style,
  });

  final TextEditingController controller;
  final String? placeholder;
  final String? label;
  final String? errorText;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final bool autofocus;
  final bool enabled;
  final int? maxLength;
  final TextAlign textAlign;
  final FocusNode? focusNode;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool obscureText;
  final bool readOnly;
  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    if (FregoAdaptive.useCupertino(context)) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (label != null) ...[
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 6),
              child: Text(
                label!,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.96,
                  color: FregoColors.neutral500,
                ),
              ),
            ),
          ],
          CupertinoTextField(
            controller: controller,
            focusNode: focusNode,
            placeholder: placeholder,
            keyboardType: keyboardType,
            textCapitalization: textCapitalization,
            autofocus: autofocus,
            enabled: enabled,
            maxLength: maxLength,
            textAlign: textAlign,
            obscureText: obscureText,
            readOnly: readOnly,
            inputFormatters: inputFormatters,
            onChanged: onChanged,
            onSubmitted: onSubmitted,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            style: style ??
                const TextStyle(
                  fontSize: 17,
                  color: FregoColors.ink,
                ),
            placeholderStyle: const TextStyle(
              fontSize: 17,
              color: FregoColors.neutral400,
            ),
            decoration: BoxDecoration(
              color: enabled ? FregoColors.card : FregoColors.neutral100,
              borderRadius: BorderRadius.circular(FregoRadius.sm),
              border: Border.all(
                color: errorText != null
                    ? FregoColors.danger
                    : FregoColors.control,
              ),
            ),
          ),
          if (errorText != null) ...[
            const SizedBox(height: 6),
            Text(
              errorText!,
              style: const TextStyle(
                color: FregoColors.danger,
                fontSize: 13,
              ),
            ),
          ],
        ],
      );
    }

    return TextField(
      controller: controller,
      focusNode: focusNode,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      autofocus: autofocus,
      enabled: enabled,
      maxLength: maxLength,
      textAlign: textAlign,
      obscureText: obscureText,
      readOnly: readOnly,
      inputFormatters: inputFormatters,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      style: style ??
          const TextStyle(
            fontSize: 17,
            color: FregoColors.ink,
          ),
      decoration: InputDecoration(
        labelText: label,
        hintText: placeholder,
        errorText: errorText,
        counterText: maxLength != null ? '' : null,
        filled: true,
        fillColor: enabled ? FregoColors.card : FregoColors.neutral100,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
    );
  }
}
