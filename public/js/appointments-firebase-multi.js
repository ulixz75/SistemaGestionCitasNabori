// js/appointments-firebase-multi.js - MODIFIED VERSION

document.addEventListener('DOMContentLoaded', () => {

    // --- INICIALIZAR EMAILJS PRIMERO ---
    try {
        emailjs.init("Up--xEasllmUPUcdI"); // Replace with your actual Public Key
        console.log("EmailJS SDK inicializado correctamente.");
    } catch (error) {
        console.error("Error inicializando EmailJS:", error);
        Swal.fire('Advertencia', `No se podrán enviar notificaciones por email: ${error.message}`, 'warning');
    }

    // --- Verificar Conexión Firestore ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no está definido al iniciar appointments-firebase-multi.js");
        Swal.fire('Error de Configuración', 'No se pudo conectar con la base de datos (Firebase).', 'error');
        const form = document.getElementById('appointment-form');
        if (form) form.style.display = 'none';
        return; // Salir del listener si no hay DB
    }
    console.log("Accediendo a Firestore (Citas Múltiples) a través de window.db...");

    // --- Referencias a Colecciones ---
    const appointmentsCollection = window.db.collection('citas');
    const clientsCollection = window.db.collection('clientes');
    const specialistsCollection = window.db.collection('especialistas');
    const servicesCollection = window.db.collection('servicios');

    // --- Elementos del DOM ---
    const appointmentForm = document.getElementById('appointment-form');
    const formTitle = document.getElementById('form-title');
    const clientIdSelect = document.getElementById('client-id');
    const specialistIdSelect = document.getElementById('specialist-id');
    const serviceIdSelect = document.getElementById('service-id');
    const notesInput = document.getElementById('notes');
    // Payment elements ADDED
    const paymentMethodSelect = document.getElementById('payment-method');
    const paymentAmountInput = document.getElementById('payment-amount');
    const sessionCountInput = document.getElementById('session-count');
    // End Payment elements
    const sessionInfoDiv = document.getElementById('session-info');
    const slotsContainer = document.getElementById('slots-container');
    const addSlotButton = document.getElementById('add-slot-button');
    const saveButton = document.getElementById('save-button');
    const appointmentsTableBody = document.querySelector('#appointments-table tbody');
    const serviceDurationInfo = document.getElementById('service-duration-info');

    // --- Variables de Estado ---
    let clientDataCache = {};
    let specialistDataCache = {};
    let serviceDataCache = {};
    let maxSessionsFromClient = 0; // Read from client data
    let currentSlots = 0;

    // --- DEFINICIÓN DE FUNCIONES ---

    // --- Función para formatear Timestamp de Firestore para display ---
    function formatDateTimeForDisplay(timestamp) {
        if (!timestamp || !timestamp.toDate) return 'N/A';
        try {
            return timestamp.toDate().toLocaleString('es-ES', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: false
            });
        } catch (e) {
            console.error("Error formateando timestamp:", timestamp, e);
            return "Fecha inválida";
        }
    }

    // --- Función Resetear Formulario ---
    function resetForm() {
        console.log("Ejecutando resetForm (modified)...");
        if (appointmentForm) appointmentForm.reset();
        if (formTitle) formTitle.textContent = 'Programar Sesiones para Cliente';
        if (saveButton) saveButton.textContent = 'Guardar Todas las Citas';
        if (clientIdSelect) clientIdSelect.selectedIndex = 0;
        if (specialistIdSelect) specialistIdSelect.selectedIndex = 0;
        if (serviceIdSelect) serviceIdSelect.selectedIndex = 0;
        // Reset payment fields explicitly if needed (though form.reset() should handle them)
        if (paymentMethodSelect) paymentMethodSelect.value = "";
        if (paymentAmountInput) paymentAmountInput.value = "";
        if (sessionCountInput) sessionCountInput.value = "";

        if (slotsContainer) slotsContainer.innerHTML = '<p>Seleccione cliente, especialista y servicio para añadir horarios.</p>';
        if (sessionInfoDiv) sessionInfoDiv.textContent = 'Sesiones disponibles: N/A';
        if (serviceDurationInfo) serviceDurationInfo.textContent = '';
        if (addSlotButton) addSlotButton.disabled = true;
        if (saveButton) saveButton.disabled = true;
        currentSlots = 0;
        maxSessionsFromClient = 0;
        console.log("resetForm (modified) completado.");
    }

    // --- Función Cargar Opciones ---
    async function loadOptions() {
        console.log("Cargando opciones (modified)...");
        if (!clientIdSelect || !specialistIdSelect || !serviceIdSelect) {
             console.error("Elementos select no encontrados para cargar opciones.");
             return;
        }
        clientIdSelect.innerHTML = '<option value="">Cargando...</option>';
        specialistIdSelect.innerHTML = '<option value="">Cargando...</option>';
        serviceIdSelect.innerHTML = '<option value="">Cargando...</option>';
        clientDataCache = {}; specialistDataCache = {}; serviceDataCache = {};

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");

            // Clientes
            const clientsSnap = await clientsCollection.orderBy('nombre_completo').get();
            clientIdSelect.innerHTML = '<option value="">Seleccionar Cliente</option>';
            clientsSnap.forEach(doc => {
                const data = doc.data(); clientDataCache[doc.id] = data; // Cache full client data
                const option = document.createElement('option'); option.value = doc.id;
                // Display service summary WITH modality in dropdown
                let servicesSummary = '';
                 if (Array.isArray(data.servicios_contratados) && data.servicios_contratados.length > 0) {
                      servicesSummary = ` (${data.servicios_contratados.map(s => {
                          if (typeof s === 'object' && s.tipo) {
                              const type = s.tipo.substring(0, 3);
                              const mod = [];
                              if(s.remoto) mod.push('R');
                              if(s.presencial) mod.push('P');
                              return mod.length > 0 ? `${type}(${mod.join('')})` : type;
                          }
                          return (s || '').substring(0,3); // Fallback for old string data
                      }).join(', ')})`;
                 }
                // Store max sessions from client data
                option.dataset.maxSessions = data.cantidad_sesiones || '0'; // Still read potential existing sessions
                option.textContent = `${data.nombre_completo || `ID: ${doc.id}`}${servicesSummary}`;
                clientIdSelect.appendChild(option);
            });

            // Especialistas
            const specialistsSnap = await specialistsCollection.orderBy('nombre').get();
            specialistIdSelect.innerHTML = '<option value="">Seleccionar Especialista</option>';
            specialistsSnap.forEach(doc => {
                 const data = doc.data(); specialistDataCache[doc.id] = data;
                 const option = document.createElement('option'); option.value = doc.id;
                 option.textContent = data.nombre || `ID: ${doc.id}`;
                 specialistIdSelect.appendChild(option);
            });

            // Servicios
            const servicesSnap = await servicesCollection.orderBy('nombre').get();
            serviceIdSelect.innerHTML = '<option value="">Seleccionar Servicio</option>';
            servicesSnap.forEach(doc => {
                 const data = doc.data(); serviceDataCache[doc.id] = data;
                 const option = document.createElement('option'); option.value = doc.id;
                 option.textContent = data.nombre || `ID: ${doc.id}`;
                 option.dataset.duration = data.duracion_minutos || 'N/A';
                 serviceIdSelect.appendChild(option);
            });
            console.log("Opciones (modified) cargadas.");

        } catch (error) {
            console.error('Error cargando opciones (modified):', error);
            Swal.fire('Error', `No se pudieron cargar las opciones: ${error.message}`, 'error');
            clientIdSelect.innerHTML = '<option value="">Error</option>';
            specialistIdSelect.innerHTML = '<option value="">Error</option>';
            serviceIdSelect.innerHTML = '<option value="">Error</option>';
        }
    } // Fin loadOptions

    // --- Función Actualizar Info Sesiones ---
    function updateSessionInfo() {
        console.log("Actualizando info de sesión (modified)...");
        const selectedClientId = clientIdSelect ? clientIdSelect.value : null;
        const selectedSpecialistId = specialistIdSelect ? specialistIdSelect.value : null;
        const selectedServiceId = serviceIdSelect ? serviceIdSelect.value : null;
        maxSessionsFromClient = 0; // Reset max sessions from client

        if (sessionInfoDiv) sessionInfoDiv.textContent = 'Sesiones disponibles: N/A';
        if (serviceDurationInfo) serviceDurationInfo.textContent = '';
        // Reset payment fields when client changes
        if (paymentMethodSelect) paymentMethodSelect.value = "";
        if (paymentAmountInput) paymentAmountInput.value = "";
        if (sessionCountInput) sessionCountInput.value = "";


        if (selectedClientId && clientIdSelect.options[clientIdSelect.selectedIndex]) {
             const selectedOption = clientIdSelect.options[clientIdSelect.selectedIndex];
             maxSessionsFromClient = parseInt(selectedOption.dataset.maxSessions || '0', 10);
             if (isNaN(maxSessionsFromClient)) maxSessionsFromClient = 0;

             if (sessionInfoDiv) sessionInfoDiv.textContent = `Sesiones disponibles: ${maxSessionsFromClient}`;

             // Pre-fill payment fields from cached client data if available
             const cachedClient = clientDataCache[selectedClientId];
             if (cachedClient) {
                 if (paymentMethodSelect) paymentMethodSelect.value = cachedClient.metodo_pago || '';
                 if (paymentAmountInput) paymentAmountInput.value = cachedClient.cantidad_pago || '';
                 if (sessionCountInput) sessionCountInput.value = cachedClient.cantidad_sesiones || '';
             } else {
                 console.warn("Datos del cliente no encontrados en caché para prellenar pago.");
             }
        }

        const canAddSlots = selectedClientId && selectedSpecialistId && selectedServiceId; // Allow adding slots even if maxSessions=0 initially
        if (addSlotButton) addSlotButton.disabled = !canAddSlots;
        if (saveButton) saveButton.disabled = !(canAddSlots && currentSlots > 0);

        if (selectedServiceId && serviceIdSelect.options[serviceIdSelect.selectedIndex]) {
            const selectedOption = serviceIdSelect.options[serviceIdSelect.selectedIndex];
            const duration = selectedOption.dataset.duration || 'N/A';
            if(serviceDurationInfo) serviceDurationInfo.textContent = ` (Duración: ${duration} min)`;
        }

        // Reset slots if selection changes
         if (slotsContainer && !addSlotButton?.disabled && currentSlots > 0) {
            console.log("Limpiando slots por cambio de selección principal.");
             slotsContainer.innerHTML = '<p>Seleccione cliente, especialista y servicio para añadir horarios.</p>';
             currentSlots = 0;
             if (saveButton) saveButton.disabled = true;
        } else if (slotsContainer && canAddSlots && currentSlots === 0) {
             slotsContainer.innerHTML = ''; // Prepare container if ready and empty
        }
    } // Fin updateSessionInfo

    // --- Función Añadir Slot Input ---
    function addSlotInput() {
        if (!addSlotButton || addSlotButton.disabled) return;

        // Use the NEW session count input for validation if filled, otherwise use cached maxSessions
        const sessionLimitInputVal = sessionCountInput ? parseInt(sessionCountInput.value, 10) : NaN;
        const effectiveMaxSessions = !isNaN(sessionLimitInputVal) && sessionLimitInputVal > 0 ? sessionLimitInputVal : maxSessionsFromClient;

        if (effectiveMaxSessions > 0 && currentSlots >= effectiveMaxSessions) {
            Swal.fire('Límite Alcanzado', `Ya ha añadido el máximo de ${effectiveMaxSessions} sesiones (basado en sesiones pagadas o disponibles).`, 'warning');
            return;
        }
        if (!slotsContainer) return;
        if (currentSlots === 0) slotsContainer.innerHTML = '';

        currentSlots++;
        const slotId = `slot-${Date.now()}-${currentSlots}`;
        const slotDiv = document.createElement('div');
        slotDiv.classList.add('slot-entry');
        slotDiv.id = slotId;
        slotDiv.innerHTML = `
            <label for="date-${slotId}">Fecha ${currentSlots}:</label>
            <input type="date" id="date-${slotId}" class="slot-date-input" required>
            <label for="time-${slotId}">Hora ${currentSlots}:</label>
            <input type="time" id="time-${slotId}" class="slot-time-input" min="08:00" max="19:59" step="1800" required>
            <button type="button" class="button-delete remove-slot-button" data-target="${slotId}" title="Eliminar horario">X</button>
        `;
        slotsContainer.appendChild(slotDiv);

        try {
            if(typeof flatpickr !== 'undefined') {
                 flatpickr(slotDiv.querySelector('input[type="date"]'), {
                     altInput: true, altFormat: "D, M j", dateFormat: "Y-m-d", minDate: "today",
                     locale: "es"
                 });
            } else { console.warn("Flatpickr no definido."); }
        } catch (e) { console.error("Error inicializando flatpickr:", e); }

        if (saveButton) saveButton.disabled = false;
        slotDiv.querySelector('.remove-slot-button').addEventListener('click', removeSlotInput);

        // Disable add button if limit is reached
        if (addSlotButton && effectiveMaxSessions > 0) {
            addSlotButton.disabled = (currentSlots >= effectiveMaxSessions);
        }
    } // Fin addSlotInput

    // --- Función Eliminar Slot Input ---
    function removeSlotInput(event) {
        const targetId = event.target.dataset.target;
        const slotToRemove = document.getElementById(targetId);
        if (slotToRemove) {
            slotToRemove.remove();
            currentSlots--;
            if (saveButton) saveButton.disabled = (currentSlots === 0);
            if (currentSlots === 0 && slotsContainer) {
                 slotsContainer.innerHTML = '<p>Seleccione cliente, especialista y servicio para añadir horarios.</p>';
            }

            // Re-enable add button if below limit
            const sessionLimitInputVal = sessionCountInput ? parseInt(sessionCountInput.value, 10) : NaN;
            const effectiveMaxSessions = !isNaN(sessionLimitInputVal) && sessionLimitInputVal > 0 ? sessionLimitInputVal : maxSessionsFromClient;

            if (addSlotButton) {
                 const canAddMore = clientIdSelect?.value && specialistIdSelect?.value && serviceIdSelect?.value && (effectiveMaxSessions <= 0 || currentSlots < effectiveMaxSessions);
                 addSlotButton.disabled = !canAddMore;
            }
        }
    } // Fin removeSlotInput

    // --- Función Cargar Lista de Citas ---
    async function loadAppointments() {
        console.log("Cargando citas (modified)...");
        if (!appointmentsTableBody) { console.error("appointmentsTableBody no encontrado"); return; }
        appointmentsTableBody.innerHTML = '<tr><td colspan="7">Cargando citas...</td></tr>'; // Colspan 7
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");
            const querySnapshot = await appointmentsCollection.orderBy('fecha_hora', 'desc').get();
            appointmentsTableBody.innerHTML = '';
            if (querySnapshot.empty) {
                appointmentsTableBody.innerHTML = '<tr><td colspan="7">No hay citas programadas.</td></tr>'; return;
            }

            // Fetch related data (no changes needed here)
            const clientIds = new Set(); const specialistIds = new Set(); const serviceIds = new Set();
            querySnapshot.docs.forEach(doc => { /* ... compile IDs ... */
                 const app = doc.data();
                 if(app.cliente_id) clientIds.add(app.cliente_id);
                 if(app.especialista_id) specialistIds.add(app.especialista_id);
                 if(app.servicio_id) serviceIds.add(app.servicio_id);
            });

            const [clientSnaps, specialistSnaps, serviceSnaps] = await Promise.all([/* ... fetch related data ... */
                 clientIds.size > 0 ? clientsCollection.where(firebase.firestore.FieldPath.documentId(), 'in', [...clientIds]).get() : Promise.resolve({ docs: [] }),
                 specialistIds.size > 0 ? specialistsCollection.where(firebase.firestore.FieldPath.documentId(), 'in', [...specialistIds]).get() : Promise.resolve({ docs: [] }),
                 serviceIds.size > 0 ? servicesCollection.where(firebase.firestore.FieldPath.documentId(), 'in', [...serviceIds]).get() : Promise.resolve({ docs: [] })
            ]);

            const clientNames = {}; clientSnaps.docs.forEach(doc => clientNames[doc.id] = doc.data().nombre_completo || 'N/A');
            const specialistNames = {}; specialistSnaps.docs.forEach(doc => specialistNames[doc.id] = doc.data().nombre || 'N/A');
            const serviceNames = {}; serviceSnaps.docs.forEach(doc => serviceNames[doc.id] = doc.data().nombre || 'N/A');

            querySnapshot.forEach(doc => {
                const appointment = doc.data(); const appointmentId = doc.id; const row = document.createElement('tr');
                // Original table row - no payment info displayed
                row.innerHTML = `
                    <td data-label="ID Cita">${appointmentId}</td>
                    <td data-label="Cliente">${clientNames[appointment.cliente_id] || appointment.cliente_id || 'N/A'}</td>
                    <td data-label="Especialista">${specialistNames[appointment.especialista_id] || appointment.especialista_id || 'N/A'}</td>
                    <td data-label="Servicio">${serviceNames[appointment.servicio_id] || appointment.servicio_id || 'N/A'}</td>
                    <td data-label="Fecha/Hora">${formatDateTimeForDisplay(appointment.fecha_hora)}</td>
                    <td data-label="Notas">${appointment.notas_adicionales || 'N/A'}</td>
                    <td data-label="Acciones">
                        <button class="button-edit" data-id="${appointmentId}" title="Edición no implementada">Editar</button>
                        <button class="button-delete" data-id="${appointmentId}">Eliminar</button>
                    </td>
                `;
                appointmentsTableBody.appendChild(row);
            });
             console.log("Citas (modified) cargadas.");
        } catch (error) {
             console.error('Error cargando citas (modified):', error);
             appointmentsTableBody.innerHTML = `<tr><td colspan="7">Error: ${error.message}</td></tr>`;
        }
    } // Fin loadAppointments

    // --- Función Guardar Citas Múltiples ---
    async function submitMultiAppointmentForm(event) {
        event.preventDefault();
        console.log("Intentando guardar citas múltiples (modified)...");
        if (!clientIdSelect || !specialistIdSelect || !serviceIdSelect || !saveButton || !paymentMethodSelect || !paymentAmountInput || !sessionCountInput) {
             console.error("Faltan elementos esenciales del formulario para guardar.");
             Swal.fire('Error Interno', 'Faltan elementos del formulario. Recargue la página.', 'error');
             return;
        }

        const clientId = clientIdSelect.value;
        const specialistId = specialistIdSelect.value;
        const serviceId = serviceIdSelect.value;
        const generalNotes = notesInput ? notesInput.value.trim() : "";
        // Read Payment info
        const paymentMethod = paymentMethodSelect.value;
        const paymentAmount = paymentAmountInput.value ? parseFloat(paymentAmountInput.value) : null;
        const sessionCount = sessionCountInput.value ? parseInt(sessionCountInput.value, 10) : null;


        if (!clientId || !specialistId || !serviceId) { Swal.fire('Faltan Datos', 'Seleccione Cliente, Especialista y Servicio.', 'warning'); return; }

        // Validate Payment info
        if (paymentAmount !== null && isNaN(paymentAmount)) { Swal.fire('Dato inválido', 'Cantidad de pago debe ser número.', 'warning'); return; }
        if (sessionCount !== null && (isNaN(sessionCount) || !Number.isInteger(sessionCount))) { Swal.fire('Dato inválido', 'Cantidad de sesiones debe ser número entero.', 'warning'); return; }

        const slotEntries = slotsContainer.querySelectorAll('.slot-entry');
        if (slotEntries.length === 0) { Swal.fire('Sin Horarios', 'Añada al menos un horario.', 'warning'); return; }

        // Use the NEW session count input for validation if filled, otherwise use cached maxSessions
        const effectiveMaxSessions = sessionCount !== null && sessionCount > 0 ? sessionCount : maxSessionsFromClient;

        if (effectiveMaxSessions > 0 && slotEntries.length > effectiveMaxSessions) {
             Swal.fire('Demasiadas Sesiones', `Está intentando programar ${slotEntries.length} sesiones, pero el límite (pagadas/disponibles) es ${effectiveMaxSessions}.`, 'warning');
             return;
        }

        const slotsToBook = []; let invalidSlot = false;
        slotEntries.forEach(slotDiv => {
            const dateInput = slotDiv.querySelector('.slot-date-input');
            const timeInput = slotDiv.querySelector('.slot-time-input');
            if (dateInput && timeInput && dateInput.value && timeInput.value) {
                slotsToBook.push({ date: dateInput.value, time: timeInput.value });
            } else { invalidSlot = true; }
        });
        if (invalidSlot) { Swal.fire('Horario Incompleto', 'Complete fecha/hora para todos los slots.', 'warning'); return; }

        saveButton.disabled = true; saveButton.textContent = 'Verificando...';

        let clientUpdateSuccess = true; // Flag to track client update status

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");

            // --- 1. Update Client Payment Info FIRST ---
            const clientDocRef = clientsCollection.doc(clientId);
            const paymentUpdateData = {};
            if (paymentMethod) paymentUpdateData.metodo_pago = paymentMethod;
            if (paymentAmount !== null) paymentUpdateData.cantidad_pago = paymentAmount;
            if (sessionCount !== null) paymentUpdateData.cantidad_sesiones = sessionCount;

             // Only update if there's something to update
             if (Object.keys(paymentUpdateData).length > 0) {
                 paymentUpdateData.timestamp_actualizacion = firebase.firestore.FieldValue.serverTimestamp();
                 console.log("Actualizando datos de pago del cliente:", clientId, paymentUpdateData);
                 try {
                     await clientDocRef.update(paymentUpdateData);
                     console.log("Datos de pago del cliente actualizados.");
                     // Update cache and dropdown data attribute immediately
                     if(clientDataCache[clientId]) {
                         Object.assign(clientDataCache[clientId], paymentUpdateData);
                         const clientOption = clientIdSelect.querySelector(`option[value="${clientId}"]`);
                         if (clientOption && paymentUpdateData.cantidad_sesiones !== undefined) {
                             clientOption.dataset.maxSessions = paymentUpdateData.cantidad_sesiones;
                             maxSessionsFromClient = paymentUpdateData.cantidad_sesiones; // Update state variable
                             if(sessionInfoDiv) sessionInfoDiv.textContent = `Sesiones disponibles: ${maxSessionsFromClient}`;
                         }
                     }
                 } catch (clientUpdateError) {
                      console.error("Error actualizando datos de pago del cliente:", clientUpdateError);
                      clientUpdateSuccess = false; // Mark as failed
                      // Decide if we should proceed or stop
                      const proceed = await Swal.fire({
                           title: 'Error al Actualizar Cliente',
                           text: `No se pudieron guardar los datos de pago del cliente (${clientUpdateError.message}). ¿Desea continuar guardando las citas igualmente?`,
                           icon: 'error',
                           showCancelButton: true,
                           confirmButtonText: 'Sí, guardar citas',
                           cancelButtonText: 'No, cancelar todo'
                      });
                      if (!proceed.isConfirmed) {
                           throw new Error("Actualización de cliente cancelada por el usuario."); // Stop execution
                      }
                      // If proceed, continue but remember the error
                 }
             } else {
                 console.log("No hay datos de pago nuevos para actualizar en el cliente.");
             }


            // --- 2. Validate and Prepare Appointment Slots ---
            // Fetch specialist availability
            const specialistDocRef = specialistsCollection.doc(specialistId);
            const docSnap = await specialistDocRef.get();
            if (!docSnap.exists) throw new Error("Especialista no encontrado.");
            const specialistData = docSnap.data();
            const availability = specialistData.disponibilidad_detallada || {};

            const validSlotsData = []; const dayMap = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];

            // Validate slots
            for (const slot of slotsToBook) {
                const appointmentDate = new Date(`${slot.date}T${slot.time}`);
                if (isNaN(appointmentDate.getTime())) throw new Error(`Fecha/Hora inválida: ${slot.date} ${slot.time}`);
                const appointmentDayIndex = appointmentDate.getDay();
                const appointmentTime = slot.time; const appointmentDayName = dayMap[appointmentDayIndex];

                // --- Availability Check (existing logic) ---
                if (appointmentDayIndex === 0 || appointmentTime < "08:00" || appointmentTime >= "20:00") {
                    throw new Error(`Horario ${appointmentDayName} ${appointmentTime} fuera de atención general.`);
                }
                const dayAvailabilityBlocks = availability[appointmentDayName]; let isAvailable = false;
                if (Array.isArray(dayAvailabilityBlocks) && dayAvailabilityBlocks.length > 0) {
                    for (const block of dayAvailabilityBlocks) {
                        if (block.inicio && block.fin && appointmentTime >= block.inicio && appointmentTime < block.fin) {
                            isAvailable = true; break;
                        }
                    }
                }
                if (!isAvailable) throw new Error(`Especialista no disponible: ${appointmentDayName} ${appointmentTime}.`);
                // --- End Availability Check ---

                // Prepare data for batch write (NO payment info needed here)
                validSlotsData.push({
                    cliente_id: clientId,
                    especialista_id: specialistId,
                    servicio_id: serviceId,
                    fecha_hora: firebase.firestore.Timestamp.fromDate(appointmentDate),
                    notas_adicionales: generalNotes || null,
                    timestamp_creacion: firebase.firestore.FieldValue.serverTimestamp(),
                    timestamp_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // --- 3. Batch Write Appointments ---
            console.log(`Guardando ${validSlotsData.length} citas en batch (modified)...`);
            saveButton.textContent = 'Guardando Citas...';
            const batch = window.db.batch();
            validSlotsData.forEach(appData => batch.set(appointmentsCollection.doc(), appData));
            await batch.commit();
            console.log("Batch commit de citas exitoso (modified).");

             // --- 4. Send Emails (No structural changes needed here) ---
            console.log("Intentando enviar emails (modified)...");
            let emailErrorOccurred = false;
            let firstErrorText = "Error desconocido en envío de email.";
             try {
                 if (typeof emailjs === 'undefined' || typeof emailjs.send !== 'function') {
                     throw new Error("EmailJS no inicializado o no cargado.");
                 }
                // Fetch emails again in case they changed or weren't cached
                 const clientEmail = clientDataCache[clientId]?.email || (await clientsCollection.doc(clientId).get()).data()?.email;
                 const specialistEmail = specialistDataCache[specialistId]?.email || (await specialistsCollection.doc(specialistId).get()).data()?.email;
                 const clientName = clientDataCache[clientId]?.nombre_completo || 'Cliente';
                 const specialistName = specialistDataCache[specialistId]?.nombre || 'Especialista';
                 const serviceName = serviceDataCache[serviceId]?.nombre || 'Servicio';
                 const citasHtmlList = validSlotsData.map(d => `<li>${formatDateTimeForDisplay(d.fecha_hora)}</li>`).join('');

                const emailPromises = [];
                if (clientEmail) { /* ... add client email promise ... */
                    const emailParamsCliente = { email: clientEmail, cliente_nombre: clientName, especialista_nombre: specialistName, servicio_nombre: serviceName, lista_citas: `<ul>${citasHtmlList}</ul>`, notas_generales: generalNotes };
                    emailPromises.push( emailjs.send('service_4qkrm4w', 'template_1ff0ozk', emailParamsCliente) .then(response => ({ status: 'fulfilled', email: clientEmail, response })) .catch(error => ({ status: 'rejected', email: clientEmail, reason: error })) );
                } else { console.warn("No se encontró email para el cliente."); }

                if (specialistEmail) { /* ... add specialist email promise ... */
                     const emailParamsEspecialista = { email: specialistEmail, cliente_nombre: clientName, especialista_nombre: specialistName, servicio_nombre: serviceName, lista_citas: `<ul>${citasHtmlList}</ul>`, notas_generales: generalNotes };
                     emailPromises.push( emailjs.send('service_4qkrm4w', 'template_zb49d3g', emailParamsEspecialista) .then(response => ({ status: 'fulfilled', email: specialistEmail, response })) .catch(error => ({ status: 'rejected', email: specialistEmail, reason: error })) );
                 } else { console.warn("No se encontró email para el especialista."); }


                if (emailPromises.length > 0) { /* ... process email results ... */
                    const results = await Promise.all(emailPromises);
                    results.forEach(result => { if (result.status === 'rejected') { emailErrorOccurred = true; firstErrorText = result.reason?.text || result.reason?.message || JSON.stringify(result.reason); console.error(`Error enviando email a ${result.email}: ${firstErrorText}`, result.reason); } else { console.log(`Email a ${result.email} enviado con éxito.`); } });
                } else { console.log("No había emails válidos para enviar."); }

            } catch(emailError) { emailErrorOccurred = true; firstErrorText = emailError?.text || emailError?.message || JSON.stringify(emailError); console.error(`Error durante el proceso de envío de emails: ${firstErrorText}`, emailError); }

            // --- 5. Final Success/Warning Message ---
            let finalTitle = 'Éxito';
            let finalMessage = `${validSlotsData.length} citas creadas correctamente.`;
            let finalIcon = 'success';

            if (!clientUpdateSuccess) {
                finalTitle = 'Citas Creadas, pero...';
                finalMessage = `Las citas (${validSlotsData.length}) se guardaron, pero hubo un error al actualizar los datos de pago del cliente.`;
                finalIcon = 'warning';
            }
            if (emailErrorOccurred) {
                finalTitle = clientUpdateSuccess ? 'Citas Creadas, pero...' : 'Problemas Múltiples';
                finalMessage += ` Además, hubo un error al enviar notificaciones por email: ${firstErrorText}`;
                finalIcon = 'warning';
            }

            Swal.fire(finalTitle, finalMessage, finalIcon);

            resetForm();
            await loadAppointments();
            // No need to reload options explicitly as cache/dropdown was updated

        } catch (error) { // Catch validation/batch write errors
            console.error("Error al verificar/guardar citas múltiples (modified):", error);
            Swal.fire('Error', `No se pudieron guardar las citas: ${error.message}`, 'error');
        } finally {
            if (saveButton) {
                 // Re-enable save button based on initial criteria (not currentSlots anymore, as it was reset)
                 saveButton.disabled = !(clientIdSelect?.value && specialistIdSelect?.value && serviceIdSelect?.value);
                 saveButton.textContent = 'Guardar Todas las Citas';
            }
        }
    } // Fin submitMultiAppointmentForm

    // --- Función Editar Cita (Placeholder) ---
    function handleEdit(appointmentId) {
         Swal.fire('Pendiente', 'La edición individual de citas aún no está implementada.', 'info');
    }

    // --- Función Eliminar Cita ---
    async function handleDelete(appointmentId) {
        const result = await Swal.fire({
             title: '¿Cancelar Cita?', text: "Esta acción no se puede deshacer.", icon: 'warning',
             showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
             confirmButtonText: 'Sí, ¡cancelar!', cancelButtonText: 'No'
         });
        if (result.isConfirmed) {
            console.log("Intentando eliminar cita (modified):", appointmentId);
            try {
                if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
                const appointmentDocRef = appointmentsCollection.doc(appointmentId);
                await appointmentDocRef.delete();
                Swal.fire('¡Cancelada!', 'La cita ha sido eliminada.', 'success');
                await loadAppointments();
            } catch (error) {
                console.error('Error eliminando cita (modified):', error);
                Swal.fire('Error', `No se pudo eliminar la cita: ${error.message}`, 'error');
            }
        }
    } // Fin handleDelete

    // --- Añadir Event Listeners ---
    if (appointmentForm) appointmentForm.addEventListener('submit', submitMultiAppointmentForm);
    else console.error("Formulario 'appointment-form' no encontrado.");

    if (addSlotButton) addSlotButton.addEventListener('click', addSlotInput);
    else console.error("Botón 'add-slot-button' no encontrado.");

    if (clientIdSelect) clientIdSelect.addEventListener('change', updateSessionInfo);
    else console.error("Select 'client-id' no encontrado.");

    if (specialistIdSelect) specialistIdSelect.addEventListener('change', updateSessionInfo);
    else console.error("Select 'specialist-id' no encontrado.");

    if (serviceIdSelect) serviceIdSelect.addEventListener('change', updateSessionInfo);
    else console.error("Select 'service-id' no encontrado.");

    // Listener for session count input to potentially re-enable/disable add button
    if(sessionCountInput && addSlotButton) {
        sessionCountInput.addEventListener('input', () => {
            const sessionLimitInputVal = parseInt(sessionCountInput.value, 10);
            const effectiveMaxSessions = !isNaN(sessionLimitInputVal) && sessionLimitInputVal > 0 ? sessionLimitInputVal : maxSessionsFromClient;
            const canAddMore = clientIdSelect?.value && specialistIdSelect?.value && serviceIdSelect?.value && (effectiveMaxSessions <= 0 || currentSlots < effectiveMaxSessions);
            addSlotButton.disabled = !canAddMore;
        });
    }

    if (appointmentsTableBody) {
        appointmentsTableBody.addEventListener('click', (e) => {
            const target = e.target.closest('button'); // Use closest for clicks inside button
            if (!target) return;
            const appointmentId = target.getAttribute('data-id');
            if (!appointmentId) return;
            if (target.classList.contains('button-edit')) { handleEdit(appointmentId); }
            else if (target.classList.contains('button-delete')) { handleDelete(appointmentId); }
        });
    } else { console.error("Elemento 'appointments-table tbody' no encontrado."); }

    // --- Carga Inicial ---
    console.log("Iniciando carga inicial de citas (modified)...");
    loadOptions().then(() => {
        loadAppointments();
        // Initial check after options are loaded
        updateSessionInfo();
    });
    resetForm(); // Reset form state initially

}); // Fin DOMContentLoaded