# Villanyszerelő - Épületvillamosság (4 0713 04 07) | Interaktív vizsga gyakorló

Ez egy statikus, hostolható gyakorlófelület a kérdésbankhoz.

## Mit tud most

- CSV-ből betölti a kérdésbankot
- támogatja a sima választós, igaz/hamis, listás, sorrendezős, párosítós, csoportosítós és numerikus kérdéseket is
- a képes feladatoknál az `assets.csv` alapján megjeleníti a kapcsolt ábrákat és fotókat
- témakör szerint szűrhető
- állítható kérdésszámot támogat
- jelöli a kérdést későbbre
- automatikus kiértékelés a teszt végén
- végső eredmény statisztikával
- állapotmentés böngészőben
- vizsgaóra a hivatalos 90 perces időkeretből, kb. 40 kérdéses arányosítással
- az állapot és az áttekintés a fejlécben látszik

## Amit még nem tud

- `test mode`

## Adatforrások

- `../kerdesbank/questions.csv`
- `../kerdesbank/choices.csv`
- `../kerdesbank/sources.csv`
- `../kerdesbank/assets.csv`

## Helyi futtatás

A felületet a repo gyökeréből indított statikus szerverrel érdemes futtatni, például:

```bash
cd <repo-root>
python3 -m http.server 8000
```

Ezután a böngészőben nyisd meg:

`http://localhost:8000/vizsga-mvp/`

## Hostolás

Bármely statikus hosztra feltehető, amely a repo struktúráját megtartja.
Ha a teljes repó gyökere kerül kiszolgálásra, a CSV-k relatív útvonala működni fog.

## Vizsgaóra

A beépített vizsgaóra a hivatalos `90 perc` időkeretből indul ki, és a gyakorlatban
használt, hozzávetőleges `kb. 40 kérdés` baseline alapján arányosítja a rendelkezésre álló időt.
Ez azt jelenti, hogy a kiválasztott kérdésszámhoz képest mutatja a hátralévő időt,
nem pedig egy fix, minden tesztre azonos futási időt.
