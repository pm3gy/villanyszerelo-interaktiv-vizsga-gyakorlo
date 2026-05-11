from __future__ import annotations

import csv
import random
import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]

FACTS_TSV = """
S0003|13. oldal|villamos-alapok|villamosenergia-rendszer|2|1|20|A villamosenergia-rendszer részei az erőművek, a hálózati összeköttetések és az állomások.|Melyik felsorolás írja le a villamosenergia-rendszer fő részeit?|erőművek, hálózati összeköttetések és állomások|csak a fogyasztók és a kapcsolók|relék, biztosítók és lámpatestek|dugaljak, lámpák és kapcsolók|A forrás a rendszer három fő részét sorolja fel.
S0003|13. oldal|villamos-alapok|hálózati csatlakozás|2|1|20|A lakóépületek hálózati csatlakozására vonatkozó előírásokat az MSZ 447 tartalmazza.|Melyik szabvány foglalkozik a lakóépületek hálózati csatlakozásával?|MSZ 447|MSZ EN 60204-1|MSZ EN 61439|MSZ EN 62305|A forrás az MSZ 447-et nevezi meg.
S0003|14. oldal|vezetékek|csatlakozó vezeték|2|1|20|A csatlakozó vezeték feszültségesése legfeljebb 1% lehet.|Mekkora lehet legfeljebb a csatlakozó vezeték feszültségesése?|1%|2%|3%|5%|A forrás 1%-os felső határt ad.
S0003|14. oldal|vezetékek|szabadvezetékes csatlakozás|2|1|20|Szabadvezetékes csatlakozást legfeljebb 6 lakásos épületig és 20 kW csatlakozási teljesítményig javasolt létesíteni.|Milyen határértékekhez kötik a szabadvezetékes csatlakozást?|6 lakás és 20 kW|8 lakás és 25 kW|10 lakás és 30 kW|4 lakás és 16 kW|A forrás ezt a két határt adja meg.
S0003|14. oldal|villamos-berendezések|főelosztó|2|1|20|A főelosztó lehet falon kívüli vagy süllyesztett kivitelű, és anyaga lehet fém vagy nehezen éghető anyag.|Milyen kialakítás jellemző a főelosztóra?|Falon kívüli vagy süllyesztett, fém vagy nehezen éghető anyagból|Csak falba süllyesztett, mindig műanyagból|Csak kültéri, mindig alumíniumból|Csak beltéri, mindig üvegből|A forrás ezt a kialakítást emeli ki.
S0003|15. oldal|kapcsolások|áramköri felosztás|2|1|20|A lakás áramköreit logikai, teljesítmény-, elhelyezkedés- és karbantarthatósági szempont szerint célszerű szétosztani.|Melyik szempont szerepel a lakás áramköri felosztásánál?|logikai, teljesítmény-, elhelyezkedés- és karbantarthatósági|csak esztétikai|csak színezési|csak költségszerinti|A forrás ezeket a szempontokat sorolja.
S0003|15. oldal|kapcsolások|külön áramkörök|2|1|20|A nagy teljesítményű fogyasztók külön áramkörről működjenek.|Mi igaz a nagy teljesítményű fogyasztókra?|Külön áramkörről célszerű működniük|Mindig ugyanarra a világítási körre kell őket kötni|A dugalj körbe kell őket kötelezően kötni|Csak soros kapcsolásban használhatók|A forrás külön áramkört javasol.
S0003|18. oldal|világítás|IP védettség|2|1|20|A lámpatestek alapvédettsége IP20.|Mi a lámpatestek alapvédettsége a forrás szerint?|IP20|IP44|IP54|IP67|A forrás ezt adja meg alapértékként.
S0003|19. oldal|védelem|túláram|2|1|20|A túláram két fő típusa a túlterhelési áram és a zárlati áram.|Melyik felsorolás adja meg a túláram két fő típusát?|túlterhelési áram és zárlati áram|feszültségesés és áramingadozás|hőveszteség és villámáram|szivárgóáram és indukáltáram|A forrás ezt a két típust különíti el.
S0003|19. oldal|védelem|hőkioldó|2|1|20|A bimetálos hőkioldó túlterheléskor elhajlik és bontja az áramkört.|Mi történik a bimetálos hőkioldóval túlterheléskor?|Elhajlik és nyitja az áramkört|Mágnesesen zárja az áramkört|Csak mérőáramkört nyit|Nem reagál a melegedésre|A forrás ezt írja le működésként.
S0003|20. oldal|érintésvédelem|SELV|2|1|20|A biztonsági törpefeszültség felső határa váltakozó áramnál 50 V, egyenáramnál 120 V.|Mekkora a biztonsági törpefeszültség felső határa?|50 V AC és 120 V DC|230 V AC és 400 V DC|24 V AC és 48 V DC|12 V AC és 24 V DC|A forrás a két határértéket adja meg.
S0003|20. oldal|érintésvédelem|II. osztály|2|1|20|A II. érintésvédelmi osztályú szerkezetek kiegészítő vagy megerősített szigeteléssel rendelkeznek, és nincs rajtuk védőkapocs.|Melyik állítás igaz a II. érintésvédelmi osztályra?|Kiegészítő vagy megerősített szigeteléssel rendelkezik, védőkapocs nélkül|Mindig szükséges hozzá külön PE vezető|Csak törpefeszültségről működik|Csak fémházas lehet|A forrás így jellemzi a II. osztályt.
S0003|7. oldal|érintésvédelem|TN rendszer|2|1|20|A TN rendszerben a megengedett limitfeszültség 50 V.|Mekkora a TN rendszerben megengedett limitfeszültség?|50 V|120 V|230 V|400 V|A forrás 50 V-ot ad meg.
S0003|7. oldal|érintésvédelem|TT rendszer|2|1|20|A TT rendszerben az RA és Ia szorzatának legfeljebb 50 V-nak kell lennie.|Melyik összefüggés igaz a TT rendszerre?|RA × Ia ≤ 50 V|RA × Ia ≥ 230 V|RA + Ia ≤ 50 V|RA / Ia ≤ 50 V|A forrás ezt a méretezési feltételt adja meg.
S0003|7. oldal|érintésvédelem|ÁVK|2|1|20|Az áram-védőkapcsoló nem önálló hibavédelmi mód, hanem a rendszer hatékonyságát növeli.|Mi igaz az áram-védőkapcsolóra?|Nem önálló hibavédelmi mód, hanem hatékonyságnövelő eszköz|Önállóan minden esetben elég a védelemhez|Csak túláramvédelemre való|Csak világítási körökben használható|A forrás ezt hangsúlyozza.
S0003|8. oldal|érintésvédelem|EPH|2|1|20|Az EPH-csomópontba a védővezető gerincvezetékét, a földelővezetőket és a releváns fém szerkezeteket kell bekötni.|Mit kell az EPH-hálózatba bekötni?|Védővezető gerincvezetéket, földelővezetőket és fém szerkezeteket|Csak a lámpatesteket|Csak a nulla vezetőt|Csak a biztosítók előtti szakaszt|A forrás ezt a bekötési logikát írja elő.
S0003|9. oldal|védelem|villámvédelem|2|1|20|A külső villámvédelem elemei a felfogó, a levezető és a földelő.|Melyik felsorolás adja meg a külső villámvédelem elemeit?|felfogó, levezető és földelő|kapcsoló, biztosító és relé|N, PE és PEN|lámpa, dugalj és kapcsoló|A forrás ezt a hármasságot adja meg.
S0003|9. oldal|védelem|túlfeszültségvédelem|2|1|20|A többlépcsős túlfeszültségvédelem 1., 2. és 3. osztályú fokozatokból áll.|Melyik fokozatsorozat szerepel a többlépcsős túlfeszültségvédelemnél?|1., 2. és 3. osztály|A, B és C betűs fokozat|TN, TT és IT|gL/gG, aM/gM és gR/aR|A forrás három fokozatot különít el.
S0003|10. oldal|transzformátor|kapcsolási csoportok|2|1|20|A transzformátorok kapcsolásai között szerepel a csillag, a delta és a zegzug kapcsolás.|Melyik felsorolás tartozik a transzformátor kapcsolásaihoz?|csillag, delta és zegzug|egypólusú, kétpólusú és hárompólusú|soros, párhuzamos és vegyes|felfogó, levezető és földelő|A forrás ezt a három kapcsolást nevezi meg.
S0003|10. oldal|motorok|aszinkron motor|2|1|20|A háromfázisú aszinkron motor fő fajtái a kalickás és a csúszógyűrűs kivitel.|Melyik felsorolás adja meg a háromfázisú aszinkron motor fő fajtáit?|kalickás és csúszógyűrűs|egyenáramú és szinkron|soros és párhuzamos|lépcsős és induktív|A forrás ezt a két fő típust említi.
S0003|11. oldal|kapcsolók|relé|2|1|20|A relé és a mágneskapcsoló között az egyik fő különbség az, hogy a relé inkább gyengeáramú, a mágneskapcsoló pedig erősáramú alkalmazásra való.|Mi a relé és a mágneskapcsoló közti alapvető különbség?|A relé gyengeáramú, a mágneskapcsoló erősáramú alkalmazásra való|A relé erősáramú, a mágneskapcsoló gyengeáramú|Mindkettő kizárólag világításra való|Mindkettő csak egyenáramban használható|A forrás ezt a felhasználást különíti el.
S0003|12. oldal|védelem|villamosív|2|1|20|A villamos ív a két fémelektróda, az anód és a katód között jön létre.|Hol jön létre a villamos ív?|Az anód és a katód között|A PE és N vezető között|A felfogó és a földelő között|A kapcsoló és a biztosító között|A forrás így definiálja az ív helyét.
S0003|12. oldal|védelem|kapcsolókészülékek|2|1|20|A kapcsolókészülékeket a megszakítási áram nagysága szerint csoportosíthatjuk.|Mi szerint csoportosíthatók a kapcsolókészülékek?|A megszakítási áram nagysága szerint|Csak a színük szerint|Csak a méretük szerint|Csak a gyártási évük szerint|A forrás ezt a csoportosítást adja meg.
S0013|2. oldal|kapcsolók|egysarkú kapcsoló|2|1|15|Az egysarkú kapcsoló egy világítási kört egy helyről kapcsol, és a fázisvezetőt szakítja meg.|Mi igaz az egysarkú kapcsolóra?|Egy helyről kapcsol egy világítási kört, a fázist szakítja meg|Mindkét pólust egyszerre szakítja nedves helyiségben|Három fázist kapcsol egyszerre|Két külön világítási kört vezérel távolról|A forrás ezt az alkalmazást írja le.
S0013|4. oldal|kapcsolók|kétsarkú kapcsoló|2|1|15|A kétsarkú kapcsoló a nulla és a fázis egyszerre történő megszakítására is alkalmas.|Mi jellemző a kétsarkú kapcsolóra?|A nulla és a fázis egyszerre történő megszakítására alkalmas|Csak a védővezetőt szakítja meg|Csak háromfázisú motorok indítására való|Csak jelzőfényekkel használható|A forrás ezt a feladatot emeli ki.
S0013|6. oldal|kapcsolók|csillárkapcsoló|2|1|15|A csillárkapcsoló kétáramkörös kapcsoló, osztott lámpatestek kapcsolására.|Mi a csillárkapcsoló feladata?|Osztott lámpatestek vagy két világítási áramkör kapcsolása|Három fázis egyidejű kapcsolása|Csak a védővezető kapcsolása|Kismegszakító tesztelése|A forrás ezt a használatot adja meg.
S0014|2. oldal|kapcsolók|váltókapcsoló|2|1|15|A váltókapcsoló egy világítási kör két helyről való kapcsolására szolgál.|Mi igaz a váltókapcsolóra?|Egy világítási kör két helyről való kapcsolására szolgál|Csak csillárokhoz használható|Csak háromfázisú körben működik|Csak a fázis előtti biztosítót kapcsolja|A forrás ezt az alkalmazást sorolja.
S0014|5. oldal|kapcsolók|keresztkapcsoló|2|1|15|A keresztkapcsoló három vagy több helyről vezérelt világítási körökben használatos.|Hol használják a keresztkapcsolót?|Három vagy több helyről vezérelt világítási körökben|Csak egyetlen nyomógombhoz|Csak zárlatvédelemre|Csak fogyasztásmérő előtt|A forrás így írja le a szerepét.
S0033|1. oldal|vezetékek|méretezés|2|1|20|A kisfeszültségű vezetékeket minőségi energiaszolgáltatás, biztonság és gazdaságosság miatt kell méretezni.|Miért kell a kisfeszültségű vezetékeket méretezni?|Minőségi energiaszolgáltatás, biztonság és gazdaságosság miatt|Csak esztétikai okból|Csak a színkódok miatt|Csak a relék miatt|A forrás ezt a hármas célt emeli ki.
S0033|2. oldal|vezetékek|feszültségesés|2|1|20|A feszültségesésre történő méretezés lépései: teljesítmény, áram, megengedett feszültségesés, keresztmetszet és szabványos keresztmetszet kiválasztása.|Melyik a helyes méretezési sorrend a feszültségesésre történő számításnál?|Teljesítmény, áram, megengedett feszültségesés, keresztmetszet, szabványos keresztmetszet|Csak a keresztmetszet, aztán a teljesítmény|Csak a biztosíték, aztán a feszültség|Csak a hőmérséklet és a színjelölés|A forrás ezt a sorrendet adja.
S0033|3. oldal|vezetékek|terhelési csoportok|2|1|20|A vezetékek terhelhetősége az A, B és C terhelési csoportban van megadva.|Melyik terhelési csoportokat használja a forrás?|A, B és C|1, 2 és 3|X, Y és Z|L, N és PE|A forrás ezt a három csoportot különíti el.
S0033|4. oldal|vezetékek|tápvezeték|2|1|20|A tápvezeték a táppontot a fogyasztóval közvetlenül összekötő vezeték, amelyen csak a végén van terhelés.|Mi a tápvezeték jellemzője?|A táppontot a fogyasztóval közvetlenül köti össze, és csak a végén van terhelés|Közbenső pontjain is több fogyasztót táplál|Csak földelésre szolgál|Csak világítási jelzésekre való|A forrás ezt a definíciót adja.
S0034|2. oldal|védelem|túláram|2|1|20|A túláram minden olyan áram, amely az adott áramkör névleges áramát meghaladja.|Mi a túláram definíciója?|Az adott áramkör névleges áramát meghaladó áram|Bármilyen áram, ami a fázisban folyik|Csak a nulla vezetőn folyó áram|Csak a földelőáram|A forrás ezt a definíciót használja.
S0034|3. oldal|védelem|szelektivitás|2|1|20|Szelektivitás esetén lehetőleg csak a hibás berendezésrész kapcsolódjon ki.|Mit jelent a szelektivitás a védelemben?|Lehetőleg csak a hibás berendezésrész kapcsolódjon ki|Minden berendezés egyszerre kapcsoljon le|A vezetékek színjelölése legyen egységes|Csak a nullavezető szakadjon meg|A forrás ezt a célt adja meg.
S0034|4-5. oldal|védelem|biztosítók|2|1|20|A gL/gG biztosítók vezetékekhez, az aM/gM biztosítók motorokhoz valók.|Melyik párosítás helyes?|gL/gG vezetékekhez, aM/gM motorokhoz|gL/gG motorokhoz, aM/gM vezetékekhez|gR/aR vezetékekhez, gTr motorokhoz|csak mindegyik világításhoz való|A forrás ezt a tipikus alkalmazást emeli ki.
S0035|1. oldal|védelem|villámvédelem|2|1|20|A külső villámvédelem feladata a villámáram biztonságos levezetése a felfogótól a földelőig.|Mi a külső villámvédelem fő feladata?|A villámáram biztonságos levezetése a felfogótól a földelőig|A kismegszakítók gyorsabb leoldása|A vezetékek keresztmetszetének növelése|A fogyasztásmérő hely ellenőrzése|A forrás ezt a fő feladatot írja le.
S0035|1. oldal|védelem|túlfeszültségvédelem|2|1|20|A többlépcsős túlfeszültségvédelmi rendszer általánosan 1., 2. és 3. osztályú fokozatokból áll.|Melyik fokozatsorozat jellemző a túlfeszültségvédelemre?|1., 2. és 3. osztály|A, B és C típus|TN, TT és IT|gL, gG és aM|A forrás három védelmi fokozatot különít el.
S0035|1. oldal|védelem|villámvédelmi zónák|2|1|20|A belső villámvédelem az LPZ 0/1 zónahatáron létesített összecsatolások rendszere.|Hol létesül a belső villámvédelem?|Az LPZ 0/1 zónahatáron|A villanyóra belsejében|A dugaljak mögött|Csak a tetőn kívül|A forrás ezt a zónahatárt nevezi meg.
S0031|1-3. oldal|villamos-berendezések|szekrénytípusok|2|1|20|A villamos berendezés szerelésben megjelenik a fogyasztásmérő szekrény, az energiaelosztó szekrény, az MCC és a rackrendszerű szekrény is.|Melyik felsorolás tartozik a villamos berendezés szerelés szekrénytípusai közé?|fogyasztásmérő, energiaelosztó, MCC és rackrendszerű szekrény|csak dugaljak és kapcsolók|csak biztosítók és relék|csak lámpatestek és sodrott vezetékek|A forrás ezeket a típusokat tárgyalja.
S0031|6. oldal|villamos-berendezések|rack|2|1|20|A rackszekrényeknél 1U = 44,45 mm.|Mekkora 1U a rackszekrényeknél?|44,45 mm|17,5 mm|25 mm|50 mm|A forrás az 1U magasságot így adja meg.
S0031|7. oldal|villamos-berendezések|kültéri szekrény|2|1|20|Kültéri szekrény kiválasztásánál az IP-besorolás önmagában nem elég, a napsugárzás, a hőterhelés és a mechanikai igénybevétel is számít.|Miért nem elég önmagában az IP-besorolás kültéri szekrényhez?|Mert a napsugárzás, hőterhelés és mechanikai igénybevétel is számít|Mert a kültéri szekrény csak beltérben használható|Mert az IP minden esetben fölösleges|Mert a szekrényeknek nincs hőterhelésük|A forrás ezeket a kiegészítő tényezőket emeli ki.
S0003|16. oldal|transzformátor|kapcsolások|2|1|20|A transzformátor kapcsolásai között szerepel a csillag, a delta és a zegzug kapcsolás.|Melyik kapcsolások szerepelnek a transzformátoroknál?|csillag, delta és zegzug|egypólusú, kétpólusú és hárompólusú|soros, párhuzamos és vegyes|felfogó, levezető és földelő|A forrás ezt a három kapcsolást említi.
S0003|17. oldal|motorok|aszinkron motor|2|1|20|A háromfázisú aszinkron motor két fő forgórész-fajtája a kalickás és a csúszógyűrűs kivitel.|Melyik a háromfázisú aszinkron motor két fő fajtája?|kalickás és csúszógyűrűs|egyenáramú és szinkron|soros és párhuzamos|lépcsős és induktív|A forrás ezt a két típust különíti el.
S0003|18. oldal|védelem|villamosív|2|1|20|A villamos ív az anód és a katód között jön létre.|Hol jön létre a villamos ív?|Az anód és a katód között|A PE és N vezető között|A felfogó és a földelő között|A kapcsoló és a biztosító között|A forrás így definiálja az ív helyét.
S0003|1. oldal|villamos-alapok|villamosenergia-rendszer|2|1|20|A villamosenergia-rendszer részei az erőművek, a hálózati összeköttetések és az állomások.|Melyik felsorolás tartozik a villamosenergia-rendszer részei közé?|erőművek, hálózati összeköttetések és állomások|csak a fogyasztók és a kapcsolók|relék, biztosítók és lámpatestek|dugaljak, lámpák és kapcsolók|A forrás a rendszer három fő részét sorolja fel.
S0003|1. oldal|villamos-alapok|hálózati csatlakozás|2|1|20|A kommunális és lakóépületek hálózatra csatlakoztatásának előírásait az MSZ 447:2009 tartalmazza.|Melyik szabvány foglalkozik a lakóépületek hálózati csatlakoztatásával?|MSZ 447:2009|MSZ EN 60204-1|MSZ EN 61439|MSZ EN 62305|A forrás az MSZ 447:2009-et nevezi meg.
S0003|1. oldal|vezetékek|csatlakozó vezeték|2|1|20|A csatlakozó vezeték feszültségesése legfeljebb 1% lehet.|Mekkora lehet legfeljebb a csatlakozó vezeték feszültségesése?|1%|2%|3%|5%|A forrás 1%-os felső határt ad.
S0003|1. oldal|vezetékek|szabadvezetékes csatlakozás|2|1|20|Szabadvezetékes csatlakozást legfeljebb 6 lakásos épületig és 20 kW csatlakozási teljesítményig javasolt létesíteni.|Milyen határértékekhez kötik a szabadvezetékes csatlakozást?|6 lakás és 20 kW|8 lakás és 25 kW|10 lakás és 30 kW|4 lakás és 16 kW|A forrás ezt a két határt adja meg.
S0003|2. oldal|kábelek|földkábel|2|1|20|A kábelfektetés után mechanikai védelmet kell kialakítani, és jelzőszalagot kell elhelyezni a kábel fölé.|Mi igaz a földkábel kábelfektetés utáni védelmére?|Mechanikai védelmet és jelzőszalagot kell alkalmazni|A kábelt védelem nélkül kell hagyni|Csak festett jelölés elég|Jelzőszalag helyett csavaros kötés kell|A forrás ezt az utólagos védelmet írja elő.
S0003|2. oldal|kábelek|fektetési mélység|2|1|20|Szabályozatlan terepen a fektetési mélység legalább 1 méter, szabályozott terepen legalább 0,7 méter.|Mekkora a minimális kábelfektetési mélység szabályozatlan terepen?|1 méter|0,5 méter|0,7 méter|1,5 méter|A forrás ezt a minimális mélységet adja meg.
S0003|2. oldal|kábelek|jelzőszalag|2|1|20|A jelzőszalagot a kábel fölé, jellemzően a fektetési mélység felénél, de minimum 30 cm-re a kábeltől kell elhelyezni.|Hol kell elhelyezni a jelzőszalagot a földkábel fölött?|A fektetési mélység felénél, de minimum 30 cm-re a kábeltől|Közvetlenül a kábel alatt|A kábel mellé, oldalt|A burkolat belsejébe|A forrás ezt az elhelyezési szabályt adja meg.
S0003|2. oldal|kábelek|üzembe helyezés|2|1|20|Üzembe helyezés előtt el kell végezni a szükséges méréseket, feszültségpróbát kell tartani, és vizsgálati jegyzőkönyvet kell kiállítani.|Mi szükséges a kábelfektetés üzembe helyezése előtt?|Mérések, feszültségpróba és vizsgálati jegyzőkönyv|Csak vizuális ellenőrzés|Csak a kábel festése|Csak a dob visszahúzása|A forrás ezeket az ellenőrzéseket írja elő.
S0003|3. oldal|vezetékek|áramköri felosztás|2|1|20|A lakás áramköreit logikai, teljesítmény-, elhelyezkedés- és karbantarthatósági szempont szerint célszerű szétosztani.|Melyik szempont szerepel a lakás áramköri felosztásánál?|Logikai, teljesítmény-, elhelyezkedés- és karbantarthatósági|Csak esztétikai|Csak színezési|Csak költségszerinti|A forrás ezeket a szempontokat sorolja.
S0003|3. oldal|villamos-berendezések|fogyasztói elosztó|2|1|20|A fogyasztói elosztó feladata a különálló áramkörök biztosítása és szelektív lekapcsolhatósága.|Mi a fogyasztói elosztó feladata?|A különálló áramkörök biztosítása és szelektív lekapcsolhatósága|Csak a vezetékek színezése|A fogyasztásmérő hitelesítése|A kábelkötegek árnyékolása|A forrás ezt a szerepkört emeli ki.
S0003|3. oldal|érintésvédelem|TN-C-S|2|1|20|TN-C-S rendszerben a PEN vezető egy ponton szétválik PE és N vezetőre, és utána tilos újra összekötni őket.|Mi jellemző a TN-C-S rendszerre a szétválasztási pont után?|A PE és N vezetőket tilos újra összekötni|A PE és N vezetők végig közösek maradnak|Csak egyenáramú körben használható|Nem alkalmazható védővezető|A forrás ezt a szabályt hangsúlyozza.
S0003|4. oldal|villamos-berendezések|csatlakozó főelosztó|2|1|20|A csatlakozó főelosztó berendezés a méretlen felhasználói hálózat központi elosztója, amely a csatlakozóvezeték fogadására és az első túláramvédelmi készülék elhelyezésére szolgál.|Mi a csatlakozó főelosztó fő feladata?|A csatlakozóvezeték fogadása és az első túláramvédelmi készülék elhelyezése|A fogyasztók esztétikai fedése|Csak a világítási körök színkódolása|A mérőeszközök kalibrálása|A forrás ezt a funkciót írja le.
""".strip()

POOLS = {
    "power_system": [
        "csak a fogyasztók és a kapcsolók",
        "relék, biztosítók és lámpatestek",
        "dugaljak, lámpák és kapcsolók",
    ],
    "grid_conn": [
        "MSZ EN 60204-1",
        "MSZ EN 61439",
        "MSZ EN 62305",
    ],
    "voltage_drop": ["2%", "3%", "5%"],
    "overhead_limit": ["8 lakás és 25 kW", "10 lakás és 30 kW", "4 lakás és 16 kW"],
    "board_material": [
        "Csak falba süllyesztett, mindig műanyagból",
        "Csak kültéri, mindig alumíniumból",
        "Csak beltéri, mindig üvegből",
    ],
    "circuits": [
        "csak esztétikai",
        "csak színezési",
        "csak költségszerinti",
    ],
    "lights": ["IP44", "IP54", "IP67"],
    "overcurrent": [
        "feszültségesés és áramingadozás",
        "hőveszteség és villámáram",
        "szivárgóáram és indukáltáram",
    ],
    "thermal": [
        "Mágnesesen zárja az áramkört",
        "Csak mérőáramkört nyit",
        "Nem reagál a melegedésre",
    ],
    "selv": [
        "230 V AC és 400 V DC",
        "24 V AC és 48 V DC",
        "12 V AC és 24 V DC",
    ],
    "class2": [
        "Mindig szükséges hozzá külön PE vezető",
        "Csak törpefeszültségről működik",
        "Csak fémházas lehet",
    ],
    "tn_limit": ["120 V", "230 V", "400 V"],
    "tt": [
        "RA × Ia ≥ 230 V",
        "RA + Ia ≤ 50 V",
        "RA / Ia ≤ 50 V",
    ],
    "rcd": [
        "Önállóan minden esetben elég a védelemhez",
        "Csak túláramvédelemre való",
        "Csak világítási körökben használható",
    ],
    "eph": [
        "Csak a lámpatesteket",
        "Csak a nulla vezetőt",
        "Csak a biztosítók előtti szakaszt",
    ],
    "lightning_parts": [
        "kapcsoló, biztosító és relé",
        "N, PE és PEN",
        "lámpa, dugalj és kapcsoló",
    ],
    "surge_classes": [
        "A, B és C típus",
        "TN, TT és IT",
        "gL, gG és aM",
    ],
    "transformer_connections": [
        "egypólusú, kétpólusú és hárompólusú",
        "soros, párhuzamos és vegyes",
        "felfogó, levezető és földelő",
    ],
    "motor_types": [
        "egyenáramú és szinkron",
        "soros és párhuzamos",
        "lépcsős és induktív",
    ],
    "arc": [
        "A PE és N vezető között",
        "A felfogó és a földelő között",
        "A kapcsoló és a biztosító között",
    ],
    "switches": [
        "Mindkét pólust egyszerre szakítja nedves helyiségben",
        "Három fázist kapcsol egyszerre",
        "Csak jelzőfényekkel használható",
    ],
    "switch_types": [
        "csak csillárokhoz használható",
        "csak háromfázisú körben működik",
        "csak a fázis előtti biztosítót kapcsolja",
    ],
    "cable_size": [
        "Csak esztétikai okból",
        "Csak a színkódok miatt",
        "Csak a relék miatt",
    ],
    "voltage_drop_steps": [
        "Csak a keresztmetszet, aztán a teljesítmény",
        "Csak a biztosíték, aztán a feszültség",
        "Csak a hőmérséklet és a színjelölés",
    ],
    "thermal_groups": ["1, 2 és 3", "X, Y és Z", "L, N és PE"],
    "tapvezetek": [
        "Közbenső pontjain is több fogyasztót táplál",
        "Csak földelésre szolgál",
        "Csak világítási jelzésekre való",
    ],
    "protection": [
        "Csak mindegyik világításhoz való",
        "gL/gG motorokhoz, aM/gM vezetékekhez",
        "gR/aR vezetékekhez, gTr motorokhoz",
    ],
    "lightning": [
        "A kismegszakítók gyorsabb leoldása",
        "A vezetékek keresztmetszetének növelése",
        "A fogyasztásmérő hely ellenőrzése",
    ],
    "cabinet": [
        "Csak dugaljak és kapcsolók",
        "csak biztosítók és relék",
        "csak lámpatestek és sodrott vezetékek",
    ],
    "rack": ["17,5 mm", "25 mm", "50 mm"],
}


def parse_facts(text: str):
    for raw in text.splitlines():
        raw = raw.strip()
        if not raw:
            continue
        fields = raw.split("|")
        if len(fields) != 14:
            raise ValueError(f"Bad fact row: {raw}")
        yield {
            "source_id": fields[0],
            "source_locator": fields[1],
            "topic": fields[2],
            "subtopic": fields[3],
            "difficulty": int(fields[4]),
            "points": int(fields[5]),
            "time_estimate_sec": int(fields[6]),
            "statement": fields[7],
            "sc_prompt": fields[8],
            "correct": fields[9],
            "wrong1": fields[10],
            "wrong2": fields[11],
            "wrong3": fields[12],
            "explanation": fields[13],
        }


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh, delimiter=";"))


def write_csv(path: Path, fieldnames, rows):
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames, delimiter=";")
        writer.writeheader()
        writer.writerows(rows)


def next_id(prefix: str, existing_ids: list[str]) -> int:
    nums = [
        int(re.search(r"(\d+)$", value).group(1))
        for value in existing_ids
        if value.startswith(prefix) and re.search(r"(\d+)$", value)
    ]
    return max(nums, default=0) + 1


def question_key(question_type: str, prompt: str, fact: dict[str, str]) -> tuple[str, ...]:
    return (
        question_type,
        prompt,
        fact["source_id"],
        fact["source_locator"],
        fact["topic"],
        fact["subtopic"],
    )


def make_choice_rows(question_id: str, choice_id_start: int, correct: str, wrongs: list[str]):
    rows = []
    labels = ["A", "B", "C", "D"]
    options = [(correct, True), *[(wrong, False) for wrong in wrongs]]
    random.shuffle(options)
    for idx, (option, is_correct) in enumerate(options):
        rows.append(
            {
                "choice_id": f"C{choice_id_start + idx:04d}",
                "question_id": question_id,
                "choice_label": labels[idx],
                "choice_text_md": option,
                "is_correct": "true" if is_correct else "false",
                "sort_order": str(idx + 1),
                "feedback_md": "",
                "match_role": "",
                "match_choice_id": "",
                "group_label": "",
            }
        )
    return rows


def make_tf_rows(question_id: str, choice_id_start: int, statement: str, answer: bool):
    rows = [
        {
            "choice_id": f"C{choice_id_start:04d}",
            "question_id": question_id,
            "choice_label": "A",
            "choice_text_md": "true",
            "is_correct": "true" if answer else "false",
            "sort_order": "1",
            "feedback_md": "",
            "match_role": "",
            "match_choice_id": "",
            "group_label": "",
        },
        {
            "choice_id": f"C{choice_id_start + 1:04d}",
            "question_id": question_id,
            "choice_label": "B",
            "choice_text_md": "false",
            "is_correct": "false" if answer else "true",
            "sort_order": "2",
            "feedback_md": "",
            "match_role": "",
            "match_choice_id": "",
            "group_label": "",
        },
    ]
    random.shuffle(rows)
    for index, row in enumerate(rows, start=1):
        row["choice_label"] = chr(64 + index)
        row["sort_order"] = str(index)
    return rows


def main():
    questions = read_csv(BASE / "questions.csv")
    choices = read_csv(BASE / "choices.csv")
    facts = list(parse_facts(FACTS_TSV))
    existing_keys = {
        question_key(
            row["question_type"],
            row["prompt_md"],
            {
                "source_id": row["source_id"],
                "source_locator": row["source_locator"],
                "topic": row["topic"],
                "subtopic": row["subtopic"],
            },
        )
        for row in questions
    }

    q_id_num = next_id("Q", [row["question_id"] for row in questions])
    c_id_num = next_id("C", [row["choice_id"] for row in choices])

    new_questions = []
    new_choices = []

    for fact in facts:
        tf_prompt = fact["statement"]
        tf_key = question_key("true_false", tf_prompt, fact)
        if tf_key not in existing_keys:
            existing_keys.add(tf_key)
            tf_qid = f"Q{q_id_num:04d}"
            q_id_num += 1
            new_questions.append(
                {
                    "question_id": tf_qid,
                    "question_type": "true_false",
                    "prompt_md": fact["statement"],
                    "explanation_md": fact["explanation"],
                    "topic": fact["topic"],
                    "subtopic": fact["subtopic"],
                    "difficulty": str(fact["difficulty"]),
                    "points": str(fact["points"]),
                    "time_estimate_sec": str(fact["time_estimate_sec"]),
                    "source_id": fact["source_id"],
                    "source_locator": fact["source_locator"],
                    "tags": fact["topic"] + "," + fact["subtopic"],
                    "language": "hu",
                    "correct_answer_md": "",
                    "answer_tolerance": "",
                }
            )
            new_choices.extend(make_tf_rows(tf_qid, c_id_num, fact["statement"], True))
            c_id_num += 2

        sc_prompt = fact["sc_prompt"]
        sc_key = question_key("single_choice", sc_prompt, fact)
        if sc_key not in existing_keys:
            existing_keys.add(sc_key)
            sc_qid = f"Q{q_id_num:04d}"
            q_id_num += 1
            new_questions.append(
                {
                    "question_id": sc_qid,
                    "question_type": "single_choice",
                    "prompt_md": fact["sc_prompt"],
                    "explanation_md": fact["explanation"],
                    "topic": fact["topic"],
                    "subtopic": fact["subtopic"],
                    "difficulty": str(fact["difficulty"]),
                    "points": str(fact["points"]),
                    "time_estimate_sec": str(fact["time_estimate_sec"]),
                    "source_id": fact["source_id"],
                    "source_locator": fact["source_locator"],
                    "tags": fact["topic"] + "," + fact["subtopic"],
                    "language": "hu",
                    "correct_answer_md": "",
                    "answer_tolerance": "",
                }
            )
            wrongs = [fact["wrong1"], fact["wrong2"], fact["wrong3"]]
            new_choices.extend(make_choice_rows(sc_qid, c_id_num, fact["correct"], wrongs))
            c_id_num += 4

    questions.extend(new_questions)
    choices.extend(new_choices)

    q_fields = [
        "question_id",
        "question_type",
        "prompt_md",
        "explanation_md",
        "topic",
        "subtopic",
        "difficulty",
        "points",
        "time_estimate_sec",
        "source_id",
        "source_locator",
        "tags",
        "language",
        "correct_answer_md",
        "answer_tolerance",
    ]
    c_fields = [
        "choice_id",
        "question_id",
        "choice_label",
        "choice_text_md",
        "is_correct",
        "sort_order",
        "feedback_md",
        "match_role",
        "match_choice_id",
        "group_label",
    ]

    write_csv(BASE / "questions.csv", q_fields, questions)
    write_csv(BASE / "choices.csv", c_fields, choices)
    print(f"Added {len(new_questions)} questions and {len(new_choices)} choices")


if __name__ == "__main__":
    main()
