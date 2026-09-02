import 'package:flutter/material.dart';

import '../theme/frego_theme.dart';
import 'adaptive.dart';

class _SkeletonPulse extends InheritedWidget {
  const _SkeletonPulse({required this.t, required super.child});

  final double t;

  static double of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<_SkeletonPulse>()?.t ??
        0;
  }

  @override
  bool updateShouldNotify(_SkeletonPulse oldWidget) => oldWidget.t != t;
}

/// Soft pulse wrapper for skeleton placeholders.
class FregoSkeleton extends StatefulWidget {
  const FregoSkeleton({super.key, required this.child});

  final Widget child;

  @override
  State<FregoSkeleton> createState() => _FregoSkeletonState();
}

class _FregoSkeletonState extends State<FregoSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return _SkeletonPulse(
          t: CurvedAnimation(
            parent: _controller,
            curve: Curves.easeInOut,
          ).value,
          child: child!,
        );
      },
      child: widget.child,
    );
  }
}

class FregoBone extends StatelessWidget {
  const FregoBone({
    super.key,
    this.width,
    this.height = 12,
    this.radius = 8,
    this.circle = false,
  });

  final double? width;
  final double height;
  final double radius;
  final bool circle;

  @override
  Widget build(BuildContext context) {
    final t = _SkeletonPulse.of(context);
    final color = Color.lerp(
      FregoColors.neutral100,
      FregoColors.neutral200,
      t,
    )!;
    if (circle) {
      return Container(
        width: width ?? height,
        height: height,
        decoration: BoxDecoration(color: color, shape: BoxShape.circle),
      );
    }
    return Container(
      width: width ?? double.infinity,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({
    required this.child,
    this.radius = 18,
    this.padding,
    this.height,
  });

  final Widget child;
  final double radius;
  final EdgeInsetsGeometry? padding;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final barHeight = height;
    return Container(
      width: double.infinity,
      height: barHeight,
      padding: barHeight != null
          ? EdgeInsets.zero
          : (padding ?? const EdgeInsets.all(16)),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(radius),
        border: Border.all(color: FregoColors.hairline),
      ),
      child: barHeight != null
          ? FregoBone(height: barHeight, radius: radius)
          : child,
    );
  }
}

/// Lojas tab — search, chips, shop rows.
class FregoShopsSkeleton extends StatelessWidget {
  const FregoShopsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return FregoSkeleton(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          FregoLargeTitlePage.gutter,
          20,
          FregoLargeTitlePage.gutter,
          24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const FregoBone(width: 168, height: 36, radius: 10),
            const SizedBox(height: 16),
            const FregoBone(height: 40, radius: 12),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              children: const [
                FregoBone(width: 72, height: 32, radius: 16),
                FregoBone(width: 88, height: 32, radius: 16),
                FregoBone(width: 76, height: 32, radius: 16),
              ],
            ),
            const SizedBox(height: 22),
            const FregoBone(width: 64, height: 10, radius: 6),
            const SizedBox(height: 12),
            for (var i = 0; i < 4; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              const _ShopRowBone(),
            ],
          ],
        ),
      ),
    );
  }
}

class _ShopRowBone extends StatelessWidget {
  const _ShopRowBone();

  @override
  Widget build(BuildContext context) {
    return const _SkeletonCard(
      child: Row(
        children: [
          FregoBone(width: 48, height: 48, radius: 14),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FregoBone(width: 72, height: 8, radius: 4),
                SizedBox(height: 8),
                FregoBone(width: 140, height: 14, radius: 6),
                SizedBox(height: 10),
                Row(
                  children: [
                    FregoBone(width: 88, height: 22, radius: 11),
                    SizedBox(width: 6),
                    FregoBone(width: 64, height: 22, radius: 11),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Prêmios tab — chips and campaign cards.
class FregoRewardsSkeleton extends StatelessWidget {
  const FregoRewardsSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return FregoSkeleton(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          FregoLargeTitlePage.gutter,
          8,
          FregoLargeTitlePage.gutter,
          24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const FregoBone(width: 220, height: 12, radius: 6),
            const SizedBox(height: 8),
            const FregoBone(width: 160, height: 12, radius: 6),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: const [
                FregoBone(width: 86, height: 32, radius: 16),
                FregoBone(width: 98, height: 32, radius: 16),
                FregoBone(width: 92, height: 32, radius: 16),
              ],
            ),
            const SizedBox(height: 18),
            for (var i = 0; i < 3; i++) ...[
              if (i > 0) const SizedBox(height: 12),
              const _CampaignCardBone(),
            ],
          ],
        ),
      ),
    );
  }
}

class _CampaignCardBone extends StatelessWidget {
  const _CampaignCardBone();

  @override
  Widget build(BuildContext context) {
    return const _SkeletonCard(
      radius: 16,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FregoBone(width: 36, height: 36, radius: 10),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FregoBone(width: 120, height: 12, radius: 6),
                    SizedBox(height: 6),
                    FregoBone(width: 80, height: 10, radius: 5),
                  ],
                ),
              ),
            ],
          ),
          SizedBox(height: 16),
          FregoBone(width: 180, height: 14, radius: 6),
          SizedBox(height: 8),
          FregoBone(height: 10, radius: 5),
          SizedBox(height: 16),
          FregoBone(height: 8, radius: 4),
          SizedBox(height: 14),
          FregoBone(height: 44, radius: 12),
        ],
      ),
    );
  }
}

/// Histórico tab — chips and event rows.
class FregoHistorySkeleton extends StatelessWidget {
  const FregoHistorySkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return FregoSkeleton(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          FregoLargeTitlePage.gutter,
          8,
          FregoLargeTitlePage.gutter,
          24,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 8,
              children: const [
                FregoBone(width: 78, height: 32, radius: 16),
                FregoBone(width: 96, height: 32, radius: 16),
                FregoBone(width: 102, height: 32, radius: 16),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 8,
              children: const [
                FregoBone(width: 92, height: 32, radius: 16),
                FregoBone(width: 88, height: 32, radius: 16),
                FregoBone(width: 76, height: 32, radius: 16),
              ],
            ),
            const SizedBox(height: 22),
            const FregoBone(width: 72, height: 10, radius: 5),
            const SizedBox(height: 10),
            for (var i = 0; i < 5; i++) ...[
              if (i > 0) const SizedBox(height: 10),
              const _HistoryRowBone(),
            ],
          ],
        ),
      ),
    );
  }
}

class _HistoryRowBone extends StatelessWidget {
  const _HistoryRowBone();

  @override
  Widget build(BuildContext context) {
    return const _SkeletonCard(
      radius: 16,
      padding: EdgeInsets.all(14),
      child: Row(
        children: [
          FregoBone(width: 44, height: 44, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FregoBone(width: 150, height: 12, radius: 6),
                SizedBox(height: 8),
                FregoBone(width: 96, height: 10, radius: 5),
              ],
            ),
          ),
          FregoBone(width: 48, height: 12, radius: 6),
        ],
      ),
    );
  }
}

/// Perfil tab.
class FregoProfileSkeleton extends StatelessWidget {
  const FregoProfileSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return FregoSkeleton(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          FregoLargeTitlePage.gutter,
          8,
          FregoLargeTitlePage.gutter,
          24,
        ),
        child: Column(
          children: [
            const FregoBone(width: 200, height: 12, radius: 6),
            const SizedBox(height: 28),
            const FregoBone(width: 72, height: 72, radius: 22),
            const SizedBox(height: 10),
            const FregoBone(width: 56, height: 10, radius: 5),
            const SizedBox(height: 20),
            const _SkeletonCard(
              radius: 16,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _StatBone(),
                  _StatBone(),
                  _StatBone(),
                ],
              ),
            ),
            const SizedBox(height: 28),
            const _FieldBone(),
            const SizedBox(height: 16),
            const _FieldBone(),
            const SizedBox(height: 16),
            const _FieldBone(),
            const SizedBox(height: 20),
            const _SkeletonCard(height: 56, child: SizedBox.shrink()),
            const SizedBox(height: 28),
            const _SkeletonCard(height: 96, child: SizedBox.shrink()),
            const SizedBox(height: 16),
            const _SkeletonCard(height: 48, child: SizedBox.shrink()),
            const SizedBox(height: 16),
            const _SkeletonCard(height: 48, child: SizedBox.shrink()),
          ],
        ),
      ),
    );
  }
}

class _StatBone extends StatelessWidget {
  const _StatBone();

  @override
  Widget build(BuildContext context) {
    return const Column(
      children: [
        FregoBone(width: 28, height: 18, radius: 6),
        SizedBox(height: 6),
        FregoBone(width: 48, height: 10, radius: 5),
      ],
    );
  }
}

class _FieldBone extends StatelessWidget {
  const _FieldBone();

  @override
  Widget build(BuildContext context) {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        FregoBone(width: 88, height: 10, radius: 5),
        SizedBox(height: 8),
        _SkeletonCard(height: 48, child: SizedBox.shrink()),
      ],
    );
  }
}

/// Pushed detail screens (loja, campanha, ganho, saldo).
class FregoDetailSkeleton extends StatelessWidget {
  const FregoDetailSkeleton({super.key, this.padding = 24});

  final double padding;

  @override
  Widget build(BuildContext context) {
    return FregoSkeleton(
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: EdgeInsets.all(padding),
        children: const [
          _SkeletonCard(
            radius: 16,
            padding: EdgeInsets.all(16),
            child: Row(
              children: [
                FregoBone(width: 56, height: 56, radius: 16),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      FregoBone(width: 140, height: 16, radius: 6),
                      SizedBox(height: 8),
                      FregoBone(width: 96, height: 12, radius: 5),
                    ],
                  ),
                ),
              ],
            ),
          ),
          SizedBox(height: 16),
          _SkeletonCard(
            radius: 16,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                FregoBone(width: 100, height: 10, radius: 5),
                SizedBox(height: 12),
                FregoBone(height: 18, radius: 6),
                SizedBox(height: 8),
                FregoBone(width: 160, height: 12, radius: 5),
              ],
            ),
          ),
          SizedBox(height: 16),
          _CampaignCardBone(),
          SizedBox(height: 12),
          _CampaignCardBone(),
        ],
      ),
    );
  }
}
