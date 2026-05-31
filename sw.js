const CACHE_VERSION = "20260531-3";
const CACHE_NAME = `villany-vizsga-${CACHE_VERSION}`;

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/pwa-icon.svg",
  "/vizsga-mvp/",
  "/vizsga-mvp/index.html",
  "/vizsga-mvp/app.js",
  "/vizsga-mvp/styles.css",
  "/infok/",
  "/infok/index.html",
  "/kerdesbank/",
  "/kerdesbank/index.html",
];

const DATA_URLS = [
  "/kerdesbank/questions.csv",
  "/kerdesbank/choices.csv",
  "/kerdesbank/sources.csv",
  "/kerdesbank/assets.csv",
];

const MEDIA_URLS = [
  "/kerdesbank/media/Screenshot_2026-05-29_at_15.38.25.png",
  "/kerdesbank/media/Screenshot_2026-05-29_at_16.13.32.png",
  "/kerdesbank/media/Screenshot_2026-05-29_at_20.11.56.png",
  "/kerdesbank/media/Screenshot_2026-05-29_at_20.14.17.png",
  "/kerdesbank/media/doc103_tablazat_1.png",
  "/kerdesbank/media/doc150619_munkafazisok.jpg",
  "/kerdesbank/media/doc150619_valtokapcsolo.jpg",
  "/kerdesbank/media/doc150619_vezetekszakasz.jpg",
  "/kerdesbank/media/szktv_2025_q0372_konyha_aramkorok.png",
  "/kerdesbank/media/szktv_2025_q0373_szerelveny_dobozok.png",
  "/kerdesbank/media/szktv_2025_q0375_szakaszolo_biztosito.png",
  "/kerdesbank/media/szktv_2025_q0378_eloszto_aramutas_rajz.png",
  "/kerdesbank/media/szktv_2025_q0385_napelem_jelleggorbe.png",
  "/kerdesbank/media/szktv_2025_q0386_motor_kapcsolas_rajz.png",
  "/kerdesbank/media/szktv_2025_q0388_tt_rendszer_rajz.png",
  "/kerdesbank/media/szktv_2025_q0389_motor_kapocstabla_csillag.png",
  "/kerdesbank/media/szktv_2025_q0392_vezetek_szamok.png",
  "/kerdesbank/media/szktv_2025_q0398_tulfeszultsegvedelmi_eszkoz.png",
  "/kerdesbank/media/szktv_2025_q0399_transzformator_kapcsolas.png",
  "/kerdesbank/media/szktv_2026_q0334_tapegyseg.png",
  "/kerdesbank/media/szktv_2026_q0335_eloszto_avk_kismegszakito.png",
  "/kerdesbank/media/szktv_2026_q0336_analog_voltmero.png",
  "/kerdesbank/media/szktv_2026_q0355_tulfeszultseglevezeto.png",
  "/kerdesbank/media/szktv_2026_q0356_szetszerelt_magneskapcsolo.png",
  "/kerdesbank/media/szktv_2026_q0357_it_rendszer_rajz.png",
  "/kerdesbank/media/szktv_2026_q0359_teljesitmenymero_kijelzo.png",
  "/kerdesbank/media/szktv_2026_q0369_motorvezerles_rajz.png",
  "/kerdesbank/media/vbs_motorvezerlo_kozpont.jpg",
  "/kerdesbank/media/vbs_tomszelence.jpg",
];

const PRECACHE_URLS = [...APP_SHELL_URLS, ...DATA_URLS, ...MEDIA_URLS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName.startsWith("villany-vizsga-") && cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isEditorUrl(url) && !isLocalhost(self.location.hostname)) {
    event.respondWith(blockReleasedEditor(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/vizsga-mvp/index.html"));
    return;
  }

  if (isDataUrl(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

function isDataUrl(url) {
  return DATA_URLS.includes(url.pathname);
}

function isEditorUrl(url) {
  return url.pathname === "/kerdesbank/editor" || url.pathname.startsWith("/kerdesbank/editor/");
}

function isLocalhost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function blockReleasedEditor(request) {
  if (request.mode === "navigate") {
    return Response.redirect(new URL("/kerdesbank/", self.location.origin), 302);
  }

  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (fallbackUrl) {
      return cache.match(fallbackUrl, { ignoreSearch: true });
    }
    throw new Error(`No cached response for ${request.url}`);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}
