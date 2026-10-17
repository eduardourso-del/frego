import 'package:flutter/material.dart';

import '../theme/frego_theme.dart';

/// Centered empty tab: azul mark, a small badge, title, and one line of why.
class FregoEmptyState extends StatelessWidget {
  const FregoEmptyState({
    super.key,
    required this.title,
    required this.body,
    required this.badge,
  });

  final String title;
  final String body;
  final IconData badge;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 8, 32, 24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 112,
            height: 112,
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: FregoColors.azul,
                    borderRadius: BorderRadius.circular(32),
                  ),
                  alignment: Alignment.center,
                  child: const FregoMark(size: 48, negative: true),
                ),
                Positioned(
                  right: 0,
                  bottom: 4,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: FregoColors.mostarda,
                      shape: BoxShape.circle,
                      border: Border.all(color: FregoColors.neutralBg, width: 3),
                    ),
                    alignment: Alignment.center,
                    child: Icon(badge, size: 18, color: FregoColors.ink),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 24,
              height: 1.15,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.4,
              color: FregoColors.ink,
            ),
          ),
          const SizedBox(height: 10),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 15,
              height: 1.4,
              color: FregoColors.neutral500,
            ),
          ),
        ],
      ),
    );
  }
}
