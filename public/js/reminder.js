async function sendReminder(appointment) {
    const templateParams = {
        to_email: appointment.cliente.email,
        subject: 'Recordatorio de Cita',
        body: `Recuerda tu cita con ${appointment.especialista.nombre} el día ${appointment.fecha_hora}.`,
    };

    emailjs.send('service_id', 'template_id', templateParams).then(
        () => console.log('Correo enviado exitosamente.'),
        (err) => console.error('Error al enviar correo:', err)
    );
}

async function scheduleReminders() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const appointments = await supabase.from('Citas')
        .select('*')
        .gte('fecha_hora', today.toISOString())
        .lte('fecha_hora', tomorrow.toISOString());

    appointments.data.forEach(sendReminder);
}

scheduleReminders();