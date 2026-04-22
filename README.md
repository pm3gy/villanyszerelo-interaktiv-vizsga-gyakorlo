# Villanyszerelő interaktív vizsga gyakorló

Ez a repó kizárólag a gyakorlóeszköz anyagait tartalmazza:

- a kérdésbank CSV-i
- a statikus gyakorlófelület kódja
- a hozzájuk tartozó dokumentáció
- a szükséges képi assetek

Nyers szakmai forrásanyagokat nem terjesztünk ebben a repóban.

## Tartalom

- `06-kerdesbank`: a kérdésbank, a forráskatalógus és a feldolgozó scriptek
- `07-vizsga-mvp`: a hostolható statikus gyakorlófelület

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
cd /Users/peter/Documents/villany/interaktiv-vizsga-gyakorlo
python3 -m http.server 8000
```

Ezután a gyakorlófelület itt érhető el:

`http://localhost:8000/07-vizsga-mvp/`

## Kérdésbank bővítése

- a kérdések a `06-kerdesbank/questions.csv` fájlban vannak
- a válaszlehetőségek a `06-kerdesbank/choices.csv` fájlban vannak
- a források a `06-kerdesbank/sources.csv` fájlban vannak
- a képek és egyéb médiák az `06-kerdesbank/assets.csv` fájlban vannak

A bővítő scriptek:

- `06-kerdesbank/scripts/append_batch_2026_04_19.py`
- `06-kerdesbank/scripts/dedupe_bank_2026_04_19.py`

## Repo-szabály

- csak a gyakorlóeszköz maradjon a repóban
- a nyers forrásanyagok maradjanak helyben, de ne kerüljenek a Gitbe

