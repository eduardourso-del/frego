import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'campaign_detail_page.dart';
import 'shop_detail_page.dart';

class CheckInPage extends StatefulWidget {
  const CheckInPage({super.key, required this.token, this.onRecorded});

  final String token;
  final VoidCallback? onRecorded;

  @override
  State<CheckInPage> createState() => _CheckInPageState();
}

class _CheckInResult {
  const _CheckInResult({
    required this.counted,
    required this.needed,
    required this.alreadyToday,
    required this.openedClube,
    required this.shop,
    required this.prize,
    required this.businessId,
    required this.campaignId,
  });

  final int counted;
  final int needed;
  final bool alreadyToday;
  final bool openedClube;
  final String shop;
  final String prize;
  final String? businessId;
  final String? campaignId;

  int get sets => counted ~/ needed;
  int get inCycle => counted % needed;
  bool get ready => sets >= 1;
  bool get justFinished => !alreadyToday && counted > 0 && inCycle == 0;

  int get shownFilled {
    if (justFinished || (ready && inCycle == 0)) return needed;
    return inCycle;
  }
}

class _CheckInPageState extends State<CheckInPage>
    with TickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  bool _loading = true;
  String? _error;
  _CheckInResult? _result;

  @override
  void dispose() {
    _pulse.dispose();
    _intro.dispose();
    super.dispose();
  }

  Future<void> _record() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await recordCheckIn(widget.token);
      if (!mounted) return;
      final result = _CheckInResult(
        counted: (data['counted'] as num?)?.toInt() ?? 0,
        needed: ((data['needed'] as num?)?.toInt() ?? 1).clamp(1, 100),
        alreadyToday: data['alreadyToday'] == true,
        openedClube: data['openedClube'] == true,
        shop: (data['businessName'] as String?)?.trim() ?? '',
        prize: (data['rewardTitle'] as String?)?.trim() ?? '',
        businessId: data['businessId'] as String?,
        campaignId: data['campaignId'] as String?,
      );
      setState(() {
        _loading = false;
        _result = result;
      });
      _pulse.stop();
      if (MediaQuery.disableAnimationsOf(context)) {
        _intro.value = 1;
      } else {
        await _intro.forward(from: 0);
      }
      widget.onRecorded?.call();
    } catch (err) {
      if (!mounted) return;
      _pulse.stop();
      setState(() {
        _loading = false;
        _error = _message(err);
      });
    }
  }

  String _message(Object err) {
    final code = err.toString().replaceFirst('Exception: ', '');
    return switch (code) {
      'NOT_FOUND' => 'Esse QR não está mais valendo.',
      'CHECKIN_CLOSED' => 'Essa campanha não está aceitando check-in agora.',
      'CHECKIN_CAP' => 'O limite desta campanha já foi usado.',
      'NO_PHONE' => 'Faça login com o telefone para registrar o check-in.',
      _ => 'Não foi possível registrar o check-in.',
    };
  }

  @override
  void initState() {
    super.initState();
    _record();
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    return FregoPage(
      title: 'Check-in',
      leading: FregoAdaptive.useCupertino(context)
          ? CupertinoButton(
              padding: EdgeInsets.zero,
              onPressed: () => Navigator.of(context).maybePop(),
              child: const Icon(CupertinoIcons.back),
            )
          : IconButton(
              onPressed: () => Navigator.of(context).maybePop(),
              icon: const Icon(Icons.arrow_back),
            ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 24),
        child: _loading
            ? _LoadingMark(pulse: _pulse)
            : result == null
                ? _ErrorBody(message: _error ?? 'Não foi possível registrar o check-in.')
                : _SuccessBody(
                    result: result,
                    intro: _intro,
                    onOpenClub: result.businessId == null
                        ? null
                        : () {
                            FregoAdaptive.push(
                              context,
                              ShopDetailPage(businessId: result.businessId!),
                            );
                          },
                    onOpenPrize: result.ready &&
                            result.businessId != null &&
                            result.campaignId != null
                        ? () {
                            FregoAdaptive.push(
                              context,
                              CampaignDetailPage(
                                businessId: result.businessId!,
                                campaignId: result.campaignId!,
                              ),
                            );
                          }
                        : null,
                  ),
      ),
    );
  }
}

class _LoadingMark extends StatelessWidget {
  const _LoadingMark({required this.pulse});

  final Animation<double> pulse;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          AnimatedBuilder(
            animation: pulse,
            builder: (context, child) {
              final t = Curves.easeInOut.transform(pulse.value);
              return Transform.scale(
                scale: 0.92 + (t * 0.08),
                child: Opacity(opacity: 0.65 + (t * 0.35), child: child),
              );
            },
            child: const _Mark(icon: _MarkIcon.qr),
          ),
          const SizedBox(height: 18),
          const Text(
            'Registrando o check-in',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: FregoColors.ink,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 48),
        const Center(child: _Mark(icon: _MarkIcon.qr, muted: true)),
        const SizedBox(height: 22),
        const Text(
          'Check-in não registrado',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 26,
            height: 1.15,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.4,
            color: FregoColors.ink,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          message,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            height: 1.4,
            color: FregoColors.neutral500,
          ),
        ),
      ],
    );
  }
}

class _QrCheckMark extends StatelessWidget {
  const _QrCheckMark({required this.swap});

  /// 0 is the QR. 1 is the check.
  final Animation<double> swap;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: swap,
      builder: (context, _) {
        final t = swap.value.clamp(0.0, 1.0);
        final qr = (1 - (t / 0.55)).clamp(0.0, 1.0);
        final check = ((t - 0.32) / 0.68).clamp(0.0, 1.0);
        final checkScale = Curves.easeOutBack.transform(check);
        return Container(
          width: 88,
          height: 88,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: FregoColors.mostarda,
            borderRadius: BorderRadius.circular(28),
          ),
          child: Stack(
            alignment: Alignment.center,
            children: [
              Opacity(
                opacity: qr,
                child: Transform.scale(
                  scale: 0.84 + (0.16 * qr),
                  child: FregoIcons.checkIn(size: 36, color: FregoColors.ink),
                ),
              ),
              Opacity(
                opacity: check,
                child: Transform.scale(
                  scale: 0.55 + (0.45 * checkScale),
                  child: const Icon(
                    FregoIcons.stampCheck,
                    size: 40,
                    color: FregoColors.ink,
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

enum _MarkIcon { qr, gift }

class _Mark extends StatelessWidget {
  const _Mark({required this.icon, this.muted = false});

  final _MarkIcon icon;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final bg = muted ? FregoColors.neutral200 : FregoColors.mostarda;
    final fg = muted ? FregoColors.neutral500 : FregoColors.ink;
    return Container(
      width: 88,
      height: 88,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(28),
      ),
      child: icon == _MarkIcon.gift
          ? Icon(FregoIcons.gift, size: 36, color: fg)
          : FregoIcons.checkIn(size: 36, color: fg),
    );
  }
}

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({
    required this.result,
    required this.intro,
    required this.onOpenClub,
    required this.onOpenPrize,
  });

  final _CheckInResult result;
  final AnimationController intro;
  final VoidCallback? onOpenClub;
  final VoidCallback? onOpenPrize;

  String get _title {
    if (result.justFinished || (result.ready && result.inCycle == 0)) {
      return 'O prêmio está pronto';
    }
    if (result.alreadyToday) return 'Check-in de hoje já feito';
    return 'Check-in registrado';
  }

  String get _progressLine {
    final filled = result.shownFilled;
    if (result.justFinished || (result.ready && result.inCycle == 0)) {
      return '${result.needed} de ${result.needed} · pode resgatar';
    }
    final missing = result.needed - filled;
    final base = '$filled de ${result.needed} · faltam $missing';
    if (result.ready) return '$base · o prêmio já pode ser resgatado';
    return base;
  }

  @override
  Widget build(BuildContext context) {
    final mark = CurvedAnimation(
      parent: intro,
      curve: const Interval(0, 0.38, curve: Curves.elasticOut),
    );
    final iconSwap = result.alreadyToday
        ? const AlwaysStoppedAnimation<double>(1)
        : CurvedAnimation(
            parent: intro,
            curve: const Interval(0.2, 0.78, curve: Curves.easeInOutCubic),
          );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedBuilder(
                animation: mark,
                builder: (context, child) {
                  return Transform.scale(
                    scale: mark.value.clamp(0.01, 1.2),
                    child: child,
                  );
                },
                child: _QrCheckMark(swap: iconSwap),
              ),
              const SizedBox(height: 22),
              Text(
                _title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 28,
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.5,
                  color: FregoColors.ink,
                ),
              ),
              if (result.shop.isNotEmpty) ...[
                const SizedBox(height: 10),
                Text(
                  result.shop.toUpperCase(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                    color: FregoColors.neutral500,
                  ),
                ),
              ],
              if (result.prize.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  result.prize,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: FregoColors.ink,
                  ),
                ),
              ],
              const SizedBox(height: 28),
              _ProgressCard(
                result: result,
                intro: intro,
                line: _progressLine,
              ),
              if (result.openedClube) ...[
                const SizedBox(height: 14),
                const Text(
                  'O clube desta loja está aberto.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 14,
                    color: FregoColors.neutral500,
                  ),
                ),
              ],
            ],
          ),
        ),
        if (onOpenPrize != null) ...[
          FregoPrimaryButton(label: 'Ver o prêmio', onPressed: onOpenPrize),
          if (onOpenClub != null) ...[
            const SizedBox(height: 8),
            FregoSecondaryButton(label: 'Ver o clube', onPressed: onOpenClub),
          ],
        ] else if (onOpenClub != null)
          FregoPrimaryButton(label: 'Ver o clube', onPressed: onOpenClub),
      ],
    );
  }
}

class _ProgressCard extends StatelessWidget {
  const _ProgressCard({
    required this.result,
    required this.intro,
    required this.line,
  });

  final _CheckInResult result;
  final Animation<double> intro;
  final String line;

  @override
  Widget build(BuildContext context) {
    final needed = result.needed;
    final filled = result.shownFilled;
    final useSlots = needed <= 12;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
      decoration: BoxDecoration(
        color: FregoColors.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: FregoColors.hairline),
      ),
      child: Column(
        children: [
          if (useSlots)
            _Slots(
              needed: needed,
              filled: filled,
              intro: intro,
              newest: result.alreadyToday ? -1 : filled - 1,
            )
          else
            _Bar(needed: needed, filled: filled, intro: intro),
          const SizedBox(height: 12),
          Text(
            line,
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: FregoColors.neutral500,
            ),
          ),
        ],
      ),
    );
  }
}

class _Slots extends StatelessWidget {
  const _Slots({
    required this.needed,
    required this.filled,
    required this.intro,
    required this.newest,
  });

  final int needed;
  final int filled;
  final Animation<double> intro;
  final int newest;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 8,
      runSpacing: 8,
      children: List.generate(needed, (i) {
        final isFilled = i < filled;
        final start = 0.28 + (i / needed) * 0.5;
        final animation = CurvedAnimation(
          parent: intro,
          curve: Interval(start.clamp(0, 0.86), (start + 0.18).clamp(0.2, 1)),
        );
        return _Slot(
          animation: animation,
          filled: isFilled,
          gift: i == needed - 1,
          newest: i == newest,
        );
      }),
    );
  }
}

class _Slot extends StatelessWidget {
  const _Slot({
    required this.animation,
    required this.filled,
    required this.gift,
    required this.newest,
  });

  final Animation<double> animation;
  final bool filled;
  final bool gift;
  final bool newest;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, child) {
        final t = filled ? Curves.easeOutBack.transform(animation.value) : 1.0;
        final scale = filled ? (0.7 + (0.3 * t.clamp(0, 1.4))) : 1.0;
        return Transform.scale(scale: newest ? scale : 1, child: child);
      },
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final show = !filled || animation.value > 0.02;
          final on = filled && animation.value > 0.45;
          return Container(
            width: 36,
            height: 36,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: on ? FregoColors.mostarda : FregoColors.card,
              borderRadius: BorderRadius.circular(10),
              border: on
                  ? null
                  : Border.all(color: FregoColors.neutral200, width: 1.4),
            ),
            child: !show
                ? null
                : gift
                    ? Icon(
                        FregoIcons.gift,
                        size: 16,
                        color: on ? FregoColors.ink : FregoColors.neutral400,
                      )
                    : on
                        ? FregoIcons.checkIn(size: 16, color: FregoColors.ink)
                        : null,
          );
        },
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  const _Bar({
    required this.needed,
    required this.filled,
    required this.intro,
  });

  final int needed;
  final int filled;
  final Animation<double> intro;

  @override
  Widget build(BuildContext context) {
    final animation = CurvedAnimation(
      parent: intro,
      curve: const Interval(0.3, 0.9, curve: Curves.easeOutCubic),
    );
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final fraction = needed == 0 ? 0.0 : (filled / needed) * animation.value;
        return ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: SizedBox(
            height: 14,
            child: Stack(
              fit: StackFit.expand,
              children: [
                const ColoredBox(color: FregoColors.neutral100),
                FractionallySizedBox(
                  alignment: Alignment.centerLeft,
                  widthFactor: fraction.clamp(0, 1),
                  child: const ColoredBox(color: FregoColors.mostarda),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
