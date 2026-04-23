# Villanyszerelő - Épületvillamosság (4 0713 04 07) | Interaktív vizsga gyakorló

Ez egy statikus, hostolható gyakorlófelület a kérdésbankhoz.

## Mit tud most

- CSV-ből betölti a kérdésbankot
- támogatja a sima választós, igaz/hamis, listás, sorrendezős, párosítós, csoportosítós és numerikus kérdéseket is
- a képes feladatoknál az `assets.csv` alapján megjeleníti a kapcsolt ábrákat és fotókat
- témakör szerint szűrhető
- állítható kérdésszámot támogat
- jelöli a kérdést későbbre
- külön listázza az átlépett kérdéseket
- visszanavigálható kérdéslista
- automatikus kiértékelés a teszt végén
- végső eredmény statisztikával
- állapotmentés böngészőben

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
