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
  late final AnimationController _enter;
  bool _loading = true;
  bool _saving = false;
  String? _error;
  List<CityChoice> _cities = const [];

  @override
  void initState() {
    super.initState();
    _enter = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    )..forward();
    _load();
  }

  @override
  void dispose() {
    _search.dispose();
    _enter.dispose();
    super.dispose();
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
    final media = MediaQuery.of(context);
    final keyboard = media.viewInsets.bottom;
    final screen = media.size.height;
    final half = screen * 0.5;
    final aboveKeyboard = screen - media.padding.top - 12 - keyboard;
    final height = keyboard == 0
        ? half
        : aboveKeyboard.clamp(0.0, screen * 0.92);

    final query = _search.text.trim();
    final waiting = foldCityLabel(query).length < 2;
    final matches =
        waiting ? const <CityChoice>[] : filterCities(_cities, query);
    final cities = matches.length > 40 ? matches.sublist(0, 40) : matches;

    return GestureDetector(
      onTap: () {},
      behavior: HitTestBehavior.opaque,
      child: ColoredBox(
        color: const Color(0x73000000),
        child: Padding(
          padding: EdgeInsets.only(bottom: keyboard),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 1),
                end: Offset.zero,
              ).animate(CurvedAnimation(
                parent: _enter,
                curve: Curves.easeOutCubic,
              )),
              child: SizedBox(
                height: height,
                width: double.infinity,
                child: DecoratedBox(
                  decoration: const BoxDecoration(
                    color: FregoColors.card,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(24),
                    ),
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
                        child: FregoTextField(
                          controller: _search,
                          placeholder: 'Nome da cidade',
                          enabled: !_saving,
                          onChanged: (_) => setState(() {}),
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
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _body(bool waiting, List<CityChoice> cities) {
    if (_loading) return const Center(child: FregoProgress());
    if (waiting) return const SizedBox.shrink();
    if (cities.isEmpty) {
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
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(0, 4, 0, 16 + MediaQuery.paddingOf(context).bottom),
      itemCount: cities.length,
      separatorBuilder: (_, _) => const CityHairline(),
      itemBuilder: (context, index) {
        final city = cities[index];
        return CityOption(
          label: city.label,
          enabled: !_saving,
          onTap: () => _pick(city),
        );
      },
    );
  }
}
