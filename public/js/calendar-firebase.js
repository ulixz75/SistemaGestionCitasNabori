// js/calendar-firebase.js

document.addEventListener('DOMContentLoaded', async () => {
    // --- Verificar Conexión y Obtener Elementos ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no está definido al iniciar calendar-firebase.js");
        Swal.fire('Error de Configuración', 'No se pudo conectar con la base de datos (Firebase).', 'error');
        return;
    }
    const calendarEl = document.getElementById('calendar');
    const loadingIndicator = document.getElementById('loading-indicator');
    if (!calendarEl) {
        console.error("Elemento 'calendar' no encontrado.");
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        return;
    }
    console.log("Accediendo a Firestore (Calendario) a través de window.db...");

    let calendarInstance = null;

    // --- Función para formatear Timestamp de Firestore para display ---
    function formatDateTimeForDisplay(timestamp) {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try { return timestamp.toDate().toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
        } catch (e) { console.error("Error formateando timestamp:", timestamp, e); return "Fecha inválida"; }
    }

    // --- Función para Cargar Eventos del Calendario desde Firestore ---
    async function loadCalendarEvents() {
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        console.log("Cargando eventos para el calendario...");
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
            const appointmentsSnap = await window.db.collection('citas').get();
            if (appointmentsSnap.empty) { console.log("No hay citas."); return []; }

            const clientIds = new Set(); const specialistIds = new Set(); const serviceIds = new Set();
            const appointmentsData = [];
            appointmentsSnap.docs.forEach(doc => { /* ... Recopilar IDs y datos ... */
                const app = doc.data(); if (app.fecha_hora && app.fecha_hora.toDate) { appointmentsData.push({ id: doc.id, ...app }); if(app.cliente_id) clientIds.add(app.cliente_id); if(app.especialista_id) specialistIds.add(app.especialista_id); if(app.servicio_id) serviceIds.add(app.servicio_id); } else { console.warn(`Cita ID ${doc.id} omitida.`); }
            });
            if (appointmentsData.length === 0) { console.log("No hay citas válidas."); return []; }

            const [clientSnaps, specialistSnaps, serviceSnaps] = await Promise.all([ /* ... Consultas where in ... */
                 clientIds.size > 0 ? window.db.collection('clientes').where(firebase.firestore.FieldPath.documentId(), 'in', [...clientIds]).get() : Promise.resolve({ docs: [] }),
                 specialistIds.size > 0 ? window.db.collection('especialistas').where(firebase.firestore.FieldPath.documentId(), 'in', [...specialistIds]).get() : Promise.resolve({ docs: [] }),
                 serviceIds.size > 0 ? window.db.collection('servicios').where(firebase.firestore.FieldPath.documentId(), 'in', [...serviceIds]).get() : Promise.resolve({ docs: [] })
            ]);

            const clientNames = {}; clientSnaps.docs.forEach(doc => clientNames[doc.id] = doc.data().nombre_completo || 'N/A');
            const specialistNames = {}; specialistSnaps.docs.forEach(doc => specialistNames[doc.id] = doc.data().nombre || 'N/A');
            const serviceInfoMap = {}; serviceSnaps.docs.forEach(doc => serviceInfoMap[doc.id] = { nombre: doc.data().nombre || 'N/A', duracion_minutos: doc.data().duracion_minutos });
            console.log("Datos relacionados cargados para calendario.");

            const events = appointmentsData.map(app => { /* ... Mapeo a eventos (código existente) ... */
                const startDateTime = app.fecha_hora.toDate(); const clientName = clientNames[app.cliente_id] || 'Cliente Desc.'; const serviceData = serviceInfoMap[app.servicio_id]; const serviceName = serviceData?.nombre || 'Servicio Desc.'; const specialistName = specialistNames[app.especialista_id] || 'Espec. Desc.'; let endDateTime = null; const duration = serviceData?.duracion_minutos; if (duration && !isNaN(parseInt(duration))) { endDateTime = new Date(startDateTime.getTime() + parseInt(duration) * 60000); }
                return { id: app.id, title: `${clientName} - ${serviceName}`, start: startDateTime, end: endDateTime, extendedProps: { client: clientName, specialist: specialistName, service: serviceName, notes: app.notas_adicionales || '', startStr: formatDateTimeForDisplay(app.fecha_hora) } };
            });

            console.log(`Eventos procesados para FullCalendar: ${events.length}`);
            return events;
        } catch (error) { console.error('Error cargando eventos:', error); Swal.fire('Error Calendario', `No se pudieron cargar citas: ${error.message}`, 'error'); throw error;
        } finally { if (loadingIndicator) loadingIndicator.style.display = 'none'; }
    } // Fin loadCalendarEvents

    // --- Inicializar FullCalendar ---
    try {
        if(typeof FullCalendar === 'undefined') throw new Error("FullCalendar no cargado.");

        // Determinar configuración del headerToolbar basado en ancho de ventana
        const mobileHeaderToolbar = { left: 'prev,next', center: 'title', right: 'today' };
        const desktopHeaderToolbar = { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' };
        const currentHeaderToolbar = window.innerWidth < 576 ? mobileHeaderToolbar : desktopHeaderToolbar;
        // Determinar vista inicial (opcional)
        // const initialCalendarView = window.innerWidth < 768 ? 'listWeek' : 'timeGridWeek';

        calendarInstance = new FullCalendar.Calendar(calendarEl, {
            locale: 'es',
            // initialView: initialCalendarView, // Descomentar si quieres vista lista en móvil
            initialView: 'timeGridWeek',
            headerToolbar: currentHeaderToolbar, // Toolbar adaptativo
            handleWindowResize: true, // Permitir redibujar
            windowResizeDelay: 250,   // Retraso para resize
            slotMinTime: '08:00:00',
            slotMaxTime: '20:00:00',
            allDaySlot: false,
            nowIndicator: true,
            businessHours: { daysOfWeek: [ 1, 2, 3, 4, 5, 6 ], startTime: '08:00', endTime: '20:00' },
            eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
            slotLabelFormat: { hour: 'numeric', minute: '2-digit', hour12: false, meridiem: false },
            // Cargar eventos usando la función
            events: async function(fetchInfo, successCallback, failureCallback) {
                 try { const events = await loadCalendarEvents(); successCallback(events); }
                 catch (error) { failureCallback(error); }
             },
            eventClick: function(info) { /* ... Popup Swal existente ... */
                 const props = info.event.extendedProps; Swal.fire({ title: 'Detalles de la Cita', html: `<div style="text-align: left; padding: 0 1em;"><p><strong>Cliente:</strong> ${props.client}</p><p><strong>Especialista:</strong> ${props.specialist}</p><p><strong>Servicio:</strong> ${props.service}</p><p><strong>Fecha y Hora:</strong> ${props.startStr}</p>${props.notes ? `<p><strong>Notas:</strong> ${props.notes}</p>` : ''}</div>`, icon: 'info', confirmButtonText: 'Cerrar', confirmButtonColor: '#4CAF50' });
             },
            height: 'auto',
             // Opciones responsivas adicionales de FullCalendar
             // views: { // Podrías definir opciones específicas por vista
             //    timeGridWeek: {
             //        dayHeaderFormat: { weekday: 'short', day: 'numeric', omitCommas: true } // Formato cabecera más corto
             //    },
             //    timeGridDay: {
             //         dayHeaderFormat: { weekday: 'long', day: 'numeric', month: 'long' }
             //    }
             // },
             // eventDisplay: 'block', // o 'list-item' en vistas de día/semana para mejor lectura en móvil
        });

        calendarInstance.render(); // Renderizar el calendario

        // Opcional: Forzar redibujo si el tamaño de ventana cambia significativamente después de cargar
        // window.addEventListener('resize', () => {
        //    if (calendarInstance) {
        //        // Podrías ajustar el headerToolbar aquí de nuevo si es necesario
        //        calendarInstance.updateSize(); // Ajusta tamaño
        //    }
        // });

    } catch (initError) {
        console.error("Error inicializando FullCalendar:", initError);
        if (calendarEl) calendarEl.innerHTML = `<p class="error-message">Error al cargar: ${initError.message}</p>`;
        Swal.fire('Error Crítico', `No se pudo inicializar calendario: ${initError.message}`, 'error');
    }

}); // Fin DOMContentLoaded