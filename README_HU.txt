BEREKALJA VÁRSZÁLLÁS – WEBOLDAL + ADMIN KEZELŐFELÜLET

FONTOS
Ez a csomag már tartalmazza a weboldalt, az admin oldalt és a szerveroldali API kódját. Nem elég csak a public mappát feltölteni: Cloudflare Worker + D1 adatbázis szükséges. A mostani éles oldalhoz nem nyúl, amíg külön nem telepíted.

ADMIN OLDAL
A telepítés után: https://A-TE-WORKER-CIMED/admin

MIT TUD AZ ADMIN?
- Főcím és főoldali szöveg módosítása
- Kezdőkép, szoba- és apartmankép URL-jének cseréje
- Kisszobák és apartman alapárának kézi módosítása (Ft)
- Árazási mód választása: szobánként/apartmanonként vagy személyenként, éjszakánként
- Egyedi ármegjelenítő szöveg megadása
- Telefonszám és e-mail cím módosítása
- Dátumtartományra 0–6 szabad szoba beállítása
- Külön apartman foglalhatóságának beállítása

TELEPÍTÉS (Cloudflare)
A csomag telepítéséhez jelenleg számítógép és Wrangler parancssori eszköz vagy Git-integráció szükséges. A jelenlegi egyszerű ZIP-es statikus feltöltés önmagában nem tudja elindítani a Worker API-t és a D1 adatbázist.

1. Cloudflare-ben hozz létre egy D1 adatbázist "berekalja-admin" néven.
2. Futtasd a schema.sql fájl tartalmát a D1 adatbázis Console felületén.
3. A wrangler.toml fájlban a database_id mező helyére írd be a Cloudflare D1 adatbázis azonosítóját.
4. A Workerhez állíts be két SECRET értéket:
   - ADMIN_PASSWORD = az általad választott erős admin jelszó
   - SESSION_SECRET = egy hosszú, véletlenszerű, legalább 32 karakteres titok
   Ezeket ne tedd közzé, és ne küldd el chatben.
5. A projekt gyökérmappájában telepítsd a Wrangler csomagot, majd futtasd:
   npx wrangler deploy
6. A Cloudflare Worker beállításainál ellenőrizd, hogy a DB D1 binding neve pontosan DB, és az ASSETS statikus eszköz binding is megvan.

A Cloudflare jelenlegi dokumentációja a Worker statikus eszközeinek és API-kódjának együttes használatát, valamint a titkok külön Secret-ként történő tárolását írja le:
https://developers.cloudflare.com/workers/static-assets/
https://developers.cloudflare.com/workers/configuration/secrets/

BIZTONSÁGI MEGJEGYZÉS
- Ne add meg az admin jelszavadat senkinek, chatben se.
- Az admin oldal keresőmotorok számára tiltva van, de a biztonságot a jelszavas szerveroldali munkamenet adja.
- A képekhez jelenleg nyilvános HTTPS kép-URL-t lehet beállítani. A közvetlen fotófeltöltés külön fejlesztés.
- A naptár kézi kapacitás-beállítást végez; a Booking.com/Airbnb foglalásokat továbbra is kézzel kell átvezetni.
- A jelenlegi csomag még nem tartalmaz automatikus foglalás-visszaigazolást vagy bankkártyás fizetést. Ezekhez külön foglalási és fizetési integráció szükséges.
- A vendég ajánlatkérése továbbra is e-mailt készít elő.
