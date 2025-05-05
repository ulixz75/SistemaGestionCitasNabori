// js/specialists.js

const specialistForm = document.getElementById('specialist-form');
const formTitle = document.getElementById('form-title');
const specialistIdInput = document.getElementById('specialist-id');
const nameInput = document.getElementById('name');
const specialtyInput = document.getElementById('specialty');
const servicesOfferedInput = document.getElementById('services-offered');
const saveButton = document.getElementById('save-button');
const cancelButton = document.getElementById('cancel-button');
const specialistsTableBody = document.querySelector('#specialists-table tbody');

let editingSpecialistId = null; // Para rastrear la edición

// --- Resetear Formulario ---
function resetForm() {
    specialistForm.reset();
    specialistIdInput.value = '';
    editingSpecialistId = null;
    formTitle.textContent = 'Agregar Especialista';
    saveButton.textContent = 'Guardar';
    cancelButton.style.display = 'none';
}

// --- Cargar Lista de Especialistas ---
async function loadSpecialists() {
    specialistsTableBody.innerHTML = '<tr><td colspan="5">Cargando especialistas...</td></tr>';

    try {
        const { data: specialists, error } = await supabase
            .from('Especialistas')
            .select('*')
            .order('id', { ascending: true });

        if (error) throw error;

        specialistsTableBody.innerHTML = '';

        if (specialists.length === 0) {
            specialistsTableBody.innerHTML = '<tr><td colspan="5">No hay especialistas registrados.</td></tr>';
            return;
        }

        specialists.forEach(specialist => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${specialist.id}</td>
                <td>${specialist.nombre || ''}</td>
                <td>${specialist.especialidad || ''}</td>
                <td>${specialist.servicios_ofrecidos || 'N/A'}</td>
                <td>
                    <button class="button-edit" data-id="${specialist.id}">Editar</button>
                    <button class="button-delete" data-id="${specialist.id}">Eliminar</button>
                </td>
            `;
            specialistsTableBody.appendChild(row);
        });

    } catch (error) {
        console.error('Error cargando especialistas:', error);
        specialistsTableBody.innerHTML = `<tr><td colspan="5">Error al cargar especialistas: ${error.message}</td></tr>`;
        Swal.fire('Error', `No se pudieron cargar los especialistas: ${error.message}`, 'error');
    }
}

// --- Agregar o Actualizar Especialista ---
specialistForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const specialistData = {
        nombre: nameInput.value.trim(),
        especialidad: specialtyInput.value.trim(),
        servicios_ofrecidos: servicesOfferedInput.value.trim() || null,
    };

    if (!specialistData.nombre || !specialistData.especialidad) {
        Swal.fire('Campos incompletos', 'Por favor, complete Nombre y Especialidad.', 'warning');
        return;
    }

    saveButton.disabled = true;

    try {
        let response;
        if (editingSpecialistId) {
            // --- Actualizar ---
            saveButton.textContent = 'Actualizando...';
            const { data, error } = await supabase
                .from('Especialistas')
                .update(specialistData)
                .match({ id: editingSpecialistId })
                .select().single();

            if (error) throw error;
            response = data;
            Swal.fire('Éxito', 'Especialista actualizado correctamente.', 'success');

        } else {
            // --- Agregar Nuevo ---
            saveButton.textContent = 'Guardando...';
            const { data, error } = await supabase
                .from('Especialistas')
                .insert(specialistData)
                .select().single();

            if (error) throw error;
            response = data;
            Swal.fire('Éxito', 'Especialista agregado correctamente.', 'success');
        }

        resetForm();
        await loadSpecialists();

    } catch (error) {
        console.error('Error guardando especialista:', error);
        Swal.fire('Error', `No se pudo guardar el especialista: ${error.message}`, 'error');
    } finally {
        saveButton.disabled = false;
        // Texto del botón se restaura en resetForm()
    }
});

// --- Editar Especialista ---
function handleEdit(specialistId) {
    supabase
        .from('Especialistas')
        .select('*')
        .eq('id', specialistId)
        .single()
        .then(({ data: specialist, error }) => {
            if (error) throw error;
            if (!specialist) throw new Error('Especialista no encontrado.');

            specialistIdInput.value = specialist.id;
            nameInput.value = specialist.nombre || '';
            specialtyInput.value = specialist.especialidad || '';
            servicesOfferedInput.value = specialist.servicios_ofrecidos || '';

            editingSpecialistId = specialist.id;
            formTitle.textContent = 'Editar Especialista';
            saveButton.textContent = 'Actualizar';
            cancelButton.style.display = 'inline-block';

            specialistForm.scrollIntoView({ behavior: 'smooth' });
        })
        .catch(error => {
             console.error('Error al cargar datos para editar:', error);
             Swal.fire('Error', `No se pudieron cargar los datos del especialista: ${error.message}`, 'error');
        });
}

// --- Eliminar Especialista ---
async function handleDelete(specialistId) {
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡No podrás revertir esto!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Sí, ¡eliminar!',
        cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
        try {
            const { error } = await supabase
                .from('Especialistas')
                .delete()
                .match({ id: specialistId });

            if (error) {
                // Comprobar si es un error de clave foránea (si tiene citas)
                if (error.message.includes('violates foreign key constraint')) {
                     Swal.fire('Error', 'No se puede eliminar el especialista porque tiene citas asociadas. Elimine primero las citas.', 'error');
                 } else {
                    throw error; // Lanzar otros errores
                 }
            } else {
                Swal.fire('¡Eliminado!', 'El especialista ha sido eliminado.', 'success');
                await loadSpecialists();
            }

        } catch (error) {
            console.error('Error eliminando especialista:', error);
            Swal.fire('Error', `No se pudo eliminar el especialista: ${error.message}`, 'error');
        }
    }
}

// --- Delegación de Eventos ---
specialistsTableBody.addEventListener('click', (e) => {
    const target = e.target;
    const specialistId = target.dataset.id;

    if (target.classList.contains('button-edit') && specialistId) {
        handleEdit(specialistId);
    } else if (target.classList.contains('button-delete') && specialistId) {
        handleDelete(specialistId);
    }
});

// --- Botón Cancelar Edición ---
cancelButton.addEventListener('click', () => {
    resetForm();
});

// --- Carga Inicial ---
document.addEventListener('DOMContentLoaded', () => {
    loadSpecialists();
    resetForm();
});