// js/firebase-config.js (Modificado para Depuración con tus credenciales)

console.log("Intentando inicializar Firebase...");

// --- Tu configuración de Firebase ---
const firebaseConfig = {
  apiKey: "AIzaSyAnRBlJQNLQxe_DXOsBaCNsxR752MlxRWM",
  authDomain: "gestionar-citas-ef868.firebaseapp.com",
  projectId: "gestionar-citas-ef868",
  storageBucket: "gestionar-citas-ef868.appspot.com", // Corregido .appspot.com
  messagingSenderId: "44685013103",
  appId: "1:44685013103:web:61e600d9a50a0551d9dd9a"
};
// --- Fin de la configuración ---

try {
  // Verifica si el objeto global 'firebase' existe (de los scripts compat)
  if (typeof firebase === 'undefined' || !firebase.app) {
      throw new Error("El SDK principal de Firebase (firebase-app-compat.js) no se ha cargado correctamente.");
  }

  // Inicializa la aplicación Firebase
  const firebaseApp = firebase.initializeApp(firebaseConfig);

  // Verifica si el objeto 'firebase.firestore' existe
  if (typeof firebase.firestore === 'undefined') {
      throw new Error("El SDK de Firestore (firebase-firestore-compat.js) no se ha cargado correctamente.");
  }

  // ASIGNACIÓN GLOBAL DIRECTA para prueba
  // Asigna la instancia de Firestore a la propiedad 'db' del objeto global 'window'
  window.db = firebase.firestore();

  // Mensaje de éxito con detalles sobre window.db
  console.log("Firebase inicializado. window.db DEBERÍA estar definido:", typeof window.db, window.db);

} catch (error) {
  // Muestra el error detallado en la consola si algo falla
  console.error("Error inicializando Firebase:", error);

  // Asegura que window.db sea undefined si hubo un error
  window.db = undefined;
}