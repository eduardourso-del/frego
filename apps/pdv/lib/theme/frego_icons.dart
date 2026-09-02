import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:frego_tokens/frego_tokens.dart';

/// Ícones do PDV. Carimbos, pontos, cashback e desfazer usam os mesmos
/// Lucide (Stamp, Coins, Banknote, Undo2) do Balcão web.
abstract final class FregoIcons {
  static const logout = Icons.logout_rounded;
  static const store = Icons.storefront_rounded;
  static const more = Icons.more_vert_rounded;
  static const search = Icons.search_rounded;
  static const gift = Icons.card_giftcard_rounded;
  static const clear = Icons.close_rounded;
  static const check = Icons.check_rounded;

  static Widget stamp({double size = 24, Color? color}) =>
      _lucide('stamp', size: size, color: color);
  static Widget points({double size = 24, Color? color}) =>
      _lucide('coins', size: size, color: color);
  static Widget cashback({double size = 24, Color? color}) =>
      _lucide('banknote', size: size, color: color);
  static Widget undo({double size = 24, Color? color}) =>
      _lucide('undo-2', size: size, color: color);

  static Widget _lucide(
    String name, {
    required double size,
    Color? color,
  }) {
    return Builder(
      builder: (context) {
        final tint = color ?? IconTheme.of(context).color ?? FregoColors.ink;
        return SvgPicture.asset(
          'assets/icons/$name.svg',
          width: size,
          height: size,
          colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
        );
      },
    );
  }
}
