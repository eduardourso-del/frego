import 'package:flutter/material.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';
import 'city_picker.dart';
import 'device_location.dart';
import 'use_location_button.dart';

/// Half-screen sheet. The Cliente has to set Cidade before using the app.
class CidadeGatePage extends StatefulWidget {
  const CidadeGatePage({super.key, required this.onPicked, this.initialCity});

  final VoidCallback onPicked;

  /// Set when she already has a Cidade and is only being asked about location.
  final CityChoice? initialCity;

  @override
  State<CidadeGatePage> createState() => _CidadeGatePageState();
}

class _CidadeGatePageState extends State<CidadeGatePage>
    with SingleTickerProviderStateMixin {
  final _search = TextEditingController();
  final _query = ValueNotifier<String>('');
  final _focus = FocusNode();
  final _fieldKey = GlobalKey();
  late final AnimationController _enter;
  late final CurvedAnimation _curve;
  late final Animation<Offset> _slide;
  double _fullHeight = 0;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  CityChoice? _selected;
  CityCatalog? _catalog;

  @override
  void initState() {
    super.initState();
    _search.addListener(_onSearch);
    _selected = widget.initialCity;
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..forward();
    _curve = CurvedAnimation(parent: _enter, curve: Curves.easeOutCubic);
    _slide = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(_curve);
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
    _curve.dispose();
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
      await DeviceLocation.markOffered();
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
        final reported = MediaQuery.sizeOf(context).height;
        if (reported > _fullHeight) _fullHeight = reported;
        final full = _fullHeight == 0 ? reported : _fullHeight;
        // The top edge stays where it was before the keyboard. Only the
        // bottom shortens, so the field does not move and iOS keeps the
        // keyboard. A moving field resigns first responder mid-tap.
        final inset = MediaQuery.viewInsetsOf(context).bottom;
        final visible = constraints.maxHeight;
        final room = visible < full - inset ? visible : full - inset;
        // Keep the header and the field on screen. Shift the top only when
        // the keyboard would otherwise crush them.
        const minSheet = 260.0;
        var top = full * 0.28;
        var height = room - top;
        if (height < minSheet) {
          height = room < minSheet ? room : minSheet;
          top = room - height;
          if (top < 0) top = 0;
        }
        final keyboardOpen = room < full - 1;
        return _sheet(top, height < 1 ? 1 : height, keyboardOpen);
      },
    );
  }

  Widget _sheet(double top, double height, bool keyboardOpen) {
    return Stack(
      fit: StackFit.expand,
      children: [
        const ModalBarrier(color: Color(0x73000000), dismissible: false),
        Positioned(
          top: top,
          left: 0,
          right: 0,
          height: height,
          child: SlideTransition(
            position: _slide,
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
                      'Use sua localização para ver a distância. Sem ela, escolha a cidade.',
                      style: TextStyle(
                        fontSize: 15,
                        height: 1.4,
                        color: FregoColors.neutral500,
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: UseMyLocationButton(
                      enabled: !_saving,
                      onResolved: _pick,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                    child: Material(
                      type: MaterialType.transparency,
                      child: TextField(
                        key: _fieldKey,
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
                        onTapUpOutside: (_) {},
                      ),
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
                        return _results(waiting, matches);
                      },
                    ),
                  ),
                  if (!_loading && !keyboardOpen)
                    Padding(
                      padding: EdgeInsets.fromLTRB(
                        16,
                        8,
                        16,
                        12 + MediaQuery.viewPaddingOf(context).bottom,
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
      ],
    );
  }

  Widget _results(bool waiting, List<CityChoice> cities) {
    final selected = _selected;
    final rows = <CityChoice>[
      if (!_loading &&
          selected != null &&
          !cities.any((city) => _sameCity(city, selected)))
        selected,
      ...cities,
    ];
    return ListView(
      primary: false,
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.manual,
      padding: const EdgeInsets.fromLTRB(0, 4, 0, 8),
      children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 0),
            child: Text(
              _error!,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
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
        if (_loading)
          const Padding(
            padding: EdgeInsets.only(top: 24),
            child: Center(child: FregoProgress()),
          )
        else if (waiting && selected == null)
          const SizedBox.shrink()
        else if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 0),
            child: Text(
              'Nenhuma cidade com esse nome.',
              style: TextStyle(
                fontSize: 15,
                height: 1.4,
                color: FregoColors.neutral500,
              ),
            ),
          )
        else
          for (var index = 0; index < rows.length; index++) ...[
            if (index > 0) const CityHairline(),
            CityOption(
              label: rows[index].label,
              selected: selected != null && _sameCity(rows[index], selected),
              enabled: !_saving,
              onTap: () => _select(rows[index]),
            ),
          ],
      ],
    );
  }
}
