import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../api/frego_api.dart';
import '../../theme/frego_icons.dart';
import '../../theme/frego_theme.dart';
import '../../ui/adaptive.dart';

class CityChoice {
  const CityChoice({required this.city, required this.state});

  final String city;
  final String state;

  String get label => '$city, $state';

  static CityChoice? fromMap(Map<String, dynamic>? raw) {
    final city = (raw?['city'] as String?)?.trim();
    final state = (raw?['state'] as String?)?.trim();
    if (city == null || city.isEmpty || state == null || state.isEmpty) {
      return null;
    }
    return CityChoice(city: city, state: state);
  }
}

List<CityChoice> _choicesFrom(List<Map<String, dynamic>> rows) {
  return [
    for (final row in rows)
      if (CityChoice.fromMap(row) != null) CityChoice.fromMap(row)!,
  ];
}

Future<List<CityChoice>> loadCityChoices() async {
  return _choicesFrom(await fetchExplorationCities());
}

List<CityChoice>? _homeCities;

/// Where she lives. Every municipality, not the cities that already have a place.
Future<List<CityChoice>> loadHomeCities() async {
  final cached = _homeCities;
  if (cached != null) return cached;
  final cities = _choicesFrom(await fetchHomeCities());
  _homeCities = cities;
  return cities;
}

Future<CityChoice?> pickCity(
  BuildContext context, {
  CityChoice? selected,
}) async {
  final cities = await loadCityChoices();
  if (!context.mounted) return null;
  if (cities.isEmpty) {
    FregoAdaptive.showMessage(
      context,
      'Ainda não há cidades com estabelecimentos.',
    );
    return null;
  }
  return FregoAdaptive.push<CityChoice>(
    context,
    CityPickerPage(
      cities: cities,
      selected: selected,
      title: 'Cidade',
      subtitle: 'A lista mostra cidades com lugares visíveis.',
    ),
  );
}

Future<CityChoice?> pickHomeCity(
  BuildContext context, {
  CityChoice? selected,
}) async {
  final cities = await loadHomeCities();
  if (!context.mounted) return null;
  if (cities.isEmpty) {
    FregoAdaptive.showMessage(
      context,
      'Não foi possível carregar as cidades. Tente de novo.',
    );
    return null;
  }
  return FregoAdaptive.push<CityChoice>(
    context,
    CityPickerPage(
      cities: cities,
      selected: selected,
      title: 'Onde você mora?',
      subtitle: 'Qualquer cidade do Brasil. A exploração começa nela.',
      requireQuery: true,
    ),
  );
}

String foldCityLabel(String value) {
  const from = 'áàâãäéèêëíìîïóòôõöúùûüçñ';
  const to = 'aaaaaeeeeiiiiooooouuuucn';
  final buffer = StringBuffer();
  for (final code in value.trim().toLowerCase().runes) {
    final ch = String.fromCharCode(code);
    final i = from.indexOf(ch);
    buffer.write(i >= 0 ? to[i] : ch);
  }
  return buffer.toString().replaceAll(RegExp(r'\s+'), ' ');
}

List<CityChoice> filterCities(List<CityChoice> cities, String query) {
  final q = foldCityLabel(query);
  if (q.isEmpty) return cities;
  return [
    for (final city in cities)
      if (foldCityLabel(city.city).contains(q) ||
          foldCityLabel(city.label).contains(q))
        city,
  ];
}

class CityPickerPage extends StatefulWidget {
  const CityPickerPage({
    super.key,
    required this.cities,
    required this.title,
    required this.subtitle,
    this.selected,
    this.requireQuery = false,
  });

  final List<CityChoice> cities;
  final CityChoice? selected;
  final String title;
  final String subtitle;
  final bool requireQuery;

  @override
  State<CityPickerPage> createState() => _CityPickerPageState();
}

class _CityPickerPageState extends State<CityPickerPage> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _search.text.trim();
    final waiting = widget.requireQuery && foldCityLabel(query).length < 2;
    final matches = waiting ? const <CityChoice>[] : filterCities(widget.cities, query);
    final cities = matches.length > 40 ? matches.sublist(0, 40) : matches;

    return CityBlueHeader(
      title: widget.title,
      subtitle: widget.subtitle,
      onBack: () => Navigator.of(context).pop(),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: FregoTextField(
              controller: _search,
              label: 'Buscar',
              placeholder: 'Nome da cidade',
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: waiting
                ? const SizedBox.shrink()
                : cities.isEmpty
                    ? const _CityPrompt(text: 'Nenhuma cidade com esse nome.')
                    : ListView.separated(
                        primary: false,
                        padding: const EdgeInsets.fromLTRB(0, 4, 0, 24),
                        itemCount: cities.length + (matches.length > cities.length ? 1 : 0),
                        separatorBuilder: (_, _) => const SizedBox(height: 2),
                        itemBuilder: (context, index) {
                          if (index >= cities.length) {
                            return const _CityPrompt(
                              text: 'Continue digitando para ver mais.',
                            );
                          }
                          final city = cities[index];
                          final selected = widget.selected?.city == city.city &&
                              widget.selected?.state == city.state;
                          return CityOption(
                            label: city.label,
                            selected: selected,
                            onTap: () => Navigator.of(context).pop(city),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

const _statusBarOnAzul = SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,
  statusBarBrightness: Brightness.dark,
  systemStatusBarContrastEnforced: false,
);

class CityBlueHeader extends StatelessWidget {
  const CityBlueHeader({
    super.key,
    required this.title,
    required this.child,
    this.subtitle,
    this.onBack,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top;
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _statusBarOnAzul,
      child: ColoredBox(
        color: FregoColors.neutralBg,
        child: Column(
          children: [
            ColoredBox(
              color: FregoColors.azul,
              child: Padding(
                padding: EdgeInsets.fromLTRB(8, top + 8, 20, 20),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (onBack != null)
                      GestureDetector(
                        onTap: onBack,
                        behavior: HitTestBehavior.opaque,
                        child: const SizedBox(
                          width: 44,
                          height: 44,
                          child: Icon(FregoIcons.back, color: FregoColors.white),
                        ),
                      )
                    else
                      const SizedBox(width: 12),
                    Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: onBack != null ? 8 : 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontSize: 28,
                                height: 1.1,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.56,
                                color: FregoColors.white,
                              ),
                            ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                subtitle!,
                                style: TextStyle(
                                  fontSize: 15,
                                  height: 1.35,
                                  color: FregoColors.white.withValues(alpha: 0.92),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: MediaQuery.removePadding(
                context: context,
                removeTop: true,
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class CityOption extends StatelessWidget {
  const CityOption({
    super.key,
    required this.label,
    required this.onTap,
    this.subtitle,
    this.selected = false,
    this.enabled = true,
  });

  final String label;
  final String? subtitle;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? onTap : null,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: selected ? FregoColors.card : Colors.transparent,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: selected ? FregoColors.azul : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: selected ? 14 : 4,
              vertical: 14,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight:
                              selected ? FontWeight.w600 : FontWeight.w400,
                          color: enabled
                              ? FregoColors.ink
                              : FregoColors.neutral500,
                        ),
                      ),
                      if (subtitle != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Text(
                            subtitle!,
                            style: const TextStyle(
                              fontSize: 13,
                              color: FregoColors.neutral500,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                if (selected)
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      color: FregoColors.azul,
                      shape: BoxShape.circle,
                    ),
                    child: SizedBox(
                      width: 26,
                      height: 26,
                      child: Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: FregoColors.white,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CityPrompt extends StatelessWidget {
  const _CityPrompt({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 0),
      child: Text(
        text,
        style: const TextStyle(
          fontSize: 15,
          height: 1.4,
          color: FregoColors.neutral500,
        ),
      ),
    );
  }
}

class CityHairline extends StatelessWidget {
  const CityHairline();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.only(left: 16),
      child: ColoredBox(
        color: FregoColors.hairline,
        child: SizedBox(height: 0.5, width: double.infinity),
      ),
    );
  }
}
