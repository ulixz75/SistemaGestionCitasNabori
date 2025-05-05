// js/auth.js

// --- Configuración del Botón de Logout ---
// Esta función busca el botón de logout y le añade la funcionalidad.
// Debe ejecutarse en cada página que tenga el botón de logout.
function setupLogoutButton() {
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut(); // Intenta cerrar sesión de Supabase

            if (error) {
                console.error('Error al cerrar sesión (Supabase):', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo cerrar la sesión de Supabase.',
                    confirmButtonColor: '#4CAF50'
                });
            } else {
                console.log('Sesión de Supabase cerrada (si existía). Redirigiendo...');
                // **ACCIÓN IMPORTANTE:** Decide a dónde redirigir al usuario después del logout.
                // Podría ser una página de "logout exitoso", la página principal de tu aplicación general,
                // o la URL que te proporcione tu sistema de autenticación externo.
                // Por ahora, redirigiremos a una página hipotética '/logged-out'. ¡AJUSTA ESTO!
                window.location.href = '/logged-out.html'; // <--- ¡¡¡CAMBIA ESTA URL!!!
                // O podrías simplemente mostrar un mensaje y dejar que tu sistema externo maneje la redirección.
            }
        });
        // Hacer visible el botón por si estaba oculto por defecto
        logoutButton.style.display = 'inline-block';
    } else {
        // console.log("Botón de logout no encontrado en esta página.");
    }
}

// --- Ejecución de la Configuración del Logout ---
// Espera a que el DOM esté listo antes de buscar el botón.
document.addEventListener('DOMContentLoaded', setupLogoutButton);

// --- Código Eliminado ---
// Se eliminó la lógica de signInWithPassword.
// Se eliminó la lógica de protectPage (redirección si no hay sesión).
// Se eliminó la redirección inicial si ya había sesión en la página de login.