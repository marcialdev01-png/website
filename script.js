'use strict';

/* ==========================================================
   Portal Dulces & Cariñosas - demostración
   Modo estándar (sin cuenta): ve todas las publicaciones.
   Con login: Administrador · Modelo · Local.
   IMPORTANTE: todo vive en memoria del navegador. Los permisos aquí
   son de demostración; el control real exige backend (siguiente etapa).
   ========================================================== */

const FOTO_ANCHO = 720;
const FOTO_ALTO = 960;                       // formato estándar 3:4
const MAX_FOTOS = 6;
const MAX_VIDEOS = 2;
const MAX_FOTO_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_SERVICIOS = 10;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const TIPOS_VIDEO = ['video/mp4', 'video/webm'];

const ROLES = { admin: 'Administrador', modelo: 'Modelo', local: 'Local' };

const NOMBRES_SERVICIO = {
    Packs: 'Packs',
    Videos: 'Videos',
    Citas: 'Citas y conexiones sociales',
    Locales: 'Locales',
    'Compañia': 'Compañía',
    Relajacion: 'Relajación'
};

const CATEGORIAS_POR_ROL = {
    modelo: ['Compañia', 'Packs', 'Videos', 'Citas', 'Relajacion'],
    local: ['Locales', 'Relajacion', 'Citas']
};

const estado = {
    cuentas: [
        { id: 1, nombre: 'Administrador', rol: 'admin', habilitada: true, suscripcion: true },
        { id: 2, nombre: 'Modelo de prueba', rol: 'modelo', habilitada: true, suscripcion: false },
        { id: 3, nombre: 'Local de prueba', rol: 'local', habilitada: true, suscripcion: false }
    ],
    publicaciones: [],
    sesionId: null,
    panelAbierto: null,
    filtro: 'Todos',
    filtroRegion: '',
    filtroComuna: '',
    siguienteCuenta: 4,
    siguientePub: 1
};

// Borradores de edición de la sesión actual
let borradores = nuevosBorradores();

function nuevosBorradores() {
    return {
        modelo: { cargado: false, servicios: [], fotos: [], videos: [] },
        local: { cargado: false, servicios: [], fotos: [] }
    };
}

/* ---------- Utilidades ---------- */

function $(id) {
    return document.getElementById(id);
}

function el(tag, opciones = {}, ...hijos) {
    const nodo = document.createElement(tag);
    if (opciones.class) nodo.className = opciones.class;
    if (opciones.text !== undefined) nodo.textContent = opciones.text;
    if (opciones.attrs) {
        Object.entries(opciones.attrs).forEach(([k, v]) => nodo.setAttribute(k, v));
    }
    if (opciones.on) {
        Object.entries(opciones.on).forEach(([k, fn]) => nodo.addEventListener(k, fn));
    }
    hijos.forEach(h => { if (h) nodo.append(h); });
    return nodo;
}

function mensaje(id, texto, esError) {
    const nodo = $(id);
    nodo.textContent = texto ? (esError ? '⚠ ' : '✓ ') + texto : '';
    nodo.className = 'form-msg' + (esError ? ' error' : '');
}

function formatoPrecio(n) {
    return '$' + Number(n).toLocaleString('es-CL');
}

// Normaliza un celular chileno a 569XXXXXXXX; null si no es válido
function normalizarWhatsapp(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (/^9\d{8}$/.test(digitos)) return '56' + digitos;
    if (/^569\d{8}$/.test(digitos)) return digitos;
    return null;
}

function enlaceWhatsapp(pub) {
    const texto = 'Hola ' + pub.nombre + ', vi tu publicación en Portal Dulces & Cariñosas y me interesa información.';
    return 'https://wa.me/' + pub.wsp + '?text=' + encodeURIComponent(texto);
}

/* ---------- Ubicación: regiones y comunas de Chile (datos en comunas.js) ---------- */

function regionPorNombre(nombre) {
    return REGIONES_CHILE.find(r => r.nombre === nombre) || null;
}

// La comuna debe existir y pertenecer a la región indicada
function ubicacionValida(region, comuna) {
    const r = regionPorNombre(region);
    return !!r && r.comunas.includes(comuna);
}

function poblarRegiones(select, textoVacio) {
    select.replaceChildren(el('option', { text: textoVacio, attrs: { value: '' } }));
    REGIONES_CHILE.forEach(r => {
        select.appendChild(el('option', { text: r.nombre, attrs: { value: r.nombre } }));
    });
}

function poblarComunas(select, region, textoVacio) {
    select.replaceChildren(el('option', { text: textoVacio, attrs: { value: '' } }));
    const r = regionPorNombre(region);
    select.disabled = !r;
    if (r) {
        r.comunas.forEach(c => select.appendChild(el('option', { text: c, attrs: { value: c } })));
    }
}

function coincideUbicacion(pub) {
    if (estado.filtroRegion && pub.region !== estado.filtroRegion) return false;
    if (estado.filtroComuna && pub.comuna !== estado.filtroComuna) return false;
    return true;
}

function textoUbicacionFiltro() {
    if (estado.filtroComuna) return estado.filtroComuna + ', ' + estado.filtroRegion;
    return estado.filtroRegion;
}

function cambiarRegionFiltro() {
    estado.filtroRegion = $('filtroRegion').value;
    estado.filtroComuna = '';
    poblarComunas($('filtroComuna'), estado.filtroRegion, 'Todas las comunas');
    aplicarFiltroUbicacion();
}

function cambiarComunaFiltro() {
    estado.filtroComuna = $('filtroComuna').value;
    aplicarFiltroUbicacion();
}

function limpiarFiltroUbicacion() {
    estado.filtroRegion = '';
    estado.filtroComuna = '';
    $('filtroRegion').value = '';
    poblarComunas($('filtroComuna'), '', 'Todas las comunas');
    aplicarFiltroUbicacion();
}

function aplicarFiltroUbicacion() {
    $('filtroLimpiar').hidden = !estado.filtroRegion;
    renderVitrina();
    $('vitrina').scrollIntoView();
}

// Un formulario de publicación: al cambiar la región se recargan sus comunas
function cambiarRegionFormulario(rol) {
    poblarComunas($(rol + 'Comuna'), $(rol + 'Region').value, 'Selecciona una comuna');
}

/* ---------- Cuentas y permisos ---------- */

function cuentaActual() {
    return estado.cuentas.find(c => c.id === estado.sesionId) || null;
}

function rolActual() {
    const c = cuentaActual();
    return c && c.habilitada ? c.rol : null;
}

function pubDe(cuentaId) {
    return estado.publicaciones.find(p => p.cuentaId === cuentaId) || null;
}

// Solo una cuenta habilitada, del tipo correcto y con suscripción activa puede publicar
function puedePublicar(rol) {
    const c = cuentaActual();
    return !!c && c.habilitada && c.rol === rol && c.suscripcion;
}

function publicacionVisible(pub) {
    const cuenta = estado.cuentas.find(c => c.id === pub.cuentaId);
    return pub.activo && !!cuenta && cuenta.habilitada && cuenta.suscripcion;
}

/* ---------- Validación de mayoría de edad ---------- */

function esMayorDeEdad(fechaISO) {
    if (!fechaISO) return false;
    const nacimiento = new Date(fechaISO + 'T00:00:00');
    const hoy = new Date();
    if (isNaN(nacimiento) || nacimiento > hoy) return false;
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const dm = hoy.getMonth() - nacimiento.getMonth();
    if (dm < 0 || (dm === 0 && hoy.getDate() < nacimiento.getDate())) edad--;
    return edad >= 18 && edad <= 110;
}

function bloquearContenido(bloquear) {
    document.querySelectorAll('header, main, footer').forEach(n => { n.inert = bloquear; });
    document.body.style.overflow = bloquear ? 'hidden' : '';
}

function iniciarValidacionEdad() {
    let confirmada = false;
    try {
        confirmada = sessionStorage.getItem('edadConfirmada') === '1';
    } catch (e) { /* almacenamiento no disponible */ }

    $('ageGate').hidden = confirmada;
    bloquearContenido(!confirmada);
    $('ageFecha').max = new Date().toISOString().slice(0, 10);

    $('ageForm').addEventListener('submit', evento => {
        evento.preventDefault();
        if (!esMayorDeEdad($('ageFecha').value)) {
            mensaje('ageMsg', 'Debes ser mayor de 18 años para ingresar.', true);
            return;
        }
        try {
            sessionStorage.setItem('edadConfirmada', '1');
        } catch (e) { /* ignorar */ }
        $('ageGate').hidden = true;
        bloquearContenido(false);
    });
}

/* ---------- Menú y filtros (modo estándar) ---------- */

function toggleMenu(forzarCierre = false) {
    const menu = $('navMenu');
    const boton = $('menuToggle');
    const abrir = forzarCierre ? false : !menu.classList.contains('active');
    menu.classList.toggle('active', abrir);
    boton.setAttribute('aria-expanded', String(abrir));
    boton.setAttribute('aria-label', abrir ? 'Cerrar menú de servicios' : 'Abrir menú de servicios');
}

function filtrarServicio(categoria) {
    estado.filtro = categoria;
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.categoria === categoria);
    });
    toggleMenu(true);
    renderVitrina();
    $('vitrina').scrollIntoView();
}

/* ---------- Login y sesión ---------- */

function rolSeleccionadoLogin() {
    const marcado = document.querySelector('input[name="loginRol"]:checked');
    return marcado ? marcado.value : 'admin';
}

function poblarCuentasLogin() {
    const rol = rolSeleccionadoLogin();
    const select = $('loginCuenta');
    select.replaceChildren();

    const cuentas = estado.cuentas.filter(c => c.rol === rol);
    if (cuentas.length === 0) {
        select.appendChild(el('option', { text: 'No hay cuentas de este tipo', attrs: { value: '' } }));
        return;
    }
    cuentas.forEach(c => {
        select.appendChild(el('option', {
            text: c.nombre + (c.habilitada ? '' : ' — deshabilitada'),
            attrs: { value: String(c.id) }
        }));
    });
}

function abrirLogin() {
    if (cuentaActual()) {
        // Con sesión iniciada, el botón lleva al panel
        abrirPanel(estado.sesionId ? cuentaActual().rol : null);
        return;
    }
    mensaje('msgLogin', '', false);
    poblarCuentasLogin();
    $('loginDialog').showModal();
}

function entrar(evento) {
    evento.preventDefault();
    const cuenta = estado.cuentas.find(c => c.id === Number($('loginCuenta').value));
    if (!cuenta) return mensaje('msgLogin', 'Selecciona una cuenta.', true);
    if (!cuenta.habilitada) {
        return mensaje('msgLogin', 'Esta cuenta está deshabilitada. Contacta al administrador.', true);
    }
    estado.sesionId = cuenta.id;
    borradores = nuevosBorradores();
    $('loginDialog').close();
    actualizarSesion();
    abrirPanel(cuenta.rol);
}

function salir() {
    estado.sesionId = null;
    estado.panelAbierto = null;
    borradores = nuevosBorradores();
    actualizarSesion();
    cerrarPaneles();
    renderVitrina();
}

function actualizarSesion() {
    const c = cuentaActual();
    $('btnLogin').textContent = c ? c.nombre : 'Ingresar';
    $('btnLogin').setAttribute('aria-label', c ? 'Cuenta: ' + c.nombre : 'Ingresar a mi cuenta');
    $('sesionBar').hidden = !c;
    if (c) {
        $('sesionInfo').textContent = 'Sesión iniciada: ' + c.nombre + ' · ' + ROLES[c.rol];
    }
    actualizarBotonPanel();
}

function actualizarBotonPanel() {
    $('btnPanel').textContent = estado.panelAbierto ? 'Cerrar mi panel' : 'Abrir mi panel';
}

/* ---------- Paneles de gestión (sobre la vitrina) ---------- */

function cerrarPaneles() {
    document.querySelectorAll('.gestion-panel').forEach(p => p.classList.remove('active'));
    estado.panelAbierto = null;
    actualizarBotonPanel();
}

function abrirPanel(rol) {
    // Cada panel exige su tipo de cuenta
    if (!rol || rolActual() !== rol) return;
    cerrarPaneles();
    $(rol).classList.add('active');
    estado.panelAbierto = rol;
    actualizarBotonPanel();

    if (rol === 'admin') renderAdmin();
    else prepararPanel(rol);
    $(rol).scrollIntoView();
}

function alternarPanel() {
    const c = cuentaActual();
    if (!c) return;
    if (estado.panelAbierto) cerrarPaneles();
    else abrirPanel(c.rol);
}

/* ---------- Administración (solo cuenta Admin) ---------- */

function crearCuenta(evento) {
    evento.preventDefault();
    if (rolActual() !== 'admin') return;
    const nombre = $('cuentaNombre').value.trim();
    const rol = $('cuentaRol').value;
    if (!nombre) return mensaje('msgCuenta', 'Ingresa un nombre.', true);
    if (!['modelo', 'local'].includes(rol)) return mensaje('msgCuenta', 'Tipo de cuenta no válido.', true);

    estado.cuentas.push({
        id: estado.siguienteCuenta++,
        nombre,
        rol,
        habilitada: true,
        suscripcion: false
    });
    evento.currentTarget.reset();
    mensaje('msgCuenta', 'Cuenta creada.', false);
    renderAdmin();
}

function cambiarHabilitada(id) {
    if (rolActual() !== 'admin') return;
    const c = estado.cuentas.find(x => x.id === id);
    if (!c) return;
    if (c.id === estado.sesionId) return mensaje('msgAdmin', 'No puedes deshabilitar tu propia cuenta.', true);
    c.habilitada = !c.habilitada;
    mensaje('msgAdmin', '', false);
    renderAdmin();
    renderVitrina();
}

function cambiarSuscripcion(id) {
    if (rolActual() !== 'admin') return;
    const c = estado.cuentas.find(x => x.id === id);
    if (!c || !['modelo', 'local'].includes(c.rol)) return;
    c.suscripcion = !c.suscripcion;
    mensaje('msgAdmin', '', false);
    renderAdmin();
    renderVitrina();
}

function renderAdmin() {
    const tbody = $('adminLista');
    tbody.replaceChildren();

    estado.cuentas.forEach(c => {
        const etiquetaEstado = el('span', {
            class: 'status ' + (c.habilitada ? 'active' : 'inactive'),
            text: c.habilitada ? 'Habilitada' : 'Deshabilitada'
        });

        let textoSub = 'No aplica';
        if (c.rol !== 'admin') textoSub = c.suscripcion ? 'Activa' : 'Pendiente de pago';

        const acciones = el('div', { class: 'acciones' },
            el('button', {
                class: 'btn-outline',
                text: c.habilitada ? 'Deshabilitar' : 'Habilitar',
                attrs: { type: 'button' },
                on: { click: () => cambiarHabilitada(c.id) }
            })
        );
        if (c.rol !== 'admin') {
            acciones.append(el('button', {
                class: 'btn-outline',
                text: c.suscripcion ? 'Quitar suscripción' : 'Confirmar pago',
                attrs: { type: 'button' },
                on: { click: () => cambiarSuscripcion(c.id) }
            }));
        }

        tbody.appendChild(el('tr', {},
            el('td', { text: c.nombre }),
            el('td', { text: ROLES[c.rol] }),
            el('td', {}, etiquetaEstado),
            el('td', { text: textoSub }),
            el('td', {}, acciones)
        ));
    });
}

/* ---------- Paneles de Modelo y Local ---------- */

function poblarSelect(id, categorias) {
    const select = $(id);
    select.replaceChildren();
    categorias.forEach(cat => {
        select.appendChild(el('option', { text: NOMBRES_SERVICIO[cat], attrs: { value: cat } }));
    });
}

function prepararPanel(rol) {
    const cuenta = cuentaActual();
    if (!cuenta || cuenta.rol !== rol) return;

    const activa = cuenta.suscripcion;
    $(rol + 'Bloqueo').hidden = activa;
    $(rol === 'modelo' ? 'formModelo' : 'formLocal').hidden = !activa;
    if (!activa) return;

    const borrador = borradores[rol];
    if (!borrador.cargado) {
        // Parte de un formulario limpio para no arrastrar datos de otra cuenta
        $(rol === 'modelo' ? 'formModelo' : 'formLocal').reset();
        poblarComunas($(rol + 'Comuna'), '', 'Selecciona una comuna');

        const pub = pubDe(cuenta.id);
        if (pub) {
            $(rol + 'Nombre').value = pub.nombre;
            $(rol + 'Region').value = pub.region;
            poblarComunas($(rol + 'Comuna'), pub.region, 'Selecciona una comuna');
            $(rol + 'Comuna').value = pub.comuna;
            $(rol + 'Servicio').value = pub.categoria;
            $(rol + 'Desc').value = pub.desc;
            $(rol + 'Wsp').value = pub.wsp;
            $(rol + 'Consent').checked = !!pub.consent;
            borrador.servicios = pub.servicios.map(s => ({ ...s }));
            borrador.fotos = [...pub.fotos];
            if (rol === 'local') $('localPromo').value = pub.promo || '';
            if (rol === 'modelo') borrador.videos = pub.videos.map(v => ({ ...v }));
        }
        borrador.cargado = true;
    }
    renderServicios(rol);
    renderMedios(rol);
}

function renderServicios(rol) {
    const lista = $(rol + 'ServLista');
    lista.replaceChildren();
    borradores[rol].servicios.forEach((s, i) => {
        lista.appendChild(el('li', {},
            el('span', { text: s.nombre }),
            el('span', { class: 'precio', text: formatoPrecio(s.precio) }),
            el('button', {
                class: 'btn-outline',
                text: 'Quitar',
                attrs: { type: 'button', 'aria-label': 'Quitar ' + s.nombre },
                on: { click: () => { borradores[rol].servicios.splice(i, 1); renderServicios(rol); } }
            })
        ));
    });
}

function agregarServicio(rol) {
    if (!puedePublicar(rol)) return;
    const msgId = rol === 'modelo' ? 'msgModelo' : 'msgLocal';
    const nombre = $(rol + 'ServNombre').value.trim();
    const textoPrecio = $(rol + 'ServPrecio').value;
    const precio = Number(textoPrecio);

    if (!nombre) return mensaje(msgId, 'Ingresa el nombre del servicio.', true);
    if (textoPrecio === '' || !Number.isInteger(precio) || precio < 0 || precio > 10000000) {
        return mensaje(msgId, 'Ingresa un precio válido en pesos chilenos.', true);
    }
    if (borradores[rol].servicios.length >= MAX_SERVICIOS) {
        return mensaje(msgId, 'Máximo ' + MAX_SERVICIOS + ' servicios.', true);
    }

    borradores[rol].servicios.push({ nombre, precio });
    $(rol + 'ServNombre').value = '';
    $(rol + 'ServPrecio').value = '';
    mensaje(msgId, '', false);
    renderServicios(rol);
}

/* --- Fotos: recorte centrado 3:4 + 720x960 + JPEG optimizado --- */

function procesarFoto(archivo) {
    return new Promise((resolver, rechazar) => {
        const origen = URL.createObjectURL(archivo);
        const img = new Image();
        img.onload = () => {
            const lienzo = document.createElement('canvas');
            lienzo.width = FOTO_ANCHO;
            lienzo.height = FOTO_ALTO;
            const ctx = lienzo.getContext('2d');
            const escala = Math.max(FOTO_ANCHO / img.width, FOTO_ALTO / img.height);
            const w = img.width * escala;
            const h = img.height * escala;
            ctx.imageSmoothingQuality = 'high';
            ctx.filter = 'contrast(1.04) saturate(1.05)'; // mejora suave; se ignora si el navegador no lo soporta
            ctx.drawImage(img, (FOTO_ANCHO - w) / 2, (FOTO_ALTO - h) / 2, w, h);
            URL.revokeObjectURL(origen);
            lienzo.toBlob(blob => {
                if (blob) resolver(URL.createObjectURL(blob));
                else rechazar(new Error('No se pudo procesar la imagen.'));
            }, 'image/jpeg', 0.85);
        };
        img.onerror = () => {
            URL.revokeObjectURL(origen);
            rechazar(new Error('No se pudo leer la imagen.'));
        };
        img.src = origen;
    });
}

// Mismo procesamiento y límites para Modelo y Local
async function subirFotos(rol, evento) {
    const input = evento.currentTarget;
    const archivos = Array.from(input.files);
    input.value = '';
    if (!puedePublicar(rol)) return;

    const msgId = rol === 'modelo' ? 'msgModelo' : 'msgLocal';
    const fotos = borradores[rol].fotos;
    for (const archivo of archivos) {
        if (fotos.length >= MAX_FOTOS) {
            mensaje(msgId, 'Máximo ' + MAX_FOTOS + ' fotos.', true);
            break;
        }
        if (!TIPOS_FOTO.includes(archivo.type)) {
            mensaje(msgId, 'Las fotos deben ser JPG, PNG o WebP.', true);
            continue;
        }
        if (archivo.size > MAX_FOTO_BYTES) {
            mensaje(msgId, 'Una foto supera los 10 MB.', true);
            continue;
        }
        try {
            fotos.push(await procesarFoto(archivo));
            mensaje(msgId, '', false);
        } catch (e) {
            mensaje(msgId, e.message, true);
        }
    }
    renderMedios(rol);
}

function subirVideo(evento) {
    const input = evento.currentTarget;
    const archivo = input.files[0];
    input.value = '';
    if (!archivo || !puedePublicar('modelo')) return;

    const videos = borradores.modelo.videos;
    if (videos.length >= MAX_VIDEOS) return mensaje('msgModelo', 'Máximo ' + MAX_VIDEOS + ' videos.', true);
    if (!TIPOS_VIDEO.includes(archivo.type)) return mensaje('msgModelo', 'El video debe ser MP4 o WebM.', true);
    if (archivo.size > MAX_VIDEO_BYTES) return mensaje('msgModelo', 'El video supera los 25 MB.', true);

    videos.push({ url: URL.createObjectURL(archivo), nombre: archivo.name });
    mensaje('msgModelo', '', false);
    renderMedios('modelo');
}

function renderMedios(rol) {
    const contFotos = $(rol + 'Fotos');
    contFotos.replaceChildren();

    borradores[rol].fotos.forEach((url, i) => {
        const marco = el('div', { class: 'media-frame' },
            el('img', { attrs: { src: url, alt: 'Foto ' + (i + 1) } }));
        contFotos.appendChild(el('div', { class: 'thumb' }, marco,
            el('button', {
                class: 'btn-outline',
                text: 'Quitar',
                attrs: { type: 'button', 'aria-label': 'Quitar foto ' + (i + 1) },
                on: { click: () => { borradores[rol].fotos.splice(i, 1); renderMedios(rol); } }
            })
        ));
    });

    if (rol !== 'modelo') return;
    const contVideos = $('modeloVideos');
    contVideos.replaceChildren();

    borradores.modelo.videos.forEach((v, i) => {
        const marco = el('div', { class: 'media-frame' },
            el('video', { attrs: { src: v.url, muted: '', preload: 'metadata' } }));
        contVideos.appendChild(el('div', { class: 'thumb' }, marco,
            el('button', {
                class: 'btn-outline',
                text: 'Quitar',
                attrs: { type: 'button', 'aria-label': 'Quitar video ' + (i + 1) },
                on: { click: () => { borradores.modelo.videos.splice(i, 1); renderMedios('modelo'); } }
            })
        ));
    });
}

/* --- Guardar publicación --- */

function guardarPublicacion(rol, evento) {
    evento.preventDefault();
    const msgId = rol === 'modelo' ? 'msgModelo' : 'msgLocal';
    if (!puedePublicar(rol)) {
        return mensaje(msgId, 'Tu cuenta no puede publicar (revisa estado y suscripción).', true);
    }

    const nombre = $(rol + 'Nombre').value.trim();
    const region = $(rol + 'Region').value;
    const comuna = $(rol + 'Comuna').value;
    const categoria = $(rol + 'Servicio').value;
    const desc = $(rol + 'Desc').value.trim();
    const wsp = normalizarWhatsapp($(rol + 'Wsp').value);
    const borrador = borradores[rol];

    if (!nombre) return mensaje(msgId, 'Ingresa un nombre.', true);
    if (!ubicacionValida(region, comuna)) return mensaje(msgId, 'Selecciona una región y una comuna de la lista.', true);
    if (!desc) return mensaje(msgId, 'Ingresa una descripción.', true);
    if (!CATEGORIAS_POR_ROL[rol].includes(categoria)) return mensaje(msgId, 'Categoría no válida.', true);
    if (!wsp) return mensaje(msgId, 'Ingresa un celular chileno válido (ej: 987654321).', true);

    const datos = {
        cuentaId: estado.sesionId,
        tipo: rol,
        nombre,
        region,
        comuna,
        categoria,
        desc,
        wsp,
        servicios: borrador.servicios.map(s => ({ ...s })),
        activo: true
    };

    if (rol === 'modelo') {
        if (borrador.fotos.length === 0) return mensaje(msgId, 'Sube al menos una foto.', true);
        if (!$('modeloConsent').checked) return mensaje(msgId, 'Debes aceptar la declaración para publicar.', true);
        datos.fotos = [...borrador.fotos];
        datos.videos = borrador.videos.map(v => ({ ...v }));
        datos.consent = true;
    } else {
        // Las fotos del local son opcionales; si hay, exigen la misma declaración
        if (borrador.fotos.length > 0 && !$('localConsent').checked) {
            return mensaje(msgId, 'Para publicar fotos debes aceptar la declaración.', true);
        }
        datos.promo = $('localPromo').value.trim();
        datos.fotos = [...borrador.fotos];
        datos.videos = [];
        datos.consent = borrador.fotos.length > 0;
    }

    const existente = pubDe(estado.sesionId);
    if (existente) Object.assign(existente, datos);
    else estado.publicaciones.push({ id: estado.siguientePub++, ...datos });

    let aviso = 'Publicación guardada. Ya aparece en la vitrina (esta sesión del navegador).';
    if (!coincideUbicacion(datos)) {
        aviso += ' Ojo: hoy el filtro de ubicación (' + textoUbicacionFiltro() + ') la oculta; usa "Limpiar" para verla.';
    }
    mensaje(msgId, aviso, false);
    renderVitrina();
}

/* ---------- Vitrina (modo estándar, siempre visible) ---------- */

function crearTarjeta(pub) {
    const marco = el('div', { class: 'media-frame' });
    if (pub.fotos.length > 0) {
        marco.appendChild(el('img', {
            attrs: { src: pub.fotos[0], alt: 'Foto de ' + pub.nombre, loading: 'lazy' }
        }));
    } else {
        marco.classList.add('monograma');
        marco.textContent = pub.nombre.charAt(0).toUpperCase();
    }
    if (pub.tipo === 'local' && pub.promo) marco.appendChild(el('span', { class: 'badge-promo', text: 'PROMO' }));

    const meta = [pub.tipo === 'modelo' ? 'Modelo' : 'Local', pub.comuna];

    const cuerpo = el('div', { class: 'banner-body' },
        el('span', { class: 'badge-servicio', text: NOMBRES_SERVICIO[pub.categoria] }),
        el('h3', { class: 'banner-title', text: pub.nombre }),
        el('p', { class: 'banner-meta', text: meta.join(' · ') }),
        el('p', { class: 'banner-desc', text: pub.desc }),
        el('div', { class: 'card-actions' },
            el('button', {
                class: 'btn-outline',
                text: 'Ver ficha',
                attrs: { type: 'button' },
                on: { click: () => abrirFicha(pub) }
            })
        ),
        el('a', {
            class: 'btn-whatsapp',
            text: 'Contactar por WhatsApp',
            attrs: { href: enlaceWhatsapp(pub), target: '_blank', rel: 'noopener noreferrer' }
        })
    );

    return el('article', { class: 'banner-card' }, marco, cuerpo);
}

function renderVitrina() {
    const contenedor = $('contenedorBanners');
    contenedor.replaceChildren();

    const visibles = estado.publicaciones.filter(p =>
        publicacionVisible(p) && coincideUbicacion(p) && (estado.filtro === 'Todos' || p.categoria === estado.filtro)
    );

    const ubicacion = textoUbicacionFiltro();
    const resumen = [];
    if (estado.filtro !== 'Todos') resumen.push(NOMBRES_SERVICIO[estado.filtro]);
    if (ubicacion) resumen.push(ubicacion);
    $('vitrinaResumen').textContent = visibles.length + (visibles.length === 1 ? ' publicación' : ' publicaciones') +
        (resumen.length ? ' · ' + resumen.join(' · ') : '');

    if (visibles.length === 0) {
        let texto;
        if (ubicacion) {
            texto = 'No hay publicaciones activas' +
                (estado.filtro === 'Todos' ? '' : ' en "' + NOMBRES_SERVICIO[estado.filtro] + '"') +
                ' en ' + ubicacion + '. Prueba con otra comuna o región, o usa "Limpiar".';
        } else if (estado.filtro === 'Todos') {
            texto = 'Aún no hay publicaciones. Una modelo o un local con suscripción activa debe publicar para verlas aquí.';
        } else {
            texto = 'No hay publicaciones activas en "' + NOMBRES_SERVICIO[estado.filtro] + '".';
        }
        contenedor.appendChild(el('p', { class: 'muted', text: texto }));
        return;
    }
    visibles.forEach(p => contenedor.appendChild(crearTarjeta(p)));
}

function abrirFicha(pub) {
    const cont = $('perfilContenido');
    cont.replaceChildren();

    cont.append(
        el('h2', { class: 'perfil-titulo', text: pub.nombre }),
        el('p', {
            class: 'banner-meta',
            text: [NOMBRES_SERVICIO[pub.categoria], pub.comuna + ', ' + pub.region].join(' · ')
        }),
        el('p', { text: pub.desc })
    );

    if (pub.tipo === 'local' && pub.promo) {
        cont.append(el('p', { class: 'lock-box', text: 'Promoción: ' + pub.promo }));
    }

    if (pub.servicios.length > 0) {
        const lista = el('ul', { class: 'svc-list' });
        pub.servicios.forEach(s => lista.appendChild(el('li', {},
            el('span', { text: s.nombre }),
            el('span', { class: 'precio', text: formatoPrecio(s.precio) })
        )));
        cont.append(el('h3', { class: 'perfil-titulo', text: 'Servicios y valores' }), lista);
    }

    if (pub.fotos.length > 0) {
        const grid = el('div', { class: 'perfil-grid' });
        pub.fotos.forEach((url, i) => grid.appendChild(el('div', { class: 'media-frame' },
            el('img', { attrs: { src: url, alt: 'Foto ' + (i + 1) + ' de ' + pub.nombre, loading: 'lazy' } }))));
        cont.append(el('h3', { class: 'perfil-titulo', text: 'Fotos' }), grid);
    }

    if (pub.videos.length > 0) {
        const grid = el('div', { class: 'perfil-grid' });
        pub.videos.forEach(v => grid.appendChild(el('div', { class: 'media-frame' },
            el('video', { attrs: { src: v.url, controls: '', preload: 'metadata', playsinline: '' } }))));
        cont.append(el('h3', { class: 'perfil-titulo', text: 'Videos' }), grid);
    }

    cont.append(el('a', {
        class: 'btn-whatsapp',
        text: 'Contactar por WhatsApp',
        attrs: { href: enlaceWhatsapp(pub), target: '_blank', rel: 'noopener noreferrer' }
    }));

    $('perfilDialog').showModal();
}

/* ---------- Inicio ---------- */

document.addEventListener('DOMContentLoaded', () => {
    iniciarValidacionEdad();

    poblarSelect('modeloServicio', CATEGORIAS_POR_ROL.modelo);
    poblarSelect('localServicio', CATEGORIAS_POR_ROL.local);

    poblarRegiones($('filtroRegion'), 'Todas las regiones');
    poblarComunas($('filtroComuna'), '', 'Todas las comunas');
    ['modelo', 'local'].forEach(rol => {
        poblarRegiones($(rol + 'Region'), 'Selecciona una región');
        poblarComunas($(rol + 'Comuna'), '', 'Selecciona una comuna');
        $(rol + 'Region').addEventListener('change', () => cambiarRegionFormulario(rol));
    });
    $('filtroRegion').addEventListener('change', cambiarRegionFiltro);
    $('filtroComuna').addEventListener('change', cambiarComunaFiltro);
    $('filtroLimpiar').addEventListener('click', limpiarFiltroUbicacion);
    actualizarSesion();

    $('menuToggle').addEventListener('click', () => toggleMenu());
    $('btnLogin').addEventListener('click', abrirLogin);
    $('btnSalir').addEventListener('click', salir);
    $('btnPanel').addEventListener('click', alternarPanel);
    $('loginCerrar').addEventListener('click', () => $('loginDialog').close());
    $('perfilCerrar').addEventListener('click', () => $('perfilDialog').close());
    $('formLogin').addEventListener('submit', entrar);
    document.querySelectorAll('input[name="loginRol"]').forEach(r => {
        r.addEventListener('change', poblarCuentasLogin);
    });

    document.querySelectorAll('[data-categoria]').forEach(nodo => {
        nodo.addEventListener('click', evento => {
            evento.preventDefault();
            filtrarServicio(nodo.dataset.categoria);
        });
    });

    $('formCuenta').addEventListener('submit', crearCuenta);
    $('formModelo').addEventListener('submit', e => guardarPublicacion('modelo', e));
    $('formLocal').addEventListener('submit', e => guardarPublicacion('local', e));
    $('modeloServAdd').addEventListener('click', () => agregarServicio('modelo'));
    $('localServAdd').addEventListener('click', () => agregarServicio('local'));
    $('modeloFoto').addEventListener('change', e => subirFotos('modelo', e));
    $('localFoto').addEventListener('change', e => subirFotos('local', e));
    $('modeloVideo').addEventListener('change', subirVideo);

    renderVitrina();
});
