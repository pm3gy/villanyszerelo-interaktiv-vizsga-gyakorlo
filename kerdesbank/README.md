# Kérdésbank

Ez a mappa a gyakorló, interaktív vizsga kérdésbankjának otthona.

Kezdő verzió:

- a bank gerince továbbra is feleletválasztós kérdésekből áll
- nincs `exam_mode`
- nincs `status`
- nincs `question_group_id`
- a hivatalos vizsgatípusokból már többféle forma is támogatott, ezért nem csak sima választás van benne
- képes kérdéseknél a kép külön `assets.csv` sorban van felvéve, nem a kérdésszövegbe van beégetve
- a szakmai verseny és vizsgafeladatsorok több évfolyama most már nagyobb arányban feldolgozott, nem csak egy-egy mintafeladat szerepel

Megjegyzés:

- a `question_type` mezőt megtartjuk, mert a hivatalos interaktív vizsga több feladattípust is ismer
- később ugyanebbe a sémába bele tudjuk tenni a többi típust is, ha a forrásanyagokból szükség lesz rá

## Fájlok

- `questions.csv`: a kérdés törzse
- `choices.csv`: a válaszlehetőségek
- `sources.csv`: a forrásanyagok katalógusa
- `assets.csv`: képek, ábrák, mellékelt vizuálok

## Oszlopok

### `questions.csv`

- `question_id`: egyedi azonosító, például `Q0001`
- `question_type`: feladattípus, például `single_choice`, `multi_choice`, `ordering`, `matching`, `grouping`, `list_choice`, `numeric_entry`
- `prompt_md`: a kérdés szövege Markdown formában
- `explanation_md`: rövid magyarázat, miért helyes a jó válasz
- `topic`: fő témakör, például `erintesvedelem`
- `subtopic`: finomabb alcím, például `TN-S rendszer`
- `difficulty`: 1-5 nehézségi szint
- `points`: pontérték
- `time_estimate_sec`: becsült megoldási idő másodpercben
- `source_id`: melyik forrásból származik
- `source_locator`: oldalszám, tételszám, bekezdés vagy más visszakeresési nyom
- `tags`: vesszővel tagolt kulcsszavak
- `language`: például `hu`
- `correct_answer_md`: csak `numeric_entry` típusnál használt kanonikus válasz
- `answer_tolerance`: numerikus válasznál megengedett eltérés

### `choices.csv`

- `choice_id`: egyedi azonosító, például `C0001`
- `question_id`: hivatkozás a `questions.csv` sorára
- `choice_label`: válaszjel, például `A`, `B`, `C`, `D`
- `choice_text_md`: a válasz szövege Markdown formában
- `is_correct`: `true` vagy `false`
- `sort_order`: megjelenítési sorrend
- `feedback_md`: opcionális rövid visszajelzés
- `match_role`: `left` vagy `right`, csak a `matching` típushoz
- `match_choice_id`: a hozzá tartozó jobb oldali elem azonosítója, csak `matching`-hez
- `group_label`: csoport neve, csak `grouping`-hoz

### `sources.csv`

- `source_id`: egyedi azonosító, például `S0001`
- `title`: a dokumentum címe, ha a forrásban szerepel; a fájlnevet csak végső esetben használjuk
- `path`: a fájl elérési útja a repo-ban
- `source_type`: például `pdf`, `docx`, `doc`, `ppt`, `jpg`, `folder`
- `year`: ha ismert
- `category`: például `vizsga`, `tankönyv`, `portfolio`
- `notes`: rövid megjegyzés

### `assets.csv`

- `asset_id`: egyedi azonosító
- `question_id`: melyik kérdéshez tartozik
- `path`: képfájl vagy egyéb média elérési útja
- `kind`: például `image`, `diagram`, `photo`
- `alt_text`: rövid alternatív szöveg
- `source_id`: eredeti forrás
- `source_locator`: oldalszám vagy képleírás

## Javasolt szabályok

- `difficulty` skála: 1 nagyon könnyű, 5 nehéz
- `question_type` kezdetben a forrásokból ténylegesen kinyert típus legyen
- `choices.csv`-ben egy kérdéshez egy vagy több `is_correct = true` sor tartozhat
- a választós kérdéseknél a gyakorlófelület a megjelenési sorrendet tesztindításkor összekeveri, ezért a CSV-sorok sorrendje nem jelent helyes válaszpozíciót
- kivétel az `ordering`, ahol a `sort_order` a kanonikus helyes sorrendet jelenti
- `prompt_md` lehet sima szöveg is, a Markdown csak lehetőséget ad a tagolásra
- `source_locator` legyen minél konkrétabb, hogy később vissza lehessen nézni az eredetit
- a témaneveket próbáljuk egységesen használni, például a `vezeték`, `vezetékezés`, `vezetékjelölés` és `kábel` témák most a `vezetékek` alá vannak vonva
- ha a dokumentumban van értelmezhető belső cím, azt használjuk forráscímnek a fájlnév helyett
- a képes feladatoknál a `source_locator` mellett az `assets.csv` adja meg, melyik ábra tartozik a kérdéshez

## Hivatalos feladattípusok

A hivatalos interaktív vizsgaleírás feladattípusai:

- `single_choice` - egyszeres választás
- `multi_choice` - többszörös választás
- `true_false` - igaz/hamis
- `list_choice` - egy választólista
- `ordering` - sorba rendezés
- `matching` - párosítás
- `grouping` - csoportosítás
- `numeric_entry` - szám beírása

Forrás:

- [Interaktív vizsga tájékoztató Vizsgázók _2025_1_2](https://www.nive.hu/index.php?Itemid=0&id=2382&option=com_content&view=article)

Ez alapján a mostani `question_type` mező nem csak a jelenlegi gyakorlóbank strukturálására jó, hanem a későbbi bővítésre is.

## Import elv

Először a forrásokat katalogizáljuk, aztán ezekből bontjuk ki a kérdéseket.

A bank most már nem csak interaktív vizsgaanyagokra épül, hanem az írásbeli
gyakorló feladatsorokból, érintésvédelmi, FAM- és kapcsolástechnikai tankönyvi
anyagokból is, ha ezekből tisztán megfogalmazható kérdés készíthető.

Kiegészítő forráscsoportok:

- vezetékek méretezése és feszültségesés
- túláramvédelem és biztosítók
- túlfeszültség- és villámvédelem
- szekrénytechnika, rack, kültéri és Ex p tokozatok

## Gyors kérdésfelvitel

Ha kézzel, de gyorsabban szeretnél kérdést hozzáadni, használd ezt:

```bash
python3 scripts/quick_add_question.py
```

A segéd:

- legenerálja a következő `Q...`, `C...`, `A...`, `S...` azonosítókat
- elkéri a kérdés típusát, szövegét és a válaszokat
- választathatóvá teszi a meglévő témákat és forrásokat
- opcionálisan új forrást is fel tud venni
- opcionálisan asset sorokat is létrehoz a megadott képfájlokhoz, és a helyi fájlt be is másolja a `media/` mappába
- közvetlenül a CSV-ket frissíti, így nem kell kézzel szerkesztened a táblákat

### Browser editor

Van egy külön, localhost-only böngészős szerkesztő is itt:

- `kerdesbank/editor/`

Ez a felület:

- ugyanazt a vizuális szerkezetet használja, mint a gyakorlóoldal
- csak `localhost` alatt működik
- a helyi `kerdesbank/*.csv` fájlokat közvetlenül írja
- képes meglévő kérdéseket kiválasztani és felülírni
- új kérdés és meglévő kérdés között is lehet váltani a szerkesztőben
- a kiválasztott kérdést véglegesen törölni is lehet, ilyenkor a hozzá tartozó `questions.csv`, `choices.csv` és `assets.csv` sorok is eltűnnek
- a kiválasztott képfájlokat a `kerdesbank/media/` mappába másolja

Chrome vagy Edge ajánlott, mert a mappaírás a File System Access API-t használja.

Ajánlott sorrend:

1. `sources.csv` feltöltése
2. a vizsgaanyagokból kérdések kinyerése
3. a többi jegyzetből és tankönyvből kiegészítés
4. ellenőrzés és egységesítés

## Példa

```csv
question_id;question_type;prompt_md;explanation_md;topic;subtopic;difficulty;points;time_estimate_sec;source_id;source_locator;tags;language;correct_answer_md;answer_tolerance
Q0001;single_choice;Melyik állítás igaz a TN-S rendszerre?;A TN-S rendszerben a védővezető és a nullavezető külön vezetett.;érintésvédelem;TN-S rendszer;2;1;30;S0001;3. oldal;"TN-S, érintésvédelem";hu;;
Q0002;multi_choice;Válassza ki azokat az értékeket, amelyek kisfeszültségnek számítanak!;A kisfeszültség AC esetén 1000 V-ig, DC esetén 1500 V-ig terjed.;villamos-alapok;feszültségszintek;2;1;20;S0001;71. sor;"kisfeszültség, feszültségszint";hu;;
Q0003;numeric_entry;Mekkora a megengedett feszültségesés?;A numerikus válasznál a pontos eredmény számít.;érintésvédelem;földelés;2;1;20;S0001;1. oldal;"feszültségesés";hu;4.90;0
```
