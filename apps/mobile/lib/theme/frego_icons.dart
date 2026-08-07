import 'package:flutter/material.dart';

/// Ícones Material Rounded — mesma identidade no iOS e Android.
///
/// Preferir estes em vez de CupertinoIcons / outlined genéricos.
abstract final class FregoIcons {
  // Tabs / navegação principal
  static const shops = Icons.storefront_outlined;
  static const shopsFilled = Icons.storefront_rounded;
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

  // Fidelidade
  static const stamp = Icons.loyalty_outlined;
  static const stampFilled = Icons.loyalty_rounded;
  static const points = Icons.stars_outlined;
  static const pointsFilled = Icons.stars_rounded;
  static const birthday = Icons.cake_outlined;
  static const birthdayFilled = Icons.cake_rounded;
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
}
