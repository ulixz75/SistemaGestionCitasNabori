// js/dashboard-firebase.js

document.addEventListener('DOMContentLoaded', async () => {
    console.log("Dashboard Firebase inicializado. Esperando DB...");
    // Pequeña espera opcional
    await new Promise(resolve => setTimeout(resolve, 150));

    // --- Verificar Conexión ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no definido.");
        document.body.innerHTML = '<p style="color:red; text-align:center; padding: 20px;">Error de conexión con la base de datos.</p>';
        return;
    }
    console.log("Accediendo a Firestore (Dashboard) a través de window.db...");

    // --- Referencias a Colecciones ---
    const appointmentsCollection = window.db.collection('citas');
    const clientsCollection = window.db.collection('clientes');
    const specialistsCollection = window.db.collection('especialistas');
    const servicesCollection = window.db.collection('servicios');

    // --- Elementos del DOM para Tarjetas ---
    const totalClientsStatP = document.getElementById('total-clients-stat');
    const upcomingAppointmentsStatP = document.getElementById('upcoming-appointments-stat');
    const totalSpecialistsStatP = document.getElementById('total-specialists-stat');
    const totalServicesStatP = document.getElementById('total-services-stat');

    // --- Elementos del DOM para Gráficos ---
    const serviceChartCtx = document.getElementById('service-chart')?.getContext('2d');
    const specialistChartCtx = document.getElementById('specialist-chart')?.getContext('2d');
    const serviceErrorP = document.getElementById('service-chart-error');
    const specialistErrorP = document.getElementById('specialist-chart-error');
    const serviceCanvas = document.getElementById('service-chart');
    const specialistCanvas = document.getElementById('specialist-chart');

    // --- Elementos del DOM para Tabla Actividad Reciente ---
    const recentAppointmentsTableBody = document.querySelector('#recent-appointments-table tbody');

    // --- Paleta de Colores ---
    const chartColors = [
        'rgba(75, 192, 192, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(255, 206, 86, 0.7)',
        'rgba(255, 99, 132, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(255, 159, 64, 0.7)',
        'rgba(46, 204, 113, 0.7)', 'rgba(230, 126, 34, 0.7)', 'rgba(142, 68, 173, 0.7)',
        'rgba(52, 73, 94, 0.7)', 'rgba(199, 199, 199, 0.7)', 'rgba(83, 102, 255, 0.7)'
    ];

    // --- Función para formatear fecha/hora (Corta para tabla) ---
    function formatDateTimeShort(timestamp) {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try { return timestamp.toDate().toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) { return "Inválida"; }
    }

    // --- Función Principal para Cargar TODO ---
    async function loadDashboardData() {
        console.log("[DBoard] Iniciando carga de todos los datos...");
        // Poner mensajes de carga iniciales
        if (totalClientsStatP) totalClientsStatP.textContent = '...';
        if (upcomingAppointmentsStatP) upcomingAppointmentsStatP.textContent = '...';
        if (totalSpecialistsStatP) totalSpecialistsStatP.textContent = '...';
        if (totalServicesStatP) totalServicesStatP.textContent = '...';
        if (recentAppointmentsTableBody) recentAppointmentsTableBody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>'; // Ajusta colspan si cambia
        if (serviceErrorP) { serviceErrorP.style.display = 'block'; serviceErrorP.textContent = 'Cargando...'; if (serviceCanvas) serviceCanvas.style.display = 'none'; }
        if (specialistErrorP) { specialistErrorP.style.display = 'block'; specialistErrorP.textContent = 'Cargando...'; if (specialistCanvas) specialistCanvas.style.display = 'none'; }

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");

            // --- Obtener todos los datos necesarios en paralelo ---
            const now = new Date();
            const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            const nowTimestamp = firebase.firestore.Timestamp.fromDate(now);
            const sevenDaysLaterTimestamp = firebase.firestore.Timestamp.fromDate(sevenDaysLater);

            console.log("[DBoard] Realizando consultas a Firestore...");
            const [
                clientsSnap, specialistsSnap, servicesSnap, allAppointmentsSnap, upcomingAppointmentsSnap
            ] = await Promise.all([
                clientsCollection.get(),
                specialistsCollection.get(),
                servicesCollection.get(),
                appointmentsCollection.get(), // Para gráficos
                appointmentsCollection // Para tarjeta y tabla reciente
                    .where('fecha_hora', '>=', nowTimestamp)
                    .where('fecha_hora', '<=', sevenDaysLaterTimestamp)
                    .orderBy('fecha_hora', 'asc') // Próximas primero
                    // .limit(10) // Limitar si esperas muchas citas próximas
                    .get()
            ]);
            console.log("[DBoard] Datos Firestore recibidos:", { clients: clientsSnap.size, specialists: specialistsSnap.size, services: servicesSnap.size, allApps: allAppointmentsSnap.size, upcomingApps: upcomingAppointmentsSnap.size });

            // --- 1. Actualizar Tarjetas de Resumen ---
            if (totalClientsStatP) totalClientsStatP.textContent = clientsSnap.size;
            if (totalSpecialistsStatP) totalSpecialistsStatP.textContent = specialistsSnap.size;
            if (totalServicesStatP) totalServicesStatP.textContent = servicesSnap.size;
            if (upcomingAppointmentsStatP) upcomingAppointmentsStatP.textContent = upcomingAppointmentsSnap.size;
            console.log("[DBoard] Tarjetas actualizadas.");

            // --- 2. Preparar Datos Relacionados (para gráficos y tabla) ---
            // (Se necesita incluso si no hay citas, para mostrar N/A en la tabla)
            const clientNames = {}; clientsSnap.docs.forEach(doc => clientNames[doc.id] = doc.data().nombre_completo || `ID:${doc.id}`);
            const specialistNames = {}; specialistsSnap.docs.forEach(doc => specialistNames[doc.id] = doc.data().nombre || `ID:${doc.id}`);
            const serviceNames = {}; servicesSnap.docs.forEach(doc => serviceNames[doc.id] = doc.data().nombre || `ID:${doc.id}`);
            console.log("[DBoard] Mapas de nombres creados.");

            // --- 3. Procesar y Generar Gráficos ---
            if (allAppointmentsSnap.empty) {
                 console.warn("[DBoard] No hay citas registradas para generar gráficos.");
                 if (serviceErrorP) { serviceErrorP.textContent = 'No hay datos de citas.'; serviceErrorP.style.display = 'block'; }
                 if (specialistErrorP) { specialistErrorP.textContent = 'No hay datos de citas.'; specialistErrorP.style.display = 'block';}
            } else {
                const serviceCounts = {}; const specialistCounts = {};
                allAppointmentsSnap.docs.forEach(doc => {
                     const app = doc.data();
                     // Contar solo si tienen referencia válida
                     if (app.servicio_id && serviceNames[app.servicio_id]) {
                         serviceCounts[serviceNames[app.servicio_id]] = (serviceCounts[serviceNames[app.servicio_id]] || 0) + 1;
                     }
                     if (app.especialista_id && specialistNames[app.especialista_id]) {
                         specialistCounts[specialistNames[app.especialista_id]] = (specialistCounts[specialistNames[app.especialista_id]] || 0) + 1;
                     }
                });
                console.log("[DBoard] Conteos gráficos:", { serviceCounts, specialistCounts });

                // Generar Gráfico Servicios
                if (serviceChartCtx && serviceCanvas && Object.keys(serviceCounts).length > 0) {
                    if(serviceErrorP) serviceErrorP.style.display = 'none'; serviceCanvas.style.display = 'block';
                    if (window.serviceChart instanceof Chart) window.serviceChart.destroy();
                    window.serviceChart = new Chart(serviceChartCtx, { type: 'bar', data: { labels: Object.keys(serviceCounts), datasets: [{ label: 'Citas', data: Object.values(serviceCounts), backgroundColor: chartColors, borderColor: chartColors.map(c=>c.replace('0.7','1')), borderWidth: 1 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` Citas: ${ctx.raw}` } } } } });
                    console.log("[DBoard] Gráfico Servicios generado.");
                } else if (serviceErrorP) { serviceErrorP.textContent = 'No hay datos suficientes.'; serviceErrorP.style.display = 'block'; if(serviceCanvas) serviceCanvas.style.display = 'none';}

                // Generar Gráfico Especialistas
                if (specialistChartCtx && specialistCanvas && Object.keys(specialistCounts).length > 0) {
                    if(specialistErrorP) specialistErrorP.style.display = 'none'; specialistCanvas.style.display = 'block';
                    if (window.specialistChart instanceof Chart) window.specialistChart.destroy();
                    window.specialistChart = new Chart(specialistChartCtx, { type: 'pie', data: { labels: Object.keys(specialistCounts), datasets: [{ label: 'Citas', data: Object.values(specialistCounts), backgroundColor: chartColors, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} citas` } } } } });
                    console.log("[DBoard] Gráfico Especialistas generado.");
                 } else if (specialistErrorP) { specialistErrorP.textContent = 'No hay datos suficientes.'; specialistErrorP.style.display = 'block'; if(specialistCanvas) specialistCanvas.style.display = 'none';}
            }

            // --- 4. Poblar Tabla de Actividad Reciente ---
            if (recentAppointmentsTableBody) {
                recentAppointmentsTableBody.innerHTML = ''; // Limpiar
                if (upcomingAppointmentsSnap.empty) {
                     recentAppointmentsTableBody.innerHTML = '<tr><td colspan="4" class="text-center">No hay citas próximas (7 días).</td></tr>'; // colspan=4
                } else {
                    // Mostrar las últimas 5 obtenidas (ya vienen ordenadas)
                    const recentToShow = upcomingAppointmentsSnap.docs.slice(0, 5);
                    recentToShow.forEach(doc => {
                        const app = doc.data(); const row = document.createElement('tr');
                        row.innerHTML = `
                            <td data-label="Fecha/Hora">${formatDateTimeShort(app.fecha_hora)}</td>
                            <td data-label="Cliente">${clientNames[app.cliente_id] || app.cliente_id}</td>
                            <td data-label="Especialista">${specialistNames[app.especialista_id] || app.especialista_id}</td>
                            <td data-label="Servicio">${serviceNames[app.servicio_id] || app.servicio_id}</td>
                        `;
                        recentAppointmentsTableBody.appendChild(row);
                    });
                    console.log(`[DBoard] Tabla actividad reciente poblada (${recentToShow.length} citas).`);
                }
            } else { console.error("[DBoard] Tabla actividad reciente no encontrada."); }

            console.log("[DBoard] Carga de datos completada con éxito.");

        } catch (error) { // Catch para toda la carga de datos
            console.error("[DBoard] Error general cargando datos:", error);
            Swal.fire('Error Dashboard', `No se pudieron cargar datos: ${error.message}`, 'error');
            // Actualizar UI para mostrar errores persistentes
            if(totalClientsStatP) totalClientsStatP.textContent = 'Error'; if(upcomingAppointmentsStatP) upcomingAppointmentsStatP.textContent = 'Error'; if(totalSpecialistsStatP) totalSpecialistsStatP.textContent = 'Error'; if(totalServicesStatP) totalServicesStatP.textContent = 'Error';
            if(recentAppointmentsTableBody) recentAppointmentsTableBody.innerHTML = `<tr><td colspan="4" class="text-center">Error al cargar: ${error.message}</td></tr>`;
            if(serviceCanvas) serviceCanvas.style.display = 'none'; if(specialistCanvas) specialistCanvas.style.display = 'none';
            if(serviceErrorP) { serviceErrorP.textContent = 'Error al cargar'; serviceErrorP.style.display = 'block'; } if(specialistErrorP) { specialistErrorP.textContent = 'Error al cargar'; specialistErrorP.style.display = 'block'; }
        }
    } // Fin loadDashboardData

    // --- Carga Inicial ---
    loadDashboardData();

}); // Fin DOMContentLoaded