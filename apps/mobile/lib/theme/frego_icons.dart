import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import 'package:frego_tokens/frego_tokens.dart';

/// Ícones do app. Carimbos, pontos e cashback usam os mesmos Lucide
/// (Stamp, Coins, Banknote) do painel do estabelecimento.
abstract final class FregoIcons {
  // Tabs / navegação principal
  static const shops = Icons.storefront_outlined;
  static const shopsFilled = Icons.storefront_rounded;
  static const rewards = Icons.card_giftcard_outlined;
  static const rewardsFilled = Icons.card_giftcard_rounded;
  static const history = Icons.receipt_long_outlined;
  static const historyFilled = Icons.receipt_long_rounded;
  static const profile = Icons.person_outline_rounded;
  static const profileFilled = Icons.person_rounded;

  // Ações
  static const back = Icons.arrow_back_rounded;
  static const chevronRight = Icons.chevron_right_rounded;
  static const refresh = Icons.refresh_rounded;
  static const logout = Icons.logout_rounded;
  static const calendar = Icons.calendar_month_rounded;
  static const location = Icons.place_rounded;
  static const image = Icons.photo_outlined;

  // Fidelidade (Lucide — iguais ao web do estabelecimento)
  static Widget stamp({double size = 24, Color? color}) =>
      _lucide('stamp', size: size, color: color);
  static Widget stampFilled({double size = 24, Color? color}) =>
      stamp(size: size, color: color);
  static Widget points({double size = 24, Color? color}) =>
      _lucide('coins', size: size, color: color);
  static Widget pointsFilled({double size = 24, Color? color}) =>
      points(size: size, color: color);
  static Widget cashback({double size = 24, Color? color}) =>
      _lucide('banknote', size: size, color: color);
  static Widget cashbackFilled({double size = 24, Color? color}) =>
      cashback(size: size, color: color);
  static Widget birthday({double size = 24, Color? color}) =>
      _lucide('cake', size: size, color: color);
  static Widget birthdayFilled({double size = 24, Color? color}) =>
      birthday(size: size, color: color);
  static Widget promo({double size = 24, Color? color}) =>
      _lucide('percent', size: size, color: color);
  static Widget promoFilled({double size = 24, Color? color}) =>
      promo(size: size, color: color);
  static Widget thumbUp({double size = 24, Color? color, bool filled = false}) =>
      _lucide(filled ? 'thumbs-up-filled' : 'thumbs-up', size: size, color: color);
  static Widget thumbDown({
    double size = 24,
    Color? color,
    bool filled = false,
  }) =>
      _lucide(
        filled ? 'thumbs-down-filled' : 'thumbs-down',
        size: size,
        color: color,
      );

  static const gift = Icons.card_giftcard_rounded;
  static const stampCheck = Icons.check_rounded;
  static const visits = Icons.calendar_today_rounded;
  static const trophy = Icons.emoji_events_rounded;
  static const trending = Icons.trending_up_rounded;
  static const search = Icons.search_rounded;
  static const favorite = Icons.favorite_border_rounded;
  static const favoriteFilled = Icons.favorite_rounded;
  static const filter = Icons.tune_rounded;
  static const clear = Icons.close_rounded;
  static const bell = Icons.notifications_rounded;
  static const bellActive = Icons.notifications_active_rounded;

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
