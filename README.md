# Villanyszerelő interaktív vizsga gyakorló

Ez a repó kizárólag a gyakorlóeszköz anyagait tartalmazza:

- a kérdésbank CSV-i
- a statikus gyakorlófelület kódja
- a hozzájuk tartozó dokumentáció
- a szükséges képi assetek

Nyers szakmai forrásanyagokat nem terjesztünk ebben a repóban.

## Tartalom

- `kerdesbank`: a kérdésbank, a forráskatalógus és a feldolgozó scriptek
- `vizsga-mvp`: a hostolható statikus gyakorlófelület
- `index.html`: a gyökér belépőoldala
- `infok`: projektcél, dokumentáció és kapcsolat

## Jelenlegi állapot

- 240 kérdés
- 895 válaszsor
- 35 forrás
- támogatott típusok:
  - `single_choice`
  - `multi_choice`
  - `true_false`
  - `list_choice`
  - `ordering`
  - `matching`
  - `grouping`
  - `numeric_entry`

## Helyi futtatás

Indíts statikus szervert a repó gyökeréből:

```bash
cd <repo-root>
python3 -m http.server 8000
```

Ezután a gyakorlófelület itt érhető el:

`http://localhost:8000/`

A fő belépőoldalról külön is nyitható:

`http://localhost:8000/vizsga-mvp/`

`http://localhost:8000/infok/`

`http://localhost:8000/kerdesbank/`

Ha közvetlenül a gyakorlófelületet akarod nézni, a `vizsga-mvp/` útvonalat nyisd meg.

## Kérdésbank bővítése

- a kérdések a `kerdesbank/questions.csv` fájlban vannak
- a válaszlehetőségek a `kerdesbank/choices.csv` fájlban vannak
- a források a `kerdesbank/sources.csv` fájlban vannak
- a képek és egyéb médiák a `kerdesbank/assets.csv` fájlban vannak

A bővítő scriptek:

- `kerdesbank/scripts/append_batch_2026_04_19.py`
- `kerdesbank/scripts/dedupe_bank_2026_04_19.py`

## Repo-szabály

- csak a gyakorlóeszköz maradjon a repóban
- a nyers forrásanyagok maradjanak helyben, de ne kerüljenek a Gitbe

## Hostolás

A repó Cloudflare Pages alatt közvetlenül hostolható, mert a gyökérben van egy önálló `index.html`.
Backendre nincs szükség, a kérdésbank CSV-k és a statikus UI ugyanarról a site-ról tölthetők.
