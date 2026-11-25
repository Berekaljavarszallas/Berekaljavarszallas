const COOKIE = "berekalja_admin";

const GITHUB_OWNER = "Berekaljavarszallas";
const GITHUB_REPO = "Berekaljavarszallas";
const GITHUB_BRANCH = "main";

const DEFAULT_CONTENT = {
  heroTitle: "Ahol a pihenés új értelmet kap.",
  heroText: "Fedezd fel Diósgyőr hangulatát, a Bükk közelségét és a gondtalan kikapcsolódást a Berekalja Várszállás kényelmes szobáiban és apartmanjában.",
  heroImage: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=2000&q=85",
  roomsImage: "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=85",
  apartmentImage: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=85",
  roomPrice: "",
  apartmentPrice: "",
  roomPriceAmount: "14000",
  roomPriceMode: "room",
  apartmentPriceAmount: "22000",
  apartmentPriceMode: "unit",
  phone: "+36 30 370 7525",
  email: "berekaljavarszallas@gmail.com"
};

const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });

const b64 = bytes => {
  let binary = "";
  const data = new Uint8Array(bytes);
  for (let i = 0; i < data.length; i += 0x8000) {
    binary += String.fromCharCode(...data.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

const unb64 = str =>
  Uint8Array.from(
    atob(str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4)),
    c => c.charCodeAt(0)
  );

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return b64(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function makeSession(secret) {
  const payload = b64(new TextEncoder().encode(JSON.stringify({
    exp: Date.now() + 8 * 60 * 60 * 1000,
    nonce: crypto.randomUUID()
  }))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return payload + "." + await hmac(secret, payload);
}

async function validSession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.split(";").map(x => x.trim()).find(x => x.startsWith(COOKIE + "="));
  if (!match) return false;

  const parts = match.slice(COOKIE.length + 1).split(".");
  if (parts.length !== 2) return false;

  const expected = await hmac(secret, parts[0]);
  if (expected !== parts[1]) return false;

  try {
    return JSON.parse(new TextDecoder().decode(unb64(parts[0]))).exp > Date.now();
  } catch {
    return false;
  }
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  return new URL(origin).host === new URL(request.url).host;
}

async function readContent(db) {
  const row = await db.prepare("SELECT value FROM site_content WHERE id=1").first();
  if (!row) return DEFAULT_CONTENT;
  try {
    return { ...DEFAULT_CONTENT, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_CONTENT;
  }
}

async function githubRequest(env, path, options = {}) {
  if (!env.GITHUB_TOKEN) throw new Error("A GitHub hozzáférési kulcs nincs beállítva.");

  const response = await fetch("https://api.github.com/repos/" +
    GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + path, {
      ...options,
      headers: {
        "Authorization": "Bearer " + env.GITHUB_TOKEN,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Berekalja-Website",
        ...(options.headers || {})
      }
    });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
   if (response.status === 404) {
  throw new Error("GitHub 404 – Nem található az útvonal: " + path);
}
    throw new Error(data.message || "GitHub hiba: " + response.status);
  }

  return data;
}

function galleryFolder(category) {
  if (category !== "rooms" && category !== "apartment") return null;
  return "public/gallery/" + category;
}

async function listGallery(env, category) {
  const folder = galleryFolder(category);
  if (!folder) throw new Error("Érvénytelen galériatípus.");

  const result = await githubRequest(env, folder + "?ref=" + GITHUB_BRANCH);
  if (!result) return [];

  return result
    .filter(file => file.type === "file" && /\.(jpe?g|png|webp|gif|jfif)$/i.test(file.name))
    .map(file => ({
      key: file.path,
      url: "https://raw.githubusercontent.com/" +
        GITHUB_OWNER + "/" + GITHUB_REPO + "/" + GITHUB_BRANCH + "/" + file.path
    }));
}

async function uploadGallery(request, env) {
  const form = await request.formData();
  const category = String(form.get("category") || "");
  const folder = galleryFolder(category);

  if (!folder) return json({ error: "Érvénytelen galériatípus." }, 400);

  const files = form.getAll("images").filter(item => item instanceof File && item.size > 0);

  if (!files.length) return json({ error: "Nem választottál ki képet." }, 400);
  if (files.length > 10) return json({ error: "Egyszerre legfeljebb 10 kép tölthető fel." }, 400);

  const existing = await listGallery(env, category);
  if (existing.length + files.length > 10) {
    return json({ error: "Ebben a galériában legfeljebb 10 kép lehet. Jelenleg " + existing.length + " kép van." }, 400);
  }

  const uploaded = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return json({ error: "Csak képfájl tölthető fel." }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      return json({ error: "Egy kép legfeljebb 5 MB méretű lehet." }, 400);
    }

    const extension = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const filename = crypto.randomUUID() + "." + extension;
    const path = folder + "/" + filename;
    const content = b64(await file.arrayBuffer());

    await githubRequest(env, path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Fotó feltöltése: " + category,
        content,
        branch: GITHUB_BRANCH
      })
    });

    uploaded.push(filename);
  }

  return json({ ok: true, uploaded });
}

async function deleteGalleryPhoto(request, env) {
  const body = await request.json().catch(() => null);
  if (!body || !galleryFolder(body.category) || typeof body.key !== "string") {
    return json({ error: "Hibás törlési adatok." }, 400);
  }

  const folder = galleryFolder(body.category);
  if (!body.key.startsWith(folder + "/") || body.key.includes("..")) {
    return json({ error: "Érvénytelen fájlútvonal." }, 400);
  }

  const file = await githubRequest(env, body.key + "?ref=" + GITHUB_BRANCH);
  if (!file || !file.sha) return json({ error: "A kép nem található." }, 404);

  await githubRequest(env, body.key, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: "Fotó törlése: " + body.category,
      sha: file.sha,
      branch: GITHUB_BRANCH
    })
  });

  return json({ ok: true });
}

async function api(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (!env.DB) return json({ error: "A D1 adatbázis nincs csatlakoztatva." }, 503);

  if (path === "/api/content" && request.method === "GET") {
    return json(await readContent(env.DB));
  }

  if (path === "/api/availability" && request.method === "GET") {
    const arrival = url.searchParams.get("arrival");
    const departure = url.searchParams.get("departure");

    if (!arrival || !departure || departure <= arrival) {
      return json({ error: "Érvénytelen dátum." }, 400);
    }

    const rows = await env.DB.prepare(
      "SELECT date, rooms_available, apartment_available FROM availability WHERE date >= ? AND date < ? ORDER BY date"
    ).bind(arrival, departure).all();

    const byDate = new Map((rows.results || []).map(r => [r.date, r]));
    let minRooms = 6;
    let apt = true;

    const start = new Date(arrival + "T12:00:00Z");
    const end = new Date(departure + "T12:00:00Z");

    for (let d = new Date(start); d < end; d.setUTCDate(d.getUTCDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const r = byDate.get(key);
      if (r) {
        minRooms = Math.min(minRooms, Number(r.rooms_available));
        if (Number(r.apartment_available) !== 1) apt = false;
      }
    }

    return json({ roomsAvailable: minRooms, apartmentAvailable: apt });
  }

  if (path === "/api/login" && request.method === "POST") {
    if (!sameOrigin(request)) return json({ error: "Érvénytelen kérés." }, 403);
    if (!env.ADMIN_PASSWORD || !env.SESSION_SECRET) {
      return json({ error: "A belépési titkok még nincsenek beállítva a Cloudflare-ben." }, 503);
    }

    const body = await request.json().catch(() => ({}));
    const given = String(body.password || "");
    const a = new TextEncoder().encode(given);
    const b = new TextEncoder().encode(env.ADMIN_PASSWORD);

    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      diff |= (a[i] || 0) ^ (b[i] || 0);
    }

    if (diff !== 0) return json({ error: "Hibás jelszó." }, 401);

const token = await makeSession(env.SESSION_SECRET);
return json({ ok: true }, 200, {
  "set-cookie": `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`
});
}

if (path === "/api/logout" && request.method === "POST") {
  return json({ ok: true }, 200, {
    "set-cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  });
  }

  if (path.startsWith("/api/admin/")) {
    if (!await validSession(request, env.SESSION_SECRET || "")) {
      return json({ error: "A munkamenet lejárt. Jelentkezz be újra." }, 401);
    }

    if (!sameOrigin(request)) return json({ error: "Érvénytelen kérés." }, 403);

    if (path === "/api/admin/gallery" && request.method === "GET") {
      try {
        const category = url.searchParams.get("category");
        return json({ photos: await listGallery(env, category) });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (path === "/api/admin/gallery/upload" && request.method === "POST") {
      try {
        return await uploadGallery(request, env);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (path === "/api/admin/gallery/delete" && request.method === "POST") {
      try {
        return await deleteGalleryPhoto(request, env);
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    if (path === "/api/admin/content" && request.method === "POST") {
      const incoming = await request.json().catch(() => null);
      if (!incoming || typeof incoming !== "object") return json({ error: "Hibás adatok." }, 400);

      const allowed = {};
      for (const key of Object.keys(DEFAULT_CONTENT)) {
        if (typeof incoming[key] === "string") allowed[key] = incoming[key].slice(0, 4000);
      }

      await env.DB.prepare(
        "INSERT INTO site_content (id,value,updated_at) VALUES (1,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP"
      ).bind(JSON.stringify({ ...DEFAULT_CONTENT, ...allowed })).run();

      return json({ ok: true });
    }

    if (path === "/api/admin/availability" && request.method === "POST") {
      const body = await request.json().catch(() => null);

      if (
        !body ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.start || "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.end || "") ||
        body.end < body.start ||
        !Number.isInteger(body.rooms) ||
        body.rooms < 0 ||
        body.rooms > 6 ||
        ![0, 1].includes(body.apartment)
      ) {
        return json({ error: "Ellenőrizd a dátumokat és az elérhető szobák számát (0–6)." }, 400);
      }

      const start = new Date(body.start + "T12:00:00Z");
      const end = new Date(body.end + "T12:00:00Z");

      if ((end - start) / 86400000 > 730) {
        return json({ error: "Egyszerre legfeljebb két év állítható be." }, 400);
      }

      const stmts = [];
      for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        stmts.push(
          env.DB.prepare(
            "INSERT INTO availability(date,rooms_available,apartment_available) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET rooms_available=excluded.rooms_available, apartment_available=excluded.apartment_available"
          ).bind(d.toISOString().slice(0, 10), body.rooms, body.apartment)
        );
      }

      for (let i = 0; i < stmts.length; i += 100) {
        await env.DB.batch(stmts.slice(i, i + 100));
      }

      return json({ ok: true, days: stmts.length });
    }

    if (path === "/api/admin/data" && request.method === "GET") {
      return json({ content: await readContent(env.DB) });
    }
  }

  return json({ error: "Nem található." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    if (url.pathname === "/admin" || url.pathname === "/admin/") {
    return env.ASSETS.fetch(new Request(new URL("/admin.html", request.url), request));
}
return env.ASSETS.fetch(request);
}
};
