// Poner esto al final de ui.js o en pwa-installer.js

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js') // Asegúrate que la ruta sea correcta desde la raíz
      .then(registration => {
        console.log('Service Worker registrado con éxito:', registration.scope);
      })
      .catch(error => {
        console.error('Error al registrar el Service Worker:', error);
      });
  });
} else {
    console.log('Service Worker no es soportado por este navegador.');
}

// Opcional: Lógica para mostrar tu propio botón de instalación
let deferredPrompt;
const installButton = document.getElementById('install-app-button'); // Necesitarías añadir un botón con este ID en tu HTML

window.addEventListener('beforeinstallprompt', (e) => {
  // Prevenir que Chrome muestre el prompt por defecto inmediatamente
  e.preventDefault();
  // Guardar el evento para poder mostrarlo luego
  deferredPrompt = e;
  // Mostrar tu botón de instalación (si tienes uno)
  if (installButton) {
    installButton.style.display = 'block';
    console.log('Evento beforeinstallprompt capturado, listo para instalar.');
  } else {
       console.log('Evento beforeinstallprompt capturado, pero no se encontró botón #install-app-button.');
  }


  if(installButton){
      installButton.addEventListener('click', async () => {
        // Ocultar nuestro botón
        installButton.style.display = 'none';
        // Mostrar el prompt de instalación del navegador
        if(deferredPrompt){
             deferredPrompt.prompt();
             // Esperar a que el usuario responda
             const { outcome } = await deferredPrompt.userChoice;
             console.log(`Respuesta del usuario al prompt: ${outcome}`);
             // Limpiar el prompt diferido (solo se puede usar una vez)
             deferredPrompt = null;
        }
      });
  }

});

window.addEventListener('appinstalled', () => {
    console.log('PWA instalada correctamente.');
    // Ocultar el botón de instalación si aún está visible
    if (installButton) {
      installButton.style.display = 'none';
    }
    deferredPrompt = null;
});