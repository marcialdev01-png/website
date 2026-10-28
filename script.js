/**
 * Función para alternar entre las vistas de los roles (Admin, Cliente, Local, Modelo)
 * @param {string} roleId - El identificador del panel que se desea mostrar
 */
function switchRole(roleId) {
    // Ocultar todas las secciones de roles
    const sections = document.querySelectorAll('.role-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Mostrar únicamente la sección seleccionada
    const activeSection = document.getElementById(roleId);
    if (activeSection) {
        activeSection.classList.add('active');
    }
}

/**
 * Funciones de simulación de guardado para cada rol
 * (Muestran un mensaje de éxito al usuario ya que la web está en GitHub Pages de forma estática)
 */
function guardarCliente() {
    alert("¡Éxito! Tu banner personal, fotos y enlaces de contacto han sido guardados correctamente.");
}

function guardarLocal() {
    alert("¡Éxito! La publicación, categoría y galería del local han sido actualizadas.");
}

function guardarModelo() {
    alert("¡Éxito! Tu galería, tarifas y enlace de WhatsApp se han publicado correctamente.");
}

// Ejecutar por defecto la vista de cliente al cargar la página de pruebas
document.addEventListener("DOMContentLoaded", () => {
    switchRole('cliente');
});