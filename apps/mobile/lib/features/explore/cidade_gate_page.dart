import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
  final _focus = FocusNode();
  late final AnimationController _enter;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  CityChoice? _selected;
  List<CityChoice> _cities = const [];
  int _keyboardRestores = 0;

  @override
  void initState() {
    super.initState();
    _focus.addListener(_onFocusChanged);
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..forward();
    _enter.addStatusListener((status) {
      if (status == AnimationStatus.completed && mounted && !_saving) {
        _focus.requestFocus();
        SystemChannels.textInput.invokeMethod<void>('TextInput.show');
      }
    });
    _load();
  }

  @override
  void dispose() {
    _focus.removeListener(_onFocusChanged);
    _focus.dispose();
    _search.dispose();
    _enter.dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (_focus.hasFocus || _saving || _selected != null || !mounted) return;
    if (_keyboardRestores >= 4) return;
    _keyboardRestores++;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _saving || _selected != null || _focus.hasFocus) return;
      _focus.requestFocus();
      SystemChannels.textInput.invokeMethod<void>('TextInput.show');
    });
  }

  void _showKeyboard() {
    _keyboardRestores = 0;
    if (!_focus.hasFocus) {
      _focus.requestFocus();
    }
    SystemChannels.textInput.invokeMethod<void>('TextInput.show');
  }

  Future<void> _load() async {
    try {
      final cities = await loadHomeCities();
      if (!mounted) return;
      setState(() {
        _cities = cities;
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
    _keyboardRestores = 4;
    setState(() => _selected = city);
    _focus.unfocus();
  }

  bool _sameCity(CityChoice a, CityChoice b) {
    return a.city == b.city && a.state == b.state;
  }

  Future<void> _pick(CityChoice city) async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await updateMyCustomer(city: city.city, state: city.state);
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
    final screen = MediaQuery.sizeOf(context).height;
    // The field has to sit above the keyboard without moving when it opens.
    // Shifting the sheet with the inset makes iOS resign the field and the
    // keyboard disappears before a letter can be typed.
    final height = screen * 0.72;

    final query = _search.text.trim();
    final waiting = foldCityLabel(query).length < 2;
    final matches = waiting
        ? const <CityChoice>[]
        : filterCities(_cities, query);
    final cities = matches.length > 40 ? matches.sublist(0, 40) : matches;

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
                              onTap: _showKeyboard,
                              onChanged: (_) {
                                _keyboardRestores = 0;
                                setState(() {});
                              },
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
                    if (_error != null && _cities.isEmpty)
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
                    Expanded(child: _body(waiting, cities)),
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
      if (selected != null &&
          !cities.any((city) => _sameCity(city, selected)))
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
