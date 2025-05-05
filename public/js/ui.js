// Poner esto DENTRO del listener DOMContentLoaded si ya tienes uno, o añadirlo

function setupMobileMenuToggle() {
    const menuButton = document.getElementById('menu-toggle-button');
    const navigation = document.getElementById('main-navigation');

    if (menuButton && navigation) {
        console.log("Configurando toggle del menú móvil...");
        menuButton.addEventListener('click', () => {
            // Alterna la clase 'nav-active' en el <nav>
            const isExpanded = navigation.classList.toggle('nav-active');
            // Actualiza el atributo ARIA para accesibilidad
            menuButton.setAttribute('aria-expanded', isExpanded);
             // Opcional: Cambiar icono hamburguesa a 'X' cuando está abierto
             const icon = menuButton.querySelector('i');
             if (icon) {
                 icon.classList.toggle('fa-bars', !isExpanded); // Muestra barras si NO está expandido
                 icon.classList.toggle('fa-times', isExpanded); // Muestra X si SÍ está expandido
             }
            console.log("Menú móvil alternado. Activo:", isExpanded);
        });

        // Opcional: Cerrar menú si se hace clic fuera de él
        document.addEventListener('click', (event) => {
            // Comprobar si el menú está activo y si el clic NO fue dentro del menú NI en el botón
            const isClickInsideNav = navigation.contains(event.target);
            const isClickOnButton = menuButton.contains(event.target);

            if (navigation.classList.contains('nav-active') && !isClickInsideNav && !isClickOnButton) {
                navigation.classList.remove('nav-active');
                menuButton.setAttribute('aria-expanded', 'false');
                 const icon = menuButton.querySelector('i');
                 if (icon) {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                 }
                console.log("Menú móvil cerrado por clic externo.");
            }
        });

    } else {
        // Advertir si no se encuentran los elementos necesarios
        if (!menuButton) console.warn("Botón de menú móvil (menu-toggle-button) no encontrado.");
        if (!navigation) console.warn("Contenedor de navegación (main-navigation) no encontrado.");
    }
}

// Asegurarse de que se ejecute después de que el DOM esté listo
// Si auth.js ya tiene un DOMContentLoaded, pon la llamada setupMobileMenuToggle() dentro.
// Si no, usa esto:
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupMobileMenuToggle);
} else {
    // El DOM ya está listo
    setupMobileMenuToggle();
}