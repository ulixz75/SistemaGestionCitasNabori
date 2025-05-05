// js/services-firebase.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Verificar Conexión ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no está definido al iniciar services-firebase.js");
        Swal.fire('Error de Configuración', 'No se pudo conectar con la base de datos (Firebase).', 'error');
        const form = document.getElementById('service-form');
        if(form) form.style.display = 'none';
        return;
    }
    console.log("Accediendo a Firestore (Servicios) a través de window.db...");

    // --- Referencia a la colección ---
    const servicesCollection = window.db.collection('servicios'); // Nombre de tu colección

    // --- Elementos del DOM (Asegúrate que estos IDs existan en services.html) ---
    const serviceForm = document.getElementById('service-form');
    const formTitle = document.getElementById('form-title');
    const serviceIdInput = document.getElementById('service-id'); // Para editar
    const nameInput = document.getElementById('service-name');
    const descriptionInput = document.getElementById('service-description');
    const durationInput = document.getElementById('service-duration');
    const priceInput = document.getElementById('service-price');
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const servicesTableBody = document.querySelector('#services-table tbody');

    let editingServiceId = null;

    // --- Función Resetear Formulario ---
    function resetForm() {
        console.log("[resetForm] Reseteando formulario de servicios..."); // Log
        if (serviceForm) serviceForm.reset();
        if (serviceIdInput) serviceIdInput.value = '';
        editingServiceId = null;
        if (formTitle) formTitle.textContent = 'Agregar Servicio';
        if (saveButton) saveButton.textContent = 'Guardar';
        if (cancelButton) cancelButton.style.display = 'none';
         console.log("[resetForm] Reseteo completado."); // Log
    }

    // --- Función Cargar Lista de Servicios ---
    async function loadServices() {
        console.log("[loadServices] Cargando servicios..."); // Log
        if (!servicesTableBody) { console.error("Elemento tbody tabla servicios no encontrado."); return; }
        servicesTableBody.innerHTML = '<tr><td colspan="6">Cargando servicios...</td></tr>';
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
            const querySnapshot = await servicesCollection.orderBy('nombre').get();
            servicesTableBody.innerHTML = '';
            if (querySnapshot.empty) { servicesTableBody.innerHTML = '<tr><td colspan="6">No hay servicios registrados.</td></tr>'; return; }

            querySnapshot.forEach(doc => {
                const service = doc.data(); const serviceId = doc.id; const row = document.createElement('tr');
                row.innerHTML = `
                          <td data-label="ID">${serviceId}</td>
                    <td data-label="Nombre">${service.nombre || ''}</td>
                    <td data-label="Descripción">${service.descripcion || 'N/A'}</td>
                    <td data-label="Duración (min)">${service.duracion_minutos || 'N/A'}</td>
                    <td data-label="Precio">${service.precio ? `$${Number(service.precio).toFixed(2)}` : 'N/A'}</td>
                    <td>
                        <button class="button-edit" data-id="${serviceId}">Editar</button>
                        <button class="button-delete" data-id="${serviceId}">Eliminar</button>
                    </td>
                `;
                servicesTableBody.appendChild(row);
            });
            console.log("[loadServices] Servicios cargados en tabla."); // Log
        } catch (error) {
            console.error('[loadServices] Error cargando servicios:', error);
            servicesTableBody.innerHTML = `<tr><td colspan="6">Error: ${error.message}</td></tr>`;
            Swal.fire('Error', `No se pudieron cargar los servicios: ${error.message}`, 'error');
        }
    } // Fin loadServices

    // --- Función Guardar/Actualizar Servicio ---
    async function submitServiceForm(event) {
        event.preventDefault();
        console.log("[submitServiceForm] Intentando guardar/actualizar..."); // Log
        if (!nameInput || !saveButton) { console.error("Inputs esenciales faltan."); return; }

        const serviceData = {
            nombre: nameInput.value.trim(),
            descripcion: descriptionInput ? descriptionInput.value.trim() || null : null,
            duracion_minutos: durationInput ? (durationInput.value ? parseInt(durationInput.value, 10) : null) : null,
            precio: priceInput ? (priceInput.value ? parseFloat(priceInput.value) : null) : null,
            timestamp_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (!serviceData.nombre) { Swal.fire('Incompleto', 'Ingrese Nombre.', 'warning'); return; }
        if (serviceData.duracion_minutos !== null && (isNaN(serviceData.duracion_minutos) || !Number.isInteger(serviceData.duracion_minutos))) { Swal.fire('Inválido', 'Duración debe ser número entero.', 'warning'); return; }
        if (serviceData.precio !== null && isNaN(serviceData.precio)) { Swal.fire('Inválido', 'Precio debe ser número.', 'warning'); return; }

        saveButton.disabled = true;

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
            let message = '';
            if (editingServiceId) {
                console.log("[submitServiceForm] Actualizando ID:", editingServiceId); // Log
                saveButton.textContent = 'Actualizando...';
                const serviceDocRef = servicesCollection.doc(editingServiceId);
                await serviceDocRef.update(serviceData);
                message = 'Servicio actualizado.';
            } else {
                 console.log("[submitServiceForm] Agregando nuevo servicio..."); // Log
                saveButton.textContent = 'Guardando...';
                serviceData.timestamp_creacion = firebase.firestore.FieldValue.serverTimestamp();
                await servicesCollection.add(serviceData);
                 message = 'Servicio agregado.';
            }
            resetForm();
            await loadServices();
             Swal.fire('Éxito', message, 'success');
        } catch (error) {
            console.error('[submitServiceForm] Error guardando servicio:', error);
            Swal.fire('Error', `No se pudo guardar el servicio: ${error.message}`, 'error');
        } finally {
            saveButton.disabled = false;
            // Restaurar texto del botón se hace en resetForm si se llamó, o aquí si falló antes
            if (editingServiceId && formTitle.textContent !== 'Agregar Servicio') { // Si sigue en modo edición (falló)
                 saveButton.textContent = 'Actualizar';
             } else {
                 saveButton.textContent = 'Guardar';
             }
        }
    } // Fin submitServiceForm

    // --- Editar Servicio (CON CORRECCIÓN .exists)---
    async function handleEdit(serviceId) {
        console.log("[handleEdit] Intentando editar ID:", serviceId);
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
            if (!serviceId) throw new Error("ID de servicio inválido.");
            const serviceDocRef = servicesCollection.doc(serviceId);
            console.log("[handleEdit] Obteniendo documento:", serviceId);
            const docSnap = await serviceDocRef.get();
            console.log("[handleEdit] Resultado de get():", docSnap);

            // --- CORRECCIÓN APLICADA AQUÍ ---
            if (!docSnap.exists) { // Usar la propiedad .exists
                console.error("[handleEdit] Documento no encontrado:", serviceId);
                throw new Error('Servicio no encontrado.');
            }
            // --- FIN CORRECCIÓN ---

            const service = docSnap.data();
            console.log("[handleEdit] Datos del servicio:", service);

            // Llenar formulario
            if(serviceIdInput) serviceIdInput.value = serviceId;
            if(nameInput) nameInput.value = service.nombre || '';
            if(descriptionInput) descriptionInput.value = service.descripcion || '';
            if(durationInput) durationInput.value = service.duracion_minutos || '';
            if(priceInput) priceInput.value = service.precio || '';

            // UI modo edición
            editingServiceId = serviceId;
            if (formTitle) formTitle.textContent = 'Editar Servicio';
            if (saveButton) saveButton.textContent = 'Actualizar';
            if (cancelButton) cancelButton.style.display = 'inline-block';
            if (serviceForm) serviceForm.scrollIntoView({ behavior: 'smooth' });
            console.log("[handleEdit] Formulario llenado para edición.");

        } catch (error) {
            console.error('[handleEdit] Error al cargar datos para editar:', error);
            Swal.fire('Error', `No se pudieron cargar los datos del servicio: ${error.message}`, 'error');
            resetForm(); // Resetear si falla la carga
        }
    } // Fin handleEdit

    // --- Función Eliminar Servicio ---
    async function handleDelete(serviceId) {
        console.log("[handleDelete] Intentando eliminar ID:", serviceId);
        const result = await Swal.fire({
             title: '¿Estás seguro?', text: "¡No podrás revertir esto!", icon: 'warning',
             showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
             confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
         });
        if (result.isConfirmed) {
            try {
                if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión perdida.");
                if (!serviceId) throw new Error("ID inválido.");
                // Aquí podrías añadir verificación de si el servicio está en uso en citas
                const serviceDocRef = servicesCollection.doc(serviceId);
                await serviceDocRef.delete();
                Swal.fire('¡Eliminado!', 'El servicio ha sido eliminado.', 'success');
                await loadServices(); // Recargar
                console.log("[handleDelete] Servicio eliminado:", serviceId);
            } catch (error) {
                console.error('[handleDelete] Error eliminando servicio:', error);
                Swal.fire('Error', `No se pudo eliminar el servicio: ${error.message}`, 'error');
            }
        }
    } // Fin handleDelete

    // --- Añadir Event Listeners ---
    if (serviceForm) serviceForm.addEventListener('submit', submitServiceForm);
    else console.error("Formulario 'service-form' no encontrado.");

    if (servicesTableBody) {
        console.log("Añadiendo listener de click a la tabla de servicios...");
        servicesTableBody.addEventListener('click', (e) => {
            const target = e.target; const serviceId = target.getAttribute('data-id');
            console.log("Click detectado en tabla servicios. Elemento:", target, "Clases:", target.classList, "ID:", serviceId);
            if (target.classList.contains('button-edit') && serviceId) { console.log("[Listener Tabla] Botón Editar detectado para:", serviceId); handleEdit(serviceId); }
            else if (target.classList.contains('button-delete') && serviceId) { console.log("[Listener Tabla] Botón Eliminar detectado para:", serviceId); handleDelete(serviceId); }
        });
    } else { console.error("Elemento 'services-table tbody' no encontrado."); }

    if (cancelButton) cancelButton.addEventListener('click', resetForm);
    else console.warn("Botón Cancelar no encontrado.");

    // --- Carga Inicial ---
    console.log("Iniciando carga inicial de servicios...");
    resetForm();
    loadServices();

}); // Fin DOMContentLoaded