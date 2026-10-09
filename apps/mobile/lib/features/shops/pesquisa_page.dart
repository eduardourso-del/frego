import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

class PesquisaPage extends StatefulWidget {
  const PesquisaPage({super.key, required this.businessId});

  final String businessId;

  @override
  State<PesquisaPage> createState() => _PesquisaPageState();
}

class _PesquisaPageState extends State<PesquisaPage> {
  bool _loading = true;
  bool _sending = false;
  String? _error;
  Map<String, dynamic>? _view;
  final Map<int, String> _answers = {};
  final _note = TextEditingController();
  _Finish? _done;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final view = await fetchMyConvite(widget.businessId);
      if (!mounted) return;
      setState(() {
        _view = view;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString().replaceFirst('Exception: ', '');
        _loading = false;
      });
    }
  }

  Future<void> _submit(Map<String, dynamic> snapshot, String conviteId) async {
    final questions = (snapshot['questions'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    if (questions.any((q) => _answers[(q['position'] as num).toInt()] == null)) {
      FregoAdaptive.showMessage(context, 'Responda todas as perguntas.');
      return;
    }
    setState(() => _sending = true);
    try {
      final result = await submitMyConvite(
        conviteId: conviteId,
        note: _note.text.trim().isEmpty ? null : _note.text.trim(),
        answers: questions
            .map(
              (q) => {
                'position': (q['position'] as num).toInt(),
                'value': _answers[(q['position'] as num).toInt()],
              },
            )
            .toList(),
      );
      if (!mounted) return;
      final bonus = result['bonus'] as Map<String, dynamic>?;
      final landed = bonus != null && bonus['landed'] == true;
      final rawLabel = (bonus?['label'] as String?)?.trim() ?? '';
      final label = rawLabel.replaceFirst(RegExp(r'^Pesquisa\s·\s'), '');
      setState(() {
        _sending = false;
        _done = _Finish(landed: landed, label: label.isEmpty ? null : label);
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _sending = false);
      FregoAdaptive.showMessage(
        context,
        e.toString().replaceFirst('Exception: ', ''),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = _view;
    final state = view?['state'] as String?;
    final snapshot = view?['snapshot'] as Map<String, dynamic>?;
    final questions = (snapshot?['questions'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final bonus = snapshot?['bonus'] as Map<String, dynamic>?;
    final pesquisaName = (view?['pesquisaName'] as String?)?.trim() ?? '';
    final purchase = (view?['purchase'] as String?)?.trim() ?? '';
    final headline = bonus?['sentence'] as String? ??
        snapshot?['inviteLine'] as String? ??
        'Pesquisa';

    return FregoPage(
      showNavBar: true,
      title: 'Pesquisa',
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(_error!),
                )
              : _done != null
                  ? _FinishView(finish: _done!)
                  : state == 'answered'
                      ? _FinishView(
                          finish: _Finish(
                            landed: ((view?['benefit'] as String?)?.trim() ?? '')
                                .isNotEmpty,
                            label: (view?['benefit'] as String?)?.trim(),
                            already: true,
                          ),
                        )
                      : state != 'open' || snapshot == null
                      ? Padding(
                          padding: const EdgeInsets.all(24),
                          child: Text(
                            'Esta Pesquisa está encerrada.',
                            style: _type(
                              context,
                              size: 28,
                              weight: FontWeight.w800,
                              letterSpacing: -0.6,
                              height: 1.1,
                            ),
                          ),
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
                          children: [
                            _BrandHeader(
                              name: view?['businessName'] as String? ?? '',
                              typeLabel: FregoBusinessTypes.labelOf(
                                view?['businessType'] as String?,
                              ),
                              slogan: view?['slogan'] as String?,
                              address: view?['address'] as String?,
                              logoUrl: view?['logoUrl'] as String?,
                              heroImageUrl: view?['heroImageUrl'] as String?,
                              primaryColor: view?['primaryColor'] as String?,
                              primaryColorDark: view?['primaryColorDark'] as String?,
                            ),
                            const SizedBox(height: 16),
                            if (pesquisaName.isNotEmpty) ...[
                              Text(
                                pesquisaName,
                                style: _type(
                                  context,
                                  size: 28,
                                  weight: FontWeight.w800,
                                  letterSpacing: -0.6,
                                  height: 1.1,
                                ),
                              ),
                              const SizedBox(height: 6),
                            ],
                            if (purchase.isNotEmpty) ...[
                              Text(
                                purchase,
                                style: _type(
                                  context,
                                  size: 14,
                                  height: 1.3,
                                  color: FregoColors.neutral500,
                                ),
                              ),
                              const SizedBox(height: 8),
                            ],
                            Text(
                              headline,
                              style: _type(
                                context,
                                size: pesquisaName.isEmpty ? 28 : 16,
                                weight: pesquisaName.isEmpty
                                    ? FontWeight.w800
                                    : FontWeight.w600,
                                letterSpacing: pesquisaName.isEmpty ? -0.6 : 0,
                                height: 1.3,
                                color: pesquisaName.isEmpty
                                    ? FregoColors.ink
                                    : FregoColors.neutral500,
                              ),
                            ),
                            const SizedBox(height: 16),
                            for (final question in questions) ...[
                              Text(
                                question['prompt'] as String? ?? '',
                                style: _type(context, size: 16, height: 1.25),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: _PolegarButton(
                                      up: true,
                                      label: 'Para cima',
                                      selected: _answers[(question['position'] as num).toInt()] ==
                                          'up',
                                      onTap: () => setState(() {
                                        _answers[(question['position'] as num).toInt()] =
                                            'up';
                                      }),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: _PolegarButton(
                                      up: false,
                                      label: 'Para baixo',
                                      selected: _answers[(question['position'] as num).toInt()] ==
                                          'down',
                                      onTap: () => setState(() {
                                        _answers[(question['position'] as num).toInt()] =
                                            'down';
                                      }),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 18),
                            ],
                            if ((snapshot['notePrompt'] as String?)?.isNotEmpty == true) ...[
                              Text(
                                snapshot['notePrompt'] as String,
                                style: _type(context, size: 13),
                              ),
                              const SizedBox(height: 8),
                              FregoTextField(
                                controller: _note,
                                placeholder: 'Escreva aqui',
                                minLines: 3,
                                maxLines: 5,
                                textCapitalization: TextCapitalization.sentences,
                              ),
                              const SizedBox(height: 18),
                            ],
                            FregoPrimaryButton(
                              label: _sending ? 'Enviando…' : 'Enviar resposta',
                              onPressed: _sending
                                  ? null
                                  : () => _submit(
                                        snapshot,
                                        view!['conviteId'] as String,
                                      ),
                            ),
                          ],
                        ),
    );
  }
}

class _Finish {
  const _Finish({required this.landed, this.label, this.already = false});

  final bool landed;
  final String? label;
  final bool already;
}

class _FinishView extends StatelessWidget {
  const _FinishView({required this.finish});

  final _Finish finish;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
      child: Column(
        children: [
          const Spacer(),
          Container(
            width: 72,
            height: 72,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: FregoColors.successBg,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_rounded,
              size: 40,
              color: FregoColors.successFill,
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Obrigado',
            textAlign: TextAlign.center,
            style: _type(
              context,
              size: 32,
              weight: FontWeight.w800,
              letterSpacing: -0.6,
              height: 1.05,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            finish.already
                ? 'Você já respondeu esta Pesquisa.'
                : finish.landed
                    ? 'Sua resposta entrou e o benefício foi para o saldo.'
                    : 'Sua resposta foi registrada.',
            textAlign: TextAlign.center,
            style: _type(
              context,
              size: 16,
              weight: FontWeight.w400,
              height: 1.35,
              color: FregoColors.neutral500,
            ),
          ),
          if (finish.landed && (finish.label ?? '').isNotEmpty) ...[
            const SizedBox(height: 20),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: FregoColors.card,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: FregoColors.hairline),
              ),
              child: Text(
                finish.label!,
                textAlign: TextAlign.center,
                style: _type(
                  context,
                  size: 16,
                  weight: FontWeight.w800,
                  height: 1.3,
                ),
              ),
            ),
          ],
          const Spacer(),
          FregoPrimaryButton(
            label: 'Voltar',
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ],
      ),
    );
  }
}

TextStyle _type(
  BuildContext context, {
  required double size,
  FontWeight weight = FontWeight.w600,
  double height = 1.2,
  double letterSpacing = 0,
  Color color = FregoColors.ink,
}) {
  final base = Theme.of(context).textTheme.bodyLarge ?? const TextStyle();
  return base.copyWith(
    fontSize: size,
    fontWeight: weight,
    height: height,
    letterSpacing: letterSpacing,
    color: color,
    decoration: TextDecoration.none,
  );
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader({
    required this.name,
    required this.typeLabel,
    this.slogan,
    this.address,
    this.logoUrl,
    this.heroImageUrl,
    this.primaryColor,
    this.primaryColorDark,
  });

  final String name;
  final String typeLabel;
  final String? slogan;
  final String? address;
  final String? logoUrl;
  final String? heroImageUrl;
  final String? primaryColor;
  final String? primaryColorDark;

  @override
  Widget build(BuildContext context) {
    final label = name.trim().isEmpty ? 'Estabelecimento' : name.trim();
    final letter = label[0].toUpperCase();
    final primary = _hex(primaryColor) ?? FregoColors.ink;
    final primaryDark = _hex(primaryColorDark) ?? primary;
    final hero = heroImageUrl != null && heroImageUrl!.isNotEmpty;
    final sloganText = slogan?.trim() ?? '';
    final addressText = address?.trim() ?? '';
    final identity = Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [primary, primaryDark],
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            clipBehavior: Clip.antiAlias,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(10),
            ),
            child: logoUrl != null && logoUrl!.isNotEmpty
                ? Image.network(
                    logoUrl!,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                  )
                : ColoredBox(
                    color: primary,
                    child: Center(
                      child: Text(
                        letter,
                        style: _type(
                          context,
                          size: 16,
                          weight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _type(
                    context,
                    size: 16,
                    weight: FontWeight.w700,
                    letterSpacing: -0.2,
                    height: 1.15,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  typeLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: _type(
                    context,
                    size: 12,
                    letterSpacing: 0.4,
                    height: 1.2,
                    color: Colors.white.withValues(alpha: 0.72),
                  ),
                ),
                if (sloganText.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    sloganText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: _type(
                      context,
                      size: 13,
                      weight: FontWeight.w400,
                      height: 1.25,
                      color: Colors.white.withValues(alpha: 0.88),
                    ),
                  ),
                ],
                if (addressText.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 1),
                        child: Icon(
                          FregoIcons.location,
                          size: 13,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          addressText,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: _type(
                            context,
                            size: 12,
                            weight: FontWeight.w400,
                            height: 1.25,
                            color: Colors.white.withValues(alpha: 0.9),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (hero)
            SizedBox(
              height: 72,
              width: double.infinity,
              child: Image.network(
                heroImageUrl!,
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
          identity,
        ],
      ),
    );
  }
}

Color? _hex(String? hex) {
  if (hex == null || hex.isEmpty) return null;
  final cleaned = hex.replaceFirst('#', '');
  if (cleaned.length != 6) return null;
  final value = int.tryParse('FF$cleaned', radix: 16);
  if (value == null) return null;
  return Color(value);
}

class _PolegarButton extends StatelessWidget {
  const _PolegarButton({
    required this.up,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final bool up;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final fill = up ? FregoColors.successFill : FregoColors.dangerFill;
    final wash = up ? FregoColors.successBg : FregoColors.dangerBg;
    return Material(
      color: selected ? fill : wash,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          alignment: Alignment.center,
          constraints: const BoxConstraints(minHeight: 56),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: fill, width: 2),
          ),
          child: Semantics(
            label: label,
            child: up
                ? FregoIcons.thumbUp(
                    size: 26,
                    filled: selected,
                    color: selected ? Colors.white : fill,
                  )
                : FregoIcons.thumbDown(
                    size: 26,
                    filled: selected,
                    color: selected ? Colors.white : fill,
                  ),
          ),
        ),
      ),
    );
  }
}
