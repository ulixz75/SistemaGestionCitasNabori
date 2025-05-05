// sw.js - Service Worker Básico

const CACHE_NAME = 'nabori-citas-cache-v1'; // Cambia 'v1' si actualizas archivos cacheados
const urlsToCache = [
  '/', // La página principal (index.html)
  '/index.html',
  '/clients.html',
  '/specialists.html',
  '/services.html',
  '/appointments.html',
  '/calendar.html',
  '/css/styles.css',
  '/css/dashboard.css', // Añade todos tus CSS
  '/css/calendar.css',
  // '/css/login.css', // Ya no lo usas
  '/js/firebase-config.js',
  '/js/ui.js', // El script del menú
  '/js/clients-firebase.js',
  '/js/specialists-firebase.js',
  '/js/services-firebase.js',
  '/js/appointments-firebase-multi.js',
  '/js/calendar-firebase.js',
  '/js/dashboard-firebase.js',
  // Añade aquí rutas a imágenes importantes que quieras offline (logo, iconos)
  '/images/icons/icon-192x192.png',
  '/images/icons/icon-512x512.png',
  // Añade aquí las URLs de las LIBRERÍAS EXTERNAS que usas (importante para offline)
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/flatpickr',
  'https://npmcdn.com/flatpickr/dist/l10n/es.js',
  'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore-compat.js',
  'https://cdn.jsdelivr.net/npm/chart.js', // Si la cargas localmente, usa la ruta local
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css' // Si usas FA CDN
  // Nota: Firebase SDKs más complejos o CDNs pueden requerir estrategias de caché más avanzadas
];

// Instalación: Guarda los archivos básicos en caché
self.addEventListener('install', event => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Abriendo caché y guardando archivos iniciales:', urlsToCache);
        // addAll falla si UNO de los archivos no se puede descargar
        return cache.addAll(urlsToCache).catch(error => {
            console.error('[SW] Fallo al cachear archivos iniciales:', error);
            // Podrías intentar cachear individualmente para más resiliencia
        });
      })
      .then(() => self.skipWaiting()) // Activa el nuevo SW inmediatamente
  );
});

// Activación: Limpia cachés antiguas
self.addEventListener('activate', event => {
  console.log('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Eliminando caché antigua:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Controla clientes inmediatamente
  );
});

// Fetch: Sirve desde caché primero, luego red (Cache First Strategy)
self.addEventListener('fetch', event => {
  // No interceptar peticiones a Firestore o EmailJS (o APIs externas)
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('api.emailjs.com') ||
      event.request.url.includes('google.com/recaptcha')) { // Añadir otros si es necesario
    // console.log('[SW] Omitiendo caché para API externa:', event.request.url);
    return; // Dejar que la petición vaya a la red directamente
  }

   // Ignorar peticiones que no son GET
   if (event.request.method !== 'GET') {
       // console.log('[SW] Omitiendo caché para método no GET:', event.request.method);
       return;
   }


  // Intenta responder desde la caché
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si se encuentra en caché, devolverla
        if (response) {
          // console.log('[SW] Sirviendo desde caché:', event.request.url);
          return response;
        }
        // Si no está en caché, ir a la red
        // console.log('[SW] No en caché, buscando en red:', event.request.url);
        return fetch(event.request).then(
          networkResponse => {
            // Opcional: Podrías cachear la respuesta aquí si quieres cachear dinámicamente
            // if (networkResponse && networkResponse.status === 200) {
            //   const cacheToUpdate = caches.open(CACHE_NAME);
            //   cacheToUpdate.then(cache => cache.put(event.request, networkResponse.clone()));
            // }
            return networkResponse;
          }
        ).catch(error => {
             console.error('[SW] Error de fetch:', error);
             // Opcional: Podrías devolver una página offline aquí
             // return caches.match('/offline.html');
        });
      })
  );
});