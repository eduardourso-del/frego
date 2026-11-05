import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'city_picker.dart';

/// Half-screen sheet. The Cliente has to set Cidade before using the app.
class CidadeGatePage extends StatefulWidget {
  const CidadeGatePage({super.key, required this.onPicked});

  final VoidCallback onPicked;

  @override
  State<CidadeGatePage> createState() => _CidadeGatePageState();
}

class _CidadeGatePageState extends State<CidadeGatePage>
    with SingleTickerProviderStateMixin {
  final _search = TextEditingController();
  final _query = ValueNotifier<String>('');
  final _focus = FocusNode();
  late final AnimationController _enter;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  CityChoice? _selected;
  CityCatalog? _catalog;

  @override
  void initState() {
    super.initState();
    _search.addListener(_onSearch);
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..forward();
    _enter.addStatusListener(_onEnter);
    _load();
  }

  @override
  void dispose() {
    _enter.removeStatusListener(_onEnter);
    _search.removeListener(_onSearch);
    _focus.dispose();
    _search.dispose();
    _query.dispose();
    _enter.dispose();
    super.dispose();
  }

  void _onSearch() {
    _query.value = _search.text;
  }

  void _onEnter(AnimationStatus status) {
    if (status != AnimationStatus.completed || !mounted || _saving) return;
    if (_selected != null || _focus.hasFocus) return;
    _focus.requestFocus();
  }

  Future<void> _load() async {
    try {
      final cities = await loadHomeCities();
      if (!mounted) return;
      setState(() {
        _catalog = CityCatalog(cities);
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

  void _select(CityChoice city) {
    _focus.unfocus();
    setState(() => _selected = city);
  }

  bool _sameCity(CityChoice a, CityChoice b) {
    return a.city == b.city && a.state == b.state;
  }

  Future<void> _pick(CityChoice city) async {
    _focus.unfocus();
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await updateMyCustomer(city: city.city, state: city.state);
      if (!mounted) return;
      // Drop the field only after the text input connection has closed.
      await WidgetsBinding.instance.endOfFrame;
      if (!mounted) return;
      widget.onPicked();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _error = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // 72% of the screen while the window is full. If the keyboard shrinks
        // the window, stay inside it — a taller sheet overflows and tears the
        // field down while she is typing.
        final wanted = MediaQuery.sizeOf(context).height * 0.72;
        final height = constraints.maxHeight < wanted
            ? constraints.maxHeight
            : wanted;
        return _sheet(height);
      },
    );
  }

  Widget _sheet(double height) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const ColoredBox(color: Color(0x73000000)),
        Align(
          alignment: Alignment.bottomCenter,
          child: SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
                .animate(
                  CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic),
                ),
            child: SizedBox(
              height: height,
              width: double.infinity,
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  color: FregoColors.card,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 10),
                    const Center(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          color: FregoColors.hairline,
                          borderRadius: BorderRadius.all(Radius.circular(99)),
                        ),
                        child: SizedBox(width: 36, height: 4),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
                      child: Text(
                        'Onde você mora?',
                        style: TextStyle(
                          fontSize: 22,
                          height: 1.15,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.4,
                          color: FregoColors.ink,
                        ),
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.fromLTRB(20, 6, 20, 0),
                      child: Text(
                        'Para encontrar os estabelecimentos da sua cidade.',
                        style: TextStyle(
                          fontSize: 15,
                          height: 1.4,
                          color: FregoColors.neutral500,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                      child: Material(
                        type: MaterialType.transparency,
                        child: TextField(
                          controller: _search,
                          focusNode: _focus,
                          enabled: !_saving,
                          autofillHints: const [],
                          enableSuggestions: false,
                          autocorrect: false,
                          scrollPadding: EdgeInsets.zero,
                          textCapitalization: TextCapitalization.words,
                          textInputAction: TextInputAction.search,
                          style: const TextStyle(
                            fontSize: 17,
                            color: FregoColors.ink,
                          ),
                          decoration: InputDecoration(
                            hintText: 'Nome da cidade',
                            hintStyle: const TextStyle(
                              fontSize: 17,
                              color: FregoColors.neutral400,
                            ),
                            filled: true,
                            fillColor: FregoColors.card,
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 14,
                            ),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: FregoColors.control,
                              ),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                              borderSide: const BorderSide(
                                color: FregoColors.control,
                              ),
                            ),
                          ),
                          onTapOutside: (_) {},
                        ),
                      ),
                    ),
                    if (_error != null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: FregoColors.danger),
                        ),
                      ),
                    if (_error != null && _catalog == null)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: FregoPrimaryButton(
                          label: 'Tentar de novo',
                          onPressed: () {
                            setState(() {
                              _loading = true;
                              _error = null;
                            });
                            _load();
                          },
                        ),
                      ),
                    const SizedBox(height: 8),
                    Expanded(
                      child: ValueListenableBuilder<String>(
                        valueListenable: _query,
                        builder: (context, raw, _) {
                          final query = raw.trim();
                          final waiting = foldCityLabel(query).length < 2;
                          final catalog = _catalog;
                          final matches = waiting || catalog == null
                              ? const <CityChoice>[]
                              : catalog.search(query, limit: 40);
                          return _body(waiting, matches);
                        },
                      ),
                    ),
                    if (!_loading)
                      Padding(
                        padding: EdgeInsets.fromLTRB(
                          16,
                          8,
                          16,
                          12 + MediaQuery.paddingOf(context).bottom,
                        ),
                        child: FregoPrimaryButton(
                          label: 'Confirmar',
                          onPressed: _selected == null || _saving
                              ? null
                              : () => _pick(_selected!),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _body(bool waiting, List<CityChoice> cities) {
    if (_loading) return const Center(child: FregoProgress());
    final selected = _selected;
    final rows = <CityChoice>[
      if (selected != null && !cities.any((city) => _sameCity(city, selected)))
        selected,
      ...cities,
    ];
    if (waiting && selected == null) return const SizedBox.shrink();
    if (rows.isEmpty) {
      return const Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
        child: Text(
          'Nenhuma cidade com esse nome.',
          style: TextStyle(
            fontSize: 15,
            height: 1.4,
            color: FregoColors.neutral500,
          ),
        ),
      );
    }
    return ListView.separated(
      primary: false,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 8),
      itemCount: rows.length,
      separatorBuilder: (_, _) => const CityHairline(),
      itemBuilder: (context, index) {
        final city = rows[index];
        final isSelected = selected != null && _sameCity(city, selected);
        return CityOption(
          label: city.label,
          selected: isSelected,
          enabled: !_saving,
          onTap: () => _select(city),
        );
      },
    );
  }
}
