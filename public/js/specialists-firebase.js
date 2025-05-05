// js/specialists-firebase.js - CORREGIDO

document.addEventListener('DOMContentLoaded', () => {
    // --- Verificar si Firestore (window.db) está disponible ---
    if (typeof window.db === 'undefined' || !window.db) {
        console.error("¡ERROR CRÍTICO! window.db no está definido al iniciar specialists-firebase.js");
        Swal.fire('Error de Configuración', 'No se pudo conectar con la base de datos (Firebase).', 'error');
        // Opcional: Ocultar formulario si falla la conexión
        const form = document.getElementById('specialist-form');
        if(form) form.style.display = 'none';
        return;
    }
    console.log("Accediendo a Firestore (Especialistas) a través de window.db...");

    // --- Referencia a la colección 'especialistas' en Firestore ---
    const specialistsCollection = window.db.collection('especialistas');

    // --- Elementos del DOM ---
    const specialistForm = document.getElementById('specialist-form');
    const formTitle = document.getElementById('form-title');
    const specialistIdInput = document.getElementById('specialist-id');
    const nameInput = document.getElementById('name');
    const specialtyInput = document.getElementById('specialty');
    const phoneInput = document.getElementById('phone');
    const emailInput = document.getElementById('email');
    const addressInput = document.getElementById('address');
    const startDateInput = document.getElementById('start-date');
    const hourlyRateInput = document.getElementById('hourly-rate');
    const servicesOfferedInput = document.getElementById('services-offered');
    // Objeto para acceder fácilmente a los inputs de tiempo por día
    const availabilityInputs = {
        lunes: { inicio: document.getElementById('avail-lunes-inicio'), fin: document.getElementById('avail-lunes-fin') },
        martes: { inicio: document.getElementById('avail-martes-inicio'), fin: document.getElementById('avail-martes-fin') },
        miercoles: { inicio: document.getElementById('avail-miercoles-inicio'), fin: document.getElementById('avail-miercoles-fin') },
        jueves: { inicio: document.getElementById('avail-jueves-inicio'), fin: document.getElementById('avail-jueves-fin') },
        viernes: { inicio: document.getElementById('avail-viernes-inicio'), fin: document.getElementById('avail-viernes-fin') },
        sabado: { inicio: document.getElementById('avail-sabado-inicio'), fin: document.getElementById('avail-sabado-fin') }
    };
    const saveButton = document.getElementById('save-button');
    const cancelButton = document.getElementById('cancel-button');
    const specialistsTableBody = document.querySelector('#specialists-table tbody');

    let editingSpecialistId = null; // Para rastrear la edición

    // --- Función Resetear Formulario ---
    function resetForm() {
        if (specialistForm) specialistForm.reset();
        if (specialistIdInput) specialistIdInput.value = '';
        editingSpecialistId = null;
        if (formTitle) formTitle.textContent = 'Agregar Especialista';
        if (saveButton) saveButton.textContent = 'Guardar';
        if (cancelButton) cancelButton.style.display = 'none';
        // Resetear inputs de tiempo explícitamente
        Object.values(availabilityInputs).forEach(day => {
            if (day.inicio) day.inicio.value = '';
            if (day.fin) day.fin.value = '';
        });
    }

    // --- Función Cargar Lista de Especialistas ---
    async function loadSpecialists() {
        if (!specialistsTableBody) {
             console.error("Elemento tbody de la tabla de especialistas no encontrado.");
             return;
        }
        specialistsTableBody.innerHTML = '<tr><td colspan="8">Cargando especialistas...</td></tr>';
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida.");

            const querySnapshot = await specialistsCollection.orderBy('nombre').get();
            specialistsTableBody.innerHTML = '';

            if (querySnapshot.empty) {
                specialistsTableBody.innerHTML = '<tr><td colspan="8">No hay especialistas registrados.</td></tr>';
                return;
            }

            querySnapshot.forEach(doc => {
                const specialist = doc.data();
                const specialistId = doc.id;
                const row = document.createElement('tr');

                // Formatear disponibilidad detallada para mostrarla
                let availabilityText = 'No especificada';
                let fullAvailabilityTitle = ''; // Para el tooltip
                if (specialist.disponibilidad_detallada) {
                    const dias = [];
                    const diasFull = [];
                     // Ordenar los días para mostrar consistentemente
                    const order = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                    order.forEach(dia => {
                         const bloques = specialist.disponibilidad_detallada[dia];
                         if (Array.isArray(bloques) && bloques.length > 0) {
                            const bloquesStr = bloques.map(b => `${b.inicio || '?'} - ${b.fin || '?'}`).join(', ');
                            const diaCapitalized = dia.charAt(0).toUpperCase() + dia.slice(1);
                            dias.push(`${diaCapitalized.substring(0, 3)}: ${bloquesStr}`);
                            diasFull.push(`${diaCapitalized}: ${bloquesStr}`);
                         }
                    });

                    if (dias.length > 0) {
                        availabilityText = dias.join('; ');
                        fullAvailabilityTitle = diasFull.join('\n'); // Salto de línea para tooltip
                    }
                }

                row.innerHTML = `
                    <td data-label="ID">${specialistId}</td>
                    <td data-label="Nombre">${specialist.nombre || ''}</td>
                    <td data-label="Especialidad">${specialist.especialidad || ''}</td>
                    <td data-label="Teléfono">${specialist.telefono || 'N/A'}</td>
                    <td data-label="Email">${specialist.email || 'N/A'}</td>
                    <td data-label="Tarifa/hr">${specialist.tarifa_hora ? `$${Number(specialist.tarifa_hora).toFixed(2)}` : 'N/A'}</td>
                    <td data-label="Disponibilidad" title="${fullAvailabilityTitle}">${availabilityText.substring(0, 30) + (availabilityText.length > 30 ? '...' : '')}</td>
                    <td data-label="Acciones"> 
                        <button class="button-edit" data-id="${specialistId}">Editar</button>
                        <button class="button-delete" data-id="${specialistId}">Eliminar</button>
                    </td>
                `;
                specialistsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error cargando especialistas desde Firestore:', error);
            specialistsTableBody.innerHTML = `<tr><td colspan="8">Error al cargar especialistas: ${error.message}</td></tr>`;
            Swal.fire('Error', `No se pudieron cargar los especialistas: ${error.message}`, 'error');
        }
    }

    // --- Función Guardar/Actualizar Especialista ---
    async function submitSpecialistForm(event) {
        event.preventDefault();
        // Asegurarse que los elementos básicos existen
        if (!nameInput || !specialtyInput || !saveButton) {
            console.error("Elementos esenciales del formulario no encontrados.");
            return;
        }

        // Construir el objeto de disponibilidad detallada
        const disponibilidadDetallada = {};
        let dataValid = true;
        for (const [dia, inputs] of Object.entries(availabilityInputs)) {
            // Asegurarse que los inputs de tiempo para el día existen
            if (!inputs.inicio || !inputs.fin) {
                console.warn(`Inputs de tiempo para el día ${dia} no encontrados.`);
                continue; // Saltar este día si faltan inputs
            }
            const inicio = inputs.inicio.value;
            const fin = inputs.fin.value;

            if (inicio && fin) {
                if (fin <= inicio) {
                    Swal.fire('Horario inválido', `La hora de fin para ${dia} debe ser posterior a la hora de inicio.`, 'warning');
                    dataValid = false;
                    break;
                }
                // Simplificación: Solo guardamos un bloque por día por ahora
                disponibilidadDetallada[dia] = [{ inicio: inicio, fin: fin }];
            } else if (inicio || fin) {
                Swal.fire('Horario incompleto', `Debe ingresar inicio y fin para ${dia}, o dejar ambos vacíos.`, 'warning');
                dataValid = false;
                break;
            } else {
                disponibilidadDetallada[dia] = []; // Vacío si no hay horario
            }
        }

        if (!dataValid) {
            // Button should have been re-enabled if validation failed, but ensure it here too
             if(saveButton) saveButton.disabled = false;
            return; // Detener si hubo error de validación
        }

        // Recopilar todos los datos del especialista
        const specialistData = {
            nombre: nameInput.value.trim(),
            especialidad: specialtyInput.value.trim(),
            telefono: phoneInput ? phoneInput.value.trim() || null : null,
            email: emailInput ? emailInput.value.trim() || null : null,
            direccion: addressInput ? addressInput.value.trim() || null : null,
            fecha_comienzo: startDateInput ? startDateInput.value || null : null,
            tarifa_hora: hourlyRateInput ? (hourlyRateInput.value ? parseFloat(hourlyRateInput.value) : null) : null,
            servicios_ofrecidos: servicesOfferedInput ? servicesOfferedInput.value.trim() || null : null,
            disponibilidad_detallada: disponibilidadDetallada,
            timestamp_actualizacion: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Validación básica
        if (!specialistData.nombre || !specialistData.especialidad) {
            Swal.fire('Campos incompletos', 'Por favor, complete Nombre y Especialidad.', 'warning');
            return;
        }
        if (specialistData.tarifa_hora !== null && isNaN(specialistData.tarifa_hora)) {
             Swal.fire('Dato inválido', 'La tarifa por hora debe ser un número.', 'warning');
             return;
        }

        saveButton.disabled = true; // Deshabilitar botón durante la operación

        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida antes de guardar.");

            if (editingSpecialistId) {
                // Actualizar documento existente
                saveButton.textContent = 'Actualizando...';
                const specialistDocRef = specialistsCollection.doc(editingSpecialistId);
                await specialistDocRef.update(specialistData);
                Swal.fire('Éxito', 'Especialista actualizado correctamente.', 'success');
            } else {
                // Agregar nuevo documento
                saveButton.textContent = 'Guardando...';
                specialistData.timestamp_creacion = firebase.firestore.FieldValue.serverTimestamp(); // Añadir al crear
                await specialistsCollection.add(specialistData);
                Swal.fire('Éxito', 'Especialista agregado correctamente.', 'success');
            }
            resetForm();
            await loadSpecialists(); // Recargar la lista
        } catch (error) {
            console.error('Error guardando especialista en Firestore:', error);
            Swal.fire('Error', `No se pudo guardar el especialista: ${error.message}`, 'error');
        } finally {
            // Rehabilitar botón y asegurar que el formulario esté reseteado
            if(saveButton) saveButton.disabled = false;
            resetForm(); // Llamar aquí asegura el estado final correcto
        }
    } // Fin submitSpecialistForm

    // --- Función Editar Especialista ---
    async function handleEdit(specialistId) {
        console.log("HandleEdit triggered for ID:", specialistId); // Add log
        try {
            if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida antes de editar.");

            const specialistDocRef = specialistsCollection.doc(specialistId);
            const docSnap = await specialistDocRef.get();

            if (!docSnap.exists) { // Corrected check
                Swal.fire('Error', 'Especialista no encontrado.', 'error');
                return;
            }
            const specialist = docSnap.data();
            console.log("Specialist data fetched:", specialist); // Add log

            // Llenar campos básicos (verificando si existen)
            if (specialistIdInput) specialistIdInput.value = specialistId;
            if (nameInput) nameInput.value = specialist.nombre || '';
            if (specialtyInput) specialtyInput.value = specialist.especialidad || '';
            if (phoneInput) phoneInput.value = specialist.telefono || '';
            if (emailInput) emailInput.value = specialist.email || '';
            if (addressInput) addressInput.value = specialist.direccion || '';
            if (startDateInput) startDateInput.value = specialist.fecha_comienzo || '';
            if (hourlyRateInput) hourlyRateInput.value = specialist.tarifa_hora || '';
            if (servicesOfferedInput) servicesOfferedInput.value = specialist.servicios_ofrecidos || '';

            // Llenar disponibilidad detallada
            const disponibilidad = specialist.disponibilidad_detallada || {};
            console.log("Filling availability:", disponibilidad); // Add log
            for (const [dia, inputs] of Object.entries(availabilityInputs)) {
                 // Asegurarse que los inputs para el día existen
                if (!inputs.inicio || !inputs.fin) continue;

                const bloquesDia = disponibilidad[dia];
                // Tomar el primer bloque si existe
                if (Array.isArray(bloquesDia) && bloquesDia.length > 0 && bloquesDia[0]) {
                    inputs.inicio.value = bloquesDia[0].inicio || '';
                    inputs.fin.value = bloquesDia[0].fin || '';
                } else {
                    inputs.inicio.value = '';
                    inputs.fin.value = '';
                }
            }
            console.log("Form fields filled."); // Add log

            // Actualizar UI para modo edición
            editingSpecialistId = specialistId;
            if (formTitle) formTitle.textContent = 'Editar Especialista';
            if (saveButton) saveButton.textContent = 'Actualizar';
            if (cancelButton) cancelButton.style.display = 'inline-block';
            if (specialistForm) specialistForm.scrollIntoView({ behavior: 'smooth' });
             console.log("UI updated for edit mode."); // Add log

        } catch (error) {
            console.error('Error al cargar datos de especialista para editar:', error);
            Swal.fire('Error', `No se pudieron cargar los datos del especialista: ${error.message}`, 'error');
        }
    } // Fin handleEdit

    // --- Función Eliminar Especialista ---
    async function handleDelete(specialistId) {
        const result = await Swal.fire({
            title: '¿Estás seguro?', text: "¡No podrás revertir esto!", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, ¡eliminar!', cancelButtonText: 'Cancelar'
        });
        if (result.isConfirmed) {
            try {
                if (typeof window.db === 'undefined' || !window.db) throw new Error("Conexión a Firestore perdida antes de eliminar.");

                // Añadir verificación de citas si es necesario aquí antes de borrar
                // ... (código de verificación omitido por brevedad) ...

                const specialistDocRef = specialistsCollection.doc(specialistId);
                await specialistDocRef.delete();
                Swal.fire('¡Eliminado!', 'El especialista ha sido eliminado.', 'success');
                await loadSpecialists(); // Recargar la lista
            } catch (error) {
                console.error('Error eliminando especialista de Firestore:', error);
                Swal.fire('Error', `No se pudo eliminar el especialista: ${error.message}`, 'error');
            }
        }
    } // Fin handleDelete

    // --- Añadir Event Listeners (verificando existencia de elementos) ---
    if (specialistForm) {
        specialistForm.addEventListener('submit', submitSpecialistForm);
    } else {
        console.error("Formulario 'specialist-form' no encontrado.");
    }

    if (specialistsTableBody) {
        console.log("Attaching click listener to specialists table body..."); // Add log
        specialistsTableBody.addEventListener('click', (e) => {
            // --- CORRECCIÓN AQUÍ ---
            // Buscar el botón más cercano que tenga el atributo data-id
            const targetButton = e.target.closest('button[data-id]');
            console.log("Click detected. Target element:", e.target, "Closest button:", targetButton); // Add log

            // Si no se encontró un botón con data-id, salir
            if (!targetButton) {
                return;
            }

            const specialistId = targetButton.getAttribute('data-id');
            console.log("Button has ID:", specialistId); // Add log

            // Comprobar las clases del botón encontrado
            if (targetButton.classList.contains('button-edit')) {
                 console.log("Edit button identified for ID:", specialistId); // Add log
                handleEdit(specialistId);
            } else if (targetButton.classList.contains('button-delete')) {
                 console.log("Delete button identified for ID:", specialistId); // Add log
                handleDelete(specialistId);
            }
            // --- FIN CORRECCIÓN ---
        });
    } else {
         console.error("Elemento 'specialists-table tbody' no encontrado.");
    }

    if (cancelButton) {
        cancelButton.addEventListener('click', resetForm);
    } else {
        console.warn("Botón 'cancel-button' no encontrado.");
    }

    // --- Carga Inicial ---
    resetForm();
    loadSpecialists(); // Cargar especialistas al iniciar

}); // Fin de DOMContentLoaded