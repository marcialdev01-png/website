// Almacenamiento local temporal para los banners publicados
let bannersData = [];

// Función para cambiar de vista de rol
function switchRole(roleId) {
    document.querySelectorAll('.role-section').forEach(el => el.classList.remove('active'));
    document.getElementById(roleId).classList.add('active');
    
    // Si selecciona vitrina, renderizamos los banners
    if (roleId === 'vitrina') {
        renderBanners(bannersData);
    }
}

// Función para alternar el menú hamburguesa en móviles
function toggleMenu() {
    const menu = document.getElementById('navMenu');
    menu.classList.toggle('active');
}

// Guardar Banner de Cliente
function guardarCliente() {
    const nombre = document.getElementById('clienteNombre').value || 'Cliente VIP';
    const servicio = document.getElementById('clienteServicio').value;
    const wsp = document.getElementById('clienteWsp').value;
    const fotoInput = document.getElementById('clienteFoto');
    
    let imagenUrl = 'https://via.placeholder.com/300x200?text=Portal+Dulce';
    if (fotoInput.files && fotoInput.files[0]) {
        imagenUrl = URL.createObjectURL(fotoInput.files[0]);
    }

    agregarBanner(nombre, servicio, 'Servicio personal verificado', wsp, imagenUrl);
}

// Guardar Banner de Local
function guardarLocal() {
    const nombre = document.getElementById('localNombre').value || 'Local Asociado';
    const servicio = document.getElementById('localServicio').value;
    const desc = document.getElementById('localDesc').value || 'Establecimiento exclusivo y seguro.';
    const wsp = document.getElementById('localWsp').value;
    const fotoInput = document.getElementById('localFoto');
    
    let imagenUrl = 'https://via.placeholder.com/300x200?text=Local+Dulce';
    if (fotoInput.files && fotoInput.files[0]) {
        imagenUrl = URL.createObjectURL(fotoInput.files[0]);
    }

    agregarBanner(nombre, servicio, desc, wsp, imagenUrl);
}

// Guardar Banner de Modelo
function guardarModelo() {
    const nombre = document.getElementById('modeloNombre').value || 'Modelo Exclusiva';
    const servicio = document.getElementById('modeloServicio').value;
    const desc = document.getElementById('modeloDesc').value || 'Atención personalizada y exclusiva.';
    const wsp = document.getElementById('modeloWsp').value;
    const fotoInput = document.getElementById('modeloFoto');
    
    let imagenUrl = 'https://via.placeholder.com/300x200?text=Modelo+Dulce';
    if (fotoInput.files && fotoInput.files[0]) {
        imagenUrl = URL.createObjectURL(fotoInput.files[0]);
    }

    agregarBanner(nombre, servicio, desc, wsp, imagenUrl);
}

// Función auxiliar para registrar el banner en la memoria y redirigir a la vitrina
function agregarBanner(nombre, servicio, desc, wsp, imagen) {
    const nuevoBanner = { nombre, servicio, desc, wsp, imagen };
    bannersData.push(nuevoBanner);
    
    alert('¡Banner publicado con éxito en Portal Dulce!');
    switchRole('vitrina');
}

// Filtrar banners por categoría de servicio
function filtrarServicio(categoria) {
    // Cambiar estado activo de pestañas visuales
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event && event.target && event.target.classList.add('active');

    // Cerrar menú hamburguesa si está abierto en móvil
    document.getElementById('navMenu').classList.remove('active');

    // Cambiar a la vista de vitrina automáticamente para ver los resultados del filtro
    switchRole('vitrina');

    if (categoria === 'Todos') {
        renderBanners(bannersData);
    } else {
        const filtrados = bannersData.filter(b => b.servicio === categoria);
        renderBanners(filtrados, categoria);
    }
}

// Renderizar dinámicamente las tarjetas en la vitrina
function renderBanners(lista, categoriaFiltro = '') {
    const contenedor = document.getElementById('contenedorBanners');
    contenedor.innerHTML = '';

    if (lista.length === 0) {
        contenedor.innerHTML = `<p style="color: var(--text-gray);">No hay banners activos para la categoría "${categoriaFiltro}". Rellena un formulario para publicar uno.</p>`;
        return;
    }

    lista.forEach(banner => {
        // Limpiar número de WhatsApp para enlace URL válido
        const wspClean = banner.wsp ? banner.wsp.replace(/[^0-9]/g, '') : '56900000000';
        const mensajeWsp = encodeURIComponent(`Hola ${banner.nombre}, vi tu perfil en Portal Dulce y me interesa información.`);
        const linkWsp = `https://wa.me/${wspClean}?text=${mensajeWsp}`;

        const card = document.createElement('div');
        card.className = 'banner-card';
        card.innerHTML = `
            <div class="banner-img-container">
                <img src="${banner.imagen}" alt="${banner.nombre}">
            </div>
            <div class="banner-body">
                <div>
                    <span class="badge-servicio">${banner.servicio}</span>
                    <h3 class="banner-title">${banner.nombre}</h3>
                    <p class="banner-desc">${banner.desc}</p>
                </div>
                <a href="${linkWsp}" target="_blank" class="btn-whatsapp">Contactar por WhatsApp</a>
            </div>
        `;
        contenedor.appendChild(card);
    });
}