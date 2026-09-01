/// Establishment categories stored on `Business.type`.
/// Keep in sync with packages/tokens/src/business-types.ts
class FregoBusinessType {
  const FregoBusinessType({
    required this.value,
    required this.label,
    required this.plural,
    required this.group,
  });

  final String value;
  final String label;
  final String plural;
  final String group;
}

abstract final class FregoBusinessTypes {
  static const groups = <({String id, String label})>[
    (id: 'food', label: 'Alimentação'),
    (id: 'beauty', label: 'Beleza'),
    (id: 'commerce', label: 'Comércio'),
    (id: 'services', label: 'Serviços'),
  ];

  static const all = <FregoBusinessType>[
    FregoBusinessType(
      value: 'padaria',
      label: 'Padaria',
      plural: 'Padarias',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'café',
      label: 'Café',
      plural: 'Cafés',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'restaurant',
      label: 'Restaurante',
      plural: 'Restaurantes',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'pizzaria',
      label: 'Pizzaria',
      plural: 'Pizzarias',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'hamburgueria',
      label: 'Hamburgueria',
      plural: 'Hamburguerias',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'lanchonete',
      label: 'Lanchonete',
      plural: 'Lanchonetes',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'acai',
      label: 'Açaí',
      plural: 'Açaí',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'bar',
      label: 'Bar',
      plural: 'Bares',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'sorveteria',
      label: 'Sorveteria',
      plural: 'Sorveterias',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'doceria',
      label: 'Doceria',
      plural: 'Docerias',
      group: 'food',
    ),
    FregoBusinessType(
      value: 'beauty',
      label: 'Salão',
      plural: 'Salões',
      group: 'beauty',
    ),
    FregoBusinessType(
      value: 'barbearia',
      label: 'Barbearia',
      plural: 'Barbearias',
      group: 'beauty',
    ),
    FregoBusinessType(
      value: 'retail',
      label: 'Varejo',
      plural: 'Varejo',
      group: 'commerce',
    ),
    FregoBusinessType(
      value: 'farmacia',
      label: 'Farmácia',
      plural: 'Farmácias',
      group: 'commerce',
    ),
    FregoBusinessType(
      value: 'pet',
      label: 'Pet',
      plural: 'Pet',
      group: 'commerce',
    ),
    FregoBusinessType(
      value: 'academia',
      label: 'Academia',
      plural: 'Academias',
      group: 'services',
    ),
    FregoBusinessType(
      value: 'outros',
      label: 'Outros',
      plural: 'Outros',
      group: 'services',
    ),
  ];

  static FregoBusinessType? find(String? value) {
    if (value == null || value.isEmpty) return null;
    for (final t in all) {
      if (t.value == value) return t;
    }
    return null;
  }

  static String labelOf(String? value) => find(value)?.label ?? value ?? 'Outros';

  static String pluralOf(String? value) =>
      find(value)?.plural ?? (value == null || value.isEmpty ? 'Outros' : value);

  static int sortIndex(String? value) {
    final i = all.indexWhere((t) => t.value == value);
    return i < 0 ? 1000 : i;
  }
}
