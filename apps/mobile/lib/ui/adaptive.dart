import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/frego_icons.dart';
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

  /// GA4 screen name from the widget type (`ShopDetailPage` → `shop_detail`).
  static String routeNameOf(Widget page) {
    final type = page.runtimeType.toString();
    final base = type.endsWith('Page')
        ? type.substring(0, type.length - 4)
        : type;
    return base.replaceAllMapped(RegExp(r'[A-Z]'), (m) {
      final letter = m.group(0)!.toLowerCase();
      return m.start == 0 ? letter : '_$letter';
    });
  }

  static RouteSettings _settingsFor(Widget page) {
    return RouteSettings(name: routeNameOf(page));
  }

  static Future<T?> push<T>(
    BuildContext context,
    Widget page, {
    bool rootNavigator = false,
  }) {
    final settings = _settingsFor(page);
    if (useCupertino(context)) {
      return Navigator.of(context, rootNavigator: rootNavigator).push<T>(
        CupertinoPageRoute<T>(builder: (_) => page, settings: settings),
      );
    }
    return Navigator.of(context, rootNavigator: rootNavigator).push<T>(
      MaterialPageRoute<T>(builder: (_) => page, settings: settings),
    );
  }

  static Future<T?> pushAndRemoveUntil<T>(
    BuildContext context,
    Widget page, {
    bool rootNavigator = false,
  }) {
    final settings = _settingsFor(page);
    final route = useCupertino(context)
        ? CupertinoPageRoute<T>(builder: (_) => page, settings: settings)
        : MaterialPageRoute<T>(builder: (_) => page, settings: settings);
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

  static Future<bool> confirm(
    BuildContext context, {
    required String title,
    required String message,
    String confirmLabel = 'Confirmar',
    String cancelLabel = 'Cancelar',
    bool isDestructive = false,
  }) async {
    if (useCupertino(context)) {
      final ok = await showCupertinoDialog<bool>(
        context: context,
        builder: (ctx) => CupertinoAlertDialog(
          title: Text(title),
          content: Text(message),
          actions: [
            CupertinoDialogAction(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(cancelLabel),
            ),
            CupertinoDialogAction(
              isDestructiveAction: isDestructive,
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(confirmLabel),
            ),
          ],
        ),
      );
      return ok ?? false;
    }

    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(cancelLabel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: isDestructive
                ? TextButton.styleFrom(foregroundColor: FregoColors.danger)
                : null,
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    return ok ?? false;
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
    final showBar = showNavBar || title != null || leading != null;
    if (FregoAdaptive.useCupertino(context)) {
      return CupertinoPageScaffold(
        backgroundColor: bg,
        child: Column(
          children: [
            if (showBar)
              _FregoStickyNavBar(
                leading: leading,
                trailing: trailing,
                backgroundColor: bg,
              ),
            Expanded(
              child: _FregoInsetBody(ownTop: !showBar, child: child),
            ),
          ],
        ),
      );
    }

    return Scaffold(
      backgroundColor: bg,
      appBar: showBar
          ? AppBar(
              leading: leading,
              actions: trailing != null ? [trailing!] : null,
              backgroundColor: bg,
              foregroundColor: FregoColors.ink,
              elevation: 0,
              surfaceTintColor: Colors.transparent,
            )
          : null,
      body: SafeArea(top: !showBar, child: child),
    );
  }
}

/// Tab-root page with a sticky, left-aligned title.
///
/// Pass content as [slivers]. Do not wrap them in [SafeArea] — the sticky
/// bar owns the top inset and the tab scaffold owns the bottom.
class FregoLargeTitlePage extends StatelessWidget {
  const FregoLargeTitlePage({
    super.key,
    required this.title,
    required this.slivers,
    this.trailing,
    this.leading,
    this.onRefresh,
    this.backgroundColor,
  });

  /// Horizontal inset aligned with the sticky nav bar title.
  static const double gutter = 16;

  final String title;
  final List<Widget> slivers;
  final Widget? trailing;
  final Widget? leading;
  final Future<void> Function()? onRefresh;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? FregoColors.neutralBg;
    if (FregoAdaptive.useCupertino(context)) {
      // Translucent tab bars inflate [MediaQuery.padding.bottom] to cover
      // themselves; opaque bars consume it and pad the scaffold instead.
      // Using padding (not padding + bar height) avoids a double gap.
      final bottomClearance = MediaQuery.paddingOf(context).bottom;
      return CupertinoPageScaffold(
        backgroundColor: bg,
        child: Column(
          children: [
            _FregoStickyNavBar(
              title: title,
              leading: leading,
              trailing: trailing,
              backgroundColor: bg,
              automaticallyImplyLeading: false,
              largeTitle: true,
            ),
            Expanded(
              child: MediaQuery.removePadding(
                context: context,
                removeTop: true,
                child: CustomScrollView(
                  physics: const AlwaysScrollableScrollPhysics(
                    parent: BouncingScrollPhysics(),
                  ),
                  slivers: [
                    if (onRefresh != null)
                      CupertinoSliverRefreshControl(onRefresh: onRefresh!),
                    ...slivers,
                    if (bottomClearance > 0)
                      SliverToBoxAdapter(
                        child: SizedBox(height: bottomClearance),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    final scroll = CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: slivers,
    );
    return Scaffold(
      backgroundColor: bg,
      appBar: AppBar(
        title: Text(title),
        leading: leading,
        automaticallyImplyLeading: false,
        actions: trailing != null ? [trailing!] : null,
        backgroundColor: bg,
        foregroundColor: FregoColors.ink,
        elevation: 0,
        toolbarHeight: 64,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontSize: 34,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.4,
              color: FregoColors.ink,
            ),
      ),
      body: SafeArea(
        top: false,
        child: onRefresh != null
            ? RefreshIndicator(onRefresh: onRefresh!, child: scroll)
            : scroll,
      ),
    );
  }
}

/// Sticky top bar: status-bar inset, left-aligned title, no overlay padding.
class _FregoStickyNavBar extends StatelessWidget {
  const _FregoStickyNavBar({
    this.title,
    this.leading,
    this.trailing,
    this.backgroundColor,
    this.automaticallyImplyLeading = true,
    this.largeTitle = false,
  });

  final String? title;
  final Widget? leading;
  final Widget? trailing;
  final Color? backgroundColor;
  final bool automaticallyImplyLeading;
  final bool largeTitle;

  @override
  Widget build(BuildContext context) {
    final bg = backgroundColor ?? FregoColors.neutralBg;
    final theme = CupertinoTheme.of(context).textTheme;
    final navStyle = largeTitle
        ? theme.navLargeTitleTextStyle
        : theme.navTitleTextStyle;
    final implyLeading = automaticallyImplyLeading &&
        leading == null &&
        ModalRoute.of(context)?.canPop == true;
    final leadingWidget = leading ??
        (implyLeading
            ? CupertinoButton(
                padding: EdgeInsets.zero,
                minimumSize: const Size(
                  FregoTouch.minTarget,
                  FregoTouch.minTarget,
                ),
                onPressed: () => Navigator.of(context).maybePop(),
                child: const Icon(FregoIcons.back),
              )
            : null);

    return ColoredBox(
      color: bg,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SafeArea(
            bottom: false,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: largeTitle ? 56 : FregoTouch.minTarget,
              ),
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  leadingWidget == null ? FregoLargeTitlePage.gutter : 4,
                  largeTitle ? 8 : 0,
                  trailing == null ? FregoLargeTitlePage.gutter : 4,
                  largeTitle ? 8 : 0,
                ),
                child: Row(
                  children: [
                    ?leadingWidget,
                    Expanded(
                      child: title == null
                          ? const SizedBox.shrink()
                          : Padding(
                              padding: EdgeInsets.only(
                                left: leadingWidget == null ? 0 : 4,
                                right: trailing == null ? 0 : 8,
                              ),
                              child: Text(
                                title!,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                textAlign: TextAlign.start,
                                style: navStyle,
                              ),
                            ),
                    ),
                    ?trailing,
                  ],
                ),
              ),
            ),
          ),
          const ColoredBox(
            color: FregoColors.hairline,
            child: SizedBox(height: 0.5, width: double.infinity),
          ),
        ],
      ),
    );
  }
}

/// Applies bottom (and optional top) safe area without double-counting a
/// sibling sticky bar. Also strips consumed padding so nested scroll views
/// do not add the status bar / home indicator again.
class _FregoInsetBody extends StatelessWidget {
  const _FregoInsetBody({required this.ownTop, required this.child});

  final bool ownTop;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return MediaQuery.removePadding(
      context: context,
      removeTop: !ownTop,
      child: SafeArea(top: ownTop, child: child),
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
    this.autofillHints,
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
  final Iterable<String>? autofillHints;

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
            autofillHints: autofillHints,
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
                height: 1.35,
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
      autofillHints: autofillHints,
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
