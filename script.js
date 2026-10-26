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

// Ejecutar por defecto la vista de cliente al cargar la página de pruebas
document.addEventListener("DOMContentLoaded", () => {
    switchRole('cliente');
});