import 'package:flutter/material.dart';

import '../../notifications/push_service.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

/// Explains why notifications matter, then asks for OS permission.
class NotificationOnboardingPage extends StatefulWidget {
  const NotificationOnboardingPage({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<NotificationOnboardingPage> createState() =>
      _NotificationOnboardingPageState();
}

class _NotificationOnboardingPageState extends State<NotificationOnboardingPage>
    with TickerProviderStateMixin {
  late final AnimationController _float;
  late final AnimationController _wiggle;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _float = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _wiggle = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _float.dispose();
    _wiggle.dispose();
    super.dispose();
  }

  Future<void> _enable() async {
    if (_busy) return;
    setState(() => _busy = true);
    await PushService.start();
    if (!mounted) return;
    widget.onDone();
  }

  Future<void> _later() async {
    if (_busy) return;
    setState(() => _busy = true);
    await PushService.deferPrePrompt();
    if (!mounted) return;
    widget.onDone();
  }

  @override
  Widget build(BuildContext context) {
    return FregoPage(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 8, 24, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    const SizedBox(height: 12),
                    _HeroScene(float: _float, wiggle: _wiggle),
                    const SizedBox(height: 28),
                    const Text(
                      'Pode te cutucar?',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                        height: 1.15,
                        color: FregoColors.ink,
                      ),
                    ),
                    const SizedBox(height: 10),
                    const Text(
                      'Quando a loja te der carimbo, ponto ou cashback, o Frego dá um toque. Também avisa se nascer uma campanha só pra você.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.4,
                        color: FregoColors.neutral500,
                      ),
                    ),
                    const SizedBox(height: 28),
                    Row(
                      children: [
                        Expanded(
                          child: _PerkCard(
                            icon: FregoIcons.stamp(
                              size: 26,
                              color: FregoColors.stamps,
                            ),
                            color: FregoColors.stamps,
                            background: FregoColors.stampsBg,
                            label: 'Carimbo\nna hora',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _PerkCard(
                            icon: FregoIcons.points(
                              size: 26,
                              color: FregoColors.points,
                            ),
                            color: FregoColors.points,
                            background: FregoColors.pointsBg,
                            label: 'Pontos &\ncashback',
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _PerkCard(
                            icon: Icon(
                              FregoIcons.gift,
                              size: 26,
                              color: FregoColors.primary500,
                            ),
                            color: FregoColors.primary500,
                            background: FregoColors.primary50,
                            label: 'Campanha\nnovinha',
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            FregoPrimaryButton(
              label: _busy ? 'Um segundinho…' : 'Quero ser avisado',
              onPressed: _busy ? null : _enable,
            ),
            const SizedBox(height: 4),
            FregoSecondaryButton(
              label: 'Agora não',
              onPressed: _busy ? null : _later,
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroScene extends StatelessWidget {
  const _HeroScene({required this.float, required this.wiggle});

  final Animation<double> float;
  final Animation<double> wiggle;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 240,
      child: AnimatedBuilder(
        animation: Listenable.merge([float, wiggle]),
        builder: (context, _) {
          final dy = (float.value - 0.5) * 14;
          final tilt = (wiggle.value - 0.5) * 0.16;
          return Stack(
            alignment: Alignment.center,
            children: [
              Positioned(
                left: 18,
                top: 28,
                child: _Blob(
                  size: 92,
                  color: FregoColors.stampsBg,
                ),
              ),
              Positioned(
                right: 8,
                bottom: 16,
                child: _Blob(
                  size: 120,
                  color: FregoColors.primary50,
                ),
              ),
              Positioned(
                right: 36,
                top: 18,
                child: _Blob(
                  size: 54,
                  color: FregoColors.pointsBg,
                ),
              ),
              Transform.translate(
                offset: Offset(0, dy),
                child: Transform.rotate(
                  angle: -0.04,
                  child: const _MockNotification(),
                ),
              ),
              Positioned(
                left: 28,
                bottom: 22,
                child: Transform.rotate(
                  angle: tilt,
                  child: const _BellBadge(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Blob extends StatelessWidget {
  const _Blob({required this.size, required this.color});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _BellBadge extends StatelessWidget {
  const _BellBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 72,
      height: 72,
      decoration: BoxDecoration(
        color: FregoColors.primary500,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: FregoColors.primary500.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: const Icon(
        FregoIcons.bellActive,
        color: FregoColors.onPrimary,
        size: 34,
      ),
    );
  }
}

class _MockNotification extends StatelessWidget {
  const _MockNotification();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(FregoRadius.lg),
        border: Border.all(color: FregoColors.hairline),
        boxShadow: [
          BoxShadow(
            color: FregoColors.ink.withValues(alpha: 0.08),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              FregoIcons.stamp(size: 18, color: FregoColors.stamps),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'Padaria da esquina',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: FregoColors.ink,
                  ),
                ),
              ),
              Text(
                'agora',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: FregoColors.neutral400,
                ),
              ),
            ],
          ),
          SizedBox(height: 8),
          Text(
            'Você acabou de ganhar +1 carimbo.',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              height: 1.3,
              color: FregoColors.ink,
            ),
          ),
          SizedBox(height: 2),
          Text(
            'Seu saldo agora é: 8 carimbos. Café grátis: faltam 2.',
            style: TextStyle(
              fontSize: 13,
              height: 1.35,
              color: FregoColors.neutral500,
            ),
          ),
        ],
      ),
    );
  }
}

class _PerkCard extends StatelessWidget {
  const _PerkCard({
    required this.icon,
    required this.color,
    required this.background,
    required this.label,
  });

  final Widget icon;
  final Color color;
  final Color background;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(10, 14, 10, 12),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(FregoRadius.lg),
      ),
      child: Column(
        children: [
          icon,
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              height: 1.25,
              color: FregoColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}
