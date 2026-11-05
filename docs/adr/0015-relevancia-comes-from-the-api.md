# Relevância comes from the API

`GET /me/exploration` returns one Cliente's Exploração already ordered: how many Campanhas she can Resgatar in that city, then one section per Tipo that has a Visível Estabelecimento there. Each section lists that Tipo's Estabelecimentos and the Campanhas that apply, in full. The app renders sections in the order received, shows the first 8 of each row, and filters search and chips without sorting. Ver todas uses those same lists.

A Tipo where she can Resgatar now comes first, then a Tipo where she has a Favorito, then the fixed Tipo order. A Tipo that qualifies for both appears once, in the first group. Estabelecimentos are Favoritos, then name. Campanhas are Resgatar-now, then a Favorito Estabelecimento, then Promoção, then the Estabelecimento name and the Campanha name. Cashback is never Resgatar-now. A birthday Campanha is not a Promoção for this order. No score is shown. Changing these rules is a server change.

## Considered Options

- **Sort on the device.** The same rules, frozen in each installed version. Rejected: Relevância has to change without an app release, and two phones in one city have to differ.
- **Return only the 8 preview cards.** Ver todas would be a second ordering. Rejected: the preview and the full list stay one sequence.
- **The API owns the order.** Chosen.
