// js/clients-firebase.js - MODIFIED VERSION

document.addEventListener('DOMContentLoaded', () => {
    // --- Verificar Conexión ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no está definido al iniciar clients-firebase.js");
        Swal.fire('Error de Configuración', 'No se pudo conectar con la base de datos (Firebase).', 'error');
        const form = document.getElementById('client-form');
        if(form) form.style.display = 'none';
        return;
    }
    console.log("Accediendo a Firestore (Clientes) a través de window.db...");

    // --- Referencia a la colección ---
    const clientsCollection = window.db.collection('clientes');

    // --- Elementos del DOM ---
    const clientForm = document.getElementById('client-form');
    const formTitle = document.getElementById('form-title');
    const clientIdInput = document.getElementById('client-id');
    const fullNameInput = document.getElementById('full-name');
    const studentNameInput = document.getElementById('student-name');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const addressInput = document.getElementById('address');
    const subjectInput = document.getElementById('subject');
    // Get main service checkboxes
    const serviceCheckboxes = document.querySelectorAll('input[name="service_type"]');
    // Payment elements REMOVED
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const clientsTableBody = document.querySelector('#clients-table tbody');

    let editingClientId = null;

    // --- Función Resetear Formulario ---
    function resetForm() {
        console.log("Ejecutando resetForm (modified)...");
        if (clientForm) clientForm.reset(); // This should reset all inputs including checkboxes
        if (clientIdInput) clientIdInput.value = '';
        editingClientId = null;
        if (formTitle) formTitle.textContent = 'Agregar Cliente';
        if (saveButton) saveButton.textContent = 'Guardar Cliente';
        if (cancelButton) cancelButton.style.display = 'none';
        console.log("resetForm (modified) completado.");
    }

    // --- Función Cargar Lista de Clientes ---
    async function loadClients() {
        console.log("Cargando clientes (modified)...");
        if (!clientsTableBody) { console.error("Elemento tbody de la tabla de clientes no encontrado."); return; }
        clientsTableBody.innerHTML = '<tr><td colspan="7">Cargando clientes...</td></tr>'; // Colspan 7
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");
            const querySnapshot = await clientsCollection.orderBy('nombre_completo').get();
            clientsTableBody.innerHTML = '';

            if (querySnapshot.empty) {
                clientsTableBody.innerHTML = '<tr><td colspan="7">No hay clientes registrados.</td></tr>'; return;
            }
            querySnapshot.forEach(doc => {
                const client = doc.data(); const clientId = doc.id; const row = document.createElement('tr');

                // Service display WITH modality
                let servicesText = 'N/A';
                if (Array.isArray(client.servicios_contratados) && client.servicios_contratados.length > 0) {
                     servicesText = client.servicios_contratados.map(s => {
                         // Handle potential old data (strings) vs new data (objects)
                         if (typeof s === 'string') {
                             return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                         } else if (typeof s === 'object' && s !== null && s.tipo) {
                             const typeFormatted = s.tipo.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                             const modality = [];
                             if (s.remoto) modality.push('R');
                             if (s.presencial) modality.push('P');
                             return `${typeFormatted}${modality.length > 0 ? ` (${modality.join(',')})` : ''}`;
                         }
                         return 'Inválido'; // Fallback for unexpected data structure
                     }).join(', ');
                }

                // Table row WITHOUT payment column
                row.innerHTML = `
                    <td data-label="ID">${clientId}</td>
                    <td data-label="Nombre">${client.nombre_completo || ''}</td>
                    <td data-label="Estudiante">${client.nombre_estudiante || 'N/A'}</td>
                    <td data-label="Teléfono">${client.telefono || 'N/A'}</td>
                    <td data-label="Email">${client.email || 'N/A'}</td>
                    <td data-label="Servicios (Modalidad)">${servicesText.substring(0, 40) + (servicesText.length > 40 ? '...' : '')}</td>
                    <!-- Payment column removed -->
                    <td data-label="Acciones">
                        <button class="button-edit" data-id="${clientId}">Editar</button>
                        <button class="button-delete" data-id="${clientId}">Eliminar</button>
                    </td>
                `;
                clientsTableBody.appendChild(row);
            });
            console.log("Clientes (modified) cargados.");
        } catch (error) {
            console.error('Error cargando clientes (modified):', error);
            clientsTableBody.innerHTML = `<tr><td colspan="7">Error al cargar clientes: ${error.message}</td></tr>`;
            Swal.fire('Error', `No se pudieron cargar los clientes: ${error.message}`, 'error');
        }
    } // Fin loadClients

    // --- Función Guardar/Actualizar Cliente ---
    async function submitClientForm(event) {
        event.preventDefault();
        console.log("Intentando guardar/actualizar cliente (modified)...");
        // Check basic elements
        if (!fullNameInput || !phoneInput || !emailInput || !saveButton || !serviceCheckboxes) {
             console.error("Faltan elementos esenciales del formulario para guardar (modified).");
             return;
        }

        // Read service checkboxes AND modality
        const serviciosContratados = [];
        serviceCheckboxes.forEach(mainCheckbox => {
            if (mainCheckbox.checked) {
                const serviceType = mainCheckbox.value;
                // Find corresponding modality checkboxes
                const remoteCheckbox = document.getElementById(`service-${serviceType}-remote`);
                const presencialCheckbox = document.getElementById(`service-${serviceType}-presencial`);

                const serviceObj = {
                    tipo: serviceType,
                    remoto: remoteCheckbox ? remoteCheckbox.checked : false,
                    presencial: presencialCheckbox ? presencialCheckbox.checked : false
                };
                serviciosContratados.push(serviceObj);
            }
        });

        const clientData = {
            nombre_completo: fullNameInput.value.trim(),
            nombre_estudiante: studentNameInput ? studentNameInput.value.trim() || null : null,
            telefono: phoneInput.value.trim(),
            email: emailInput.value.trim(),
            direccion: addressInput ? addressInput.value.trim() || null : null,
            materia: subjectInput ? subjectInput.value.trim() || null : null,
            servicios_contratados: serviciosContratados, // Array of objects {tipo, remoto, presencial}
            // Payment data REMOVED from here
            timestamp_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!clientData.nombre_completo || !clientData.telefono || !clientData.email) { Swal.fire('Campos incompletos', 'Complete Nombre, Teléfono y Email.', 'warning'); return; }
        // Payment validation REMOVED

        saveButton.disabled = true;

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");
            let message = '';
            if (editingClientId) {
                saveButton.textContent = 'Actualizando...';
                const clientDocRef = clientsCollection.doc(editingClientId);
                await clientDocRef.update(clientData);
                message = 'Cliente actualizado.';
            } else {
                saveButton.textContent = 'Guardando...';
                clientData.timestamp_creacion = firebase.firestore.FieldValue.serverTimestamp();
                await clientsCollection.add(clientData);
                message = 'Cliente agregado.';
            }
            resetForm();
            await loadClients();
            Swal.fire('Éxito', message, 'success');
        } catch (error) {
            console.error('Error guardando cliente (modified):', error);
            Swal.fire('Error', `No se pudo guardar el cliente: ${error.message}`, 'error');
        } finally {
            saveButton.disabled = false;
            // Restore button text based on mode (handled in resetForm)
            resetForm(); // Ensure form is reset even on error after trying to save
        }
    } // Fin submitClientForm

    // --- Editar Cliente ---
     async function handleEdit(clientId) {
        console.log("Ejecutando handleEdit (modified) para ID:", clientId);
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");
            if (!clientId) throw new Error("ID de cliente inválido para editar.");

            const clientDocRef = clientsCollection.doc(clientId);
            const docSnap = await clientDocRef.get();

            if (!docSnap.exists) { // Use .exists property
                throw new Error('Cliente no encontrado.');
            }

            const client = docSnap.data();

            // Llenar campos básicos
            if (clientIdInput) clientIdInput.value = clientId;
            if (fullNameInput) fullNameInput.value = client.nombre_completo || '';
            if (studentNameInput) studentNameInput.value = client.nombre_estudiante || '';
            if (phoneInput) phoneInput.value = client.telefono || '';
            if (emailInput) emailInput.value = client.email || '';
            if (addressInput) addressInput.value = client.direccion || '';
            if (subjectInput) subjectInput.value = client.materia || '';
            // Payment fields REMOVED

            // Mark service checkboxes AND modality
            if (serviceCheckboxes) {
                 // Reset all first
                 serviceCheckboxes.forEach(cb => {
                     cb.checked = false;
                     const remoteCb = document.getElementById(`service-${cb.value}-remote`);
                     const presencialCb = document.getElementById(`service-${cb.value}-presencial`);
                     if(remoteCb) remoteCb.checked = false;
                     if(presencialCb) presencialCb.checked = false;
                 });

                 const serviciosGuardados = client.servicios_contratados || []; // Array of objects
                 serviciosGuardados.forEach(serviceObj => {
                    // Check if it's a valid object with 'tipo'
                    if (typeof serviceObj === 'object' && serviceObj !== null && serviceObj.tipo) {
                        const mainCheckbox = document.getElementById(`service-${serviceObj.tipo}`);
                        const remoteCheckbox = document.getElementById(`service-${serviceObj.tipo}-remote`);
                        const presencialCheckbox = document.getElementById(`service-${serviceObj.tipo}-presencial`);

                        if (mainCheckbox) mainCheckbox.checked = true;
                        if (remoteCheckbox) remoteCheckbox.checked = serviceObj.remoto || false;
                        if (presencialCheckbox) presencialCheckbox.checked = serviceObj.presencial || false;
                    } else if (typeof serviceObj === 'string') {
                        // Handle legacy data if needed (mark only main checkbox)
                        const mainCheckbox = document.getElementById(`service-${serviceObj}`);
                        if (mainCheckbox) mainCheckbox.checked = true;
                        console.warn(`Servicio guardado como string (legacy?): ${serviceObj}`);
                    }
                 });
             }

            // Actualizar UI para modo edición
            editingClientId = clientId;
            if (formTitle) formTitle.textContent = 'Editar Cliente';
            if (saveButton) saveButton.textContent = 'Actualizar';
            if (cancelButton) cancelButton.style.display = 'inline-block';
            if (clientForm) clientForm.scrollIntoView({ behavior: 'smooth' });
            console.log("Formulario llenado para edición (modified).");

         } catch (error) {
            console.error('Error al cargar datos para editar (modified):', error);
            Swal.fire('Error', `No se pudieron cargar los datos del cliente: ${error.message}`, 'error');
            resetForm(); // Resetear si falla la carga
         }
    } // Fin handleEdit

    // --- Función Eliminar Cliente ---
    async function handleDelete(clientId) {
        console.log("Intentando eliminar cliente ID (modified):", clientId);
        const result = await Swal.fire({
             title: '¿Estás seguro?', text: "¡No podrás revertir esto!", icon: 'warning',
             showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
             confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
         });
        if (result.isConfirmed) {
            try {
                if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");
                const clientDocRef = clientsCollection.doc(clientId);
                await clientDocRef.delete();
                Swal.fire('¡Eliminado!', 'El cliente ha sido eliminado.', 'success');
                await loadClients();
            } catch (error) {
                console.error('Error eliminando cliente (modified):', error);
                Swal.fire('Error', `No se pudo eliminar el cliente: ${error.message}`, 'error');
            }
        }
    } // Fin handleDelete

    // --- Añadir Event Listeners ---
    if (clientForm) clientForm.addEventListener('submit', submitClientForm);
    else console.error("Formulario 'client-form' no encontrado.");

    if (clientsTableBody) {
        clientsTableBody.addEventListener('click', (e) => {
            // Find the closest button ancestor in case the click is on the icon/text inside
            const targetButton = e.target.closest('button[data-id]');
            if (!targetButton) return; // Exit if the click wasn't on or inside a button with data-id

            const clientId = targetButton.getAttribute('data-id');
            if (targetButton.classList.contains('button-edit')) {
                handleEdit(clientId);
            } else if (targetButton.classList.contains('button-delete')) {
                handleDelete(clientId);
            }
        });
    } else { console.error("Tabla 'clients-table tbody' no encontrada."); }


    if (cancelButton) cancelButton.addEventListener('click', resetForm);


    // --- Carga Inicial ---
    console.log("Iniciando carga inicial de clientes (modified)...");
    resetForm();
    loadClients();

}); // Fin DOMContentLoaded