// CONTROL DE ACCESO
const sesionActiva = localStorage.getItem('boletin_sesion_activa');
if (sesionActiva !== 'true') {
  window.location.href = 'index.html';
}

// INTERCEPTOR GLOBAL DE PETICIONES A LA API (TP N.º 2 - Autenticación Bearer Token)
const _originalFetch = window.fetch;
window.fetch = async function(resource, init = {}) {
  const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
  if (url.includes('api/')) {
    const token = localStorage.getItem('boletin_token');
    if (token) {
      init = init || {};
      const headers = new Headers(init.headers || {});
      if (!headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      init.headers = headers;
    }
  }
  return _originalFetch(resource, init);
};

// Sincronizar token de API automáticamente si ya existía una sesión activa
(async function asegurarTokenApi() {
  if (!localStorage.getItem('boletin_token')) {
    try {
      const usuarioGuardado = JSON.parse(localStorage.getItem('boletin_usuario') || '{}');
      if (usuarioGuardado && (usuarioGuardado.email || usuarioGuardado.rol)) {
        const res = await _originalFetch('api/auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(usuarioGuardado)
        });
        const data = await res.json();
        if (data && data.token) {
          localStorage.setItem('boletin_token', data.token);
        }
      }
    } catch (e) {
      console.warn('No se pudo inicializar token API:', e);
    }
  }
})();

// CLIENTE HTTP ASÍNCRONO REUTILIZABLE 

async function apiPost(url, payload) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

async function apiGet(url) {
  return fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
}

async function apiDelete(url) {
  return fetch(url, {
    method: 'DELETE'
  });
}

let datosMemoria = null;
let rolActual = 'tutor';

// 1. Carga de JSON
async function cargarDatos(archivoJson) {
  try {
    const respuesta = await fetch(archivoJson);
    const data = await respuesta.json();
    datosMemoria = data;

    // Aplicar personalización institucional si existe
    if (DB_ESCOLAR && DB_ESCOLAR.configuracion && datosMemoria && datosMemoria.institucion) {
      if (DB_ESCOLAR.configuracion.nombre) datosMemoria.institucion.nombre = DB_ESCOLAR.configuracion.nombre;
      if (DB_ESCOLAR.configuracion.subtitulo) datosMemoria.institucion.subtitulo = DB_ESCOLAR.configuracion.subtitulo;
    }

    // Cargar el alumno activo
    if (typeof cargarAlumnoEnBoletin === 'function') {
      await cargarAlumnoEnBoletin(alumnoActivoDni);
    } else {
      renderizarPortal(datosMemoria);
    }
  } catch (error) {
    console.error("Error cargando el archivo JSON:", error);
  }
}

// 2. Render de la pantalla completa
function renderizarPortal(data) {
  if (!data) return;

  if (data.institucion) {
    const escNom = document.getElementById('escuela-nombre');
    if (escNom) escNom.textContent = data.institucion.nombre || '';
    const escSub = document.getElementById('escuela-subtitulo');
    if (escSub) escSub.textContent = data.institucion.subtitulo || '';
    const escReg = document.getElementById('escuela-regimen');
    if (escReg) escReg.textContent = data.institucion.regimen || '';
  }

  if (data.estudiante) {
    const tutorHTML = data.estudiante.tutor
      ? ` | Tutor/a: <span class="text-blue" style="font-weight: 600;">${data.estudiante.tutor}</span>`
      : '';
    const dniHTML = data.estudiante.dni ? ` | DNI ${data.estudiante.dni}` : '';
    const estInfo = document.getElementById('estudiante-info');
    if (estInfo) {
      estInfo.innerHTML = `Estudiante: <strong class="text-white">${data.estudiante.nombre || ''}</strong> | ${data.estudiante.curso || ''}${dniHTML}${tutorHTML}`;
    }

    const studentSelectorTextEl = document.getElementById('student-selector-text');
    if (studentSelectorTextEl) {
      studentSelectorTextEl.textContent =
        `${data.estudiante.nombre || ''}${data.estudiante.dni ? ' - DNI ' + data.estudiante.dni : ''} - ${data.estudiante.curso || ''}`;
    }
  }

  const asistInfo = document.getElementById('asistencia-info');
  if (asistInfo) asistInfo.textContent = data.asistencia || '';

  const esBuenosAires = data.jurisdiccion === 'Buenos Aires';
  const esPreceptor = rolActual === 'preceptor';
  const displayPreceptor = esPreceptor ? 'inline-flex' : 'none';

  // Cabeceras dinámicas
  const theadMateriasElem = document.getElementById('thead-materias');
  if (theadMateriasElem) {
    if (esBuenosAires) {
      theadMateriasElem.innerHTML = `
        <tr class="header-group-row">
          <th rowspan="2" style="vertical-align: middle; width: 60px;">Tipo</th>
          <th rowspan="2" style="vertical-align: middle;">Materia / Espacio Curricular</th>
          <th rowspan="2" style="text-align: center; vertical-align: middle; width: 60px;">Año</th>
          <th colspan="2" class="th-cuatrimestre" style="text-align: center;">1° Cuatrimestre</th>
          <th colspan="2" class="th-cuatrimestre" style="text-align: center;">2° Cuatrimestre</th>
          <th rowspan="2" style="text-align: center; vertical-align: middle;">Intensif. Dic</th>
          <th rowspan="2" style="text-align: center; vertical-align: middle;">Condición</th>
        </tr>
        <tr class="header-sub-row">
          <th style="text-align: center; font-size: 0.7rem;">Valoración</th>
          <th style="text-align: center; font-size: 0.7rem;">Nota</th>
          <th style="text-align: center; font-size: 0.7rem;">Valoración</th>
          <th style="text-align: center; font-size: 0.7rem;">Nota</th>
        </tr>
      `;
    } else {
      theadMateriasElem.innerHTML = `
        <tr class="header-group-row">
          <th rowspan="2" style="vertical-align: middle; min-width: 220px;">Materia / Espacio Curricular</th>
          <th colspan="2" class="th-trimestre" style="text-align: center;">1° Trimestre</th>
          <th colspan="2" class="th-trimestre" style="text-align: center;">2° Trimestre</th>
          <th colspan="2" class="th-trimestre" style="text-align: center;">3° Trimestre</th>
          <th colspan="2" class="th-recup" style="text-align: center;">Periodos de Recuperación y PAIR</th>
          <th colspan="2" class="th-final" style="text-align: center;">Nota Final</th>
        </tr>
        <tr class="header-sub-row">
          <th style="text-align: center; font-size: 0.68rem;">Concepto</th>
          <th style="text-align: center; font-size: 0.68rem;">Nro</th>
          <th style="text-align: center; font-size: 0.68rem;">Concepto</th>
          <th style="text-align: center; font-size: 0.68rem;">Nro</th>
          <th style="text-align: center; font-size: 0.68rem;">Concepto</th>
          <th style="text-align: center; font-size: 0.68rem;">Nro</th>
          <th style="text-align: center; font-size: 0.68rem;">Dic 2026</th>
          <th style="text-align: center; font-size: 0.68rem;">Feb/Mar/Abr</th>
          <th style="text-align: center; font-size: 0.68rem;">Concepto</th>
          <th style="text-align: center; font-size: 0.68rem;">Nro</th>
        </tr>
      `;
    }
  }

  // Filas de materias
  const tbodyMateriasElem = document.getElementById('tbody-materias');
  if (tbodyMateriasElem && Array.isArray(data.materias)) {
    let tbodyMaterias = '';
    data.materias.forEach((m, index) => {
      let celdasPrefijo = '';
      if (esBuenosAires) {
        const badgeTipo = m.tipo === 'R'
          ? `<span class="badge badge-amber" title="Recursada">R</span>`
          : `<span class="badge badge-blue" title="Cursada regular">C</span>`;
        const badgeAnio = m.anio
          ? `<span class="text-secondary" style="font-weight: 700;">${m.anio}</span>`
          : '<span class="text-dim">-</span>';
        celdasPrefijo = `<td>${badgeTipo}</td><td class="text-white" style="font-weight: 600;">${m.nombre}</td><td style="text-align: center;">${badgeAnio}</td>`;
      } else {
        celdasPrefijo = `<td class="text-white" style="font-weight: 600;">${m.nombre}</td>`;
      }

      tbodyMaterias += `<tr>${celdasPrefijo}`;

      data.columnas.forEach(col => {
        const valor = m.notas[col.key];
        let celdaContenido = '<span class="text-dim">-</span>';

        if (valor !== null && valor !== undefined) {
          if (typeof valor === 'number') {
            const badgeClass = valor >= 6 ? 'badge-green' : 'badge-red';
            celdaContenido = `<span class="badge ${badgeClass}" style="min-width: 28px; text-align: center; font-weight: 700;">${valor}</span>`;
          } else {
            const valorUpper = String(valor).toUpperCase();
            let badgeClass = 'badge-blue';
            if (['TEA', 'B', 'MB', 'S', 'A'].includes(valorUpper)) {
              badgeClass = 'badge-green';
            } else if (['TEP', 'TED', 'D', 'R'].includes(valorUpper)) {
              badgeClass = 'badge-red';
            }
            celdaContenido = `<span class="badge ${badgeClass}" style="font-weight: 700;">${valor}</span>`;
          }
        }

        tbodyMaterias += `<td style="text-align: center;">${celdaContenido}</td>`;
      });

      if (m.condicion && esBuenosAires) {
        const condicionUpper = m.condicion.toUpperCase();
        let condClass = 'badge-red';
        if (condicionUpper.includes('APROB') || condicionUpper.includes('TEA')) {
          condClass = 'badge-green';
        } else if (condicionUpper.includes('CONCEPTUAL')) {
          condClass = 'badge-blue';
        }
        tbodyMaterias += `<td style="text-align: center;"><span class="badge ${condClass}">${m.condicion}</span></td>`;
      }

      tbodyMaterias += `</tr>`;
    });

    // Inasistencias en Formosa (Trimestral)
    if (data.inasistencias && !esBuenosAires) {
      const t1Val = data.inasistencias.t1 !== undefined ? data.inasistencias.t1 : '-';
      const t2Val = data.inasistencias.t2 !== undefined ? data.inasistencias.t2 : '-';
      const t3Val = data.inasistencias.t3 !== undefined ? data.inasistencias.t3 : '-';
      const totalVal = data.inasistencias.total !== undefined ? data.inasistencias.total : 0;
      tbodyMaterias += `
        <tr class="tr-inasistencias">
          <td class="text-secondary" style="font-weight: 700; text-transform: uppercase; font-size: 0.75rem;">Inasistencias</td>
          <td class="text-dim" style="text-align: center;">-</td>
          <td class="text-amber" style="text-align: center; font-weight: 700;">${t1Val}</td>
          <td class="text-dim" style="text-align: center;">-</td>
          <td class="text-amber" style="text-align: center; font-weight: 700;">${t2Val}</td>
          <td class="text-dim" style="text-align: center;">-</td>
          <td class="text-dim" style="text-align: center;">${t3Val}</td>
          <td colspan="2" class="text-muted" style="text-align: center; font-size: 0.72rem;">Límite Institucional: 20</td>
          <td colspan="2" style="text-align: center;">
            <span class="badge badge-amber">Total: ${totalVal}</span>
          </td>
        </tr>
      `;
    }

    // Inasistencias en Buenos Aires (Cuatrimestral)
    if (data.inasistencias && esBuenosAires) {
      const c1Val = data.inasistencias.c1 !== undefined ? data.inasistencias.c1 : (data.inasistencias.t1 !== undefined ? data.inasistencias.t1 : '-');
      const c2Val = data.inasistencias.c2 !== undefined ? data.inasistencias.c2 : (data.inasistencias.t2 !== undefined ? data.inasistencias.t2 : '-');
      const totalVal = data.inasistencias.total !== undefined ? data.inasistencias.total : 0;
      tbodyMaterias += `
        <tr class="tr-inasistencias">
          <td class="text-secondary" style="font-weight: 700; text-transform: uppercase; font-size: 0.75rem;">Inasistencias</td>
          <td colspan="2" class="text-dim" style="text-align: center;">-</td>
          <td colspan="2" class="text-amber" style="text-align: center; font-weight: 700;">${c1Val}</td>
          <td colspan="2" class="text-amber" style="text-align: center; font-weight: 700;">${c2Val}</td>
          <td class="text-muted" style="text-align: center; font-size: 0.72rem;">Límite Institucional: 20</td>
          <td style="text-align: center;">
            <span class="badge badge-amber">Total: ${totalVal}</span>
          </td>
        </tr>
      `;
    }

    tbodyMateriasElem.innerHTML = tbodyMaterias;
  }

  // Panel Inferior (Previas / Intensificación)
  const elBloqueTit = document.getElementById('bloque-inferior-titulo');
  if (elBloqueTit && data.bloqueInferior) {
    elBloqueTit.textContent = data.bloqueInferior.titulo || 'Materias Previas y Equivalencias';
  }

  const btnContenedorPrevia = document.getElementById('btnContenedorAccionPrevia');
  if (btnContenedorPrevia) {
    btnContenedorPrevia.style.display = esPreceptor ? 'inline-flex' : 'none';
  }

  const theadInfEl = document.getElementById('thead-inferior');
  if (theadInfEl) {
    theadInfEl.innerHTML = `
      <tr>
        <th style="width: 45px; text-align: center;">#</th>
        <th>Condición / Régimen</th>
        <th>Curso Origen</th>
        <th>Materia / Espacio Curricular</th>
        <th style="text-align: center; width: 110px;">Calificación</th>
        <th style="text-align: center; width: 130px;">Estado</th>
        ${esPreceptor ? '<th style="text-align: center; width: 95px;">Acciones</th>' : ''}
      </tr>
    `;
  }

  const tbodyInfEl = document.getElementById('tbody-inferior');
  if (tbodyInfEl) {
    const items = (data.bloqueInferior && Array.isArray(data.bloqueInferior.items)) ? data.bloqueInferior.items : [];
    if (items.length === 0) {
      tbodyInfEl.innerHTML = `
        <tr>
          <td colspan="${esPreceptor ? 7 : 6}" style="text-align: center; padding: 2rem; color: #10b981;">
            <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 0.35rem; display: block;"></i>
            <strong>¡Excelente!</strong> El estudiante no tiene materias previas registradas.
          </td>
        </tr>
      `;
    } else {
      let tbodyInferior = '';
      items.forEach((item, idx) => {
        const id = item.id || `prev_${idx}`;
        const tipo = item.c1 || item.tipo || 'Previa';
        const cursoOrigen = item.curso_origen || item.cursoOrigen || item.c2 || '1° Año';
        const materia = item.c3 || item.materia || item.nombre_materia || 'Materia';
        const estado = item.c4 || item.estado || 'Pendiente';
        const fechaAprobacion = item.fecha_aprobacion || null;
        const fechaTurno = item.fecha || '';
        const calif = (item.calificacion !== null && item.calificacion !== undefined && item.calificacion !== '')
          ? item.calificacion
          : '-';

        const esAprobada = estado.toLowerCase().includes('aprob') || estado.toLowerCase().includes('acredit');
        const esEnCurso = estado.toLowerCase().includes('curs') || estado.toLowerCase().includes('intensi');

        let badgeEstado = '';
        if (esAprobada) {
          badgeEstado = `
            <span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Aprobada</span>
            ${fechaAprobacion ? `<div style="font-size: 0.72rem; color: #86efac; font-weight: 600; margin-top: 0.25rem;"><i class="fa-solid fa-calendar-check"></i> Aprobó: ${fechaAprobacion}</div>` : ''}
          `;
        } else if (esEnCurso) {
          badgeEstado = `
            <span class="badge badge-blue"><i class="fa-solid fa-spinner"></i> En Cursada</span>
          `;
        } else {
          badgeEstado = `
            <span class="badge badge-amber"><i class="fa-solid fa-clock"></i> Pendiente</span>
            ${(fechaTurno && fechaTurno !== cursoOrigen) ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.25rem;"><i class="fa-regular fa-calendar"></i> ${fechaTurno}</div>` : ''}
          `;
        }

        let badgeCalif = '<span style="color: var(--text-muted);">-</span>';
        if (calif !== '-') {
          const num = Number(calif);
          if (!isNaN(num)) {
            badgeCalif = `<span class="badge ${num >= 6 ? 'badge-green' : 'badge-red'}" style="font-weight: 700;">${num}</span>`;
          } else {
            badgeCalif = `<span class="badge badge-blue" style="font-weight: 700;">${calif}</span>`;
          }
        }

        tbodyInferior += `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
            <td><span class="badge badge-purple">${tipo}</span></td>
            <td style="color: var(--text-muted);">${cursoOrigen}</td>
            <td class="text-white" style="font-weight: 600;">${materia}</td>
            <td style="text-align: center;">${badgeCalif}</td>
            <td style="text-align: center;">${badgeEstado}</td>
            ${esPreceptor ? `
              <td style="text-align: center; white-space: nowrap;">
                <div style="display: flex; gap: 0.45rem; justify-content: center; align-items: center;">
                  <button type="button" class="btn-action-icon btn-action-edit" title="Editar / Calificar previa" onclick="editarPreviaModal('${id}')">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  <button type="button" class="btn-action-icon btn-action-delete" title="Eliminar previa" onclick="abrirModalConfirmarBorrarPrevia('${id}')">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </td>
            ` : ''}
          </tr>
        `;
      });
      tbodyInfEl.innerHTML = tbodyInferior;
    }
  }
}

// Función para garantizar que tutorPanelBoletin esté ubicado en su contenedor correcto según el rol activo
function asegurarUbicacionBoletin() {
  const vistaTutor = document.getElementById('vistaTutor');
  const panelBoletin = document.getElementById('tutorPanelBoletin');
  const contenedorPreview = document.getElementById('contenedorBoletinPreview');
  if (!panelBoletin) return;

  if (rolActual === 'tutor') {
    // Si el rol es tutor o alumno, el boletín SIEMPRE debe estar en vistaTutor como primer elemento
    if (vistaTutor && !vistaTutor.contains(panelBoletin)) {
      vistaTutor.insertBefore(panelBoletin, vistaTutor.firstElementChild);
    }
    if (pestanaTutorActiva === 'boletin') {
      panelBoletin.style.display = 'block';
    }
  } else if (rolActual === 'preceptor') {
    // Si el rol es preceptor y está en la pestaña boletín, se ubica en contenedorBoletinPreview
    const panBol = document.getElementById('preceptorPanelBoletin');
    if (panBol && panBol.style.display !== 'none' && contenedorPreview) {
      if (!contenedorPreview.contains(panelBoletin)) {
        contenedorPreview.innerHTML = '';
        contenedorPreview.appendChild(panelBoletin);
      }
      panelBoletin.style.display = 'block';
    }
  }
}

// 3. Roles y Jurisdicción
function cambiarRol(nuevoRol) {
  rolActual = nuevoRol === 'preceptor' ? 'preceptor' : 'tutor';
  if (typeof usuarioSesion !== 'undefined' && usuarioSesion) {
    if (nuevoRol === 'preceptor') {
      usuarioSesion.rol = 'preceptor';
      if (usuarioSesion.metodo !== 'google') {
        usuarioSesion.nombre = 'Prof. Daniel Martínez';
        usuarioSesion.email = 'preceptor@escuela.edu.ar';
        usuarioSesion.avatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100';
      }
    } else {
      const tipo = obtenerTipoUsuarioSesion(usuarioSesion);
      usuarioSesion.rol = (tipo === 'estudiante') ? 'estudiante' : 'padre';
      const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
        ? DB_ESCOLAR.configuracion.jurisdiccion
        : ((datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ? 'pba' : 'formosa');
      const esPba = (jurisActiva === 'pba');

      // Un solo alumno oficial por escuela para tutor y estudiante
      alumnoActivoDni = esPba ? '48763736' : '34567890';
      cursoActivoId = esPba ? 'pba-4-u' : '2-3';
      usuarioSesion.alumnoDni = alumnoActivoDni;

      if (tipo === 'padre') {
        usuarioSesion.nombre = esPba ? 'PLEININGER, CRISTIAN' : 'Pedro Gómez';
        usuarioSesion.email = esPba ? 'cristian@gmail.com' : 'pedro@gmail.com';
        usuarioSesion.avatar = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
      } else if (tipo === 'estudiante' && !(usuarioSesion.es_google_cuenta && usuarioSesion.en_padron === false)) {
        usuarioSesion.nombre = esPba ? 'PLEININGER, URIEL LUCIANO' : 'Mateo Gómez';
        usuarioSesion.email = esPba ? 'uriel.pleininger@escuela.edu.ar' : 'mateo.gomez@escuela.edu.ar';
        usuarioSesion.avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
      }
    }
    localStorage.setItem('boletin_usuario', JSON.stringify(usuarioSesion));
    actualizarHeaderUsuario();
  }
  const btnTutor = document.getElementById('btnRolTutor');
  const btnPreceptor = document.getElementById('btnRolPreceptor');
  if (btnTutor) btnTutor.classList.toggle('active', rolActual === 'tutor');
  if (btnPreceptor) btnPreceptor.classList.toggle('active', rolActual === 'preceptor');

  if (rolActual === 'tutor') {
    asegurarUbicacionBoletin();
  }

  if (typeof sincronizarSesionYAlumno === 'function') {
    sincronizarSesionYAlumno();
  }
  renderizarPortal(datosMemoria);
}


// 9. GESTIÓN DE SESIÓN EN PORTAL Y USUARIO
let usuarioSesion = {
  nombre: 'Mateo Gómez',
  email: 'mateo.gomez@escuela.edu.ar',
  rol: 'estudiante',
  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
  metodo: 'google'
};

// Resuelve con precisión si el usuario es: 'estudiante', 'padre' o 'preceptor'
function obtenerTipoUsuarioSesion(usuario = usuarioSesion) {
  if (!usuario) return 'padre';
  const rol = (usuario.rol || '').toLowerCase().trim();
  const email = (usuario.email || '').toLowerCase().trim();
  const nombre = (usuario.nombre || '').toLowerCase().trim();

  // 1. Institucional: Preceptor / Docente / Administrador
  if (
    rol === 'preceptor' ||
    rol === 'docente' ||
    rol === 'administrador' ||
    rol === 'admin' ||
    email.includes('preceptor@escuela.edu.ar') ||
    email === 'preceptor' ||
    nombre.includes('prof. daniel martínez')
  ) {
    return 'preceptor';
  }

  // 2. Estudiante / Alumno: priorizar rol explícito (importante para cuentas Google abiertas)
  if (rol === 'estudiante' || rol === 'alumno') {
    return 'estudiante';
  }

  // 3. Padre / Tutor (Familia)
  if (
    rol === 'padre' ||
    rol === 'tutor' ||
    rol === 'familia' ||
    email === 'pedro@gmail.com' ||
    email === 'cristian@gmail.com' ||
    email.includes('pedro.gomez') ||
    email.includes('cristian.pleininger') ||
    email.includes('tutor') ||
    email.includes('padre')
  ) {
    return 'padre';
  }

  // 4. Heurísticas de respaldo por correo / nombre si no vino un rol explícito
  if (
    email.includes('estudiante') ||
    email.includes('alumno') ||
    email.includes('mateo.gomez') ||
    email.includes('uriel.pleininger') ||
    nombre.includes('mateo') ||
    nombre.includes('uriel') ||
    nombre.includes('estudiante') ||
    nombre.includes('alumno')
  ) {
    return 'estudiante';
  }

  // 5. Por defecto: Tutor/a
  return 'padre';
}

function inicializarSesionPortal() {
  const guardado = localStorage.getItem('boletin_usuario');
  if (guardado) {
    try {
      usuarioSesion = JSON.parse(guardado);
    } catch (e) {
      console.warn("Error leyendo sesión:", e);
    }
  }

  const tipo = obtenerTipoUsuarioSesion(usuarioSesion);
  rolActual = tipo === 'preceptor' ? 'preceptor' : 'tutor';

  if (rolActual === 'tutor' && usuarioSesion) {
    // Sincronizar la institución activa automáticamente según la sede del estudiante o hijo vinculado 1-a-1
    const jurisUsuario = (usuarioSesion.jurisdiccion || '').toLowerCase();
    const idInstUsuario = Number(usuarioSesion.id_institucion || 0);
    const esPba = (jurisUsuario === 'pba' || idInstUsuario === 2);

    if (DB_ESCOLAR && DB_ESCOLAR.instituciones) {
      const instTargetId = esPba ? 'inst-pba' : 'inst-formosa';
      const instObj = DB_ESCOLAR.instituciones.find(i => i.id === instTargetId);
      if (instObj) {
        DB_ESCOLAR.institucionActivaId = instObj.id;
        DB_ESCOLAR.configuracion = instObj;
        guardarBaseDatosEscolar();
      }
    }

    const dniVinc = usuarioSesion.alumnoDni || usuarioSesion.alumno_dni || (usuarioSesion.hijo && usuarioSesion.hijo.dni) || '';
    alumnoActivoDni = dniVinc ? String(dniVinc) : (esPba ? '48763736' : '34567890');
    usuarioSesion.alumnoDni = alumnoActivoDni;
    cursoActivoId = esPba ? 'pba-4-u' : '2-3';
    localStorage.setItem('boletin_usuario', JSON.stringify(usuarioSesion));
  }

  actualizarHeaderUsuario();

  // Sincronizar botones de perfil en el panel selector si existen
  const btnTutor = document.getElementById('btnRolTutor');
  const btnPreceptor = document.getElementById('btnRolPreceptor');
  if (btnTutor) btnTutor.classList.toggle('active', rolActual === 'tutor');
  if (btnPreceptor) btnPreceptor.classList.toggle('active', rolActual === 'preceptor');

  let etiquetaRol = 'Tutor/a';
  const r = (usuarioSesion.rol || '').toLowerCase();
  if (r === 'administrador' || r === 'admin') etiquetaRol = 'Administrador';
  else if (r === 'docente') etiquetaRol = 'Docente';
  else if (tipo === 'preceptor') etiquetaRol = 'Preceptor/a';
  else if (tipo === 'estudiante') etiquetaRol = (r === 'alumno') ? 'Alumno' : 'Estudiante';

  mostrarToast(`¡Bienvenido/a, ${usuarioSesion.nombre || 'Usuario'}! Has ingresado como ${etiquetaRol}.`, 'success');
}

function actualizarHeaderUsuario() {
  const nombreEl = document.getElementById('headerUserNombre');
  const badgeEl = document.getElementById('headerUserBadge');
  const avatarInner = document.getElementById('headerAvatarInner');

  const dropNameEl = document.getElementById('dropdownUserName');
  const dropEmailEl = document.getElementById('dropdownUserEmail');
  const dropBadgeEl = document.getElementById('dropdownUserBadge');
  const dropAvatar = document.getElementById('dropdownAvatar');

  const tipo = obtenerTipoUsuarioSesion(usuarioSesion);
  const r = (usuarioSesion.rol || '').toLowerCase();

  // Configuración estilizada y formal para cada tipo de cuenta
  let configRol = {
    tipo: 'padre',
    headerBadge: 'Tutor/a',
    headerClass: 'badge-blue',
    dropdownBadge: 'Tutor/a (Seguimiento Académico)',
    dropdownClass: 'badge-blue',
    avatarBorder: '#38bdf8',
    icon: 'fa-user-group',
    iconColor: '#38bdf8'
  };

  if (r === 'administrador' || r === 'admin') {
    configRol = {
      tipo: 'preceptor',
      headerBadge: 'Administrador',
      headerClass: 'badge-purple',
      dropdownBadge: 'Administrador (Gestión Institucional)',
      dropdownClass: 'badge-purple',
      avatarBorder: '#a855f7',
      icon: 'fa-user-shield',
      iconColor: '#a855f7'
    };
  } else if (r === 'docente') {
    configRol = {
      tipo: 'preceptor',
      headerBadge: 'Docente',
      headerClass: 'badge-amber',
      dropdownBadge: 'Docente de Cátedra (Carga de Calificaciones)',
      dropdownClass: 'badge-amber',
      avatarBorder: '#f59e0b',
      icon: 'fa-chalkboard-user',
      iconColor: '#f59e0b'
    };
  } else if (tipo === 'preceptor') {
    configRol = {
      tipo: 'preceptor',
      headerBadge: 'Preceptor/a',
      headerClass: 'badge-amber',
      dropdownBadge: 'Preceptor/a (Gestión y Asistencias)',
      dropdownClass: 'badge-amber',
      avatarBorder: '#fbbf24',
      icon: 'fa-clipboard-user',
      iconColor: '#fbbf24'
    };
  } else if (tipo === 'estudiante') {
    configRol = {
      tipo: 'estudiante',
      headerBadge: (r === 'alumno') ? 'Alumno' : 'Estudiante',
      headerClass: 'badge-green',
      dropdownBadge: (r === 'alumno') ? 'Alumno (Consulta Oficial y Mesas)' : 'Estudiante (Consulta Oficial y Mesas)',
      dropdownClass: 'badge-green',
      avatarBorder: '#4ade80',
      icon: 'fa-graduation-cap',
      iconColor: '#4ade80'
    };
  }

  if (nombreEl) nombreEl.textContent = usuarioSesion.nombre || 'Usuario';
  if (badgeEl) {
    badgeEl.textContent = configRol.headerBadge;
    badgeEl.className = `badge header-user-badge ${configRol.headerClass}`;
  }

  if (avatarInner) {
    if (usuarioSesion.avatar) {
      avatarInner.innerHTML = `<img src="${usuarioSesion.avatar}" alt="Avatar" style="width:100%; height:100%; object-fit:cover; border-radius:50%; border: 2px solid ${configRol.avatarBorder};">`;
    } else {
      avatarInner.innerHTML = `<i class="fa-solid ${configRol.icon}" style="color: ${configRol.iconColor}; font-size: 1.1rem;"></i>`;
    }
  }

  if (dropNameEl) dropNameEl.textContent = usuarioSesion.nombre || 'Usuario';
  if (dropEmailEl) dropEmailEl.textContent = usuarioSesion.email || 'correo@ejemplo.com';
  if (dropBadgeEl) {
    dropBadgeEl.textContent = configRol.dropdownBadge;
    dropBadgeEl.className = `badge ${configRol.dropdownClass}`;
  }
  if (dropAvatar) {
    dropAvatar.style.borderColor = configRol.avatarBorder;
    if (usuarioSesion.avatar) {
      dropAvatar.innerHTML = `<img src="${usuarioSesion.avatar}" alt="Avatar">`;
    } else {
      dropAvatar.innerHTML = `<i class="fa-solid ${configRol.icon}" style="color: ${configRol.iconColor};"></i>`;
    }
  }
}

// Dropdown del Usuario
function toggleUserDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('userDropdownMenu');
  if (!dropdown) return;
  const estaVisible = dropdown.style.display === 'block';
  dropdown.style.display = estaVisible ? 'none' : 'block';
}

function cerrarUserDropdown() {
  const dropdown = document.getElementById('userDropdownMenu');
  if (dropdown) dropdown.style.display = 'none';
}

document.addEventListener('click', function (e) {
  const userProfile = document.getElementById('userProfileTrigger');
  const dropdown = document.getElementById('userDropdownMenu');
  if (dropdown && dropdown.style.display === 'block') {
    if (!userProfile || !userProfile.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  }
});

function cerrarSesionUsuario() {
  localStorage.removeItem('boletin_sesion_activa');
  localStorage.removeItem('boletin_usuario');
  localStorage.removeItem('boletin_token');
  window.location.href = 'index.html?logout=true';
}

function cambiarPerfilEstudianteTutor() {
  if (usuarioSesion && usuarioSesion.email) {
    localStorage.removeItem('boletin_perfil_' + usuarioSesion.email.toLowerCase().trim());
  }
  localStorage.removeItem('boletin_sesion_activa');
  localStorage.removeItem('boletin_usuario');
  localStorage.removeItem('boletin_token');
  window.location.href = 'index.html?cambiar_perfil=true';
}

function cambiarUsuarioVolverLogin() {
  window.location.href = 'index.html';
}

// Toast Flotante
let toastTimer = null;
function mostrarToast(mensaje, tipo = 'info') {
  const toast = document.getElementById('toastNotification');
  const icon = document.getElementById('toastIcon');
  const msg = document.getElementById('toastMsg');
  if (!toast) return;

  clearTimeout(toastTimer);
  toast.className = `toast-notification toast-${tipo} show`;
  if (msg) msg.textContent = mensaje;

  if (icon) {
    if (tipo === 'success') {
      icon.className = 'fa-solid fa-circle-check';
    } else if (tipo === 'warning') {
      icon.className = 'fa-solid fa-triangle-exclamation';
    } else {
      icon.className = 'fa-solid fa-circle-info';
    }
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 4000);
}

// 10. MULTI-INSTITUCIÓN Y MULTI-CURSO
// Catálogo inicial de Escuelas
const SEED_INSTITUCIONES = [
  {
    id: "inst-formosa",
    nombre: "EPES N° 19 Vuelta de Obligado",
    cue: "3400124-00",
    subtitulo: "Delegación Zonal Pilcomayo | Laguna Naineck | Ciclo Lectivo 2026",
    jurisdiccion: "formosa",
    regimen: "Secundaria 3 Trimestres con PAIR",
    nivel: "Secundario",
    configurado: true
  },
  {
    id: "inst-pba",
    nombre: "E.E.S. N° 5",
    cue: "0604123-00",
    subtitulo: "Distrito: PUAN | Nivel Secundario | Ciclo Lectivo 2026",
    jurisdiccion: "pba",
    regimen: "Secundaria Cuatrimestral (R.I.T.E.)",
    nivel: "Secundario",
    configurado: true
  }
];

// Base de Datos Escolar Inicial (Semilla)
const SEED_DB_ESCOLAR = {
  instituciones: JSON.parse(JSON.stringify(SEED_INSTITUCIONES)),
  institucionActivaId: "inst-formosa",
  configuracion: {
    nombre: "EPES N° 19 Vuelta de Obligado",
    cue: "3400124-00",
    subtitulo: "Delegación Zonal Pilcomayo | Laguna Naineck | Ciclo Lectivo 2026",
    jurisdiccion: "formosa", // 'formosa' o 'pba'
    nivel: "Secundario"
  },
  cursos: [
    // --- EPES N° 19 Vuelta de Obligado (Formosa) ---
    // Ciclo Básico Formosa
    { id: "1-1", nombre: "1° I", turno: "Turno Mañana", ciclo: "basico", anio: 1, division: "I", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "1-2", nombre: "1° II", turno: "Turno Tarde", ciclo: "basico", anio: 1, division: "II", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "1-3", nombre: "1° III", turno: "Turno Mañana", ciclo: "basico", anio: 1, division: "III", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "2-1", nombre: "2° I", turno: "Turno Mañana", ciclo: "basico", anio: 2, division: "I", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "2-2", nombre: "2° II", turno: "Turno Tarde", ciclo: "basico", anio: 2, division: "II", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "2-3", nombre: "2° III", turno: "Turno Mañana", ciclo: "basico", anio: 2, division: "III", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "3-1", nombre: "3° I", turno: "Turno Mañana", ciclo: "basico", anio: 3, division: "I", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "3-2", nombre: "3° II", turno: "Turno Tarde", ciclo: "basico", anio: 3, division: "II", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },
    { id: "3-3", nombre: "3° III", turno: "Turno Mañana", ciclo: "basico", anio: 3, division: "III", orientacion: "Ciclo Básico", institucionId: "inst-formosa" },

    // Ciclo Orientado - Ciencias Naturales Formosa
    { id: "4-cn-1", nombre: "4° I", turno: "Turno Mañana", ciclo: "orientado", anio: 4, division: "I", orientacion: "Ciencias Naturales", institucionId: "inst-formosa" },
    { id: "4-cn-2", nombre: "4° II", turno: "Turno Tarde", ciclo: "orientado", anio: 4, division: "II", orientacion: "Ciencias Naturales", institucionId: "inst-formosa" },
    { id: "5-cn-1", nombre: "5° I", turno: "Turno Mañana", ciclo: "orientado", anio: 5, division: "I", orientacion: "Ciencias Naturales", institucionId: "inst-formosa" },
    { id: "5-cn-2", nombre: "5° II", turno: "Turno Tarde", ciclo: "orientado", anio: 5, division: "II", orientacion: "Ciencias Naturales", institucionId: "inst-formosa" },
    { id: "6-cn-1", nombre: "6° I", turno: "Turno Tarde", ciclo: "orientado", anio: 6, division: "I", orientacion: "Ciencias Naturales", institucionId: "inst-formosa" },

    // Ciclo Orientado - Ciencias Sociales Formosa
    { id: "4-cs-1", nombre: "4° I", turno: "Turno Mañana", ciclo: "orientado", anio: 4, division: "I", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },
    { id: "4-cs-2", nombre: "4° II", turno: "Turno Tarde", ciclo: "orientado", anio: 4, division: "II", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },
    { id: "5-cs-1", nombre: "5° I", turno: "Turno Mañana", ciclo: "orientado", anio: 5, division: "I", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },
    { id: "5-cs-2", nombre: "5° II", turno: "Turno Tarde", ciclo: "orientado", anio: 5, division: "II", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },
    { id: "6-cs-1", nombre: "6° I", turno: "Turno Mañana", ciclo: "orientado", anio: 6, division: "I", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },
    { id: "6-cs-2", nombre: "6° II", turno: "Turno Tarde", ciclo: "orientado", anio: 6, division: "II", orientacion: "Ciencias Sociales", institucionId: "inst-formosa" },

    // --- E.E.S. N° 5 (Buenos Aires - R.I.T.E.) ---
    { id: "pba-1-u", nombre: "1° Única", turno: "Turno Mañana", ciclo: "basico", anio: 1, division: "Única", orientacion: "Ciclo Básico", institucionId: "inst-pba" },
    { id: "pba-2-u", nombre: "2° Única", turno: "Turno Mañana", ciclo: "basico", anio: 2, division: "Única", orientacion: "Ciclo Básico", institucionId: "inst-pba" },
    { id: "pba-3-u", nombre: "3° Única", turno: "Turno Mañana", ciclo: "basico", anio: 3, division: "Única", orientacion: "Ciclo Básico", institucionId: "inst-pba" },
    { id: "pba-4-u", nombre: "4° Única", turno: "Turno Mañana", ciclo: "orientado", anio: 4, division: "Única", orientacion: "Ciencias Sociales", institucionId: "inst-pba" },
    { id: "pba-5-u", nombre: "5° Única", turno: "Turno Mañana", ciclo: "orientado", anio: 5, division: "Única", orientacion: "Ciencias Sociales", institucionId: "inst-pba" },
    { id: "pba-6-u", nombre: "6° Única", turno: "Turno Mañana", ciclo: "orientado", anio: 6, division: "Única", orientacion: "Ciencias Sociales", institucionId: "inst-pba" }
  ],
  planillasGuardadas: [],
  alumnos: [
    {
      dni: "34567890",
      nombre: "GÓMEZ, MATEO",
      cursoId: "2-3",
      curso: "2° III",
      emailAlumno: "mateo.gomez@escuela.edu.ar",
      tutor: "Gómez Pedro",
      dniTutor: "20123456",
      emailTutor: "pedro@gmail.com",
      asistencia: "Días Hábiles: 96 • Inasistencias: 0",
      diasHabiles: 96,
      totalAsistencias: 96,
      totalInasistencias: 0,
      justificadas: 0,
      institucionId: "inst-formosa",
      jurisdiccion: "formosa",
      notasFormosa: {},
      notasPba: {}
    },
    {
      dni: "48763736",
      nombre: "PLEININGER, URIEL LUCIANO",
      cursoId: "pba-4-u",
      curso: "4° Única",
      emailAlumno: "uriel.pleininger@escuela.edu.ar",
      tutor: "PLEININGER, CRISTIAN",
      dniTutor: "24876373",
      emailTutor: "cristian@gmail.com",
      asistencia: "Días Hábiles: 82 • Inasistencias: 17",
      diasHabiles: 82,
      totalAsistencias: 65,
      totalInasistencias: 17,
      justificadas: 0,
      institucionId: "inst-pba",
      jurisdiccion: "pba",
      notasFormosa: {},
      notasPba: {}
    }
  ],
  mesasExamen: [
    {
      id: "mesa-1",
      materia: "Matemática",
      ciclo: "basico",
      mes: "Diciembre",
      docentes: "Prof. Ramírez, Prof. Gómez",
      fecha: "2026-12-14",
      hora: "08:00",
      turno: "Turno Diciembre 2026",
      estado: "abierta",
      institucionId: "inst-formosa",
      inscriptos: [
        { dni: "34567890", nombre: "GÓMEZ, MATEO", curso: "2° III", condicion: "Regular", fechaInscripcion: "12/10/2026 14:30" }
      ]
    },
    {
      id: "mesa-2",
      materia: "Lenguas Extranjeras (Inglés)",
      ciclo: "basico",
      mes: "Diciembre",
      docentes: "Prof. Martínez, Prof. Benítez",
      fecha: "2026-12-16",
      hora: "10:30",
      turno: "Turno Diciembre 2026",
      estado: "abierta",
      institucionId: "inst-formosa",
      inscriptos: [
        { dni: "34567890", nombre: "GÓMEZ, MATEO", curso: "2° III", condicion: "Regular", fechaInscripcion: "14/10/2026 11:20" }
      ]
    },
    {
      id: "mesa-3",
      materia: "Físico - Química",
      ciclo: "basico",
      mes: "Diciembre",
      docentes: "Prof. Herrera, Prof. Delgado",
      fecha: "2026-12-18",
      hora: "08:30",
      turno: "Turno Diciembre 2026",
      estado: "abierta",
      institucionId: "inst-formosa",
      inscriptos: []
    },
    {
      id: "mesa-pba-1",
      materia: "Geografía",
      ciclo: "orientado",
      mes: "Diciembre",
      docentes: "Prof. Domínguez, Prof. Morales",
      fecha: "2026-12-15",
      hora: "08:00",
      turno: "Turno Diciembre 2026",
      estado: "abierta",
      institucionId: "inst-pba",
      inscriptos: [
        { dni: "48763736", nombre: "PLEININGER, URIEL LUCIANO", curso: "4° Única", condicion: "Regular", fechaInscripcion: "11/10/2026 09:30" }
      ]
    },
    {
      id: "mesa-pba-2",
      materia: "Físico-Química",
      ciclo: "orientado",
      mes: "Diciembre",
      docentes: "Prof. Rossi, Prof. Delgado",
      fecha: "2026-12-18",
      hora: "10:00",
      turno: "Turno Diciembre 2026",
      estado: "abierta",
      institucionId: "inst-pba",
      inscriptos: [
        { dni: "48763736", nombre: "PLEININGER, URIEL LUCIANO", curso: "4° Única", condicion: "Regular", fechaInscripcion: "12/10/2026 10:15" }
      ]
    },
    {
      id: "mesa-pba-3",
      materia: "Literatura",
      ciclo: "orientado",
      mes: "Febrero / Marzo",
      docentes: "Prof. Soria, Prof. Benítez",
      fecha: "2027-02-23",
      hora: "09:00",
      turno: "Turno Febrero / Marzo 2027",
      estado: "abierta",
      institucionId: "inst-pba",
      inscriptos: []
    }
  ],
  notificaciones: [
    {
      id: "notif-1",
      titulo: "Cierre de Calificaciones y Descarga del Reporte Digital",
      categoria: "Boletines y Calificaciones",
      prioridad: "normal",
      color: "#38bdf8",
      fecha: "10/10/2026",
      emisor: "Dirección EPES N° 19",
      destinatario: "Todos los Cursos y Familias - EPES N° 19",
      contenido: "Estimados tutores: Ya se encuentran registradas y visadas las calificaciones del presente período lectivo. Pueden acceder a la pestaña Boletín Oficial para consultar notas o descargar PDF.",
      estado: "activa",
      institucionId: "inst-formosa"
    },
    {
      id: "notif-2",
      titulo: "Convocatoria a Encuentro de Familias y Diálogo Pedagógico",
      categoria: "Reunión de Familias",
      prioridad: "alta",
      color: "#22c55e",
      fecha: "24/10/2026",
      emisor: "Preceptoría EPES N° 19",
      destinatario: "Familias EPES N° 19 (Laguna Naineck)",
      contenido: "Invitamos a las familias a la reunión presencial de seguimiento pedagógico en el SUM de la EPES N° 19 Vuelta de Obligado.",
      estado: "activa",
      institucionId: "inst-formosa"
    },
    {
      id: "notif-3",
      titulo: "Canales de Contacto y Horarios de Atención Institucional",
      categoria: "Atención y Preceptoría",
      prioridad: "normal",
      color: "#fbbf24",
      fecha: "12/10/2026",
      emisor: "Secretaría EPES N° 19",
      destinatario: "Comunidad Educativa EPES N° 19",
      contenido: "Recordamos que el horario de atención para consultas y trámites de reincorporación es de 07:30 a 12:30 hs (Mañana) y 13:00 a 18:00 hs (Tarde).",
      estado: "activa",
      institucionId: "inst-formosa"
    },

    {
      id: "notif-pba-1",
      titulo: "Publicación de Valoraciones R.I.T.E. - 1° Cuatrimestre",
      categoria: "Boletines y Calificaciones",
      prioridad: "normal",
      color: "#38bdf8",
      fecha: "11/10/2026",
      emisor: "Dirección E.E.S. N° 5",
      destinatario: "Familias y Estudiantes E.E.S. N° 5",
      contenido: "Se encuentran publicadas en la plataforma las valoraciones pedagógicas del 1° Cuatrimestre (TEA, TEP, TED) según normativa vigente de la DGCyE de la Provincia de Buenos Aires.",
      estado: "activa",
      institucionId: "inst-pba"
    },
    {
      id: "notif-pba-2",
      titulo: "Acompañamiento e Intensificación de Aprendizajes R.I.T.E.",
      categoria: "Mesas de Examen",
      prioridad: "alta",
      color: "#22c55e",
      fecha: "20/10/2026",
      emisor: "Preceptoría E.E.S. N° 5",
      destinatario: "Estudiantes con Trayectorias en Proceso (TEP / TED)",
      contenido: "Informamos las fechas del período de intensificación y compensación pedagógica para materias previas y pendientes en la E.E.S. N° 5 Distrito PUAN.",
      estado: "activa",
      institucionId: "inst-pba"
    },
    {
      id: "notif-pba-3",
      titulo: "Atención a Familias y Trámites Administrativos",
      categoria: "Atención y Preceptoría",
      prioridad: "normal",
      color: "#fbbf24",
      fecha: "14/10/2026",
      emisor: "Secretaría E.E.S. N° 5",
      destinatario: "Familias E.E.S. N° 5",
      contenido: "El equipo de preceptoría atenderá consultas presenciales y constancias de alumno regular de lunes a viernes en el turno mañana.",
      estado: "activa",
      institucionId: "inst-pba"
    }
  ]
};

let DB_ESCOLAR = null;
let cursoActivoId = '2-3';
let alumnoActivoDni = '34567890';

// Inicializar la Base de Datos Escolar desde LocalStorage
function initBaseDatosEscolar() {
  const guardado = localStorage.getItem('boletin_db_escolar_v1');
  if (guardado) {
    try {
      DB_ESCOLAR = JSON.parse(guardado);
      // Mantener exclusivamente las 2 escuelas oficiales: Formosa y Buenos Aires
      DB_ESCOLAR.instituciones = JSON.parse(JSON.stringify(SEED_INSTITUCIONES));
      if (!DB_ESCOLAR.institucionActivaId || !DB_ESCOLAR.instituciones.some(i => i.id === DB_ESCOLAR.institucionActivaId)) {
        DB_ESCOLAR.institucionActivaId = DB_ESCOLAR.instituciones[0].id;
      }
      if (!DB_ESCOLAR.configuracion || !DB_ESCOLAR.instituciones.some(i => i.id === DB_ESCOLAR.configuracion.id)) {
        DB_ESCOLAR.configuracion = DB_ESCOLAR.instituciones.find(i => i.id === DB_ESCOLAR.institucionActivaId) || DB_ESCOLAR.instituciones[0];
      }

      // Sincronizar catálogo estructurado de los cursos para ambas escuelas
      DB_ESCOLAR.cursos = JSON.parse(JSON.stringify(SEED_DB_ESCOLAR.cursos));

      // Sincronizar mesas de examen iniciales si no existen o normalizar existentes
      if (!DB_ESCOLAR.mesasExamen || DB_ESCOLAR.mesasExamen.length === 0) {
        DB_ESCOLAR.mesasExamen = JSON.parse(JSON.stringify(SEED_DB_ESCOLAR.mesasExamen));
      } else {
        // Normalizar mesas existentes y asegurar institucionId
        DB_ESCOLAR.mesasExamen.forEach(m => {
          if (!m.institucionId) {
            m.institucionId = (m.id && m.id.includes('pba')) ? 'inst-pba' : 'inst-formosa';
          }
          if (!m.mes) {
            m.mes = (m.fecha && m.fecha.includes('-02')) ? 'Febrero / Marzo' : 'Diciembre';
          }
          delete m.aula;
          delete m.cupoMaximo;
          if (m.inscriptos) {
            m.inscriptos.forEach(i => {
              if (!i.condicion) i.condicion = 'Regular';
              if (i.dni === '52646047') {
                i.dni = '34567890';
                i.nombre = 'GÓMEZ, MATEO';
              }
            });
          }
        });
        (SEED_DB_ESCOLAR.mesasExamen || []).forEach(seedMesa => {
          if (!DB_ESCOLAR.mesasExamen.some(m => m.id === seedMesa.id)) {
            DB_ESCOLAR.mesasExamen.push(JSON.parse(JSON.stringify(seedMesa)));
          }
        });
      }

      // Sincronizar notificaciones institucionales si no existen o asegurar asignación
      if (!DB_ESCOLAR.notificaciones || DB_ESCOLAR.notificaciones.length === 0) {
        DB_ESCOLAR.notificaciones = JSON.parse(JSON.stringify(SEED_DB_ESCOLAR.notificaciones));
      } else {
        DB_ESCOLAR.notificaciones.forEach(n => {
          if (!n.institucionId) {
            n.institucionId = (n.id && n.id.includes('pba')) ? 'inst-pba' : 'inst-formosa';
          }
        });
        (SEED_DB_ESCOLAR.notificaciones || []).forEach(seedNotif => {
          if (!DB_ESCOLAR.notificaciones.some(n => n.id === seedNotif.id)) {
            DB_ESCOLAR.notificaciones.push(JSON.parse(JSON.stringify(seedNotif)));
          }
        });
      }

      // Migrar y limpiar alumnos: remover alumnos de prueba obsoletos
      if (!DB_ESCOLAR.alumnos) DB_ESCOLAR.alumnos = [];
      DB_ESCOLAR.alumnos = DB_ESCOLAR.alumnos.filter(a => a.dni !== '52646047' && a.dni !== '54110291');

      DB_ESCOLAR.alumnos.forEach(alum => {
        // Taggear alumnos a sus respectivas escuelas
        if (alum.dni === '34567890') {
          alum.institucionId = 'inst-formosa';
          alum.jurisdiccion = 'formosa';
          alum.nombre = 'GÓMEZ, MATEO';
          alum.curso = '2° III';
          alum.cursoId = '2-3';
          alum.tutor = 'Gómez Pedro';
          alum.dniTutor = '20123456';
          alum.emailTutor = 'pedro@gmail.com';
          alum.asistencia = 'Días Hábiles: 96 • Inasistencias: 0';
          alum.diasHabiles = 96;
          alum.totalAsistencias = 96;
          alum.totalInasistencias = 0;
          alum.justificadas = 0;
        } else if (alum.dni === '48763736') {
          alum.institucionId = 'inst-pba';
          alum.jurisdiccion = 'pba';
          alum.nombre = 'PLEININGER, URIEL LUCIANO';
          alum.curso = '4° Única';
          alum.cursoId = 'pba-4-u';
          alum.tutor = 'PLEININGER, CRISTIAN';
          alum.dniTutor = '24876373';
          alum.emailTutor = 'cristian@gmail.com';
          alum.asistencia = 'Días Hábiles: 82 • Inasistencias: 17';
          alum.diasHabiles = 82;
          alum.totalAsistencias = 65;
          alum.totalInasistencias = 17;
          alum.justificadas = 0;
        } else if (!alum.institucionId) {
          alum.institucionId = 'inst-formosa';
          alum.jurisdiccion = 'formosa';
        }

        // Mapeo retrocompatible de IDs de cursos anteriores
        if (alum.cursoId === '4-1' || alum.cursoId === '4-cs') alum.cursoId = '4-cs-1';
        if (alum.cursoId === '4-cn') alum.cursoId = '4-cn-1';
        if (alum.cursoId === '5-1' || alum.cursoId === '5-cs') alum.cursoId = '5-cs-1';
        if (alum.cursoId === '5-cn') alum.cursoId = '5-cn-1';
        if (alum.cursoId === '6-1' || alum.cursoId === '6-cs') alum.cursoId = '6-cs-1';
        if (alum.cursoId === '6-cn') alum.cursoId = '6-cn-1';

        // Sincronizar nombre legible del curso desde la tabla de cursos
        const cursoObj = DB_ESCOLAR.cursos.find(c => c.id === alum.cursoId);
        if (cursoObj) alum.curso = cursoObj.nombre;

        // Autocompletar email del alumno si faltaba
        if (!alum.emailAlumno) {
          const partes = (alum.nombre || '').split(',');
          const apellido = (partes[0] || 'alumno').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const nom = (partes[1] || 'est').trim().toLowerCase().split(' ')[0].replace(/[^a-z0-9]/g, '');
          alum.emailAlumno = `${nom}.${apellido}@alumno.edu.ar`;
        }

        // Autocompletar DNI del tutor si faltaba
        if (!alum.dniTutor) {
          alum.dniTutor = '2' + String(alum.dni || '80000000').slice(1);
        }
      });

      // Incorporar alumnos de muestra de la semilla si la lista no los incluye
      SEED_DB_ESCOLAR.alumnos.forEach(seedAlum => {
        if (!DB_ESCOLAR.alumnos.some(a => a.dni === seedAlum.dni)) {
          DB_ESCOLAR.alumnos.push(JSON.parse(JSON.stringify(seedAlum)));
        }
      });

      // Las planillas guardadas se sincronizan automáticamente con las notas existentes en la Base de Datos
      DB_ESCOLAR.planillasGuardadas = [];

      // Sincronizar alumnoActivoDni y cursoActivoId según la institución activa
      if (DB_ESCOLAR.institucionActivaId === 'inst-pba') {
        alumnoActivoDni = '48763736';
        cursoActivoId = 'pba-4-u';
      } else {
        alumnoActivoDni = '34567890';
        cursoActivoId = '2-3';
      }

      guardarBaseDatosEscolar();
    } catch (e) {
      console.warn("Error leyendo DB_ESCOLAR, usando semilla:", e);
      DB_ESCOLAR = JSON.parse(JSON.stringify(SEED_DB_ESCOLAR));
      guardarBaseDatosEscolar();
    }
  } else {
    DB_ESCOLAR = JSON.parse(JSON.stringify(SEED_DB_ESCOLAR));
    guardarBaseDatosEscolar();
  }
}

function guardarBaseDatosEscolar() {
  if (!DB_ESCOLAR) return;
  localStorage.setItem('boletin_db_escolar_v1', JSON.stringify(DB_ESCOLAR));
}

// Obtener exclusivamente los alumnos pertenecientes a la institución escolar activa
function obtenerAlumnosEscuelaActiva() {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return [];
  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
    ? DB_ESCOLAR.configuracion.jurisdiccion
    : "formosa";
  const idInstKey = jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa';

  return DB_ESCOLAR.alumnos.filter(a => {
    if (a.institucionId) return a.institucionId === idInstKey;
    if (a.jurisdiccion) return a.jurisdiccion.toLowerCase() === jurisActiva.toLowerCase();
    return jurisActiva === 'formosa';
  });
}

// Obtener el estudiante activo garantizando que pertenezca a la escuela activa
function obtenerAlumnoActivo() {
  const alumnos = obtenerAlumnosEscuelaActiva();
  if (alumnoActivoDni) {
    const encontrado = alumnos.find(a => String(a.dni) === String(alumnoActivoDni));
    if (encontrado) return encontrado;
  }
  return alumnos.length > 0 ? alumnos[0] : null;
}

// 11. SISTEMA ACADÉMICO: CATÁLOGOS, CICLOS Y JURISDICCIONES 

const CATALOGO_ACADEMICO = {
  formosa: {
    basico: [
      "Lengua y Literatura",
      "Matemática",
      "Geografía",
      "Seminarios o Talleres de Historia",
      "Formación Ética y Compromiso Comunitario",
      "Educación Física",
      "Físico - Química",
      "Biología",
      "Educación Tecnológica",
      "Lengua Extranjera (Inglés)",
      "Educación Artística (Música)",
      "Tutoría: Fortalecimiento del Estudiante"
    ],
    orientado: [
      "Lengua y Literatura",
      "Matemática",
      "Historia",
      "Geografía",
      "Física",
      "Química",
      "Filosofía",
      "Economía",
      "Lengua Extranjera (Inglés)",
      "Educación Física",
      "Tecnologías de la Información y Comunicación"
    ]
  },
  pba: {
    basico: [
      "Prácticas del Lenguaje",
      "Matemática",
      "Ciencias Sociales",
      "Ciencias Naturales",
      "Inglés",
      "Educación Física",
      "Educación Artística",
      "Construcción de Ciudadanía"
    ],
    orientado: [
      "Literatura",
      "Matemática",
      "Historia",
      "Geografía",
      "Introducción a la Física",
      "Biología",
      "Inglés",
      "Educación Física",
      "NTICX",
      "Psicología",
      "Introducción a la Comunicación",
      "Construcción Ciudadana"
    ]
  }
};

const PERIODOS_CATALOGO = {
  formosa: [
    { id: "t1", nombre: "1° Trimestre (Calificación 1-10 + Concepto)" },
    { id: "t2", nombre: "2° Trimestre (Calificación 1-10 + Concepto)" },
    { id: "t3", nombre: "3° Trimestre (Calificación 1-10 + Concepto)" },
    { id: "rec_dic", nombre: "Período Complementario Diciembre" },
    { id: "pair", nombre: "PAIR (Feb / Mar)" }
  ],
  pba: [
    { id: "c1", nombre: "1° Cuatrimestre (RITE: TEA / TEP / TED)" },
    { id: "c2", nombre: "2° Cuatrimestre (RITE: TEA / TEP / TED)" },
    { id: "rit_dic", nombre: "Intensificación Diciembre" },
    { id: "rit_feb", nombre: "Intensificación Febrero / Marzo" }
  ]
};

// Variables de estado del flujo docente
let cicloActivo = 'basico'; // 'basico' o 'orientado'
let cursoSeleccionadoCarga = '2-3';
let materiaSeleccionadaCarga = '';
let periodoSeleccionadoCarga = 't1';

// Vincular automáticamente el usuario logueado con su rol y vista
function sincronizarSesionYAlumno() {
  initBaseDatosEscolar();
  poblarSelectorEscuelas();

  const esPreceptor = rolActual === 'preceptor';
  const vistaPreceptor = document.getElementById('vistaPreceptor');
  const vistaTutor = document.getElementById('vistaTutor');
  const navLinksPreceptor = document.getElementById('navLinksPreceptor');
  const navLinksTutor = document.getElementById('navLinksTutor');

  if (esPreceptor) {
    // MODO DOCENTE / PRECEPTOR:
    // Nunca mostrar el boletín de un alumno individual en pantalla de inicio.
    if (vistaPreceptor) vistaPreceptor.style.display = 'block';
    if (vistaTutor) vistaTutor.style.display = 'none';
    if (navLinksPreceptor) navLinksPreceptor.style.display = 'flex';
    if (navLinksTutor) navLinksTutor.style.display = 'none';

    // Determinar si es un usuario / escuela nueva sin configurar
    const cfg = (DB_ESCOLAR && DB_ESCOLAR.configuracion) ? DB_ESCOLAR.configuracion : {};
    const estaConfigurado = cfg.configurado === true;

    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (!estaConfigurado) {
      // Si entra por primera vez o no guardó la institución, dirigir a pestaña "Institución"
      cambiarPestanaPreceptor('institucion');
      mostrarToast('¡Bienvenido! Por favor completá los datos de tu institución para comenzar.', 'info');
    } else if (hash === 'notificaciones' || hash === 'notificaciones-admin') {
      cambiarPestanaPreceptor('notificaciones');
    } else if (hash === 'mesas' || hash === 'mesas-admin') {
      cambiarPestanaPreceptor('mesas');
    } else if (hash === 'asistencia') {
      cambiarPestanaPreceptor('asistencia');
    } else if (hash === 'alumnos') {
      cambiarPestanaPreceptor('alumnos');
    } else {
      // Si ya está configurada, directo a la carga colectiva por materia
      cambiarPestanaPreceptor('carga');
    }

    actualizarBadgeRegimenPreceptor(cfg.jurisdiccion || 'formosa');
    seleccionarCiclo('basico');
    poblarSelectorPreviewAlumnos();
    poblarSelectorCursosFiltroPadron();
    poblarSelectorCursosAsistencia();
    poblarSelectorPeriodosAsistencia();
    renderizarPadronAlumnos();
    renderizarTarjetasInstituciones();
    renderizarListaPlanillasGuardadas();
  } else {
    // MODO TUTOR / ALUMNO:
    // Exclusivamente para padres y estudiantes. Solo ven el boletín oficial individual.
    if (vistaPreceptor) vistaPreceptor.style.display = 'none';
    if (vistaTutor) vistaTutor.style.display = 'block';
    if (navLinksPreceptor) navLinksPreceptor.style.display = 'none';
    if (navLinksTutor) navLinksTutor.style.display = 'flex';

    asegurarUbicacionBoletin();
    vincularAlumnoTutor();
    cargarAlumnoEnBoletin(alumnoActivoDni).then(() => {
      if (datosMemoria) renderizarPortal(datosMemoria);
    });

    // Respetar hash en la URL o iniciar en 'boletin'
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (hash === 'asistencia' || hash === 'mesas' || hash === 'notificaciones') {
      cambiarPestanaTutor(hash);
    } else {
      cambiarPestanaTutor('boletin');
    }
    renderizarNotificacionesTutor();
  }

  // Limpiar cualquier hash de la URL para mantener la dirección limpia
  if (window.location.hash) {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  }
}

// Vinculación automática 1-a-1 del tutor o estudiante con su boletín asignado
function vincularAlumnoTutor() {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;
  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const esPba = (jurisActiva === 'pba');

  const dniSesion = (typeof usuarioSesion !== 'undefined' && usuarioSesion)
    ? (usuarioSesion.alumnoDni || usuarioSesion.alumno_dni || (usuarioSesion.hijo && usuarioSesion.hijo.dni) || '')
    : '';

  alumnoActivoDni = dniSesion ? String(dniSesion) : (esPba ? '48763736' : '34567890');
  cursoActivoId = esPba ? 'pba-4-u' : '2-3';

  if (typeof usuarioSesion !== 'undefined' && usuarioSesion && !usuarioSesion.alumnoDni) {
    usuarioSesion.alumnoDni = alumnoActivoDni;
    localStorage.setItem('boletin_usuario', JSON.stringify(usuarioSesion));
  }
  actualizarHeaderUsuario();
}

// 12. FLUJO DOCENTE EN CASCADA (CICLO -> CURSO -> MATERIA -> PERÍODO -> ALUMNOS)

// Poblar selector de Cursos en Carga de Calificaciones 
function poblarSelectorCursosCargaDocente() {
  const selCurso = document.getElementById('selectPreceptorCurso');
  if (!selCurso || !DB_ESCOLAR || !DB_ESCOLAR.cursos) return;

  const esBsAs = ((datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') || (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba'));
  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || (esBsAs ? 'inst-pba' : 'inst-formosa'));
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);
  let html = '';

  // Grupo 1: Ciclo Básico (1° a 3° Año)
  const basico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
  if (basico.length > 0) {
    html += `<optgroup label="Ciclo Básico (1° a 3° Año)">`;
    basico.forEach(c => {
      html += `<option value="${c.id}">${c.nombre}</option>`;
    });
    html += `</optgroup>`;
  }

  // Grupo 2: Ciclo Orientado - Orientaciones Dinámicas
  const orientado = cursos.filter(c => c.ciclo === 'orientado');
  const orientacionesMap = {};
  orientado.forEach(c => {
    const ori = c.orientacion || 'Ciclo Orientado';
    if (!orientacionesMap[ori]) orientacionesMap[ori] = [];
    orientacionesMap[ori].push(c);
  });

  Object.keys(orientacionesMap).forEach(oriNombre => {
    html += `<optgroup label="Ciclo Orientado - ${oriNombre} (4° a 6° Año)">`;
    orientacionesMap[oriNombre].forEach(c => {
      html += `<option value="${c.id}">${c.nombre} (${oriNombre})</option>`;
    });
    html += `</optgroup>`;
  });

  selCurso.innerHTML = html;

  const existe = cursos.some(c => c.id === cursoSeleccionadoCarga);
  cursoSeleccionadoCarga = existe ? cursoSeleccionadoCarga : (cursos[0] ? cursos[0].id : (instActiva === 'inst-pba' ? 'pba-4-u' : '2-3'));
  selCurso.value = cursoSeleccionadoCarga;
}

// Actualizar materias correspondientes al curso seleccionado 
function actualizarMateriasSegunCurso(cursoId) {
  const selMateria = document.getElementById('selectPreceptorMateria');
  if (!selMateria || !DB_ESCOLAR || !DB_ESCOLAR.cursos) return;

  const cursoObj = DB_ESCOLAR.cursos.find(c => c.id === cursoId);
  const ciclo = cursoObj ? (cursoObj.ciclo || 'basico') : 'basico';
  cicloActivo = ciclo;

  const jurisdiccion = ((datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') || (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba')) ? 'pba' : 'formosa';
  const catalogo = CATALOGO_ACADEMICO[jurisdiccion] || CATALOGO_ACADEMICO.formosa;
  const materiasCiclo = catalogo[ciclo] || catalogo.basico;

  selMateria.innerHTML = materiasCiclo.map(m => `<option value="${m}">${m}</option>`).join('');

  if (!materiasCiclo.includes(materiaSeleccionadaCarga)) {
    materiaSeleccionadaCarga = materiasCiclo[0] || '';
  }
  selMateria.value = materiaSeleccionadaCarga;
}

// Actualizar períodos de carga según la jurisdicción
function actualizarPeriodosCarga() {
  const selPeriodo = document.getElementById('selectPreceptorPeriodo');
  if (!selPeriodo) return;
  const jurisdiccion = ((datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') || (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba')) ? 'pba' : 'formosa';
  const periodos = PERIODOS_CATALOGO[jurisdiccion] || PERIODOS_CATALOGO.formosa;

  selPeriodo.innerHTML = periodos.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('');
  const existe = periodos.some(p => p.id === periodoSeleccionadoCarga);
  periodoSeleccionadoCarga = existe ? periodoSeleccionadoCarga : (periodos[0] ? periodos[0].id : (jurisdiccion === 'pba' ? 'c1' : 't1'));
  selPeriodo.value = periodoSeleccionadoCarga;
}

function seleccionarCiclo(ciclo) {
  poblarSelectorCursosCargaDocente();
  actualizarMateriasSegunCurso(cursoSeleccionadoCarga);
  actualizarPeriodosCarga();
  renderizarTablaCargaDocente();

  const selPlanillaCurso = document.getElementById('selectFiltroPlanillaCurso');
  if (selPlanillaCurso && Array.from(selPlanillaCurso.options).some(o => o.value === cursoSeleccionadoCarga)) {
    selPlanillaCurso.value = cursoSeleccionadoCarga;
  }
  renderizarListaPlanillasGuardadas();
}

function alCambiarCursoCarga(nuevoCursoId) {
  cursoSeleccionadoCarga = nuevoCursoId;
  actualizarMateriasSegunCurso(nuevoCursoId);
  renderizarTablaCargaDocente();

  // Sincronizar el filtro de planillas para que muestre estrictamente las notas de este curso
  const selPlanillaCurso = document.getElementById('selectFiltroPlanillaCurso');
  if (selPlanillaCurso && Array.from(selPlanillaCurso.options).some(o => o.value === nuevoCursoId)) {
    selPlanillaCurso.value = nuevoCursoId;
  }
  renderizarListaPlanillasGuardadas();
}

function alCambiarFiltroPlanillaCurso(nuevoCursoId) {
  if (nuevoCursoId) {
    const selPreceptorCurso = document.getElementById('selectPreceptorCurso');
    if (selPreceptorCurso && selPreceptorCurso.value !== nuevoCursoId && Array.from(selPreceptorCurso.options).some(o => o.value === nuevoCursoId)) {
      selPreceptorCurso.value = nuevoCursoId;
      cursoSeleccionadoCarga = nuevoCursoId;
      actualizarMateriasSegunCurso(nuevoCursoId);
      renderizarTablaCargaDocente();
    }
  }
  renderizarListaPlanillasGuardadas();
}

function alCambiarMateriaCarga(nuevaMateria) {
  materiaSeleccionadaCarga = nuevaMateria;
  renderizarTablaCargaDocente();
}

function alCambiarPeriodoCarga(nuevoPeriodo) {
  periodoSeleccionadoCarga = nuevoPeriodo;
  renderizarTablaCargaDocente();
}

// Renderizado reactivo de la planilla de calificaciones del docente
function renderizarTablaCargaDocente() {
  if (!DB_ESCOLAR) return;

  const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const alumnos = obtenerAlumnosEscuelaActiva().filter(a => a.cursoId === cursoSeleccionadoCarga);
  const cursoObj = DB_ESCOLAR.cursos.find(c => c.id === cursoSeleccionadoCarga);
  const nombreCurso = cursoObj ? cursoObj.nombre : cursoSeleccionadoCarga;

  // Actualizar Título de la Planilla
  const tituloEl = document.getElementById('tituloPlanillaDocente');
  if (tituloEl) {
    tituloEl.textContent = `Planilla: ${materiaSeleccionadaCarga || 'Materia'} — ${nombreCurso} [${(periodoSeleccionadoCarga || '').toUpperCase()}]`;
  }

  // Encabezado de la tabla según régimen oficial
  const thead = document.getElementById('theadCargaDocente');
  if (thead) {
    thead.innerHTML = esBsAs
      ? `
        <tr>
          <th style="width: 45px; text-align: center;">#</th>
          <th>Apellido y Nombre del Alumno</th>
          <th style="width: 110px;">DNI</th>
          <th style="width: 150px; text-align: center;">Valoración RITE</th>
          <th style="width: 90px; text-align: center;">Nota Numérica</th>
          <th>Observación Pedagógica del Docente</th>
        </tr>
      `
      : `
        <tr>
          <th style="width: 45px; text-align: center;">#</th>
          <th>Apellido y Nombre del Alumno</th>
          <th style="width: 110px;">DNI</th>
          <th style="width: 100px; text-align: center;">Calificación (1-10)</th>
          <th style="width: 120px; text-align: center;">Concepto Oficial</th>
          <th>Observación Pedagógica del Docente</th>
        </tr>
      `;
  }

  // Filas de alumnos
  const tbody = document.getElementById('tbodyCargaDocente');
  if (!tbody) return;

  let aprobadosCount = 0;
  let htmlFilas = '';

  alumnos.forEach((alum, index) => {
    const mapa = esBsAs ? (alum.notasPba || {}) : (alum.notasFormosa || {});
    const registroMat = mapa[materiaSeleccionadaCarga] || {};

    let valNotaNum = '';
    let valConcepto = '';
    let valObs = registroMat.obs || '';

    if (esBsAs) {
      if (periodoSeleccionadoCarga === 'c1') {
        valNotaNum = registroMat.c1_nota !== undefined && registroMat.c1_nota !== null ? registroMat.c1_nota : '';
        valConcepto = registroMat.c1_val || 'TEA';
      } else if (periodoSeleccionadoCarga === 'c2') {
        valNotaNum = registroMat.c2_nota !== undefined && registroMat.c2_nota !== null ? registroMat.c2_nota : '';
        valConcepto = registroMat.c2_val || 'TEA';
      } else {
        valNotaNum = registroMat.rit_dic !== undefined && registroMat.rit_dic !== null ? registroMat.rit_dic : '';
        valConcepto = registroMat.rit_dic ? 'Aprobado' : '';
      }

      if (valConcepto === 'TEA' || Number(valNotaNum) >= 7) aprobadosCount++;

      htmlFilas += `
        <tr>
          <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${index + 1}</td>
          <td>
            <strong class="text-white" style="font-size: 0.9rem;">${alum.nombre}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Tutor: ${alum.tutor || 'No asignado'}</div>
          </td>
          <td class="text-muted" style="font-family: monospace; font-size: 0.82rem;">${alum.dni}</td>
          <td style="text-align: center;">
            <select id="carga_val_${alum.dni}" class="select-rite-sabana" onchange="alCambiarRiteCarga('${alum.dni}', this.value)">
              <option value="TEA" ${valConcepto === 'TEA' ? 'selected' : ''}>TEA (Avanzada)</option>
              <option value="TEP" ${valConcepto === 'TEP' ? 'selected' : ''}>TEP (En Proceso)</option>
              <option value="TED" ${valConcepto === 'TED' ? 'selected' : ''}>TED (Discontinua)</option>
            </select>
          </td>
          <td style="text-align: center;">
            <input type="number" id="carga_nota_${alum.dni}" class="input-nota-sabana" min="1" max="10" value="${valNotaNum}" placeholder="-">
          </td>
          <td>
            <input type="text" id="carga_obs_${alum.dni}" class="input-obs-sabana" value="${valObs}" placeholder="Observación pedagógica...">
          </td>
        </tr>
      `;
    } else {
      // Formosa
      if (periodoSeleccionadoCarga === 't1') {
        valNotaNum = registroMat.t1_n !== undefined && registroMat.t1_n !== null ? registroMat.t1_n : '';
        valConcepto = registroMat.t1_c || (valNotaNum >= 6 ? 'B' : '');
      } else if (periodoSeleccionadoCarga === 't2') {
        valNotaNum = registroMat.t2_n !== undefined && registroMat.t2_n !== null ? registroMat.t2_n : '';
        valConcepto = registroMat.t2_c || '';
      } else if (periodoSeleccionadoCarga === 't3') {
        valNotaNum = registroMat.t3_n !== undefined && registroMat.t3_n !== null ? registroMat.t3_n : '';
        valConcepto = registroMat.t3_c || '';
      } else if (periodoSeleccionadoCarga === 'rec_dic') {
        valNotaNum = registroMat.rec_dic !== undefined && registroMat.rec_dic !== null ? registroMat.rec_dic : '';
      } else if (periodoSeleccionadoCarga === 'pair') {
        valNotaNum = registroMat.pair !== undefined && registroMat.pair !== null ? registroMat.pair : '';
      }

      if (Number(valNotaNum) >= 6) aprobadosCount++;

      htmlFilas += `
        <tr>
          <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${index + 1}</td>
          <td>
            <strong class="text-white" style="font-size: 0.9rem;">${alum.nombre}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Tutor: ${alum.tutor || 'No asignado'}</div>
          </td>
          <td class="text-muted" style="font-family: monospace; font-size: 0.82rem;">${alum.dni}</td>
          <td style="text-align: center;">
            <input type="number" id="carga_nota_${alum.dni}" class="input-nota-sabana" min="1" max="10" value="${valNotaNum}" placeholder="-" oninput="autoCalcularConceptoFormosaCarga('${alum.dni}', this.value)">
          </td>
          <td style="text-align: center;">
            <select id="carga_val_${alum.dni}" class="select-rite-sabana">
              <option value="" ${!valConcepto ? 'selected' : ''}>-</option>
              <option value="SO" ${valConcepto === 'SO' ? 'selected' : ''}>SO (10)</option>
              <option value="MB" ${valConcepto === 'MB' ? 'selected' : ''}>MB (8-9)</option>
              <option value="B" ${valConcepto === 'B' ? 'selected' : ''}>B (6-7)</option>
              <option value="R" ${valConcepto === 'R' ? 'selected' : ''}>R (4-5)</option>
              <option value="I" ${valConcepto === 'I' ? 'selected' : ''}>I (1-3)</option>
            </select>
          </td>
          <td>
            <input type="text" id="carga_obs_${alum.dni}" class="input-obs-sabana" value="${valObs}" placeholder="Observación pedagógica...">
          </td>
        </tr>
      `;
    }
  });

  tbody.innerHTML = htmlFilas || `
    <tr>
      <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
        <i class="fa-solid fa-users-slash" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
        No hay alumnos inscriptos en este curso todavía. Podés agregarlos en la pestaña <strong>Padrón de Alumnos</strong>.
      </td>
    </tr>
  `;

  // Estadísticas de la clase
  const statsBox = document.getElementById('statsAlumnosPlanilla');
  const badgeStats = document.getElementById('badgeCargaStats');
  if (statsBox) {
    statsBox.innerHTML = `
      <span class="badge badge-blue">Matrícula: ${alumnos.length} alumnos</span>
      <span class="badge badge-green">Aprobados: ${aprobadosCount}</span>
      <span class="badge badge-amber">A intensificar: ${alumnos.length - aprobadosCount}</span>
    `;
  }
  if (badgeStats) {
    badgeStats.textContent = `${alumnos.length} Alumnos en ${nombreCurso}`;
  }
}

// Cálculo automático de concepto al escribir la nota numérica en Formosa
function autoCalcularConceptoFormosaCarga(dni, valorNota) {
  const selVal = document.getElementById(`carga_val_${dni}`);
  if (!selVal) return;
  const num = parseInt(valorNota, 10);
  if (isNaN(num)) return;
  if (num === 10) selVal.value = 'SO';
  else if (num >= 8) selVal.value = 'MB';
  else if (num >= 6) selVal.value = 'B';
  else if (num >= 4) selVal.value = 'R';
  else if (num >= 1) selVal.value = 'I';
}

// Asignación de nota representativa al cambiar RITE en PBA
function alCambiarRiteCarga(dni, rite) {
  const inputNota = document.getElementById(`carga_nota_${dni}`);
  if (!inputNota) return;
  if (rite === 'TEA' && !inputNota.value) inputNota.value = '8';
  else if (rite === 'TEP' && !inputNota.value) inputNota.value = '5';
  else if (rite === 'TED' && !inputNota.value) inputNota.value = '3';
}

// Guardar Calificaciones Colectivas de la Materia
async function guardarNotasDocenteGeneral() {
  if (!DB_ESCOLAR) {
    mostrarToast('La base de datos escolar no está disponible.', 'error');
    return;
  }

  const btnGuardar = document.getElementById('btnGuardarNotasDocente');
  const estadoGuardado = document.getElementById('estadoGuardadoDocente');

  // Asegurar que la materia no sea vacía
  if (!materiaSeleccionadaCarga) {
    const selMat = document.getElementById('selectPreceptorMateria');
    if (selMat && selMat.value) {
      materiaSeleccionadaCarga = selMat.value;
    }
  }

  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
  }

  try {
    const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
      (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'Buenos Aires') ||
      (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
    const alumnos = (DB_ESCOLAR.alumnos || []).filter(a => a.cursoId === cursoSeleccionadoCarga);
    let guardadosCount = 0;
    let paqueteDeNotas = [];

    alumnos.forEach(alum => {
      const inputNota = document.getElementById(`carga_nota_${alum.dni}`);
      const selVal = document.getElementById(`carga_val_${alum.dni}`);
      const inputObs = document.getElementById(`carga_obs_${alum.dni}`);

      if (!inputNota) return;

      const notaNum = inputNota.value !== '' && !isNaN(parseInt(inputNota.value, 10)) ? parseInt(inputNota.value, 10) : null;
      const valoracion = selVal ? selVal.value : null;
      const obs = inputObs ? inputObs.value.trim() : '';

      if (esBsAs) {
        if (!alum.notasPba) alum.notasPba = {};
        if (!alum.notasPba[materiaSeleccionadaCarga]) alum.notasPba[materiaSeleccionadaCarga] = {};

        if (periodoSeleccionadoCarga === 'c1') {
          alum.notasPba[materiaSeleccionadaCarga].c1_val = valoracion;
          alum.notasPba[materiaSeleccionadaCarga].c1_nota = notaNum;
        } else if (periodoSeleccionadoCarga === 'c2') {
          alum.notasPba[materiaSeleccionadaCarga].c2_val = valoracion;
          alum.notasPba[materiaSeleccionadaCarga].c2_nota = notaNum;
        } else if (periodoSeleccionadoCarga === 'rit_dic') {
          alum.notasPba[materiaSeleccionadaCarga].rit_dic = notaNum;
        }
        alum.notasPba[materiaSeleccionadaCarga].obs = obs;
      } else {
        if (!alum.notasFormosa) alum.notasFormosa = {};
        if (!alum.notasFormosa[materiaSeleccionadaCarga]) alum.notasFormosa[materiaSeleccionadaCarga] = {};

        if (periodoSeleccionadoCarga === 't1') {
          alum.notasFormosa[materiaSeleccionadaCarga].t1_n = notaNum;
          alum.notasFormosa[materiaSeleccionadaCarga].t1_c = valoracion;
        } else if (periodoSeleccionadoCarga === 't2') {
          alum.notasFormosa[materiaSeleccionadaCarga].t2_n = notaNum;
          alum.notasFormosa[materiaSeleccionadaCarga].t2_c = valoracion;
        } else if (periodoSeleccionadoCarga === 't3') {
          alum.notasFormosa[materiaSeleccionadaCarga].t3_n = notaNum;
          alum.notasFormosa[materiaSeleccionadaCarga].t3_c = valoracion;
        } else if (periodoSeleccionadoCarga === 'rec_dic') {
          alum.notasFormosa[materiaSeleccionadaCarga].rec_dic = notaNum;
        } else if (periodoSeleccionadoCarga === 'pair') {
          alum.notasFormosa[materiaSeleccionadaCarga].pair = notaNum;
        }
        alum.notasFormosa[materiaSeleccionadaCarga].obs = obs;
      }

      if (notaNum !== null || (valoracion && valoracion !== '') || obs !== '') {
        const idInst = (alum.institucionId === 'inst-pba' || (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id === 'inst-pba') || esBsAs) ? 2 : 1;
        paqueteDeNotas.push({
          dni_estudiante: String(alum.dni),
          materia: materiaSeleccionadaCarga,
          periodo: periodoSeleccionadoCarga,
          nota_numerica: notaNum,
          valoracion_conceptual: valoracion,
          observacion: obs,
          id_institucion: idInst
        });
      }
      guardadosCount++;
    });

    // Guardar en MySQL
    let guardadoExitoso = true;
    if (paqueteDeNotas.length > 0) {
      try {
        const respDB = await fetch('api/notas.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paqueteDeNotas)
        });
        if (!respDB.ok) {
          guardadoExitoso = false;
        } else {
          const resJSON = await respDB.json();
          if (resJSON.status !== 'ok') {
            guardadoExitoso = false;
          }
        }
      } catch (errDB) {
        console.warn("Aviso al sincronizar notas:", errDB);
        guardadoExitoso = false;
      }
    }

    if (!guardadoExitoso) {
      if (estadoGuardado) {
        estadoGuardado.style.display = 'inline-flex';
        estadoGuardado.style.color = '#ef4444';
        estadoGuardado.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
        setTimeout(() => {
          if (estadoGuardado && estadoGuardado.innerHTML.includes('No se guardó correctamente')) {
            estadoGuardado.style.display = 'none';
          }
        }, 5000);
      }
      if (btnGuardar) {
        btnGuardar.disabled = false;
        btnGuardar.style.backgroundColor = '#dc2626';
        btnGuardar.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
        setTimeout(() => {
          btnGuardar.style.backgroundColor = '';
          btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Calificaciones de la Materia`;
        }, 3000);
      }
      mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
      return;
    }

    // Guardar en localStorage de inmediato
    guardarBaseDatosEscolar();

    // Actualizar boletín activo si existe
    try {
      if (typeof cargarAlumnoEnBoletin === 'function') {
        await cargarAlumnoEnBoletin(alumnoActivoDni);
      }
      if (typeof renderizarBoletinPreview === 'function') {
        renderizarBoletinPreview();
      }
    } catch (eB) {
      console.warn("Aviso al refrescar boletín:", eB);
    }

    // Registrar o actualizar planilla en los botones de abajo
    if (typeof sincronizarPlanillasCargadas === 'function') {
      sincronizarPlanillasCargadas();
      renderizarListaPlanillasGuardadas();
    }

    // Renderizar la tabla con los datos guardados
    renderizarTablaCargaDocente();

    // Animación visual de guardado en las celdas
    const inputsActualizados = document.querySelectorAll('.input-nota-sabana, .input-obs-sabana, .select-rite-sabana');
    inputsActualizados.forEach(el => el.classList.add('input-guardado-flash'));
    setTimeout(() => {
      inputsActualizados.forEach(el => el.classList.remove('input-guardado-flash'));
    }, 1000);

    if (estadoGuardado) {
      estadoGuardado.style.display = 'inline-flex';
      estadoGuardado.style.color = '#10b981';
      estadoGuardado.innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardado correctamente`;
      setTimeout(() => {
        if (estadoGuardado && estadoGuardado.innerHTML.includes('Guardado correctamente')) {
          estadoGuardado.style.display = 'none';
        }
      }, 4000);
    }

    if (btnGuardar) {
      btnGuardar.innerHTML = `<i class="fa-solid fa-check"></i> Guardado correctamente`;
      btnGuardar.style.backgroundColor = '#059669';
      setTimeout(() => {
        btnGuardar.disabled = false;
        btnGuardar.style.backgroundColor = '';
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Calificaciones de la Materia`;
      }, 1500);
    }

    mostrarToast('Guardado correctamente.', 'success');
  } catch (err) {
    console.error("Error al guardar calificaciones:", err);
    if (estadoGuardado) {
      estadoGuardado.style.display = 'inline-flex';
      estadoGuardado.style.color = '#ef4444';
      estadoGuardado.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
      setTimeout(() => {
        if (estadoGuardado && estadoGuardado.innerHTML.includes('No se guardó correctamente')) {
          estadoGuardado.style.display = 'none';
        }
      }, 5000);
    }
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.style.backgroundColor = '#dc2626';
      btnGuardar.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
      setTimeout(() => {
        btnGuardar.style.backgroundColor = '';
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Calificaciones de la Materia`;
      }, 3000);
    }
    mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
  }
}

function imprimirPlanillaDocente() {
  window.print();
}

// 12.1 GESTIÓN DE PLANILLAS GUARDADAS (BOTONES DIRECTOS, MODAL DE EDICIÓN Y BORRADO)
let planillaActivaEdicionId = null;

// Escanear la base de alumnos para detectar automáticamente cualquier curso y materia con notas cargadas en la BD
function sincronizarPlanillasCargadas() {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const esBsAs = jurisActiva === 'pba' || (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') || (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || (esBsAs ? 'inst-pba' : 'inst-formosa'));
  const catalogoPeriodos = esBsAs ? PERIODOS_CATALOGO.pba : PERIODOS_CATALOGO.formosa;

  // Filtrar exclusivamente los alumnos de la escuela activa
  const alumnosEscuela = obtenerAlumnosEscuelaActiva();

  // Mapa para registrar todas las combinaciones que tienen notas reales en los alumnos de la BD
  const mapaNotasDetectadas = new Map();

  alumnosEscuela.forEach(alum => {
    const cId = alum.cursoId;
    if (!cId) return;

    const mapaNotas = esBsAs ? (alum.notasPba || {}) : (alum.notasFormosa || {});
    Object.entries(mapaNotas).forEach(([materia, registro]) => {
      if (!registro || typeof registro !== 'object') return;

      if (esBsAs) {
        if ((registro.c1_nota !== undefined && registro.c1_nota !== null && registro.c1_nota !== '') || (registro.c1_val && registro.c1_val !== '')) {
          const k = `${cId}___${materia}___c1`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 'c1' });
        }
        if ((registro.c2_nota !== undefined && registro.c2_nota !== null && registro.c2_nota !== '') || (registro.c2_val && registro.c2_val !== '')) {
          const k = `${cId}___${materia}___c2`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 'c2' });
        }
        if (registro.rit_dic !== undefined && registro.rit_dic !== null && registro.rit_dic !== '') {
          const k = `${cId}___${materia}___rit_dic`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 'rit_dic' });
        }
      } else {
        if ((registro.t1_n !== undefined && registro.t1_n !== null && registro.t1_n !== '') || (registro.t1_c && registro.t1_c !== '')) {
          const k = `${cId}___${materia}___t1`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 't1' });
        }
        if ((registro.t2_n !== undefined && registro.t2_n !== null && registro.t2_n !== '') || (registro.t2_c && registro.t2_c !== '')) {
          const k = `${cId}___${materia}___t2`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 't2' });
        }
        if ((registro.t3_n !== undefined && registro.t3_n !== null && registro.t3_n !== '') || (registro.t3_c && registro.t3_c !== '')) {
          const k = `${cId}___${materia}___t3`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 't3' });
        }
        if (registro.rec_dic !== undefined && registro.rec_dic !== null && registro.rec_dic !== '') {
          const k = `${cId}___${materia}___rec_dic`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 'rec_dic' });
        }
        if (registro.pair !== undefined && registro.pair !== null && registro.pair !== '') {
          const k = `${cId}___${materia}___pair`;
          if (!mapaNotasDetectadas.has(k)) mapaNotasDetectadas.set(k, { cursoId: cId, materia, periodo: 'pair' });
        }
      }
    });
  });

  // Reconstruir DB_ESCOLAR.planillasGuardadas: SOLO y EXCLUSIVAMENTE las planillas con notas en la BD
  const planillasReales = [];
  mapaNotasDetectadas.forEach(({ cursoId, materia, periodo }) => {
    const idCompuesto = `pln_${cursoId}_${(materia || 'materia').toLowerCase().replace(/[^a-z0-9]/g, '-')}_${periodo}`;

    const cursoObj = (DB_ESCOLAR.cursos || []).find(c => c.id === cursoId);
    const nombreCurso = cursoObj ? cursoObj.nombre : cursoId;
    const orientacion = cursoObj ? (cursoObj.orientacion || '') : '';
    const ciclo = cursoObj ? (cursoObj.ciclo || 'basico') : 'basico';
    const periodoObj = (catalogoPeriodos || []).find(p => p.id === periodo);
    const periodoNombre = periodoObj ? periodoObj.nombre.split('(')[0].trim() : (periodo || '').toUpperCase();

    const alumnosDelCurso = alumnosEscuela.filter(a => a.cursoId === cursoId);
    let aprobados = 0;
    let conNotaCount = 0;
    alumnosDelCurso.forEach(alum => {
      const mapa = esBsAs ? (alum.notasPba || {}) : (alum.notasFormosa || {});
      const reg = mapa[materia] || {};
      if (esBsAs) {
        const c = periodo === 'c1' ? reg.c1_val : (periodo === 'c2' ? reg.c2_val : '');
        const n = periodo === 'c1' ? reg.c1_nota : (periodo === 'c2' ? reg.c2_nota : reg.rit_dic);
        if ((n !== undefined && n !== null && n !== '') || (c && c !== '')) {
          conNotaCount++;
          if (c === 'TEA' || Number(n) >= 7) aprobados++;
        }
      } else {
        const n = periodo === 't1' ? reg.t1_n : (periodo === 't2' ? reg.t2_n : (periodo === 't3' ? reg.t3_n : (periodo === 'rec_dic' ? reg.rec_dic : reg.pair)));
        const c = periodo === 't1' ? reg.t1_c : (periodo === 't2' ? reg.t2_c : (periodo === 't3' ? reg.t3_c : ''));
        if ((n !== undefined && n !== null && n !== '') || (c && c !== '')) {
          conNotaCount++;
          if (Number(n) >= 6) aprobados++;
        }
      }
    });

    planillasReales.push({
      id: idCompuesto,
      cursoId,
      nombreCurso,
      orientacion,
      ciclo,
      materia,
      periodo,
      periodoNombre,
      institucionId: instActiva,
      fechaCarga: 'Cargada en la Base de Datos',
      fechaTimestamp: Date.now(),
      totalAlumnos: conNotaCount || alumnosDelCurso.length,
      aprobados,
      aIntensificar: Math.max(0, (conNotaCount || alumnosDelCurso.length) - aprobados)
    });
  });

  const otrasPlanillas = (DB_ESCOLAR.planillasGuardadas || []).filter(p => p.institucionId && p.institucionId !== instActiva);
  DB_ESCOLAR.planillasGuardadas = [...otrasPlanillas, ...planillasReales];
}

function registrarOActualizarPlanillaGuardada({ cursoId, materia, periodo }) {
  if (!DB_ESCOLAR) return;
  if (!DB_ESCOLAR.planillasGuardadas) DB_ESCOLAR.planillasGuardadas = [];

  const cursoObj = (DB_ESCOLAR.cursos || []).find(c => c.id === cursoId);
  const nombreCurso = cursoObj ? cursoObj.nombre : cursoId;
  const orientacion = cursoObj ? (cursoObj.orientacion || '') : '';
  const ciclo = cursoObj ? (cursoObj.ciclo || 'basico') : 'basico';

  const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const catalogoPeriodos = esBsAs ? PERIODOS_CATALOGO.pba : PERIODOS_CATALOGO.formosa;
  const periodoObj = (catalogoPeriodos || []).find(p => p.id === periodo);
  const periodoNombre = periodoObj ? periodoObj.nombre.split('(')[0].trim() : (periodo || '').toUpperCase();

  const alumnos = (DB_ESCOLAR.alumnos || []).filter(a => a.cursoId === cursoId);
  let aprobados = 0;
  alumnos.forEach(alum => {
    const mapa = esBsAs ? (alum.notasPba || {}) : (alum.notasFormosa || {});
    const registroMat = mapa[materia] || {};
    let nota = null;
    let concepto = '';
    if (esBsAs) {
      if (periodo === 'c1') { nota = registroMat.c1_nota; concepto = registroMat.c1_val; }
      else if (periodo === 'c2') { nota = registroMat.c2_nota; concepto = registroMat.c2_val; }
      else { nota = registroMat.rit_dic; }
      if (concepto === 'TEA' || Number(nota) >= 7) aprobados++;
    } else {
      if (periodo === 't1') { nota = registroMat.t1_n; concepto = registroMat.t1_c; }
      else if (periodo === 't2') { nota = registroMat.t2_n; concepto = registroMat.t2_c; }
      else if (periodo === 't3') { nota = registroMat.t3_n; concepto = registroMat.t3_c; }
      else if (periodo === 'rec_dic') { nota = registroMat.rec_dic; }
      else if (periodo === 'pair') { nota = registroMat.pair; }
      if (Number(nota) >= 6) aprobados++;
    }
  });

  const idCompuesto = `pln_${cursoId}_${(materia || 'materia').toLowerCase().replace(/[^a-z0-9]/g, '-')}_${periodo}`;
  const horaStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fechaStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const fechaCarga = `${fechaStr}, ${horaStr} hs`;

  const indexExistente = DB_ESCOLAR.planillasGuardadas.findIndex(p => p.id === idCompuesto || (p.cursoId === cursoId && p.materia === materia && p.periodo === periodo));

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const planillaData = {
    id: idCompuesto,
    cursoId,
    nombreCurso,
    orientacion,
    ciclo,
    materia,
    periodo,
    periodoNombre,
    institucionId: instActiva,
    fechaCarga,
    fechaTimestamp: Date.now(),
    totalAlumnos: alumnos.length,
    aprobados,
    aIntensificar: Math.max(0, alumnos.length - aprobados)
  };

  if (indexExistente >= 0) {
    DB_ESCOLAR.planillasGuardadas[indexExistente] = planillaData;
  } else {
    DB_ESCOLAR.planillasGuardadas.unshift(planillaData);
  }

  guardarBaseDatosEscolar();
  renderizarListaPlanillasGuardadas();
}

// BÚSQUEDA Y FILTRADO DE PLANILLAS CARGADAS POR CURSO O MATERIA

let cachePlanillasFiltroCant = -1;
let cachePlanillasFiltroJuris = '';

function normalizarTextoBusquedaPlanilla(str) {
  if (!str) return '';
  return str
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/°|º|ª/g, '')
    .trim();
}

function poblarSelectoresFiltroPlanillas(forzar = false) {
  const selCurso = document.getElementById('selectFiltroPlanillaCurso');
  const selPeriodo = document.getElementById('selectFiltroPlanillaPeriodo');
  if (!selCurso || !selPeriodo || !DB_ESCOLAR) return;

  const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const jurisActual = esBsAs ? 'pba' : 'formosa';

  const planillas = DB_ESCOLAR.planillasGuardadas || [];
  if (!forzar && cachePlanillasFiltroCant === planillas.length && cachePlanillasFiltroJuris === jurisActual && selCurso.options.length > 0 && selPeriodo.options.length > 1) {
    return; // Ya está poblado y no cambió la cantidad ni el régimen
  }
  cachePlanillasFiltroCant = planillas.length;
  cachePlanillasFiltroJuris = jurisActual;

  // 1. POBLAR CURSOS (Organizados por Ciclo Básico y Ciclo Orientado de la escuela activa - Muestra por curso de a 1)
  const cursoValPrevio = selCurso.value;
  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || (esBsAs ? 'inst-pba' : 'inst-formosa'));
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);

  let htmlCursos = '';

  // Grupo 1: Ciclo Básico (1° a 3° Año)
  const basico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
  if (basico.length > 0) {
    htmlCursos += `<optgroup label="Ciclo Básico (1° a 3°)">`;
    basico.forEach(c => {
      const cant = planillas.filter(p => p.cursoId === c.id || p.nombreCurso === c.nombre).length;
      const badgeCant = cant > 0 ? ` (${cant})` : '';
      htmlCursos += `<option value="${c.id}">${c.nombre}${badgeCant}</option>`;
    });
    htmlCursos += `</optgroup>`;
  }

  // Grupo 2: Ciclo Orientado - Ciencias Naturales (4° a 6° Año)
  const csNat = cursos.filter(c => c.ciclo === 'orientado' && (c.orientacion || '').includes('Naturales'));
  if (csNat.length > 0) {
    htmlCursos += `<optgroup label="Ciclo Orientado - Cs. Naturales (4° a 6°)">`;
    csNat.forEach(c => {
      const cant = planillas.filter(p => p.cursoId === c.id).length;
      const badgeCant = cant > 0 ? ` (${cant})` : '';
      htmlCursos += `<option value="${c.id}">${c.nombre} (Cs. Naturales)${badgeCant}</option>`;
    });
    htmlCursos += `</optgroup>`;
  }

  // Grupo 3: Ciclo Orientado - Ciencias Sociales (4° a 6° Año)
  const csSoc = cursos.filter(c => c.ciclo === 'orientado' && (c.orientacion || '').includes('Sociales'));
  if (csSoc.length > 0) {
    htmlCursos += `<optgroup label="Ciclo Orientado - Cs. Sociales (4° a 6°)">`;
    csSoc.forEach(c => {
      const cant = planillas.filter(p => p.cursoId === c.id).length;
      const badgeCant = cant > 0 ? ` (${cant})` : '';
      htmlCursos += `<option value="${c.id}">${c.nombre} (Cs. Sociales)${badgeCant}</option>`;
    });
    htmlCursos += `</optgroup>`;
  }

  // Grupo 4: Otros cursos si existieran
  const otros = cursos.filter(c =>
    (c.ciclo || 'basico') !== 'basico' &&
    !(c.orientacion || '').includes('Naturales') &&
    !(c.orientacion || '').includes('Sociales')
  );
  if (otros.length > 0) {
    htmlCursos += `<optgroup label="Otros Cursos">`;
    otros.forEach(c => {
      const cant = planillas.filter(p => p.cursoId === c.id).length;
      const badgeCant = cant > 0 ? ` (${cant})` : '';
      htmlCursos += `<option value="${c.id}">${c.nombre} ${c.orientacion ? '(' + c.orientacion + ')' : ''}${badgeCant}</option>`;
    });
    htmlCursos += `</optgroup>`;
  }

  if (cursos.length === 0) {
    htmlCursos = '<option value="">Sin cursos disponibles</option>';
  }

  selCurso.innerHTML = htmlCursos;

  // Seleccionar de a 1 curso: preservar previo si existe, sino usar el curso activo de carga
  const cursoTarget = (cursoValPrevio && Array.from(selCurso.options).some(o => o.value === cursoValPrevio))
    ? cursoValPrevio
    : (Array.from(selCurso.options).some(o => o.value === cursoSeleccionadoCarga)
        ? cursoSeleccionadoCarga
        : (selCurso.options[0] ? selCurso.options[0].value : ''));
  if (cursoTarget) {
    selCurso.value = cursoTarget;
  }

  // 2. POBLAR PERÍODOS (Trimestres en Formosa, Cuatrimestres en Buenos Aires)
  const periodoValPrevio = selPeriodo.value;
  const listaPeriodos = esBsAs ? (PERIODOS_CATALOGO.pba || []) : (PERIODOS_CATALOGO.formosa || []);
  const textoTodos = esBsAs ? 'Todos los cuatrimestres' : 'Todos los trimestres';

  let htmlPeriodos = `<option value="">${textoTodos}</option>`;
  listaPeriodos.forEach(per => {
    const nombreLimpio = per.nombre.split('(')[0].trim();
    const cant = planillas.filter(p => p.periodo === per.id || (p.periodoNombre && p.periodoNombre.toLowerCase().includes(per.id.toLowerCase()))).length;
    const badgeCant = cant > 0 ? ` (${cant})` : '';
    htmlPeriodos += `<option value="${per.id}">${nombreLimpio}${badgeCant}</option>`;
  });
  selPeriodo.innerHTML = htmlPeriodos;
  if (periodoValPrevio && Array.from(selPeriodo.options).some(o => o.value === periodoValPrevio)) {
    selPeriodo.value = periodoValPrevio;
  }
}

// Trigger principal cuando el usuario escribe o cambia selectores
function filtrarBotonesPlanillas() {
  renderizarListaPlanillasGuardadas();
}

function limpiarTextoBuscarPlanilla() {
  const inputTexto = document.getElementById('inputBuscarPlanillaTexto');
  if (inputTexto) inputTexto.value = '';
  filtrarBotonesPlanillas();
}

function limpiarTodosFiltrosPlanillas() {
  const inputTexto = document.getElementById('inputBuscarPlanillaTexto');
  const selCurso = document.getElementById('selectFiltroPlanillaCurso');
  const selPeriodo = document.getElementById('selectFiltroPlanillaPeriodo');

  if (inputTexto) inputTexto.value = '';
  if (selCurso) {
    selCurso.value = cursoSeleccionadoCarga || (selCurso.options[0] ? selCurso.options[0].value : '');
  }
  if (selPeriodo) selPeriodo.value = '';

  filtrarBotonesPlanillas();
}

function filtrarPlanillasGuardadas(texto) {
  const inputTexto = document.getElementById('inputBuscarPlanillaTexto');
  if (inputTexto) inputTexto.value = texto;
  renderizarListaPlanillasGuardadas();
}

// Renderizar las planillas cargadas como botones interactivos
function renderizarListaPlanillasGuardadas(filtroTexto = null, filtroCurso = null, filtroPeriodo = null) {
  const contenedor = document.getElementById('contenedorBotonesPlanillas');
  const badgeTotal = document.getElementById('badgeCantPlanillasBotones');
  if (!contenedor || !DB_ESCOLAR) return;

  // Escanear datos para detectar automáticamente cualquier curso calificado
  sincronizarPlanillasCargadas();

  if (!DB_ESCOLAR.planillasGuardadas) DB_ESCOLAR.planillasGuardadas = [];

  // Actualizar opciones de cursos y períodos en los filtros según el régimen escolar
  poblarSelectoresFiltroPlanillas();

  const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || (esBsAs ? 'inst-pba' : 'inst-formosa'));
  const cursosEscuela = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);
  const idsCursosEscuela = new Set(cursosEscuela.map(c => c.id));

  let planillas = (DB_ESCOLAR.planillasGuardadas || []).filter(p => {
    if (p.institucionId) return p.institucionId === instActiva;
    if (p.cursoId) return idsCursosEscuela.has(p.cursoId);
    return instActiva === 'inst-formosa';
  });
  planillas.sort((a, b) => (b.fechaTimestamp || 0) - (a.fechaTimestamp || 0));

  const totalCargadas = planillas.length;

  // Obtener valores de los filtros desde el DOM o parámetros
  const inputTexto = document.getElementById('inputBuscarPlanillaTexto');
  const selCurso = document.getElementById('selectFiltroPlanillaCurso');
  const selPeriodo = document.getElementById('selectFiltroPlanillaPeriodo');
  const btnLimpiarTexto = document.getElementById('btnLimpiarTextoPlanilla');
  const btnLimpiarTodos = document.getElementById('btnLimpiarTodosFiltrosPlanillas');
  const lblContador = document.getElementById('labelContadorFiltroPlanillas');

  const textoVal = filtroTexto !== null ? filtroTexto : (inputTexto ? inputTexto.value : '');
  const cursoVal = filtroCurso !== null ? filtroCurso : (selCurso && selCurso.value ? selCurso.value : cursoSeleccionadoCarga);
  const periodoVal = filtroPeriodo !== null ? filtroPeriodo : (selPeriodo ? selPeriodo.value : '');

  // Mostrar u ocultar botón de limpiar texto
  if (btnLimpiarTexto) {
    btnLimpiarTexto.style.display = textoVal.trim().length > 0 ? 'inline-block' : 'none';
  }

  const textoNorm = normalizarTextoBusquedaPlanilla(textoVal);
  const hayFiltroSecundario = textoVal.trim().length > 0 || periodoVal !== '';

  // Filtrar planillas según los criterios: estricto por curso seleccionado (de a 1)
  let planillasFiltradas = planillas.filter(p => {
    // 1. Filtro por Curso (muestra exclusivamente las planillas de 1 curso a la vez)
    if (cursoVal) {
      const cursoObjSel = (DB_ESCOLAR.cursos || []).find(c => c.id === cursoVal);
      const nombreSel = cursoObjSel ? cursoObjSel.nombre : cursoVal;
      const coincideCurso = (p.cursoId === cursoVal) ||
        (p.nombreCurso === cursoVal) ||
        (p.nombreCurso === nombreSel);
      if (!coincideCurso) return false;
    }

    // 2. Filtro por Período (Trimestre o Cuatrimestre)
    if (periodoVal) {
      const coincidePeriodo = p.periodo === periodoVal ||
        (p.periodoNombre && p.periodoNombre.toLowerCase().includes(periodoVal.toLowerCase()));
      if (!coincidePeriodo) return false;
    }

    // 3. Filtro por Texto libre (materia, curso, orientación, período)
    if (textoNorm) {
      const matNorm = normalizarTextoBusquedaPlanilla(p.materia);
      const curNorm = normalizarTextoBusquedaPlanilla(p.nombreCurso);
      const oriNorm = normalizarTextoBusquedaPlanilla(p.orientacion || '');
      const perNorm = normalizarTextoBusquedaPlanilla(p.periodoNombre || p.periodo || '');

      const coincide = matNorm.includes(textoNorm) ||
        curNorm.includes(textoNorm) ||
        oriNorm.includes(textoNorm) ||
        perNorm.includes(textoNorm);
      if (!coincide) return false;
    }

    return true;
  });

  const cursoObjSel = (DB_ESCOLAR.cursos || []).find(c => c.id === cursoVal);
  const nombreCursoSel = cursoObjSel ? cursoObjSel.nombre : (cursoVal || 'Curso');

  // Actualizar visibilidad de botón Limpiar y contador
  if (btnLimpiarTodos) {
    btnLimpiarTodos.style.display = hayFiltroSecundario ? 'inline-flex' : 'none';
  }

  if (badgeTotal) {
    const cantFiltradas = planillasFiltradas.length;
    badgeTotal.textContent = `${cantFiltradas} cargada${cantFiltradas !== 1 ? 's' : ''}`;
  }

  if (lblContador) {
    if (hayFiltroSecundario) {
      lblContador.innerHTML = `<span class="text-blue" style="font-weight: 700;">${planillasFiltradas.length}</span> planillas en <strong>${nombreCursoSel}</strong>`;
    } else {
      lblContador.innerHTML = `Curso: <span class="text-blue" style="font-weight: 700;">${nombreCursoSel}</span>`;
    }
  }

  // Caso 1: Aún no hay ninguna planilla guardada en toda la base de datos
  if (totalCargadas === 0) {
    contenedor.innerHTML = `
      <div class="empty-state-box">
        <i class="fa-regular fa-folder-open text-dim" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;"></i>
        <strong class="text-secondary" style="font-size: 0.9rem;">Aún no hay planillas registradas abajo.</strong><br>
        <span class="text-dim" style="font-size: 0.8rem;">Cuando cargues notas arriba y presiones <strong>"Guardar Calificaciones de la Materia"</strong>, aparecerá aquí como un botón de acceso directo para revisarla y editarla cuando quieras.</span>
      </div>
    `;
    return;
  }

  // Caso 2: Hay planillas guardadas pero ninguna coincide con los filtros aplicados
  if (planillasFiltradas.length === 0) {
    contenedor.innerHTML = `
      <div class="empty-state-box">
        <i class="fa-solid fa-filter-circle-xmark text-amber" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;"></i>
        <strong style="color: #cbd5e1; font-size: 0.92rem;">No hay planillas registradas para ${nombreCursoSel || 'este curso'}.</strong><br>
        <span class="text-dim" style="font-size: 0.8rem;">Cargá calificaciones arriba para este curso y guardalas para ver su planilla aquí.</span>
      </div>
    `;
    return;
  }

  // Caso 3: Renderizar las planillas filtradas
  contenedor.innerHTML = planillasFiltradas.map(p => {
    return `
      <div class="card-boton-planilla" id="card_btn_${p.id}">
        <button type="button" class="btn-planilla-click" onclick="abrirModalEditarPlanilla('${p.id}')" title="Clic para ver o editar la planilla general de ${p.materia}">
          <div class="btn-planilla-icon">
            <i class="fa-solid fa-file-signature"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <div class="btn-planilla-materia">${p.materia}</div>
            <div class="btn-planilla-sub">
              <strong class="text-secondary">${p.nombreCurso}</strong>
              ${p.orientacion ? `<span class="text-blue" style="font-size: 0.72rem; margin-left: 2px;">(${p.orientacion})</span>` : ''} 
              <span class="badge badge-blue" style="font-size: 0.68rem; padding: 1px 6px; margin-left: 4px;">${p.periodoNombre || (p.periodo || '').toUpperCase()}</span>
            </div>
            <div class="btn-planilla-stats">
              <span class="badge-mini-alumnos"><i class="fa-solid fa-users"></i> ${p.totalAlumnos || 0} alum.</span>
              <span class="badge-mini-aprob"><i class="fa-solid fa-check"></i> ${p.aprobados || 0} aprob.</span>
              ${(p.aIntensificar > 0) ? `<span class="bg-amber-subtle text-amber" style="font-size: 0.68rem; padding: 1px 6px; border-radius: 4px; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation"></i> ${p.aIntensificar} intensif.</span>` : ''}
            </div>
          </div>
          <div class="btn-planilla-chevron text-muted" style="display: flex; align-items: center; padding-left: 0.5rem; font-size: 0.95rem;">
            <i class="fa-solid fa-chevron-right"></i>
          </div>
        </button>
        <button type="button" class="btn-planilla-borrar-directo" onclick="confirmarBorrarPlanilla('${p.id}')" title="Borrar toda la planilla y vaciar calificaciones si hubo un error">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;
  }).join('');
}



function abrirModalEditarPlanilla(idPlanilla) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.planillasGuardadas) return;

  const modal = document.getElementById('modalEditarPlanillaGuardada');
  if (!modal) return;

  const p = DB_ESCOLAR.planillasGuardadas.find(x => x.id === idPlanilla);
  if (!p) {
    mostrarToast('No se encontró la planilla seleccionada.', 'error');
    return;
  }

  planillaActivaEdicionId = idPlanilla;

  // Actualizar Título y subtítulos
  document.getElementById('modalPlanillaTitulo').innerHTML = `
    <i class="fa-solid fa-file-pen text-blue"></i> Planilla: ${p.materia} — ${p.nombreCurso}
  `;
  document.getElementById('modalPlanillaSubtitulo').textContent = `
    ${p.orientacion ? p.orientacion + ' • ' : ''}${p.periodoNombre}
  `;

  // Badges informativos
  const badgesBox = document.getElementById('modalPlanillaBadges');
  if (badgesBox) {
    badgesBox.innerHTML = `
      <span class="badge badge-blue"><i class="fa-solid fa-graduation-cap"></i> Curso: ${p.nombreCurso}</span>
      <span class="badge badge-green"><i class="fa-solid fa-book"></i> ${p.materia}</span>
      <span class="badge badge-amber"><i class="fa-solid fa-calendar-day"></i> ${p.periodoNombre}</span>
      ${p.orientacion ? `<span class="badge badge badge-purple"><i class="fa-solid fa-compass"></i> ${p.orientacion}</span>` : ''}
    `;
  }

  const fechaEl = document.getElementById('modalPlanillaFecha');
  if (fechaEl) {
    fechaEl.innerHTML = `<i class="fa-regular fa-clock"></i> Último guardado: <strong>${p.fechaCarga || 'Hoy'}</strong>`;
  }

  const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
    (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
  const thead = document.getElementById('modalPlanillaThead');
  if (thead) {
    thead.innerHTML = esBsAs
      ? `
        <tr>
          <th style="width: 45px; text-align: center;">#</th>
          <th>Apellido y Nombre del Alumno</th>
          <th style="width: 110px;">DNI</th>
          <th style="width: 160px; text-align: center;">Valoración RITE</th>
          <th style="width: 100px; text-align: center;">Nota Numérica</th>
          <th>Observación Pedagógica</th>
        </tr>
      `
      : `
        <tr>
          <th style="width: 45px; text-align: center;">#</th>
          <th>Apellido y Nombre del Alumno</th>
          <th style="width: 110px;">DNI</th>
          <th style="width: 100px; text-align: center;">Calificación (1-10)</th>
          <th style="width: 130px; text-align: center;">Concepto Oficial</th>
          <th>Observación Pedagógica</th>
        </tr>
      `;
  }

  const tbody = document.getElementById('modalPlanillaTbody');
  if (!tbody) return;

  const alumnos = DB_ESCOLAR.alumnos.filter(a => a.cursoId === p.cursoId);
  if (alumnos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          No hay alumnos inscriptos en este curso.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = alumnos.map((alum, idx) => {
      const mapa = esBsAs ? (alum.notasPba || {}) : (alum.notasFormosa || {});
      const reg = mapa[p.materia] || {};

      let valNota = '';
      let valConcepto = '';
      let valObs = reg.obs || '';

      if (esBsAs) {
        if (p.periodo === 'c1') {
          valNota = reg.c1_nota !== undefined && reg.c1_nota !== null ? reg.c1_nota : '';
          valConcepto = reg.c1_val || 'TEA';
        } else if (p.periodo === 'c2') {
          valNota = reg.c2_nota !== undefined && reg.c2_nota !== null ? reg.c2_nota : '';
          valConcepto = reg.c2_val || 'TEA';
        } else {
          valNota = reg.rit_dic !== undefined && reg.rit_dic !== null ? reg.rit_dic : '';
          valConcepto = reg.rit_dic ? 'Aprobado' : '';
        }

        return `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
            <td>
              <strong class="text-white" style="font-size: 0.9rem;">${alum.nombre}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Tutor: ${alum.tutor || 'No asignado'}</div>
            </td>
            <td class="text-muted" style="font-family: monospace; font-size: 0.82rem;">${alum.dni}</td>
            <td style="text-align: center;">
              <select id="modal_carga_val_${alum.dni}" class="select-rite-sabana">
                <option value="TEA" ${valConcepto === 'TEA' ? 'selected' : ''}>TEA (Avanzada)</option>
                <option value="TEP" ${valConcepto === 'TEP' ? 'selected' : ''}>TEP (En Proceso)</option>
                <option value="TED" ${valConcepto === 'TED' ? 'selected' : ''}>TED (Discontinua)</option>
              </select>
            </td>
            <td style="text-align: center;">
              <input type="number" id="modal_carga_nota_${alum.dni}" class="input-nota-sabana" min="1" max="10" value="${valNota}" placeholder="-">
            </td>
            <td>
              <input type="text" id="modal_carga_obs_${alum.dni}" class="input-obs-sabana" value="${valObs}" placeholder="Observación pedagógica...">
            </td>
          </tr>
        `;
      } else {
        if (p.periodo === 't1') {
          valNota = reg.t1_n !== undefined && reg.t1_n !== null ? reg.t1_n : '';
          valConcepto = reg.t1_c || (valNota >= 6 ? 'B' : '');
        } else if (p.periodo === 't2') {
          valNota = reg.t2_n !== undefined && reg.t2_n !== null ? reg.t2_n : '';
          valConcepto = reg.t2_c || (valNota >= 6 ? 'B' : '');
        } else if (p.periodo === 't3') {
          valNota = reg.t3_n !== undefined && reg.t3_n !== null ? reg.t3_n : '';
          valConcepto = reg.t3_c || (valNota >= 6 ? 'B' : '');
        } else if (p.periodo === 'rec_dic') {
          valNota = reg.rec_dic !== undefined && reg.rec_dic !== null ? reg.rec_dic : '';
        } else if (p.periodo === 'pair') {
          valNota = reg.pair !== undefined && reg.pair !== null ? reg.pair : '';
        }

        return `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-weight: 700;">${idx + 1}</td>
            <td>
              <strong class="text-white" style="font-size: 0.9rem;">${alum.nombre}</strong>
              <div style="font-size: 0.72rem; color: var(--text-muted);">Tutor: ${alum.tutor || 'No asignado'}</div>
            </td>
            <td class="text-muted" style="font-family: monospace; font-size: 0.82rem;">${alum.dni}</td>
            <td style="text-align: center;">
              <input type="number" id="modal_carga_nota_${alum.dni}" class="input-nota-sabana" min="1" max="10" value="${valNota}" placeholder="-" oninput="autoCalcularConceptoFormosaModal('${alum.dni}', this.value)">
            </td>
            <td style="text-align: center;">
              <select id="modal_carga_val_${alum.dni}" class="select-rite-sabana">
                <option value="" ${!valConcepto ? 'selected' : ''}>-</option>
                <option value="SO" ${valConcepto === 'SO' ? 'selected' : ''}>SO (10)</option>
                <option value="MB" ${valConcepto === 'MB' ? 'selected' : ''}>MB (8-9)</option>
                <option value="B" ${valConcepto === 'B' ? 'selected' : ''}>B (6-7)</option>
                <option value="R" ${valConcepto === 'R' ? 'selected' : ''}>R (4-5)</option>
                <option value="I" ${valConcepto === 'I' ? 'selected' : ''}>I (1-3)</option>
              </select>
            </td>
            <td>
              <input type="text" id="modal_carga_obs_${alum.dni}" class="input-obs-sabana" value="${valObs}" placeholder="Observación pedagógica...">
            </td>
          </tr>
        `;
      }
    }).join('');
  }

  modal.style.display = 'flex';
}

function autoCalcularConceptoFormosaModal(dni, valorNota) {
  const selVal = document.getElementById(`modal_carga_val_${dni}`);
  if (!selVal) return;
  const num = parseInt(valorNota, 10);
  if (isNaN(num)) return;
  if (num === 10) selVal.value = 'SO';
  else if (num >= 8) selVal.value = 'MB';
  else if (num >= 6) selVal.value = 'B';
  else if (num >= 4) selVal.value = 'R';
  else if (num >= 1) selVal.value = 'I';
}

function cerrarModalEditarPlanilla() {
  const modal = document.getElementById('modalEditarPlanillaGuardada');
  if (modal) modal.style.display = 'none';
  planillaActivaEdicionId = null;
}

async function guardarCambiosModalPlanilla() {
  if (!DB_ESCOLAR || !planillaActivaEdicionId) return;

  const p = DB_ESCOLAR.planillasGuardadas.find(x => x.id === planillaActivaEdicionId);
  if (!p) return;

  const btn = document.getElementById('btnGuardarCambiosModalPlanilla');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;
  }

  try {
    const esBsAs = (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ||
      (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'Buenos Aires') ||
      (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion === 'pba');
    const alumnos = (DB_ESCOLAR.alumnos || []).filter(a => a.cursoId === p.cursoId);
    let guardadosCount = 0;
    let aprobados = 0;
    let paqueteDeNotas = [];

    alumnos.forEach(alum => {
      const inputNota = document.getElementById(`modal_carga_nota_${alum.dni}`);
      const selVal = document.getElementById(`modal_carga_val_${alum.dni}`);
      const inputObs = document.getElementById(`modal_carga_obs_${alum.dni}`);

      if (!inputNota) return;

      const notaNum = inputNota.value !== '' && !isNaN(parseInt(inputNota.value, 10)) ? parseInt(inputNota.value, 10) : null;
      const valoracion = selVal ? selVal.value : null;
      const obs = inputObs ? inputObs.value.trim() : '';

      if (esBsAs) {
        if (!alum.notasPba) alum.notasPba = {};
        if (!alum.notasPba[p.materia]) alum.notasPba[p.materia] = {};

        if (p.periodo === 'c1') {
          alum.notasPba[p.materia].c1_val = valoracion;
          alum.notasPba[p.materia].c1_nota = notaNum;
        } else if (p.periodo === 'c2') {
          alum.notasPba[p.materia].c2_val = valoracion;
          alum.notasPba[p.materia].c2_nota = notaNum;
        } else if (p.periodo === 'rit_dic') {
          alum.notasPba[p.materia].rit_dic = notaNum;
        }
        alum.notasPba[p.materia].obs = obs;
        if (valoracion === 'TEA' || Number(notaNum) >= 7) aprobados++;
      } else {
        if (!alum.notasFormosa) alum.notasFormosa = {};
        if (!alum.notasFormosa[p.materia]) alum.notasFormosa[p.materia] = {};

        if (p.periodo === 't1') {
          alum.notasFormosa[p.materia].t1_n = notaNum;
          alum.notasFormosa[p.materia].t1_c = valoracion;
        } else if (p.periodo === 't2') {
          alum.notasFormosa[p.materia].t2_n = notaNum;
          alum.notasFormosa[p.materia].t2_c = valoracion;
        } else if (p.periodo === 't3') {
          alum.notasFormosa[p.materia].t3_n = notaNum;
          alum.notasFormosa[p.materia].t3_c = valoracion;
        } else if (p.periodo === 'rec_dic') {
          alum.notasFormosa[p.materia].rec_dic = notaNum;
        } else if (p.periodo === 'pair') {
          alum.notasFormosa[p.materia].pair = notaNum;
        }
        alum.notasFormosa[p.materia].obs = obs;
        if (Number(notaNum) >= 6) aprobados++;
      }

      if (notaNum !== null || (valoracion && valoracion !== '') || obs !== '') {
        const idInst = (alum.institucionId === 'inst-pba' || (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id === 'inst-pba') || esBsAs) ? 2 : 1;
        paqueteDeNotas.push({
          dni_estudiante: String(alum.dni),
          materia: p.materia,
          periodo: p.periodo,
          nota_numerica: notaNum,
          valoracion_conceptual: valoracion,
          observacion: obs,
          id_institucion: idInst
        });
      }
      guardadosCount++;
    });

    // Enviar a MySQL
    let guardadoExitoso = true;
    if (paqueteDeNotas.length > 0) {
      try {
        const respDB = await fetch('api/notas.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paqueteDeNotas)
        });
        if (!respDB.ok) {
          guardadoExitoso = false;
        } else {
          const resJSON = await respDB.json();
          if (resJSON.status !== 'ok') {
            guardadoExitoso = false;
          }
        }
      } catch (errDB) {
        console.warn("Aviso al sincronizar planilla con notas:", errDB);
        guardadoExitoso = false;
      }
    }

    if (!guardadoExitoso) {
      if (btn) {
        btn.disabled = false;
        btn.style.backgroundColor = '#dc2626';
        btn.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
        setTimeout(() => {
          btn.style.backgroundColor = '';
          btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Modificaciones`;
        }, 3000);
      }
      mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
      return;
    }

    // Actualizar metadatos de la planilla
    const horaStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const fechaStr = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    p.fechaCarga = `${fechaStr}, ${horaStr} hs`;
    p.fechaTimestamp = Date.now();
    p.totalAlumnos = alumnos.length;
    p.aprobados = aprobados;
    p.aIntensificar = Math.max(0, alumnos.length - aprobados);

    guardarBaseDatosEscolar();

    try {
      if (typeof cargarAlumnoEnBoletin === 'function') {
        await cargarAlumnoEnBoletin(alumnoActivoDni);
      }
      if (typeof renderizarBoletinPreview === 'function') {
        renderizarBoletinPreview();
      }
    } catch (eB) {
      console.warn("Aviso al refrescar boletín desde modal:", eB);
    }

    // Si la planilla actual en la pantalla principal coincide, refrescarla
    if (cursoSeleccionadoCarga === p.cursoId && materiaSeleccionadaCarga === p.materia && periodoSeleccionadoCarga === p.periodo) {
      renderizarTablaCargaDocente();
    }

    if (btn) {
      btn.style.backgroundColor = '#059669';
      btn.innerHTML = `<i class="fa-solid fa-circle-check"></i> Guardado correctamente`;
      setTimeout(() => {
        btn.disabled = false;
        btn.style.backgroundColor = '';
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Modificaciones`;
        cerrarModalEditarPlanilla();
        renderizarListaPlanillasGuardadas();
        mostrarToast('Guardado correctamente.', 'success');
      }, 700);
    }
  } catch (err) {
    console.error("Error al guardar en modal:", err);
    if (btn) {
      btn.disabled = false;
      btn.style.backgroundColor = '#dc2626';
      btn.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> No se guardó correctamente, intentalo de nuevo`;
      setTimeout(() => {
        btn.style.backgroundColor = '';
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Modificaciones`;
      }, 3000);
    }
    mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
  }
}

let planillaPendienteBorrarId = null;
let planillaPendienteBorrarVieneDeModal = false;

function borrarPlanillaDesdeModal() {
  if (!planillaActivaEdicionId) return;
  confirmarBorrarPlanilla(planillaActivaEdicionId, true);
}

// Abre el modal personalizado de confirmación de borrado
function confirmarBorrarPlanilla(idPlanilla, vieneDeModal = false) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.planillasGuardadas) return;

  const p = DB_ESCOLAR.planillasGuardadas.find(x => x.id === idPlanilla);
  if (!p) {
    mostrarToast('No se encontró la planilla seleccionada.', 'error');
    return;
  }

  planillaPendienteBorrarId = idPlanilla;
  planillaPendienteBorrarVieneDeModal = vieneDeModal;

  const modal = document.getElementById('modalConfirmarBorradoPlanilla');
  const matEl = document.getElementById('modalBorrarMateriaTexto');
  const curEl = document.getElementById('modalBorrarCursoTexto');
  const perEl = document.getElementById('modalBorrarPeriodoTexto');

  if (matEl) matEl.textContent = p.materia;
  if (curEl) curEl.textContent = `${p.nombreCurso}${p.orientacion ? ' (' + p.orientacion + ')' : ''}`;
  if (perEl) perEl.textContent = p.periodoNombre || (p.periodo || '').toUpperCase();

  if (modal) {
    modal.style.display = 'flex';
  }
}

// Cierra el modal de confirmación
function cerrarModalConfirmarBorrado(event = null) {
  if (event && event.target && event.target.id !== 'modalConfirmarBorradoPlanilla') {
    return;
  }
  const modal = document.getElementById('modalConfirmarBorradoPlanilla');
  if (modal) {
    modal.style.display = 'none';
  }
  planillaPendienteBorrarId = null;
  planillaPendienteBorrarVieneDeModal = false;
}

// Ejecuta el borrado una vez confirmado en el modal
async function ejecutarBorradoPlanillaConfirmada() {
  if (!DB_ESCOLAR || !DB_ESCOLAR.planillasGuardadas || !planillaPendienteBorrarId) {
    cerrarModalConfirmarBorrado();
    return;
  }

  const idPlanilla = planillaPendienteBorrarId;
  const vieneDeModal = planillaPendienteBorrarVieneDeModal;
  const p = DB_ESCOLAR.planillasGuardadas.find(x => x.id === idPlanilla);

  if (!p) {
    cerrarModalConfirmarBorrado();
    return;
  }

  const btnConfirm = document.getElementById('btnEjecutarBorradoPlanilla');
  if (btnConfirm) {
    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="color: #ffffff !important;"></i> Eliminando...';
  }

  try {
    const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
    const idInst = jurisActiva === 'pba' ? 2 : 1;

    // 1. Eliminar de la base de datos MySQL
    try {
      await fetch(`api/notas.php?materia=${encodeURIComponent(p.materia)}&periodo=${encodeURIComponent(p.periodo)}&id_institucion=${idInst}`, {
        method: 'DELETE'
      });
    } catch (eDB) {
      console.warn("Aviso al eliminar notas en el backend:", eDB);
    }

    // 2. Limpiar notas en la memoria local
    const esBsAs = jurisActiva === 'pba';
    const alumnos = (DB_ESCOLAR.alumnos || []).filter(a => a.cursoId === p.cursoId);

    alumnos.forEach(alum => {
      if (esBsAs) {
        if (alum.notasPba && alum.notasPba[p.materia]) {
          if (p.periodo === 'c1') {
            delete alum.notasPba[p.materia].c1_val;
            delete alum.notasPba[p.materia].c1_nota;
          } else if (p.periodo === 'c2') {
            delete alum.notasPba[p.materia].c2_val;
            delete alum.notasPba[p.materia].c2_nota;
          } else if (p.periodo === 'rit_dic') {
            delete alum.notasPba[p.materia].rit_dic;
          }
          delete alum.notasPba[p.materia].obs;
        }
      } else {
        if (alum.notasFormosa && alum.notasFormosa[p.materia]) {
          if (p.periodo === 't1') {
            delete alum.notasFormosa[p.materia].t1_n;
            delete alum.notasFormosa[p.materia].t1_c;
          } else if (p.periodo === 't2') {
            delete alum.notasFormosa[p.materia].t2_n;
            delete alum.notasFormosa[p.materia].t2_c;
          } else if (p.periodo === 't3') {
            delete alum.notasFormosa[p.materia].t3_n;
            delete alum.notasFormosa[p.materia].t3_c;
          } else if (p.periodo === 'rec_dic') {
            delete alum.notasFormosa[p.materia].rec_dic;
          } else if (p.periodo === 'pair') {
            delete alum.notasFormosa[p.materia].pair;
          }
          delete alum.notasFormosa[p.materia].obs;
        }
      }
    });

    // 3. Eliminar de planillas guardadas
    DB_ESCOLAR.planillasGuardadas = DB_ESCOLAR.planillasGuardadas.filter(x => x.id !== idPlanilla);

    guardarBaseDatosEscolar();

    if (typeof cargarAlumnoEnBoletin === 'function') {
      await cargarAlumnoEnBoletin(alumnoActivoDni);
    }
    if (typeof renderizarBoletinPreview === 'function') {
      renderizarBoletinPreview();
    }

    if (cursoSeleccionadoCarga === p.cursoId && materiaSeleccionadaCarga === p.materia && periodoSeleccionadoCarga === p.periodo) {
      renderizarTablaCargaDocente();
    }

    if (vieneDeModal) {
      cerrarModalEditarPlanilla();
    }

    cerrarModalConfirmarBorrado();
    renderizarListaPlanillasGuardadas();
    mostrarToast(`Se borró la planilla y se vaciaron las notas de ${p.materia} (${p.nombreCurso}) del sistema.`, 'info');
  } catch (err) {
    console.error('Error al eliminar planilla:', err);
    mostrarToast('Hubo un error al eliminar la planilla.', 'error');
  } finally {
    if (btnConfirm) {
      btnConfirm.disabled = false;
      btnConfirm.innerHTML = '<i class="fa-solid fa-trash-can" style="color: #ffffff !important;"></i> Sí, Eliminar Planilla';
    }
  }
}

// MODAL UNIVERSAL DE CONFIRMACIÓN ELEGANTE
let callbackConfirmacionUniversal = null;

function mostrarModalConfirmacion({
  titulo = '¿Confirmar Eliminación?',
  mensaje = 'Esta acción no se puede deshacer.',
  detalles = [],
  alerta = 'Los datos asociados serán removidos de forma permanente del sistema.',
  textoBoton = 'Sí, Eliminar',
  icono = 'fa-solid fa-trash-can',
  onConfirm = null
}) {
  const modal = document.getElementById('modalConfirmacionUniversal');
  if (!modal) {
    if (confirm(`${titulo}\n\n${mensaje}`)) {
      if (typeof onConfirm === 'function') onConfirm();
    }
    return;
  }

  callbackConfirmacionUniversal = onConfirm;

  const tituloEl = document.getElementById('modalConfirmarTitulo');
  const mensajeEl = document.getElementById('modalConfirmarMensaje');
  const iconoEl = document.getElementById('modalConfirmarIcono');
  const detallesEl = document.getElementById('modalConfirmarDetalles');
  const alertaTextoEl = document.getElementById('modalConfirmarAlertaTexto');
  const botonTextoEl = document.getElementById('modalConfirmarBotonTexto');
  const btnEjecutar = document.getElementById('btnEjecutarConfirmacionUniversal');

  if (tituloEl) tituloEl.textContent = titulo;
  if (mensajeEl) mensajeEl.textContent = mensaje;
  if (iconoEl) iconoEl.className = icono + ' text-red';
  if (alertaTextoEl) alertaTextoEl.textContent = alerta;
  if (botonTextoEl) botonTextoEl.textContent = textoBoton;

  if (btnEjecutar) {
    btnEjecutar.disabled = false;
    btnEjecutar.innerHTML = `<i class="${icono} text-white"></i> <span>${textoBoton}</span>`;
  }

  if (detallesEl) {
    if (detalles && detalles.length > 0) {
      detallesEl.style.display = 'block';
      detallesEl.innerHTML = detalles.map((item, idx) => {
        const esUltimo = idx === detalles.length - 1;
        const borderStyle = esUltimo ? '' : 'border-bottom: 1px solid rgba(255, 255, 255, 0.07); padding-bottom: 0.45rem; margin-bottom: 0.45rem;';
        const valorHtml = item.badge
          ? `<span class="badge ${item.badge}" style="font-size: 0.72rem; padding: 2px 8px; font-weight: 700;">${item.valor}</span>`
          : `<span class="${item.colorClase || 'text-white'}" style="font-weight: 700; font-size: 0.86rem; text-align: right; word-break: break-word;">${item.valor}</span>`;

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.6rem; ${borderStyle}">
            <span class="text-muted" style="font-size: 0.74rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.03em;">${item.label}:</span>
            ${valorHtml}
          </div>
        `;
      }).join('');
    } else {
      detallesEl.style.display = 'none';
      detallesEl.innerHTML = '';
    }
  }

  modal.style.display = 'flex';
}

function cerrarModalConfirmacionUniversal(e) {
  if (e && e.target && e.target.id !== 'modalConfirmacionUniversal') return;
  const modal = document.getElementById('modalConfirmacionUniversal');
  if (modal) modal.style.display = 'none';
  callbackConfirmacionUniversal = null;
}

function ejecutarAccionConfirmada() {
  const btn = document.getElementById('btnEjecutarConfirmacionUniversal');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-white"></i> Eliminando...';
  }

  setTimeout(() => {
    try {
      if (typeof callbackConfirmacionUniversal === 'function') {
        callbackConfirmacionUniversal();
      }
    } finally {
      cerrarModalConfirmacionUniversal();
    }
  }, 220);
}

function cargarPlanillaEnPanelPrincipal(idPlanilla) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.planillasGuardadas) return;

  const p = DB_ESCOLAR.planillasGuardadas.find(x => x.id === idPlanilla);
  if (!p) return;

  // Cambiar ciclo
  cicloActivo = p.ciclo || 'basico';
  seleccionarCiclo(cicloActivo);

  // Seleccionar curso
  cursoSeleccionadoCarga = p.cursoId;
  const selCurso = document.getElementById('selectPreceptorCurso');
  if (selCurso) selCurso.value = cursoSeleccionadoCarga;
  const selPlanillaCurso = document.getElementById('selectFiltroPlanillaCurso');
  if (selPlanillaCurso) selPlanillaCurso.value = cursoSeleccionadoCarga;
  renderizarListaPlanillasGuardadas();

  // Seleccionar materia
  materiaSeleccionadaCarga = p.materia;
  const selMat = document.getElementById('selectPreceptorMateria');
  if (selMat) selMat.value = materiaSeleccionadaCarga;

  // Seleccionar período
  periodoSeleccionadoCarga = p.periodo;
  const selPer = document.getElementById('selectPreceptorPeriodo');
  if (selPer) selPer.value = periodoSeleccionadoCarga;

  renderizarTablaCargaDocente();

  // Scroll suave hacia la tabla principal de carga
  const panelCarga = document.getElementById('preceptorPanelCarga');
  if (panelCarga) {
    panelCarga.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  mostrarToast(`Planilla de ${p.materia} (${p.nombreCurso}) cargada en el panel principal.`, 'info');
}

// 13. NAVEGACIÓN DE PESTAÑAS DEL PRECEPTOR / DOCENTE

function cambiarPestanaPreceptor(tab) {
  if (window.location.hash) {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  }

  const panCarga = document.getElementById('preceptorPanelCarga');
  const panAsist = document.getElementById('preceptorPanelAsistencia');
  const panInst = document.getElementById('preceptorPanelInstitucion');
  const panAlum = document.getElementById('preceptorPanelAlumnos');
  const panBol = document.getElementById('preceptorPanelBoletin');
  const panMesas = document.getElementById('preceptorPanelMesas');
  const panNotif = document.getElementById('preceptorPanelNotificaciones');

  if (panCarga) panCarga.style.display = tab === 'carga' ? 'block' : 'none';
  if (panAsist) panAsist.style.display = tab === 'asistencia' ? 'block' : 'none';
  if (panInst) panInst.style.display = tab === 'institucion' ? 'block' : 'none';
  if (panAlum) panAlum.style.display = tab === 'alumnos' ? 'block' : 'none';
  if (panBol) panBol.style.display = tab === 'boletin' ? 'block' : 'none';
  if (panMesas) panMesas.style.display = tab === 'mesas' ? 'block' : 'none';
  if (panNotif) panNotif.style.display = tab === 'notificaciones' ? 'block' : 'none';

  // Resaltar botones de pestañas
  const tabBtns = ['Carga', 'Asistencia', 'Institucion', 'Alumnos', 'Mesas', 'Notif', 'Boletin'];
  tabBtns.forEach(t => {
    const btn = document.getElementById(`btnTabPrec${t}`);
    const navLink = document.getElementById(`navLinkPrec${t}`);
    const activo = t.toLowerCase() === tab.toLowerCase() || (t.toLowerCase() === 'notif' && tab.toLowerCase() === 'notificaciones');
    if (btn) btn.classList.toggle('active', activo);
    if (navLink) navLink.classList.toggle('active', activo);
  });

  // Acciones al cambiar de pestaña
  if (tab === 'institucion') {
    cargarDatosInstitucionEnForm();
    renderizarTarjetasInstituciones();
    renderizarEstructuraCurricular();
    if (typeof sincronizarInstitucionYCursosDesdeMySQL === 'function') {
      sincronizarInstitucionYCursosDesdeMySQL();
    }
  } else if (tab === 'carga') {
    seleccionarCiclo(cicloActivo || 'basico');
    if (typeof sincronizarPlanillasCargadas === 'function') {
      sincronizarPlanillasCargadas();
      renderizarListaPlanillasGuardadas();
    }
    if (typeof renderizarTablaCargaDocente === 'function') {
      renderizarTablaCargaDocente();
    }
  } else if (tab === 'asistencia') {
    poblarSelectorCursosAsistencia();
    poblarSelectorPeriodosAsistencia();
    renderizarTablaAsistencia();
    if (typeof avisarFeriadosDelMes === 'function') {
      avisarFeriadosDelMes();
    }
  } else if (tab === 'alumnos') {
    poblarSelectorCursosFiltroPadron();
    renderizarPadronAlumnos();
  } else if (tab === 'mesas') {
    renderizarMesasPreceptor();
    if (typeof sincronizarMesasDesdeMySQL === 'function') {
      sincronizarMesasDesdeMySQL().then(() => renderizarMesasPreceptor());
    }
  } else if (tab === 'notificaciones') {
    renderizarNotificacionesPreceptor();
    if (typeof sincronizarNotificacionesDesdeMySQL === 'function') {
      sincronizarNotificacionesDesdeMySQL().then(() => renderizarNotificacionesPreceptor());
    }
  } else if (tab === 'boletin') {
    poblarSelectorPreviewAlumnos();
    if (!alumnoActivoDni && DB_ESCOLAR && DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos.length > 0) {
      alumnoActivoDni = DB_ESCOLAR.alumnos[0].dni;
    }
    const sel = document.getElementById('selectPreviewAlumno');
    if (sel && alumnoActivoDni) sel.value = alumnoActivoDni;
    cargarAlumnoEnBoletin(alumnoActivoDni).then(() => {
      renderizarBoletinPreview();
    });
  }
}

// Navegación de pestañas para el Tutor / Familia
let pestanaTutorActiva = 'boletin';

function cambiarPestanaTutor(tab) {
  if (window.location.hash) {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  }

  pestanaTutorActiva = tab;
  asegurarUbicacionBoletin();

  const panBol = document.getElementById('tutorPanelBoletin');
  const panAsist = document.getElementById('tutorPanelAsistencia');
  const panMesas = document.getElementById('tutorPanelMesas');
  const panNotif = document.getElementById('tutorPanelNotificaciones');

  if (panBol) panBol.style.display = tab === 'boletin' ? 'block' : 'none';
  if (panAsist) panAsist.style.display = tab === 'asistencia' ? 'block' : 'none';
  if (panMesas) panMesas.style.display = tab === 'mesas' ? 'block' : 'none';
  if (panNotif) panNotif.style.display = tab === 'notificaciones' ? 'block' : 'none';

  // Resaltar pestañas del tutor
  const tabs = [
    { id: 'boletin', elId: 'navLinkTutorBoletin' },
    { id: 'asistencia', elId: 'navLinkTutorAsistencia' },
    { id: 'mesas', elId: 'navLinkTutorMesas' },
    { id: 'notificaciones', elId: 'navLinkTutorNotif' }
  ];

  tabs.forEach(t => {
    const el = document.getElementById(t.elId);
    if (el) el.classList.toggle('active', t.id === tab);
  });

  // Cargar contenido según la pestaña seleccionada
  if (tab === 'boletin') {
    if (datosMemoria) {
      renderizarPortal(datosMemoria);
    } else if (alumnoActivoDni) {
      cargarAlumnoEnBoletin(alumnoActivoDni);
    }
  } else if (tab === 'asistencia') {
    renderizarAsistenciaTutor();
    if (typeof avisarFeriadosDelMes === 'function') {
      avisarFeriadosDelMes();
    }
  } else if (tab === 'mesas') {
    renderizarMesasTutor();
    if (typeof sincronizarMesasDesdeMySQL === 'function') {
      sincronizarMesasDesdeMySQL().then(() => renderizarMesasTutor());
    }
  } else if (tab === 'notificaciones') {
    renderizarNotificacionesTutor();
    if (typeof sincronizarNotificacionesDesdeMySQL === 'function') {
      sincronizarNotificacionesDesdeMySQL().then(() => renderizarNotificacionesTutor());
    }
  }
}

// Renderizar panel de asistencia individual para la vista del tutor
function renderizarAsistenciaTutor() {
  const grid = document.getElementById('tutorAsistenciaGridMetricas');
  const badgeEstado = document.getElementById('tutorBadgeAsistEstado');
  const porcTexto = document.getElementById('tutorAsistPorcentajeTexto');
  const progressBar = document.getElementById('tutorAsistProgressBar');
  const msgRegul = document.getElementById('tutorAsistMensajeRegul');

  if (!grid || !DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;

  const alumno = obtenerAlumnoActivo();
  if (!alumno) return;

  const datos = obtenerDatosAsistenciaAlumno(alumno);

  // Badge de regularidad
  if (badgeEstado) {
    if (datos.inasistencias <= 15) {
      badgeEstado.className = 'badge badge-green';
      badgeEstado.innerHTML = '<i class="fa-solid fa-circle-check"></i> Asistencia Regular';
    } else if (datos.inasistencias <= 20) {
      badgeEstado.className = 'badge badge-amber';
      badgeEstado.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Alerta Preventiva de Faltas';
    } else {
      badgeEstado.className = 'badge badge-red';
      badgeEstado.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Límite de Regularidad Excedido';
    }
  }

  // Tarjetas de métricas
  grid.innerHTML = `
    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-blue">
        <i class="fa-solid fa-calendar-days"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Días Hábiles del Ciclo</div>
        <div class="text-white" style="font-size: 1.25rem; font-weight: 800;">${datos.dias} Días</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-green">
        <i class="fa-solid fa-user-check"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Asistencias (Presente)</div>
        <div class="text-green" style="font-size: 1.25rem; font-weight: 800;">${datos.asistencias} Días</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-amber">
        <i class="fa-solid fa-file-medical"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Faltas Justificadas</div>
        <div class="text-amber" style="font-size: 1.25rem; font-weight: 800;">${datos.justificadas} Inasistencias</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-red">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Faltas Injustificadas</div>
        <div class="text-red" style="font-size: 1.25rem; font-weight: 800;">${datos.injustificadas} Inasistencias</div>
      </div>
    </div>
  `;

  // Barra de progreso y porcentaje
  if (porcTexto) {
    const colorPorc = datos.porcentaje >= 85 ? '#4ade80' : datos.porcentaje >= 75 ? '#facc15' : '#f87171';
    porcTexto.style.color = colorPorc;
    porcTexto.textContent = `${datos.porcentaje}%`;
  }

  if (progressBar) {
    progressBar.style.width = `${datos.porcentaje}%`;
    if (datos.porcentaje >= 85) {
      progressBar.style.background = 'linear-gradient(90deg, #38bdf8, #22c55e)';
    } else if (datos.porcentaje >= 75) {
      progressBar.style.background = 'linear-gradient(90deg, #38bdf8, #facc15)';
    } else {
      progressBar.style.background = 'linear-gradient(90deg, #facc15, #ef4444)';
    }
  }

  // Mensaje de situación
  if (msgRegul) {
    if (datos.inasistencias <= 15) {
      const margen = 15 - datos.inasistencias;
      msgRegul.style.background = 'rgba(34, 197, 94, 0.1)';
      msgRegul.style.borderColor = 'rgba(34, 197, 94, 0.25)';
      msgRegul.style.color = '#86efac';
      msgRegul.innerHTML = `<i class="fa-solid fa-circle-check"></i> El estudiante tiene <strong>${datos.inasistencias} inasistencias</strong> en total. Mantiene regularidad normal (restan ${margen} faltas antes del límite de alerta de 15).`;
    } else if (datos.inasistencias <= 20) {
      const margen = 20 - datos.inasistencias;
      msgRegul.style.background = 'rgba(250, 204, 21, 0.1)';
      msgRegul.style.borderColor = 'rgba(250, 204, 21, 0.25)';
      msgRegul.style.color = '#fde047';
      msgRegul.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ¡Atención! El estudiante acumula <strong>${datos.inasistencias} faltas</strong> (zona de alerta). Restan ${margen} falta(s) antes del límite de reincorporación (20 faltas).`;
    } else {
      msgRegul.style.background = 'rgba(239, 68, 68, 0.1)';
      msgRegul.style.borderColor = 'rgba(239, 68, 68, 0.25)';
      msgRegul.style.color = '#fca5a5';
      msgRegul.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> Límite de inasistencias excedido (<strong>${datos.inasistencias} faltas</strong>). Es necesario concertar una entrevista con la Dirección para iniciar el trámite de reincorporación.`;
    }
  }
}

// Renderizar panel de mesas de examen para la vista del tutor (previas e inscripción online por condición)
function renderizarMesasTutor() {
  const tbodyPrevias = document.getElementById('tbodyTutorMesasPrevias');
  const badgeCant = document.getElementById('tutorBadgeMesasCant');
  const tbodyInscripcion = document.getElementById('tbodyTutorMesasInscripcion');
  const badgeDisponibles = document.getElementById('badgeTutorMesasDisponibles');
  const boxMisInsc = document.getElementById('boxMisInscripcionesTutor');
  const listaMisInsc = document.getElementById('listaMisInscripcionesConfirmadas');
  const badgeCantConfirmadas = document.getElementById('badgeCantInscripcionesConfirmadas');

  if (!DB_ESCOLAR) return;

  // 1. Obtener datos del alumno activo de la escuela activa
  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const alumnoActual = obtenerAlumnoActivo() ||
    (datosMemoria && datosMemoria.estudiante ? {
      dni: datosMemoria.estudiante.dni || (jurisActiva === 'pba' ? '48763736' : '34567890'),
      nombre: datosMemoria.estudiante.nombre || (jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO'),
      curso: datosMemoria.estudiante.curso || (jurisActiva === 'pba' ? '4° Única' : '2° III')
    } : {
      dni: jurisActiva === 'pba' ? '48763736' : '34567890',
      nombre: jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO',
      curso: jurisActiva === 'pba' ? '4° Única' : '2° III'
    });

  const alumnoDni = alumnoActual ? alumnoActual.dni : alumnoActivoDni;

  // 2. Renderizar tabla de previas / pendientes del estudiante
  if (tbodyPrevias) {
    const items = (datosMemoria && datosMemoria.bloqueInferior && datosMemoria.bloqueInferior.items) || [];
    if (badgeCant) {
      badgeCant.textContent = `${items.length} Materia(s) a Rendir`;
      badgeCant.className = items.length === 0 ? 'badge badge-green' : 'badge badge-amber';
    }

    if (items.length === 0) {
      tbodyPrevias.innerHTML = `
        <tr>
          <td colspan="6" class="text-green" style="text-align: center; padding: 2rem;">
            <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
            <strong>¡Excelente!</strong> El estudiante no tiene materias previas ni espacios pendientes de acreditación.
          </td>
        </tr>
      `;
    } else {
      let htmlPrev = '';
      items.forEach((item, index) => {
        const condicion = item.c4 || 'Pendiente';
        const esAprobada = condicion.toLowerCase().includes('aprob');
        const badgeCond = esAprobada
          ? '<span class="badge badge-green">Acreditada</span>'
          : '<span class="badge badge-amber">A Rendir</span>';
        const turnoEstimado = index % 2 === 0 ? 'Turno Diciembre 2026' : 'Turno Febrero / Marzo 2027';

        htmlPrev += `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${index + 1}</td>
            <td class="text-white" style="font-weight: 600;">${item.c1 || 'Previa'}</td>
            <td style="color: var(--text-muted);">${item.c2 || '-'}</td>
            <td class="text-blue" style="font-weight: 700;">${item.c3 || '-'}</td>
            <td style="text-align: center;">${badgeCond}</td>
            <td class="text-secondary" style="text-align: center; font-size: 0.82rem;">${turnoEstimado}</td>
          </tr>
        `;
      });
      tbodyPrevias.innerHTML = htmlPrev;
    }
  }

  // 3. Renderizar mesas de examen disponibles e inscripción online 
  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const mesas = (DB_ESCOLAR.mesasExamen || []).filter(m => !m.institucionId || m.institucionId === instActiva);
  if (badgeDisponibles) {
    badgeDisponibles.textContent = `${mesas.length} Mesas Habilitadas`;
  }

  if (tbodyInscripcion) {
    if (mesas.length === 0) {
      tbodyInscripcion.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            <i class="fa-solid fa-calendar-xmark text-dim" style="font-size: 1.75rem; margin-bottom: 0.5rem; display: block;"></i>
            No hay mesas de examen disponibles para inscripción en este momento.
          </td>
        </tr>
      `;
    } else {
      let htmlInsc = '';
      mesas.forEach((mesa, idx) => {
        const inscriptos = mesa.inscriptos || [];
        const inscriptoObj = inscriptos.find(i => i.dni === alumnoDni);
        const estaInscripto = !!inscriptoObj;

        // Formatear fecha
        let fechaFmt = mesa.fecha;
        if (mesa.fecha && mesa.fecha.includes('-')) {
          const p = mesa.fecha.split('-');
          if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
        }

        // Columna de Condición del alumno (Regular / Libre)
        let badgeCondicion = '';
        if (estaInscripto) {
          const cond = inscriptoObj.condicion || 'Regular';
          badgeCondicion = cond === 'Libre'
            ? `<span class="badge badge-amber"><i class="fa-solid fa-book-open"></i> Alumno Libre</span>`
            : `<span class="badge badge-green"><i class="fa-solid fa-user-check"></i> Alumno Regular</span>`;
        } else {
          badgeCondicion = `<span style="color: var(--text-muted); font-size: 0.78rem;"><i class="fa-solid fa-user-tag text-amber"></i> Regular o Libre</span>`;
        }

        // Columna de acción de inscripción
        let botonAccion = '';
        if (estaInscripto) {
          botonAccion = `
            <div style="display: flex; gap: 0.4rem; justify-content: center; align-items: center; flex-wrap: wrap;">
              <button type="button" class="btn-success" style="padding: 0.35rem 0.65rem; font-size: 0.74rem;" onclick="verComprobanteInscripcion('${mesa.id}')">
                <i class="fa-solid fa-file-circle-check"></i> Constancia
              </button>
              <button type="button" class="btn-cancelar" style="padding: 0.35rem 0.55rem; font-size: 0.74rem;" onclick="cancelarInscripcionMesa('${mesa.id}')" title="Anular inscripción">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `;
        } else if (mesa.estado === 'cerrada') {
          botonAccion = `
            <button type="button" class="btn-tab" disabled style="opacity: 0.6; font-size: 0.74rem; cursor: not-allowed;">
              <i class="fa-solid fa-lock"></i> Inscripción Cerrada
            </button>
          `;
        } else {
          botonAccion = `
            <button type="button" class="btn-toolbar-action btn-toolbar-primary" style="padding: 0.4rem 0.85rem; font-size: 0.75rem;" onclick="abrirModalInscripcionAlumno('${mesa.id}')">
              <i class="fa-solid fa-pen-to-square"></i> Inscribirme a la Mesa
            </button>
          `;
        }

        htmlInsc += `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
            <td>
              <div class="text-white" style="font-weight: 700; font-size: 0.88rem;">${mesa.materia}</div>
              <div style="margin-top: 3px; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                <span class="badge badge-purple" style="font-size: 0.68rem; font-weight: 700;">
                  <i class="fa-solid fa-graduation-cap"></i> ${mesa.curso || 'Ciclo Básico'}
                </span>
                <span class="text-blue" style="font-size: 0.72rem;">${mesa.turno || 'Turno Regular'}</span>
              </div>
            </td>
            <td style="text-align: center;">
              <span class="badge badge-amber" style="font-weight: 700; font-size: 0.75rem;">
                <i class="fa-solid fa-calendar"></i> Mesa de ${mesa.mes || 'Diciembre'}
              </span>
            </td>
            <td style="color: #cbd5e1; font-size: 0.84rem;">
              <i class="fa-solid fa-chalkboard-user" style="color: #38bdf8; margin-right: 4px;"></i> ${mesa.docentes || 'A designar'}
            </td>
            <td style="text-align: center;">
              <div style="font-weight: 700; color: #fff; font-size: 0.84rem;"><i class="fa-solid fa-calendar-day" style="color: #38bdf8; margin-right: 4px;"></i> ${fechaFmt}</div>
              <div style="font-size: 0.76rem; color: #38bdf8; font-weight: 600;"><i class="fa-solid fa-clock" style="margin-right: 2px;"></i> ${mesa.hora} hs</div>
            </td>
            <td style="text-align: center;">
              ${badgeCondicion}
            </td>
            <td style="text-align: center;">
              ${botonAccion}
            </td>
          </tr>
        `;
      });
      tbodyInscripcion.innerHTML = htmlInsc;
    }
  }

  // 4. Mis Inscripciones Confirmadas
  const misInscripciones = mesas.filter(m => (m.inscriptos || []).some(i => i.dni === alumnoDni));

  if (boxMisInsc) {
    if (misInscripciones.length > 0) {
      boxMisInsc.style.display = 'block';
      if (badgeCantConfirmadas) {
        badgeCantConfirmadas.textContent = `${misInscripciones.length} Mesa(s) Confirmada(s)`;
      }

      if (listaMisInsc) {
        listaMisInsc.innerHTML = `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem;">
            ${misInscripciones.map(m => {
          const inscObj = (m.inscriptos || []).find(i => i.dni === alumnoDni);
          const condicion = (inscObj && inscObj.condicion) || 'Regular';
          const esLibre = condicion === 'Libre';

          let fechaFmt = m.fecha;
          if (m.fecha && m.fecha.includes('-')) {
            const p = m.fecha.split('-');
            if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
          }
          return `
                <div style="background: #111827; border: 1.5px solid ${esLibre ? '#f59e0b' : '#22c55e'}; border-radius: 8px; padding: 0.85rem 1rem;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                    <div>
                      <div style="font-size: 0.95rem; font-weight: 800; color: #fff;">${m.materia}</div>
                      <div style="font-size: 0.74rem; color: #fbbf24; margin-top: 2px;">
                        <i class="fa-solid fa-calendar"></i> Mesa de ${m.mes || 'Diciembre'}
                      </div>
                    </div>
                    <span class="badge ${esLibre ? 'badge-amber' : 'badge-green'}" style="font-size: 0.72rem; font-weight: 700;">
                      <i class="${esLibre ? 'fa-solid fa-book-open' : 'fa-solid fa-user-check'}"></i> ${condicion.toUpperCase()}
                    </span>
                  </div>
                  <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.5; margin-bottom: 0.65rem;">
                    <div><i class="fa-solid fa-calendar-day" style="color: #38bdf8; width: 16px;"></i> <strong>Fecha:</strong> ${fechaFmt} — ${m.hora} hs</div>
                    <div><i class="fa-solid fa-chalkboard-user" style="color: #a855f7; width: 16px;"></i> <strong>Tribunal:</strong> ${m.docentes || 'A designar'}</div>
                    <div><i class="fa-solid fa-user-tag" style="color: #fbbf24; width: 16px;"></i> <strong>Condición:</strong> Alumno ${condicion}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 3px;">
                      <i class="fa-solid fa-clock" style="width: 16px;"></i> Inscripto el: ${inscObj ? inscObj.fechaInscripcion : '-'}
                    </div>
                  </div>
                  <div style="display: flex; gap: 0.5rem; justify-content: flex-end; border-top: 1px dashed #1e293b; padding-top: 0.5rem;">
                    <button type="button" class="btn-cancelar" style="padding: 0.35rem 0.65rem; font-size: 0.72rem;" onclick="cancelarInscripcionMesa('${m.id}')">
                      <i class="fa-solid fa-xmark"></i> Anular
                    </button>
                    <button type="button" class="btn-success" style="padding: 0.35rem 0.65rem; font-size: 0.72rem;" onclick="verComprobanteInscripcion('${m.id}')">
                      <i class="fa-solid fa-print"></i> Constancia
                    </button>
                  </div>
                </div>
              `;
        }).join('')}
          </div>
        `;
      }
    } else {
      boxMisInsc.style.display = 'none';
    }
  }
}

// 14. GESTIÓN MULTI-INSTITUCIÓN Y SELECTOR DE PROVINCIAS

// 1. Selector desplegable de escuelas en la barra superior y sincronización de régimen
function poblarSelectorEscuelas() {
  const sel = document.getElementById('selectEscuelaActiva');
  if (sel && DB_ESCOLAR && DB_ESCOLAR.instituciones) {
    sel.innerHTML = DB_ESCOLAR.instituciones.map(inst => {
      const esPba = inst.jurisdiccion === 'pba';
      const tag = esPba ? 'Buenos Aires (RITE)' : 'Formosa (Trimestral)';
      return `<option value="${inst.id}" ${inst.id === DB_ESCOLAR.institucionActivaId ? 'selected' : ''}>${inst.nombre} • ${tag}</option>`;
    }).join('');
  }

  // Sincronizar el badge de régimen según la escuela activa
  if (DB_ESCOLAR && DB_ESCOLAR.instituciones) {
    const escActiva = DB_ESCOLAR.instituciones.find(i => i.id === DB_ESCOLAR.institucionActivaId);
    if (escActiva) {
      actualizarBadgeRegimenPreceptor(escActiva.jurisdiccion);
    }
  }
}

// 2. Render de tarjetas de escuelas en la pestaña Institución
function renderizarTarjetasInstituciones() {
  const grid = document.getElementById('gridInstitucionesCards');
  if (!grid || !DB_ESCOLAR || !DB_ESCOLAR.instituciones) return;

  grid.innerHTML = DB_ESCOLAR.instituciones.map(inst => {
    const esActiva = inst.id === DB_ESCOLAR.institucionActivaId;
    const esPba = inst.jurisdiccion === 'pba';
    const badgeProv = esPba
      ? '<span class="badge badge-blue"><i class="fa-solid fa-map-pin"></i> Buenos Aires • RITE</span>'
      : '<span class="badge badge-amber"><i class="fa-solid fa-map-location-dot"></i> Formosa • Trimestral</span>';

    return `
      <div class="card-institucion ${esActiva ? 'activa' : ''}">
        <div>
          <div class="card-institucion-header">
            <h4 class="card-institucion-title">${inst.nombre}</h4>
            ${badgeProv}
          </div>
          <div class="card-institucion-meta" style="margin-top: 0.5rem;">
            <span><i class="fa-solid fa-id-card"></i> <strong>CUE:</strong> ${inst.cue || 'Sin CUE'}</span>
            <span><i class="fa-solid fa-location-dot"></i> ${inst.subtitulo || 'Establecimiento escolar'}</span>
            <span><i class="fa-solid fa-graduation-cap"></i> ${inst.nivel || 'Secundario'}</span>
          </div>
        </div>

        <div style="margin-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
          ${esActiva
        ? '<span class="badge badge-green" style="font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Escuela Activa</span>'
        : `<button type="button" class="btn-tab" style="font-size: 0.75rem; padding: 0.35rem 0.75rem;" onclick="alSeleccionarEscuela('${inst.id}')">
                <i class="fa-solid fa-arrows-rotate"></i> Activar esta Escuela
               </button>`
      }
        </div>
      </div>
    `;
  }).join('');
}

// 3. Selección y activación de una escuela
function alSeleccionarEscuela(id) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.instituciones) return;
  const inst = DB_ESCOLAR.instituciones.find(i => i.id === id);
  if (!inst) return;

  DB_ESCOLAR.institucionActivaId = id;
  DB_ESCOLAR.configuracion = inst;
  guardarBaseDatosEscolar();

  if (datosMemoria && datosMemoria.institucion) {
    datosMemoria.institucion.nombre = inst.nombre;
    datosMemoria.institucion.subtitulo = inst.subtitulo;
    if (inst.cue) datosMemoria.institucion.cue = inst.cue;
  }

  cambiarJurisdiccion(inst.jurisdiccion, false);
  cargarDatosInstitucionEnForm();
  mostrarToast(`Escuela activa: ${inst.nombre}`, 'success');
}

function alCambiarEscuelaDesdeDropdown(id) {
  alSeleccionarEscuela(id);
}

// 4. Cargar datos en el formulario de edición de la escuela activa
function cargarDatosInstitucionEnForm() {
  if (!DB_ESCOLAR) return;
  const cfg = DB_ESCOLAR.configuracion || {};

  const inputNom = document.getElementById('instNombreInput');
  const inputCue = document.getElementById('instCueInput');
  const inputSub = document.getElementById('instSubtituloInput');
  const selNivel = document.getElementById('instNivelSelect');
  const selJuris = document.getElementById('instJurisdiccionSelect');

  if (inputNom) inputNom.value = cfg.nombre || (datosMemoria ? datosMemoria.institucion.nombre : '');
  if (inputCue) inputCue.value = cfg.cue || '3400124-00';
  if (inputSub) inputSub.value = cfg.subtitulo || (datosMemoria ? datosMemoria.institucion.subtitulo : '');
  if (selNivel) selNivel.value = cfg.nivel || 'Secundario';
  if (selJuris) selJuris.value = cfg.jurisdiccion || ((datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires') ? 'pba' : 'formosa');
}

// 6. Guardar modificaciones de la escuela activa en MySQL y en memoria local
async function guardarDatosInstitucionForm(e) {
  if (e) e.preventDefault();
  if (!DB_ESCOLAR) return;

  const nombre = document.getElementById('instNombreInput').value.trim();
  const cue = document.getElementById('instCueInput').value.trim();
  const subtitulo = document.getElementById('instSubtituloInput').value.trim();
  const nivel = document.getElementById('instNivelSelect').value;
  const jurisdiccion = document.getElementById('instJurisdiccionSelect').value;

  const activeId = DB_ESCOLAR.institucionActivaId || 'inst-formosa';
  const idInstitucion = (jurisdiccion === 'pba' || activeId === 'inst-pba') ? 2 : 1;
  const regimen = jurisdiccion === 'pba' ? 'Secundaria Cuatrimestral (R.I.T.E.)' : 'Secundaria 3 Trimestres con PAIR';

  const escuelaExistente = (DB_ESCOLAR.instituciones || []).find(i => i.id === activeId);

  const datosActualizados = {
    id: activeId,
    nombre: nombre || 'Institución Escolar',
    cue: cue || (idInstitucion === 2 ? '0604123-00' : '3400124-00'),
    subtitulo: subtitulo || 'Ciclo Lectivo 2026',
    nivel: nivel || 'Secundario',
    jurisdiccion: jurisdiccion || 'formosa',
    regimen: regimen,
    configurado: true
  };

  if (escuelaExistente) {
    Object.assign(escuelaExistente, datosActualizados);
  } else {
    if (!DB_ESCOLAR.instituciones) DB_ESCOLAR.instituciones = [];
    DB_ESCOLAR.instituciones.push(datosActualizados);
  }

  DB_ESCOLAR.configuracion = datosActualizados;
  guardarBaseDatosEscolar();

  if (datosMemoria && datosMemoria.institucion) {
    datosMemoria.institucion.nombre = datosActualizados.nombre;
    datosMemoria.institucion.subtitulo = datosActualizados.subtitulo;
    if (cue) datosMemoria.institucion.cue = cue;
  }

  actualizarBadgeRegimenPreceptor(jurisdiccion);
  poblarSelectorEscuelas();
  renderizarTarjetasInstituciones();
  renderizarEstructuraCurricular();

  // Guardar en MySQL
  try {
    const resp = await fetch('api/instituciones.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_institucion',
        id_institucion: idInstitucion,
        nombre: datosActualizados.nombre,
        cue: datosActualizados.cue,
        nivel: datosActualizados.nivel,
        subtitulo: datosActualizados.subtitulo,
        regimen: datosActualizados.regimen,
        jurisdiccion: datosActualizados.jurisdiccion
      })
    });
    if (resp.ok) {
      mostrarToast('¡Datos institucionales guardados en la base de datos MySQL con éxito!', 'success');
    } else {
      mostrarToast('Datos guardados localmente.', 'info');
    }
  } catch (errMySQL) {
    console.warn("Aviso al guardar institución en MySQL:", errMySQL);
    mostrarToast('Datos guardados en memoria local.', 'info');
  }
}

// 6.1 Sincronizar datos institucionales y estructura curricular (cursos/divisiones) desde MySQL
let filtroCicloActivo = 'todos';

async function sincronizarInstitucionYCursosDesdeMySQL() {
  try {
    const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
      ? DB_ESCOLAR.configuracion.jurisdiccion
      : "formosa";
    const idInst = jurisActiva === 'pba' ? 2 : 1;
    const instKey = idInst === 2 ? 'inst-pba' : 'inst-formosa';

    const resp = await fetch(`api/instituciones.php?id_institucion=${idInst}`);
    if (!resp.ok) return;
    const instData = await resp.json();
    if (!instData || !instData.id_db) return;

    if (!DB_ESCOLAR.instituciones) DB_ESCOLAR.instituciones = [];
    const idxInst = DB_ESCOLAR.instituciones.findIndex(i => i.id === instKey);
    const datosInst = {
      id: instKey,
      nombre: instData.nombre || 'Institución Escolar',
      cue: instData.cue || (idInst === 2 ? '0604123-00' : '3400124-00'),
      nivel: instData.nivel || 'Secundario',
      subtitulo: instData.subtitulo || 'Ciclo Lectivo 2026',
      jurisdiccion: instData.jurisdiccion || jurisActiva,
      regimen: instData.regimen || (idInst === 2 ? 'Secundaria Cuatrimestral (R.I.T.E.)' : 'Secundaria 3 Trimestres con PAIR'),
      configurado: true
    };

    if (idxInst !== -1) {
      DB_ESCOLAR.instituciones[idxInst] = { ...DB_ESCOLAR.instituciones[idxInst], ...datosInst };
    } else {
      DB_ESCOLAR.instituciones.push(datosInst);
    }
    DB_ESCOLAR.configuracion = { ...DB_ESCOLAR.configuracion, ...datosInst };

    if (datosMemoria && datosMemoria.institucion) {
      datosMemoria.institucion.nombre = datosInst.nombre;
      datosMemoria.institucion.subtitulo = datosInst.subtitulo;
      if (datosInst.cue) datosMemoria.institucion.cue = datosInst.cue;
    }

    // Actualizar cursos y divisiones de esta escuela desde MySQL
    if (Array.isArray(instData.cursos) && instData.cursos.length > 0) {
      if (!DB_ESCOLAR.cursos) DB_ESCOLAR.cursos = [];
      const otrosCursos = DB_ESCOLAR.cursos.filter(c => c.institucionId && c.institucionId !== instKey);
      const nuevosCursos = instData.cursos.map(c => ({
        id: c.id || c.codigo_curso,
        id_db: c.id_db,
        codigo_curso: c.codigo_curso || c.id,
        nombre: c.nombre,
        turno: c.turno || 'Turno Mañana',
        ciclo: c.ciclo || 'basico',
        anio: parseInt(c.anio, 10),
        division: c.division || 'I',
        orientacion: c.orientacion || (c.ciclo === 'orientado' ? 'Ciencias Naturales' : 'Ciclo Básico'),
        institucionId: instKey
      }));
      DB_ESCOLAR.cursos = [...otrosCursos, ...nuevosCursos];
    }

    guardarBaseDatosEscolar();
    cargarDatosInstitucionEnForm();
    renderizarTarjetasInstituciones();
    renderizarEstructuraCurricular();
  } catch (err) {
    console.warn("Aviso al sincronizar institución y cursos desde MySQL:", err);
  }
}

// Renderizado dinámico de la Estructura Curricular (Ciclos, Orientaciones y Divisiones)
function renderizarEstructuraCurricular() {
  const cont = document.getElementById('contenedorEstructuraCurricular');
  if (!cont || !DB_ESCOLAR) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id)
    ? DB_ESCOLAR.configuracion.id
    : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);

  if (cursos.length === 0) {
    cont.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: #0f172a; border-radius: 8px;">
        <i class="fa-solid fa-layer-group" style="font-size: 2rem; color: #475569; margin-bottom: 0.5rem; display: block;"></i>
        No hay cursos ni divisiones configuradas en esta institución.<br>
        <button type="button" class="btn-toolbar-action btn-toolbar-primary" style="margin-top: 0.75rem;" onclick="abrirModalNuevoCurso()">
          <i class="fa-solid fa-plus"></i> Crear Primera División
        </button>
      </div>
    `;
    return;
  }

  let html = '';

  // 1. CICLO BÁSICO
  if (filtroCicloActivo === 'todos' || filtroCicloActivo === 'basico') {
    const cursosBasico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
    html += `
      <div class="card-ciclo-grupo">
        <div class="card-ciclo-header">
          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <i class="fa-solid fa-book-open text-blue" style="font-size: 1.1rem;"></i>
            <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">Ciclo Básico (1° a 3° Año)</span>
            <span class="badge badge-blue" style="font-size: 0.72rem;">${cursosBasico.length} ${cursosBasico.length === 1 ? 'división' : 'divisiones'}</span>
          </div>
          <div>
            <button type="button" class="btn-toolbar-action" style="font-size: 0.74rem; padding: 0.3rem 0.65rem;" onclick="abrirModalNuevoCurso('basico')">
              <i class="fa-solid fa-plus"></i> Agregar División
            </button>
          </div>
        </div>
        <div class="grid-cursos-ciclo">
          ${cursosBasico.map(c => `
            <div class="item-curso-card">
              <div>
                <div style="font-weight: 700; color: #fff; font-size: 0.92rem;">
                  ${c.nombre}
                </div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                  ${c.turno || 'Turno Mañana'} • Div. ${c.division} • ${c.anio}° Año
                </div>
              </div>
              <div>
                <button type="button" class="btn-action-icon btn-action-delete" onclick="eliminarCurso('${c.id}')" title="Eliminar división ${c.nombre}">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // 2. CICLO ORIENTADO (Agrupado por Orientaciones)
  if (filtroCicloActivo === 'todos' || filtroCicloActivo === 'orientado') {
    const cursosOrientado = cursos.filter(c => c.ciclo === 'orientado');
    const orientacionesMap = {};

    cursosOrientado.forEach(c => {
      const ori = c.orientacion || 'Ciencias Naturales';
      if (!orientacionesMap[ori]) orientacionesMap[ori] = [];
      orientacionesMap[ori].push(c);
    });

    const nombresOrientaciones = Object.keys(orientacionesMap);

    if (nombresOrientaciones.length === 0) {
      if (filtroCicloActivo === 'orientado') {
        html += `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted); background: #0f172a; border-radius: 8px;">
            <i class="fa-solid fa-compass" style="font-size: 2rem; color: #475569; margin-bottom: 0.5rem; display: block;"></i>
            Aún no hay divisiones del Ciclo Orientado registradas.<br>
            <button type="button" class="btn-toolbar-action btn-toolbar-primary" style="margin-top: 0.75rem;" onclick="abrirModalNuevoCurso('orientado')">
              <i class="fa-solid fa-plus"></i> Crear Primera División del Ciclo Orientado
            </button>
          </div>
        `;
      }
    } else {
      nombresOrientaciones.forEach(oriNombre => {
        const cursosOri = orientacionesMap[oriNombre];
        html += `
          <div class="card-ciclo-grupo" style="border-left: 3px solid #a855f7;">
            <div class="card-ciclo-header">
              <div style="display: flex; align-items: center; gap: 0.55rem; flex-wrap: wrap;">
                <i class="fa-solid fa-graduation-cap text-purple" style="font-size: 1.15rem;"></i>
                <span style="font-weight: 700; color: #fff; font-size: 0.95rem;">
                  Orientación: <strong class="text-white">${oriNombre}</strong>
                </span>
                <span class="badge badge-purple" style="font-size: 0.72rem;">${cursosOri.length} ${cursosOri.length === 1 ? 'división' : 'divisiones'}</span>
              </div>
              <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
                <button type="button" class="btn-toolbar-action" style="font-size: 0.73rem; padding: 0.25rem 0.65rem;" onclick="abrirModalNuevoCurso('orientado', '${oriNombre}')">
                  <i class="fa-solid fa-plus"></i> Agregar División
                </button>
              </div>
            </div>
            <div class="grid-cursos-ciclo">
              ${cursosOri.map(c => `
                <div class="item-curso-card">
                  <div>
                    <div style="font-weight: 700; color: #fff; font-size: 0.92rem;">
                      ${c.nombre}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
                      ${c.turno || 'Turno Mañana'} • Div. ${c.division} • ${c.anio}° Año
                    </div>
                  </div>
                  <div>
                    <button type="button" class="btn-action-icon btn-action-delete" onclick="eliminarCurso('${c.id}')" title="Eliminar división ${c.nombre}">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      });
    }
  }

  cont.innerHTML = html;
}

// Filtrar vista de ciclos 
function filtrarVistaCiclos(ciclo) {
  filtroCicloActivo = ciclo;
  const btnTodos = document.getElementById('btnFiltroCicloTodos');
  const btnBasico = document.getElementById('btnFiltroCicloBasico');
  const btnOrientado = document.getElementById('btnFiltroCicloOrientado');

  if (btnTodos) btnTodos.classList.toggle('active', ciclo === 'todos');
  if (btnBasico) btnBasico.classList.toggle('active', ciclo === 'basico');
  if (btnOrientado) btnOrientado.classList.toggle('active', ciclo === 'orientado');

  renderizarEstructuraCurricular();
}

// Modales de Cursos / Divisiones
function alCambiarCicloEnModalCurso(ciclo) {
  const selAnio = document.getElementById('selectCursoAnio');
  const selOri = document.getElementById('selectCursoOrientacion');
  const badgeOri = document.getElementById('badgeOrientacionEstado');
  const ayudaOri = document.getElementById('ayudaOrientacionModal');

  const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
    ? DB_ESCOLAR.configuracion.jurisdiccion
    : "formosa";

  if (ciclo === 'basico') {
    // 1. Años para Ciclo Básico: 1°, 2°, 3°
    if (selAnio) {
      selAnio.innerHTML = `
        <option value="1">1° Año</option>
        <option value="2">2° Año</option>
        <option value="3">3° Año</option>
      `;
    }

    // 2. Orientación BLOQUEADA para Ciclo Básico
    if (selOri) {
      selOri.disabled = true;
      selOri.innerHTML = `<option value="Ciclo Básico" selected>No aplica (Ciclo Básico)</option>`;
      selOri.style.opacity = '0.6';
      selOri.style.cursor = 'not-allowed';
      selOri.style.background = '#0b1120';
    }
    if (badgeOri) {
      badgeOri.className = 'badge badge-dim';
      badgeOri.innerHTML = '<i class="fa-solid fa-lock"></i> Bloqueado en Ciclo Básico';
    }
    if (ayudaOri) {
      ayudaOri.textContent = 'Las divisiones del Ciclo Básico no poseen orientación específica.';
    }
  } else {
    // 1. Años para Ciclo Orientado: 4°, 5°, 6°
    if (selAnio) {
      selAnio.innerHTML = `
        <option value="4">4° Año</option>
        <option value="5">5° Año</option>
        <option value="6">6° Año</option>
      `;
    }

    // 2. Orientación DESBLOQUEADA según escuela (Formosa: Cs. Naturales, Cs. Sociales)
    if (selOri) {
      selOri.disabled = false;
      selOri.style.opacity = '1';
      selOri.style.cursor = 'default';
      selOri.style.background = '#1e293b';

      if (jurisActiva === 'pba') {
        selOri.innerHTML = `
          <option value="Ciencias Sociales">Ciencias Sociales</option>
          <option value="Ciencias Naturales">Ciencias Naturales</option>
          <option value="Economía y Administración">Economía y Administración</option>
        `;
      } else {
        // Formosa (EPES N° 19): Cs. Naturales y Cs. Sociales
        selOri.innerHTML = `
          <option value="Ciencias Naturales">Ciencias Naturales</option>
          <option value="Ciencias Sociales">Ciencias Sociales</option>
        `;
      }
    }
    if (badgeOri) {
      badgeOri.className = 'badge badge-green';
      badgeOri.innerHTML = '<i class="fa-solid fa-lock-open"></i> Habilitado';
    }
    if (ayudaOri) {
      ayudaOri.textContent = 'Seleccioná la orientación correspondiente a esta división del Ciclo Orientado.';
    }
  }
}

function abrirModalNuevoCurso(cicloSugerido = 'basico', oriSugerida = '') {
  const modal = document.getElementById('modalEditarCurso');
  const tit = document.getElementById('modalCursoTitulo');
  const sub = document.getElementById('modalCursoSubtitulo');
  const inIdOrig = document.getElementById('inputCursoIdOriginal');
  const inIdDb = document.getElementById('inputCursoIdDb');
  const selCiclo = document.getElementById('selectCursoCiclo');
  const inDiv = document.getElementById('inputCursoDivision');
  const selTurno = document.getElementById('selectCursoTurno');
  const selOri = document.getElementById('selectCursoOrientacion');

  if (inIdOrig) inIdOrig.value = '';
  if (inIdDb) inIdDb.value = '0';
  if (tit) tit.textContent = 'Agregar Nueva División';
  if (sub) sub.textContent = 'Completá los datos de la división para guardarla en la base de datos';

  if (selCiclo) selCiclo.value = cicloSugerido;
  alCambiarCicloEnModalCurso(cicloSugerido);

  if (inDiv) inDiv.value = '';
  if (selTurno) selTurno.value = 'Turno Mañana';

  if (cicloSugerido === 'orientado' && oriSugerida && selOri) {
    selOri.value = oriSugerida;
  }

  if (modal) modal.style.display = 'flex';
}

function abrirModalEditarCurso(cursoId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.cursos) return;
  const curso = DB_ESCOLAR.cursos.find(c => c.id === cursoId);
  if (!curso) return;

  const modal = document.getElementById('modalEditarCurso');
  const tit = document.getElementById('modalCursoTitulo');
  const sub = document.getElementById('modalCursoSubtitulo');
  const inIdOrig = document.getElementById('inputCursoIdOriginal');
  const inIdDb = document.getElementById('inputCursoIdDb');
  const selCiclo = document.getElementById('selectCursoCiclo');
  const selAnio = document.getElementById('selectCursoAnio');
  const inDiv = document.getElementById('inputCursoDivision');
  const selTurno = document.getElementById('selectCursoTurno');
  const selOri = document.getElementById('selectCursoOrientacion');

  if (inIdOrig) inIdOrig.value = curso.id;
  if (inIdDb) inIdDb.value = curso.id_db || '0';
  if (tit) tit.textContent = `Editar División ${curso.nombre}`;
  if (sub) sub.textContent = `Modificá los datos de esta división en la base de datos`;

  const ciclo = curso.ciclo || 'basico';
  if (selCiclo) selCiclo.value = ciclo;
  alCambiarCicloEnModalCurso(ciclo);

  if (selAnio) selAnio.value = String(curso.anio || (ciclo === 'orientado' ? 4 : 1));
  if (inDiv) inDiv.value = curso.division || '';
  if (selTurno) selTurno.value = curso.turno || 'Turno Mañana';
  if (ciclo === 'orientado' && selOri && curso.orientacion) {
    selOri.value = curso.orientacion;
  }

  if (modal) modal.style.display = 'flex';
}

function cerrarModalEditarCurso(event) {
  if (event && event.target && event.target.id !== 'modalEditarCurso' && !event.target.classList.contains('btn-cerrar-modal') && !event.target.classList.contains('btn-cancelar')) {
    return;
  }
  const modal = document.getElementById('modalEditarCurso');
  if (modal) modal.style.display = 'none';
}

// 6.5 Guardar Curso / División en MySQL
async function guardarCursoForm(e) {
  if (e) e.preventDefault();
  if (!DB_ESCOLAR) return;

  const idOrig = document.getElementById('inputCursoIdOriginal').value.trim();
  const idDb = parseInt(document.getElementById('inputCursoIdDb').value, 10) || 0;
  const ciclo = document.getElementById('selectCursoCiclo').value;
  const anio = parseInt(document.getElementById('selectCursoAnio').value, 10) || 1;
  const division = document.getElementById('inputCursoDivision').value.trim();
  const turno = document.getElementById('selectCursoTurno').value;
  const selOri = document.getElementById('selectCursoOrientacion');

  if (!division) {
    alert("Por favor completá la división / sección (ej: I, II, III, Única).");
    return;
  }

  // Si es Ciclo Básico, la orientación es siempre Ciclo Básico
  const orientacion = (ciclo === 'orientado')
    ? (selOri ? selOri.value.trim() : 'Ciencias Naturales')
    : 'Ciclo Básico';

  // El nombre oficial del curso se arma automáticamente con año y división (ej: "1° I", "4° II", "4° Única")
  const nombre = `${anio}° ${division}`;

  const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = jurisActiva === 'pba' ? 2 : 1;
  const instKey = idInst === 2 ? 'inst-pba' : 'inst-formosa';

  let codigoCurso = idOrig;
  if (!codigoCurso) {
    const prefijo = (idInst === 2) ? 'pba-' : '';
    const codOri = (ciclo === 'orientado') ? ('-' + orientacion.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) + '-') : '-';
    codigoCurso = `${prefijo}${anio}${codOri}${division.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  }

  const cursoGuardado = {
    id: codigoCurso,
    id_db: idDb,
    codigo_curso: codigoCurso,
    nombre,
    turno,
    ciclo,
    anio,
    division,
    orientacion,
    institucionId: instKey,
    id_institucion: idInst
  };

  if (!DB_ESCOLAR.cursos) DB_ESCOLAR.cursos = [];
  const idx = DB_ESCOLAR.cursos.findIndex(c => c.id === idOrig || (c.id_institucion === idInst && c.codigo_curso === codigoCurso));

  if (idx !== -1) {
    DB_ESCOLAR.cursos[idx] = { ...DB_ESCOLAR.cursos[idx], ...cursoGuardado };
    mostrarToast(`División ${nombre} actualizada correctamente.`);
  } else {
    DB_ESCOLAR.cursos.push(cursoGuardado);
    mostrarToast(`¡Nueva división ${nombre} creada con éxito!`);
  }

  guardarBaseDatosEscolar();
  cerrarModalEditarCurso();
  renderizarEstructuraCurricular();
  poblarSelectorCursosCargaDocente();
  poblarSelectorCursosFiltroPadron();
  poblarSelectorCursosAsistencia();
  poblarSelectorPreviewAlumnos();

  // Guardar en MySQL
  try {
    const resp = await fetch('api/instituciones.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_curso',
        id_institucion: idInst,
        codigo_curso: codigoCurso,
        nombre: cursoGuardado.nombre,
        turno: cursoGuardado.turno,
        ciclo: cursoGuardado.ciclo,
        anio: cursoGuardado.anio,
        division: cursoGuardado.division,
        orientacion: cursoGuardado.orientacion
      })
    });
    const resJSON = await resp.json();
    if (resp.ok && resJSON.id_db) {
      const cItem = DB_ESCOLAR.cursos.find(c => c.id === codigoCurso);
      if (cItem) {
        cItem.id_db = resJSON.id_db;
        guardarBaseDatosEscolar();
      }
    }
  } catch (errMySQL) {
    console.warn("Aviso al guardar curso en MySQL:", errMySQL);
  }
}

// 6.6 Eliminar Curso / División
function eliminarCurso(cursoId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.cursos) return;
  const curso = DB_ESCOLAR.cursos.find(c => c.id === cursoId);
  if (!curso) return;

  mostrarModalConfirmacion({
    titulo: '¿Eliminar División Escolar?',
    mensaje: `¿Estás seguro de que deseás eliminar el curso "${curso.nombre}"?`,
    detalles: [
      { label: 'Curso', valor: curso.nombre, colorClase: 'text-white' },
      { label: 'Ciclo', valor: curso.ciclo === 'orientado' ? 'Ciclo Orientado' : 'Ciclo Básico', badge: 'badge-blue' },
      { label: 'Orientación', valor: curso.orientacion || 'Ciclo Básico', colorClase: 'text-secondary' },
      { label: 'Turno', valor: curso.turno || 'Turno Mañana', colorClase: 'text-muted' }
    ],
    alerta: 'Esta división dejará de estar disponible en las planillas y selectores del sistema.',
    textoBoton: 'Sí, Eliminar División',
    icono: 'fa-solid fa-trash-can',
    onConfirm: async () => {
      const idDb = curso.id_db || 0;
      DB_ESCOLAR.cursos = DB_ESCOLAR.cursos.filter(c => c.id !== cursoId);
      guardarBaseDatosEscolar();
      mostrarToast(`Se eliminó la división "${curso.nombre}".`, 'info');
      renderizarEstructuraCurricular();
      poblarSelectorCursosCargaDocente();
      poblarSelectorCursosFiltroPadron();
      poblarSelectorCursosAsistencia();
      poblarSelectorPreviewAlumnos();

      // Eliminar de MySQL
      try {
        await fetch('api/instituciones.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_curso',
            codigo_curso: cursoId,
            id_db: idDb
          })
        });
      } catch (errMySQL) {
        console.warn("Aviso al eliminar curso en MySQL:", errMySQL);
      }
    }
  });
}

// 7. Cambio dinámico entre Formosa y Buenos Aires
async function cambiarJurisdiccion(jurisdiccion, sincronizarId = true) {
  // Sincronizar botones de la barra superior
  const btnFormosa = document.getElementById('btnFormosa');
  const btnPba = document.getElementById('btnPba');
  if (btnFormosa) btnFormosa.classList.toggle('active', jurisdiccion === 'formosa');
  if (btnPba) btnPba.classList.toggle('active', jurisdiccion === 'pba');

  // Si sincronizarId es true, activar la escuela correspondiente en la lista
  if (sincronizarId && DB_ESCOLAR && DB_ESCOLAR.instituciones) {
    const inst = DB_ESCOLAR.instituciones.find(i => i.jurisdiccion === jurisdiccion);
    if (inst) {
      DB_ESCOLAR.institucionActivaId = inst.id;
      DB_ESCOLAR.configuracion = inst;
      guardarBaseDatosEscolar();
    }
  }

  // Establecer alumno y curso por defecto para la escuela activa
  if (jurisdiccion === 'pba') {
    alumnoActivoDni = '48763736';
    cursoActivoId = 'pba-4-u';
    cursoSeleccionadoCarga = 'pba-4-u';
    asistenciaCursoSeleccionado = 'pba-4-u';
    asistenciaPeriodoSeleccionado = '1° Cuatrimestre';
  } else {
    alumnoActivoDni = '34567890';
    cursoActivoId = '2-3';
    cursoSeleccionadoCarga = '2-3';
    asistenciaCursoSeleccionado = '2-3';
    asistenciaPeriodoSeleccionado = '1° Trimestre';
  }

  if (rolActual === 'tutor' && typeof usuarioSesion !== 'undefined' && usuarioSesion) {
    const tipo = obtenerTipoUsuarioSesion(usuarioSesion);
    const esPba = (jurisdiccion === 'pba');
    usuarioSesion.alumnoDni = alumnoActivoDni;
    if (tipo === 'padre') {
      usuarioSesion.nombre = esPba ? 'PLEININGER, CRISTIAN' : 'Pedro Gómez';
      usuarioSesion.email = esPba ? 'cristian@gmail.com' : 'pedro@gmail.com';
    } else if (tipo === 'estudiante' && !(usuarioSesion.es_google_cuenta && usuarioSesion.en_padron === false)) {
      usuarioSesion.nombre = esPba ? 'PLEININGER, URIEL LUCIANO' : 'Mateo Gómez';
      usuarioSesion.email = esPba ? 'uriel.pleininger@escuela.edu.ar' : 'mateo.gomez@escuela.edu.ar';
    }
    localStorage.setItem('boletin_usuario', JSON.stringify(usuarioSesion));
    actualizarHeaderUsuario();
  }

  poblarSelectorEscuelas();
  renderizarTarjetasInstituciones();

  const archivo = jurisdiccion === 'pba' ? 'data/pba.json' : 'data/formosa.json';
  await cargarDatos(archivo);

  actualizarBadgeRegimenPreceptor(jurisdiccion);
  poblarSelectorCursosCargaDocente();
  poblarSelectorCursosFiltroPadron();
  poblarSelectorCursosAsistencia();
  poblarSelectorPeriodosAsistencia();
  poblarSelectorPreviewAlumnos();

  if (typeof refrescarPadronDesdeMySQL === 'function') {
    await refrescarPadronDesdeMySQL();
  }

  await cargarAlumnoEnBoletin(alumnoActivoDni);

  if (rolActual === 'tutor') {
    if (typeof renderizarAsistenciaTutor === 'function') renderizarAsistenciaTutor();
    if (typeof renderizarMesasTutor === 'function') renderizarMesasTutor();
    if (typeof renderizarNotificacionesTutor === 'function') renderizarNotificacionesTutor();
  } else {
    seleccionarCiclo(cicloActivo || 'basico');
    cargarDatosInstitucionEnForm();
    renderizarPadronAlumnos();
    renderizarMesasPreceptor();
    renderizarNotificacionesPreceptor();
    renderizarListaPlanillasGuardadas();
    if (typeof renderizarBoletinPreview === 'function') renderizarBoletinPreview();
  }
}

function actualizarBadgeRegimenPreceptor(jurisdiccion) {
  const badge = document.getElementById('badgeRegimenEscolarPreceptor');
  if (!badge) return;

  if (jurisdiccion === 'pba' || (datosMemoria && datosMemoria.jurisdiccion === 'Buenos Aires')) {
    badge.className = 'badge badge-blue';
    badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Prov. de Buenos Aires • Cuatrimestral R.I.T.E.';
  } else {
    badge.className = 'badge badge-amber';
    badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Formosa • 3 Trimestres con PAIR';
  }
}

// ==========================================================================
// COMPONENTE UNIVERSAL DE PAGINACIÓN (15 REGISTROS POR PÁGINA)
// ==========================================================================
function generarHtmlPaginacion({
  totalItems,
  porPagina = 15,
  paginaActual = 1,
  nombreFuncionCambio,
  etiquetaItems = 'estudiantes'
}) {
  const totalPaginas = Math.max(1, Math.ceil(totalItems / porPagina));
  if (totalItems === 0) return '';

  const inicio = (paginaActual - 1) * porPagina + 1;
  const fin = Math.min(paginaActual * porPagina, totalItems);

  let botonesHtml = '';

  // Botón Anterior
  const disabledPrev = paginaActual <= 1 ? 'disabled' : '';
  botonesHtml += `
    <button type="button" class="btn-paginacion" ${disabledPrev} onclick="${nombreFuncionCambio}(${paginaActual - 1})" title="Página anterior">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;

  // Números de páginas con elipsis inteligente
  const delta = 2;
  const rango = [];
  const rangoConPuntos = [];
  let l;

  for (let i = 1; i <= totalPaginas; i++) {
    if (i === 1 || i === totalPaginas || (i >= paginaActual - delta && i <= paginaActual + delta)) {
      rango.push(i);
    }
  }

  for (const i of rango) {
    if (l) {
      if (i - l === 2) {
        rangoConPuntos.push(l + 1);
      } else if (i - l !== 1) {
        rangoConPuntos.push('...');
      }
    }
    rangoConPuntos.push(i);
    l = i;
  }

  rangoConPuntos.forEach(p => {
    if (p === '...') {
      botonesHtml += `<span class="paginacion-dots">...</span>`;
    } else {
      const activeClass = p === paginaActual ? 'active' : '';
      botonesHtml += `
        <button type="button" class="btn-paginacion ${activeClass}" onclick="${nombreFuncionCambio}(${p})">
          ${p}
        </button>
      `;
    }
  });

  // Botón Siguiente
  const disabledNext = paginaActual >= totalPaginas ? 'disabled' : '';
  botonesHtml += `
    <button type="button" class="btn-paginacion" ${disabledNext} onclick="${nombreFuncionCambio}(${paginaActual + 1})" title="Página siguiente">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  return `
    <div class="paginacion-contenedor">
      <div class="paginacion-info">
        Mostrando <strong class="text-white">${inicio}–${fin}</strong> de <strong class="text-white">${totalItems}</strong> ${etiquetaItems} • Página <strong class="text-white">${paginaActual}</strong> de <strong class="text-white">${totalPaginas}</strong>
      </div>
      <div class="paginacion-botones">
        ${botonesHtml}
      </div>
    </div>
  `;
}

// 15. GESTIÓN DEL PADRÓN ESCOLAR DE ALUMNOS (ALTA, EDICIÓN Y BAJA)

let padronCicloFiltro = 'todos';
let padronCursoFiltro = 'todos';
let padronTextoBusqueda = '';
let padronPaginaActual = 1;
const PADRON_POR_PAGINA = 15;

// Poblar selector de cursos en la barra de filtros del Padrón 
function poblarSelectorCursosFiltroPadron() {
  const sel = document.getElementById('selectPadronFiltroCurso');
  if (!sel || !DB_ESCOLAR || !DB_ESCOLAR.cursos) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);
  let html = `<option value="todos">Todos los Cursos</option>`;

  // Grupo 1: Ciclo Básico (1° a 3° Año)
  const basico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
  if (basico.length > 0) {
    html += `<optgroup label="Ciclo Básico (1° a 3°)">`;
    basico.forEach(c => {
      html += `<option value="${c.id}" ${c.id === padronCursoFiltro ? 'selected' : ''}>${c.nombre}</option>`;
    });
    html += `</optgroup>`;
  }

  // Ciclo Orientado - Orientaciones Dinámicas
  const orientado = cursos.filter(c => c.ciclo === 'orientado');
  const orientacionesMap = {};
  orientado.forEach(c => {
    const ori = c.orientacion || 'Ciclo Orientado';
    if (!orientacionesMap[ori]) orientacionesMap[ori] = [];
    orientacionesMap[ori].push(c);
  });

  Object.keys(orientacionesMap).forEach(oriNombre => {
    html += `<optgroup label="Ciclo Orientado - ${oriNombre} (4° a 6°)">`;
    orientacionesMap[oriNombre].forEach(c => {
      html += `<option value="${c.id}" ${c.id === padronCursoFiltro ? 'selected' : ''}>${c.nombre} (${oriNombre})</option>`;
    });
    html += `</optgroup>`;
  });

  sel.innerHTML = html;

  // Validar selección existente
  if (padronCursoFiltro !== 'todos') {
    const opcionExiste = (sel.options && sel.options.length > 0)
      ? Array.from(sel.options).some(o => o.value === padronCursoFiltro)
      : true;
    if (!opcionExiste) {
      padronCursoFiltro = 'todos';
      sel.value = 'todos';
    } else {
      sel.value = padronCursoFiltro;
    }
  } else {
    sel.value = 'todos';
  }
}

// Filtrar padrón por ciclo educativo 
function filtrarPadronPorCiclo(ciclo) {
  if (ciclo === 'todos') {
    padronCursoFiltro = 'todos';
  }
  const sel = document.getElementById('selectPadronFiltroCurso');
  if (sel) sel.value = padronCursoFiltro;
  renderizarPadronAlumnos();
}

// Filtrar padrón al seleccionar un curso/división específico
function alCambiarCursoFiltroPadron(cursoId) {
  padronCursoFiltro = cursoId || 'todos';
  padronPaginaActual = 1;
  renderizarPadronAlumnos();
}

// Filtrar padrón en tiempo real por búsqueda de texto
function filtrarPadronAlumnos() {
  const input = document.getElementById('inputBuscarPadron');
  padronTextoBusqueda = input ? input.value.trim().toLowerCase() : '';
  padronPaginaActual = 1;
  renderizarPadronAlumnos();
}

// Cambiar de página en la tabla del Padrón
function cambiarPaginaPadron(nuevaPagina) {
  padronPaginaActual = nuevaPagina;
  renderizarPadronAlumnos();
  const tabla = document.getElementById('tbodyPadronAlumnos');
  if (tabla) {
    tabla.closest('.table-responsive')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Renderizar tabla del padrón escolar con datos completos de alumnos y tutores (paginado a 15)
function renderizarPadronAlumnos() {
  const tbody = document.getElementById('tbodyPadronAlumnos');
  const paginacionBox = document.getElementById('paginacionPadron');
  if (!tbody || !DB_ESCOLAR) return;

  // Asegurar que el selector de cursos del filtro esté poblado
  const selCursoFiltro = document.getElementById('selectPadronFiltroCurso');
  if (selCursoFiltro && selCursoFiltro.children.length === 0) {
    poblarSelectorCursosFiltroPadron();
  }

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInstKey = jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa';

  // CRÍTICO: Filtrar estrictamente para que NUNCA se mezclen alumnos 
  const alumnos = obtenerAlumnosEscuelaActiva();
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === idInstKey);

  // 1. Filtrar según curso específico (o todos los cursos)
  let filtrados = alumnos;
  if (padronCursoFiltro !== 'todos') {
    filtrados = filtrados.filter(alum => alum.cursoId === padronCursoFiltro);
  }

  // 2. Filtrar según texto de búsqueda
  if (padronTextoBusqueda) {
    filtrados = filtrados.filter(alum => {
      const nom = (alum.nombre || '').toLowerCase();
      const dni = (alum.dni || '').toLowerCase();
      const emailA = (alum.emailAlumno || '').toLowerCase();
      const tut = (alum.tutor || '').toLowerCase();
      const dniT = (alum.dniTutor || '').toLowerCase();
      const emailT = (alum.emailTutor || '').toLowerCase();
      const cur = (alum.curso || '').toLowerCase();
      return nom.includes(padronTextoBusqueda) ||
        dni.includes(padronTextoBusqueda) ||
        emailA.includes(padronTextoBusqueda) ||
        tut.includes(padronTextoBusqueda) ||
        dniT.includes(padronTextoBusqueda) ||
        emailT.includes(padronTextoBusqueda) ||
        cur.includes(padronTextoBusqueda);
    });
  }

  // Actualizar indicador de estadísticas
  const badgeStats = document.getElementById('badgePadronStats');
  if (badgeStats) {
    let detalleCurso = '';
    if (padronCursoFiltro !== 'todos') {
      const cObj = cursos.find(c => c.id === padronCursoFiltro);
      detalleCurso = cObj ? ` • ${cObj.nombre} (${cObj.orientacion || 'Ciclo Básico'})` : '';
    }
    badgeStats.innerHTML = `Mostrando <strong class="text-white">${filtrados.length}</strong> de <strong class="text-white">${alumnos.length}</strong> estudiantes registrados${detalleCurso}`;
  }

  if (filtrados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <i class="fa-solid fa-users-slash" style="font-size: 2rem; display: block; margin-bottom: 0.6rem; color: #475569;"></i>
          <span class="text-secondary" style="font-weight: 600;">No se encontraron alumnos para los filtros aplicados.</span>
          <br>
          <span style="font-size: 0.78rem; color: #64748b;">Probá seleccionando otro curso o limpiando el campo de búsqueda.</span>
        </td>
      </tr>
    `;
    if (paginacionBox) paginacionBox.innerHTML = '';
    return;
  }

  // Paginación a 15 alumnos por página
  const totalFiltrados = filtrados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalFiltrados / PADRON_POR_PAGINA));
  if (padronPaginaActual > totalPaginas) padronPaginaActual = totalPaginas;
  if (padronPaginaActual < 1) padronPaginaActual = 1;

  const inicio = (padronPaginaActual - 1) * PADRON_POR_PAGINA;
  const fin = inicio + PADRON_POR_PAGINA;
  const alumnosPagina = filtrados.slice(inicio, fin);

  let html = '';
  alumnosPagina.forEach(alum => {
    const cursoObj = cursos.find(c => c.id === alum.cursoId);
    let badgeClass = 'badge-blue';
    let badgeIcon = '<i class="fa-solid fa-shapes"></i>';
    let orientacionTexto = '';

    if (cursoObj) {
      if (cursoObj.orientacion === 'Ciencias Sociales') {
        badgeClass = 'badge-purple';
        badgeIcon = '<i class="fa-solid fa-book-bookmark"></i>';
        orientacionTexto = ' • Cs. Sociales';
      } else if (cursoObj.orientacion === 'Ciencias Naturales') {
        badgeClass = 'badge-emerald';
        badgeIcon = '<i class="fa-solid fa-flask-vial"></i>';
        orientacionTexto = ' • Cs. Naturales';
      }
    }

    const cursoNombre = cursoObj ? cursoObj.nombre : (alum.curso || alum.cursoId);

    html += `
      <tr>
        <td>
          <span class="badge ${badgeClass}" style="font-weight: 600; white-space: nowrap; display: inline-flex; align-items: center; gap: 0.35rem;">
            ${badgeIcon} ${cursoNombre}${orientacionTexto}
          </span>
        </td>
        <td style="font-family: monospace; color: #94a3b8; font-weight: 700; white-space: nowrap;">
          ${alum.dni}
        </td>
        <td>
          <strong class="text-white" style="font-size: 0.9rem;">${alum.nombre}</strong>
        </td>
        <td style="font-family: monospace; font-size: 0.8rem; color: #38bdf8; white-space: nowrap;">
          ${alum.emailAlumno || '<span class="text-dim">-</span>'}
        </td>
        <td style="color: #e2e8f0; font-weight: 500;">
          ${alum.tutor || 'No asignado'}
        </td>
        <td class="text-muted" style="font-family: monospace; font-size: 0.82rem; white-space: nowrap;">
          ${alum.dniTutor || '<span class="text-dim">-</span>'}
        </td>
        <td class="text-green" style="font-family: monospace; font-size: 0.8rem; white-space: nowrap;">
          ${alum.emailTutor || '<span class="text-dim">-</span>'}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <button type="button" class="btn-action-icon" style="color: #f59e0b;" title="Ver y gestionar materias previas del alumno" onclick="gestionarPreviasDeAlumno('${alum.dni}')">
            <i class="fa-solid fa-book-bookmark"></i>
          </button>
          <button type="button" class="btn-action-icon btn-edit" title="Editar ficha de alumno y tutor" onclick="editarAlumnoPadron('${alum.dni}')">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
          <button type="button" class="btn-action-icon btn-delete" title="Eliminar alumno del padrón" onclick="eliminarAlumnoPadron('${alum.dni}')">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Renderizar barra de paginación
  if (paginacionBox) {
    paginacionBox.innerHTML = generarHtmlPaginacion({
      totalItems: totalFiltrados,
      porPagina: PADRON_POR_PAGINA,
      paginaActual: padronPaginaActual,
      nombreFuncionCambio: 'cambiarPaginaPadron',
      etiquetaItems: 'estudiantes'
    });
  }
}

// Poblar selector de cursos dentro de la modal de carga/edición con optgroups ordenados
function poblarCursosEnModalPadron(cursoSeleccionado) {
  const sel = document.getElementById('padronCursoSelect');
  if (!sel || !DB_ESCOLAR || !DB_ESCOLAR.cursos) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);
  let html = '';

  //  Ciclo Básico
  const basico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
  if (basico.length > 0) {
    html += `<optgroup label="Ciclo Básico">`;
    basico.forEach(c => {
      html += `<option value="${c.id}" ${c.id === cursoSeleccionado ? 'selected' : ''}>${c.nombre}</option>`;
    });
    html += `</optgroup>`;
  }

  // Orientaciones dinámicas
  const orientado = cursos.filter(c => c.ciclo === 'orientado');
  const orientacionesMap = {};
  orientado.forEach(c => {
    const ori = c.orientacion || 'Ciclo Orientado';
    if (!orientacionesMap[ori]) orientacionesMap[ori] = [];
    orientacionesMap[ori].push(c);
  });

  Object.keys(orientacionesMap).forEach(oriNombre => {
    html += `<optgroup label="${oriNombre}">`;
    orientacionesMap[oriNombre].forEach(c => {
      html += `<option value="${c.id}" ${c.id === cursoSeleccionado ? 'selected' : ''}>${c.nombre} (${oriNombre})</option>`;
    });
    html += `</optgroup>`;
  });

  sel.innerHTML = html;
}

function capitalizarPalabras(texto) {
  if (!texto) return '';
  return texto.toLowerCase().replace(/(^|[\s,]+)([a-záéíóúñü])/g, (m, sep, letra) => {
    return sep + letra.toUpperCase();
  });
}

function formatearNombreInput(input) {
  if (!input) return;
  const pos = input.selectionStart;
  const original = input.value;
  let limpio = original.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s,]/g, '');
  let formateado = capitalizarPalabras(limpio);
  if (input.value !== formateado) {
    input.value = formateado;
    if (pos !== null) {
      const diff = formateado.length - original.length;
      const nuevoPos = Math.max(0, pos + diff);
      input.setSelectionRange(nuevoPos, nuevoPos);
    }
  }
}

function formatearDniInput(input) {
  if (!input) return;
  const pos = input.selectionStart;
  const original = input.value;
  let limpio = original.replace(/\D/g, '').slice(0, 8);
  if (input.value !== limpio) {
    input.value = limpio;
    if (pos !== null) {
      input.setSelectionRange(pos, pos);
    }
  }
}

function mostrarErrorCampo(idCampo, mensaje) {
  const input = document.getElementById(idCampo);
  if (!input) return;
  input.classList.add('input-error');

  let msgSpan = document.getElementById('error_' + idCampo);
  if (!msgSpan) {
    msgSpan = document.createElement('span');
    msgSpan.id = 'error_' + idCampo;
    msgSpan.className = 'campo-error-msg';
    if (input.nextSibling) {
      input.parentNode.insertBefore(msgSpan, input.nextSibling);
    } else {
      input.parentNode.appendChild(msgSpan);
    }
  }
  msgSpan.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${mensaje}`;
  msgSpan.style.display = 'flex';
}

function limpiarErrorCampo(inputOId) {
  const input = typeof inputOId === 'string' ? document.getElementById(inputOId) : inputOId;
  if (!input) return;
  input.classList.remove('input-error');
  const msgSpan = document.getElementById('error_' + input.id);
  if (msgSpan) {
    msgSpan.style.display = 'none';
    msgSpan.textContent = '';
  }
}

function limpiarTodosLosErroresPadron() {
  const campos = [
    'padronEstNombre',
    'padronEstDni',
    'padronEstEmail',
    'padronCursoSelect',
    'padronTutorNombre',
    'padronTutorDni',
    'padronTutorEmail'
  ];
  campos.forEach(id => limpiarErrorCampo(id));
}

// 1. Abrir modal para NUEVO alumno
function abrirModalNuevoAlumno() {
  const modal = document.getElementById('modalPadronAlumno');
  if (!modal || !DB_ESCOLAR) return;

  limpiarTodosLosErroresPadron();

  document.getElementById('modalPadronTitulo').textContent = 'Cargar Nuevo Alumno y Tutor';
  document.getElementById('modalPadronSubtitulo').textContent = 'Registrá a un nuevo estudiante y vinculá su tutor responsable';
  document.getElementById('btnGuardarAlumnoPadron').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Alumno';

  document.getElementById('padronDniOriginal').value = '';
  const inputIdEst = document.getElementById('padronIdEstudiante');
  if (inputIdEst) inputIdEst.value = '';
  document.getElementById('padronEstNombre').value = '';
  document.getElementById('padronEstDni').value = '';
  document.getElementById('padronEstEmail').value = '';
  document.getElementById('padronTutorNombre').value = '';
  document.getElementById('padronTutorDni').value = '';
  document.getElementById('padronTutorEmail').value = '';

  const cursoDefault = padronCursoFiltro !== 'todos' ? padronCursoFiltro : (cursoSeleccionadoCarga || '2-3');
  poblarCursosEnModalPadron(cursoDefault);

  modal.style.display = 'flex';
  setTimeout(() => {
    const inputNom = document.getElementById('padronEstNombre');
    if (inputNom) inputNom.focus();
  }, 100);
}

// 2. Abrir modal para EDITAR alumno existente
function editarAlumnoPadron(dni) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;
  const alum = DB_ESCOLAR.alumnos.find(a => a.dni === dni);
  if (!alum) {
    mostrarToast('No se encontró el alumno seleccionado.', 'warning');
    return;
  }

  const modal = document.getElementById('modalPadronAlumno');
  if (!modal) return;

  limpiarTodosLosErroresPadron();

  document.getElementById('modalPadronTitulo').textContent = `Editar Alumno: ${alum.nombre}`;
  document.getElementById('modalPadronSubtitulo').textContent = `Modificá los datos del estudiante o de su tutor responsable`;
  document.getElementById('btnGuardarAlumnoPadron').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';

  document.getElementById('padronDniOriginal').value = alum.dni;
  const inputIdEst = document.getElementById('padronIdEstudiante');
  if (inputIdEst) inputIdEst.value = alum.idDB || '';
  document.getElementById('padronEstNombre').value = alum.nombre;
  document.getElementById('padronEstDni').value = alum.dni;
  document.getElementById('padronEstEmail').value = alum.emailAlumno || '';
  document.getElementById('padronTutorNombre').value = alum.tutor || '';
  document.getElementById('padronTutorDni').value = alum.dniTutor || '';
  document.getElementById('padronTutorEmail').value = alum.emailTutor || '';

  poblarCursosEnModalPadron(alum.cursoId);

  modal.style.display = 'flex';
}

function cerrarModalPadronAlumno() {
  limpiarTodosLosErroresPadron();
  const modal = document.getElementById('modalPadronAlumno');
  if (modal) modal.style.display = 'none';
}

// 3. Guardar Alumno (Alta o Modificación)
async function guardarAlumnoPadron(e) {
  if (e) e.preventDefault();
  if (!DB_ESCOLAR) return;

  const btnGuardar = document.getElementById('btnGuardarAlumnoPadron');
  const dniOriginal = document.getElementById('padronDniOriginal').value.trim();
  const textoBtn = dniOriginal ? '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios' : '<i class="fa-solid fa-floppy-disk"></i> Guardar Alumno';

  const inputNombre = document.getElementById('padronEstNombre');
  const inputDni = document.getElementById('padronEstDni');
  const inputEmail = document.getElementById('padronEstEmail');
  const selectCurso = document.getElementById('padronCursoSelect');
  const inputTutor = document.getElementById('padronTutorNombre');
  const inputTutorDni = document.getElementById('padronTutorDni');
  const inputTutorEmail = document.getElementById('padronTutorEmail');

  const nombreCompleto = capitalizarPalabras(inputNombre.value.trim());
  const dni = inputDni.value.trim();
  const emailAlumno = inputEmail.value.trim().toLowerCase();
  const cursoId = selectCurso.value;
  const tutor = capitalizarPalabras(inputTutor.value.trim());
  const dniTutor = inputTutorDni.value.trim();
  const emailTutor = inputTutorEmail.value.trim().toLowerCase();

  limpiarTodosLosErroresPadron();

  let hayError = false;
  let primerElementoError = null;

  function registrarError(id, mensaje) {
    mostrarErrorCampo(id, mensaje);
    hayError = true;
    if (!primerElementoError) {
      primerElementoError = document.getElementById(id);
    }
  }

  if (!nombreCompleto) {
    registrarError('padronEstNombre', 'Es obligatorio completar el nombre');
  } else if (nombreCompleto.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '').length < 2) {
    registrarError('padronEstNombre', 'Solo se permiten letras');
  }

  if (!dni) {
    registrarError('padronEstDni', 'Es obligatorio el DNI');
  } else if (!/^\d{8}$/.test(dni)) {
    registrarError('padronEstDni', 'Es obligatorio que el DNI lleve 8 caracteres');
  } else if (dniOriginal === '' && DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos.some(a => a.dni === dni)) {
    registrarError('padronEstDni', 'Ya existe un alumno con este DNI');
  } else if (dniOriginal !== '' && dni !== dniOriginal && DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos.some(a => a.dni === dni)) {
    registrarError('padronEstDni', 'Ya existe otro alumno con este DNI');
  }

  if (!emailAlumno) {
    registrarError('padronEstEmail', 'Es obligatorio el correo');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAlumno)) {
    registrarError('padronEstEmail', 'Ingresá un correo electrónico válido');
  }

  if (!cursoId) {
    registrarError('padronCursoSelect', 'Es obligatorio seleccionar un curso');
  }

  if (!tutor) {
    registrarError('padronTutorNombre', 'Es obligatorio completar el tutor');
  } else if (tutor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/g, '').length < 2) {
    registrarError('padronTutorNombre', 'Solo se permiten letras');
  }

  if (!dniTutor) {
    registrarError('padronTutorDni', 'Es obligatorio el DNI del tutor');
  } else if (!/^\d{8}$/.test(dniTutor)) {
    registrarError('padronTutorDni', 'Es obligatorio que el DNI lleve 8 caracteres');
  }

  if (!emailTutor) {
    registrarError('padronTutorEmail', 'Es obligatorio el correo del tutor');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTutor)) {
    registrarError('padronTutorEmail', 'Ingresá un correo electrónico válido');
  }

  if (hayError) {
    if (primerElementoError) primerElementoError.focus();
    return;
  }

  if (btnGuardar) btnGuardar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  const cursoObj = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => c.id === cursoId) : null;
  const cursoNombre = cursoObj ? cursoObj.nombre : cursoId;

  let apellidoDB = "";
  let nombreDB = "";

  if (nombreCompleto.includes(',')) {
    let partes = nombreCompleto.split(',');
    apellidoDB = partes[0].trim();
    nombreDB = partes.slice(1).join(', ').trim();
  } else {
    // Si el usuario escribe sin coma ("Perez Lucia" o "Escobar Lucas"),
    // como el campo solicita "Apellido y Nombre", la primera palabra es el Apellido
    let partes = nombreCompleto.trim().split(/\s+/);
    if (partes.length > 1) {
      apellidoDB = partes[0].trim();
      nombreDB = partes.slice(1).join(' ').trim();
    } else {
      nombreDB = nombreCompleto.trim();
      apellidoDB = "-";
    }
  }

  // Averiguamos en qué escuela está el usuario ahora mismo
  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = jurisActiva === "pba" ? 2 : 1; // 1 es Formosa, 2 es PBA en MySQL

  let seccionParaDB = cursoObj ? cursoObj.division : "I";
  if (cursoObj && cursoObj.ciclo === 'orientado' && cursoObj.orientacion) {
    if (cursoObj.orientacion.toLowerCase().includes('social')) {
      seccionParaDB = `${cursoObj.division} (CS)`;
    } else if (cursoObj.orientacion.toLowerCase().includes('natural')) {
      seccionParaDB = `${cursoObj.division} (CN)`;
    }
  }

  const datosParaMySQL = {
    dni: dni,
    nombre: nombreDB,
    apellido: apellidoDB,
    jurisdiccion: jurisActiva,
    id_institucion: idInst,
    curso: cursoObj ? String(cursoObj.anio) + "°" : "1°",
    seccion: seccionParaDB,
    nombre_tutor: tutor,
    email_estudiante: emailAlumno,
    email_tutor: emailTutor,
    dni_tutor: dniTutor
  };

  const idDB = document.getElementById('padronIdEstudiante') ? document.getElementById('padronIdEstudiante').value.trim() : '';
  const esEdicion = (dniOriginal !== '');

  let urlDB = 'api/alumnos.php';
  let metodoHttp = 'POST';

  if (esEdicion) {
    metodoHttp = 'PUT';
    if (idDB) {
      urlDB = `api/alumnos.php?id=${encodeURIComponent(idDB)}`;
    } else {
      urlDB = `api/alumnos.php?dni=${encodeURIComponent(dniOriginal)}&jurisdiccion=${encodeURIComponent(jurisActiva)}`;
    }
  }

  try {
    let respuestaDB = await fetch(urlDB, {
      method: metodoHttp,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosParaMySQL)
    });

    if (metodoHttp === 'PUT' && respuestaDB.status === 404) {
      // Fallback si no existía en MySQL
      respuestaDB = await fetch('api/alumnos.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosParaMySQL)
      });
    }

    const resultadoDB = await respuestaDB.json();

    if (!respuestaDB.ok) {
      console.warn("Respuesta API:", resultadoDB.error);
      if (resultadoDB.error && resultadoDB.error.toLowerCase().includes('dni')) {
        registrarError('padronEstDni', 'Este DNI ya está registrado en la base de datos');
        if (primerElementoError) primerElementoError.focus();
        if (btnGuardar) btnGuardar.innerHTML = textoBtn;
        return;
      }
      mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
      if (btnGuardar) btnGuardar.innerHTML = textoBtn;
      return;
    }

    window._ultimaCredencialAlumnoCreada = (resultadoDB && resultadoDB.credenciales_alumno) ? resultadoDB.credenciales_alumno : { usuario: dni, clave_provisoria: String(dni).slice(-4) };
  } catch (error) {
    console.error("Error al guardar alumno:", error);
    mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
    if (btnGuardar) btnGuardar.innerHTML = textoBtn;
    return;
  }

  const nombreParaMostrar = (apellidoDB && apellidoDB !== '-' && nombreDB) ? `${apellidoDB.toUpperCase()}, ${nombreDB.toUpperCase()}` : nombreCompleto;

  if (dniOriginal === '') {
    const emailAlumnoDefinitivo = emailAlumno || `${nombreDB.toLowerCase().replace(/\s/g, '')}.${apellidoDB.toLowerCase().replace(/\s/g, '')}@escuela.edu.ar`;

    const nuevo = {
      dni: dni,
      nombre: nombreParaMostrar,
      institucionId: jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa',
      jurisdiccion: jurisActiva,
      cursoId: cursoId,
      curso: cursoNombre,
      emailAlumno: emailAlumnoDefinitivo,
      tutor: tutor,
      dniTutor: dniTutor,
      emailTutor: emailTutor,
      asistencia: jurisActiva === 'pba' ? 'Días Hábiles: 82 • Inasistencias: 0 (Justificadas: 0)' : 'Días Hábiles: 96 • Inasistencias: 0 (Justificadas: 0)',
      notasFormosa: {},
      notasPba: {}
    };

    if (!DB_ESCOLAR.alumnos) DB_ESCOLAR.alumnos = [];
    DB_ESCOLAR.alumnos.push(nuevo);
    const cred = window._ultimaCredencialAlumnoCreada || { usuario: dni, clave_provisoria: String(dni).slice(-4) };
    mostrarToast(`Alumno "${nombreParaMostrar}" guardado. Usuario: ${cred.usuario} • Clave inicial: ${cred.clave_provisoria}`, 'success');
  } else {
    // Modo Edición visual
    const alum = DB_ESCOLAR.alumnos.find(a => a.dni === dniOriginal);
    if (alum) {
      alum.dni = dni;
      alum.nombre = nombreParaMostrar;
      alum.institucionId = jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa';
      alum.jurisdiccion = jurisActiva;
      alum.cursoId = cursoId;
      alum.curso = cursoNombre;
      alum.emailAlumno = emailAlumno;
      alum.tutor = tutor;
      alum.dniTutor = dniTutor;
      alum.emailTutor = emailTutor;
    }
    mostrarToast(`Datos actualizados con éxito en el padrón.`, 'success');
  }

  guardarBaseDatosEscolar();
  cerrarModalPadronAlumno();
  renderizarPadronAlumnos();
  poblarSelectorPreviewAlumnos();
  renderizarTablaCargaDocente();
  if (typeof refrescarPadronDesdeMySQL === 'function') {
    await refrescarPadronDesdeMySQL();
  }
}
// 4. Eliminar Alumno 
function eliminarAlumnoPadron(dni) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;
  const alum = DB_ESCOLAR.alumnos.find(a => a.dni === dni);
  if (!alum) return;

  mostrarModalConfirmacion({
    titulo: '¿Eliminar Alumno del Padrón?',
    mensaje: `¿Estás seguro de que deseás eliminar el registro oficial de ${alum.nombre}?`,
    detalles: [
      { label: 'Estudiante', valor: alum.nombre, colorClase: 'text-white' },
      { label: 'DNI Alumno', valor: alum.dni, colorClase: 'text-blue' },
      { label: 'Curso Asignado', valor: alum.curso || alum.cursoId, badge: 'badge-blue' },
      { label: 'Tutor / Responsable', valor: `${alum.tutor || 'No asignado'} (DNI ${alum.dniTutor || '-'})`, colorClase: 'text-secondary' }
    ],
    alerta: 'Esta acción dará de baja al estudiante del padrón y removerá todas sus calificaciones y asistencias.',
    textoBoton: 'Sí, Eliminar Alumno',
    icono: 'fa-solid fa-user-xmark',
    onConfirm: async () => {
      DB_ESCOLAR.alumnos = DB_ESCOLAR.alumnos.filter(a => a.dni !== dni);

      if (alumnoActivoDni === dni) {
        const alumnosEscuela = obtenerAlumnosEscuelaActiva();
        alumnoActivoDni = alumnosEscuela.length > 0 ? alumnosEscuela[0].dni : '';
      }

      guardarBaseDatosEscolar();
      renderizarPadronAlumnos();
      poblarSelectorPreviewAlumnos();
      renderizarTablaCargaDocente();
      mostrarToast(`Alumno "${alum.nombre}" eliminado del padrón escolar.`, 'info');

      // Sincronizar baja con MySQL
      try {
        const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
        const urlDel = (alum && alum.idDB) ? `api/alumnos.php?id=${encodeURIComponent(alum.idDB)}` : `api/alumnos.php?dni=${encodeURIComponent(dni)}&jurisdiccion=${encodeURIComponent(jurisActiva)}`;
        await fetch(urlDel, { method: 'DELETE' });
      } catch (errDel) {
        console.warn("Aviso al eliminar alumno en MySQL:", errDel);
      }
    }
  });
}

// VISTA PREVIA DEL BOLETÍN INDIVIDUAL PARA PRECEPTORES

function poblarSelectorPreviewAlumnos() {
  const sel = document.getElementById('selectPreviewAlumno');
  if (!sel || !DB_ESCOLAR) return;

  const alumnosEscuela = obtenerAlumnosEscuelaActiva();

  if (!alumnosEscuela.some(a => a.dni === alumnoActivoDni) && alumnosEscuela.length > 0) {
    alumnoActivoDni = alumnosEscuela[0].dni;
  }

  sel.innerHTML = alumnosEscuela.map(a =>
    `<option value="${a.dni}" ${a.dni === alumnoActivoDni ? 'selected' : ''}>${a.nombre} — DNI ${a.dni} (${a.curso || a.cursoId})</option>`
  ).join('');

  if (sel.options.length > 0) {
    sel.value = alumnoActivoDni;
  }
}

async function cambiarAlumnoPreview(dni) {
  alumnoActivoDni = dni;
  await cargarAlumnoEnBoletin(dni);
  renderizarBoletinPreview();
}

function cambiarAlumnoDesdeToolbar(dni) {
  cambiarAlumnoPreview(dni);
}

function verBoletinAlumnoDesdeCarga(dni) {
  alumnoActivoDni = dni;
  cambiarPestanaPreceptor('boletin');
  const sel = document.getElementById('selectPreviewAlumno');
  if (sel) sel.value = dni;
  cambiarAlumnoPreview(dni);
}

function renderizarBoletinPreview() {
  const contenedor = document.getElementById('contenedorBoletinPreview');
  const panelBoletin = document.getElementById('tutorPanelBoletin');
  if (!panelBoletin) return;

  if (rolActual === 'preceptor') {
    // Solo movemos el nodo DOM a la vista previa del preceptor si el rol activo es preceptor
    if (contenedor && !contenedor.contains(panelBoletin)) {
      contenedor.innerHTML = '';
      contenedor.appendChild(panelBoletin);
    }
    panelBoletin.style.display = 'block';
  } else {
    // Si el usuario activo es estudiante o tutor, NUNCA moverlo fuera de vistaTutor
    asegurarUbicacionBoletin();
  }

  if (datosMemoria) {
    renderizarPortal(datosMemoria);
  }
}

function sonMateriasEquivalentes(nomA, nomB) {
  if (!nomA || !nomB) return false;
  const aRaw = String(nomA).trim().toLowerCase();
  const bRaw = String(nomB).trim().toLowerCase();
  if (aRaw === bRaw) return true;

  // Normalización sin tildes ni diacríticos
  const a = aRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const b = bRaw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (a === b) return true;

  // Educación Física (aislada estrictamente de Física)
  const esEdFisA = a.includes('educacion fisica') || a.includes('ed. fisica') || a.includes('ed fisica');
  const esEdFisB = b.includes('educacion fisica') || b.includes('ed. fisica') || b.includes('ed fisica');
  if (esEdFisA && esEdFisB) return true;
  if (esEdFisA || esEdFisB) return false;

  // Matemática (aislada estrictamente para evitar que la sílaba 'tic' de matemática colisione con TIC)
  const esMatA = a.includes('matematica') || a.includes('matematicas');
  const esMatB = b.includes('matematica') || b.includes('matematicas');
  if (esMatA && esMatB) return true;
  if (esMatA || esMatB) return false;

  // Lengua / Lengua y Literatura / Prácticas del Lenguaje / Literatura
  const esLenguaA = a.includes('lengua') || a.includes('literatura') || a.includes('lenguaje');
  const esLenguaB = b.includes('lengua') || b.includes('literatura') || b.includes('lenguaje');
  if (esLenguaA && esLenguaB) {
    if (!a.includes('extranjera') && !b.includes('extranjera') && !a.includes('ingles') && !b.includes('ingles')) {
      return true;
    }
  }

  // Idioma Extranjero / Inglés
  const esInglesA = a.includes('extranjera') || a.includes('ingles');
  const esInglesB = b.includes('extranjera') || b.includes('ingles');
  if (esInglesA && esInglesB) return true;
  if (esInglesA || esInglesB) return false;

  // Educación Artística / Música
  const esArteA = a.includes('artistica') || a.includes('musica');
  const esArteB = b.includes('artistica') || b.includes('musica');
  if (esArteA && esArteB) return true;
  if (esArteA || esArteB) return false;

  // Biología
  const esBioA = a.includes('biologia');
  const esBioB = b.includes('biologia');
  if (esBioA && esBioB) return true;
  if (esBioA || esBioB) return false;

  // Historia
  const esHistA = a.includes('historia');
  const esHistB = b.includes('historia');
  if (esHistA && esHistB) return true;
  if (esHistA || esHistB) return false;

  // Geografía
  const esGeoA = a.includes('geografia');
  const esGeoB = b.includes('geografia');
  if (esGeoA && esGeoB) return true;
  if (esGeoA || esGeoB) return false;

  // Filosofía
  const esFiloA = a.includes('filosofia');
  const esFiloB = b.includes('filosofia');
  if (esFiloA && esFiloB) return true;
  if (esFiloA || esFiloB) return false;

  // Economía
  const esEconA = a.includes('economia');
  const esEconB = b.includes('economia');
  if (esEconA && esEconB) return true;
  if (esEconA || esEconB) return false;

  // Formación Ética
  const esEticaA = a.includes('etica');
  const esEticaB = b.includes('etica');
  if (esEticaA && esEticaB) return true;
  if (esEticaA || esEticaB) return false;

  // Físico - Química (debe contener referencia a ambas o al compuesto)
  const esFisQcaCompA = (a.includes('fisic') && a.includes('quim'));
  const esFisQcaCompB = (b.includes('fisic') && b.includes('quim'));
  if (esFisQcaCompA && esFisQcaCompB) return true;
  if (esFisQcaCompA || esFisQcaCompB) return false;

  // Física (o Introducción a la Física) - SIN Educación Física y SIN Química
  const esFisSolaA = a.includes('fisic') && !a.includes('quim') && !a.includes('educacion');
  const esFisSolaB = b.includes('fisic') && !b.includes('quim') && !b.includes('educacion');
  if (esFisSolaA && esFisSolaB) return true;
  if (esFisSolaA || esFisSolaB) return false;

  // Química - SIN Física
  const esQcaSolaA = a.includes('quim') && !a.includes('fisic');
  const esQcaSolaB = b.includes('quim') && !b.includes('fisic');
  if (esQcaSolaA && esQcaSolaB) return true;
  if (esQcaSolaA || esQcaSolaB) return false;

  // Tecnologías de la Información y Comunicación / TIC / NTICX (estrictamente delimitado por palabra completa o frase)
  const esTicA = (/\b(tic|nticx)\b/i.test(a) || a.includes('tecnologias de la informacion') || a.includes('tecnologia de la informacion') || a.includes('informacion y comunicacion') || a === 'tecnologias' || a === 'tecnologia') && !a.includes('educacion tecnologica');
  const esTicB = (/\b(tic|nticx)\b/i.test(b) || b.includes('tecnologias de la informacion') || b.includes('tecnologia de la informacion') || b.includes('informacion y comunicacion') || b === 'tecnologias' || b === 'tecnologia') && !b.includes('educacion tecnologica');
  if (esTicA && esTicB) return true;
  if (esTicA || esTicB) return false;

  // Educación Tecnológica
  const esEdTecA = a.includes('educacion tecnologica') || a.includes('ed. tecnologica') || a.includes('ed tecnologica');
  const esEdTecB = b.includes('educacion tecnologica') || b.includes('ed. tecnologica') || b.includes('ed tecnologica');
  if (esEdTecA && esEdTecB) return true;
  if (esEdTecA || esEdTecB) return false;

  return false;
}

// NUEVO: LEER EL BOLETÍN DESDE MYSQL (GET)
async function cargarAlumnoEnBoletin(dni) {
  if (!datosMemoria) return;
  const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = jurisActiva === 'pba' ? 2 : 1;
  const esPba = (jurisActiva === 'pba');

  // En rol tutor/estudiante conservar siempre el DNI vinculado a la sesión 1-a-1
  if (rolActual === 'tutor') {
    const dniVinc = (typeof usuarioSesion !== 'undefined' && usuarioSesion)
      ? (usuarioSesion.alumnoDni || usuarioSesion.alumno_dni || (usuarioSesion.hijo && usuarioSesion.hijo.dni) || '')
      : '';
    if (dniVinc) {
      dni = String(dniVinc);
    } else if (!dni) {
      dni = esPba ? '48763736' : '34567890';
    }
  }

  const alumnosEscuela = obtenerAlumnosEscuelaActiva();
  if (!dni && alumnosEscuela.length > 0) {
    dni = alumnosEscuela[0].dni;
  }
  if (!dni) {
    dni = esPba ? '48763736' : '34567890';
  }

  let alumno = alumnosEscuela.find(a => String(a.dni) === String(dni));
  if (!alumno && rolActual !== 'tutor' && alumnosEscuela.length > 0) {
    alumno = alumnosEscuela[0];
    dni = alumno.dni;
  }
  alumnoActivoDni = String(dni);

  // 1. Armamos los datos básicos del estudiante (Nombre, Curso, Tutor)
  if (!datosMemoria.estudiante) datosMemoria.estudiante = {};
  const tipoSesionActual = obtenerTipoUsuarioSesion(usuarioSesion);
  const esGoogleInvitado = Boolean(
    rolActual === 'tutor' &&
    tipoSesionActual === 'estudiante' &&
    typeof usuarioSesion !== 'undefined' &&
    usuarioSesion &&
    (usuarioSesion.es_google_cuenta || usuarioSesion.esGoogleCuenta) &&
    !usuarioSesion.en_padron
  );

  if (esGoogleInvitado) {
    const cursoGoogle = (alumno && alumno.curso) || usuarioSesion.curso || (esPba ? '4° Única' : '2° III');
    datosMemoria.estudiante.nombre = usuarioSesion.nombre || 'Estudiante Google';
    datosMemoria.estudiante.dni = '';
    datosMemoria.estudiante.curso = `${cursoGoogle} • Cuenta Google`;
    datosMemoria.estudiante.tutor = usuarioSesion.email || 'Acceso con Google';
    if (alumno && alumno.asistencia) datosMemoria.asistencia = alumno.asistencia;
  } else if (alumno) {
    datosMemoria.estudiante.nombre = alumno.nombre || (esPba ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO');
    datosMemoria.estudiante.dni = alumno.dni || dni;
    datosMemoria.estudiante.curso = alumno.curso || (esPba ? '4° Única' : '2° III');
    datosMemoria.estudiante.tutor = alumno.tutor || (esPba ? 'PLEININGER, CRISTIAN' : 'Gómez Pedro');
    datosMemoria.estudiante.emailTutor = alumno.emailTutor || '';
    if (alumno.asistencia) datosMemoria.asistencia = alumno.asistencia;
  } else {
    if (esPba) {
      datosMemoria.estudiante.nombre = 'PLEININGER, URIEL LUCIANO';
      datosMemoria.estudiante.dni = '48763736';
      datosMemoria.estudiante.curso = '4° Única';
      datosMemoria.estudiante.tutor = 'PLEININGER, CRISTIAN';
      datosMemoria.asistencia = 'Días Hábiles: 82 • Inasistencias: 17';
    } else {
      datosMemoria.estudiante.nombre = 'GÓMEZ, MATEO';
      datosMemoria.estudiante.dni = '34567890';
      datosMemoria.estudiante.curso = '2° III';
      datosMemoria.estudiante.tutor = 'Gómez Pedro';
      datosMemoria.asistencia = 'Días Hábiles: 96 • Inasistencias: 0';
    }
  }

  // Sincronizar solamente alumnoDni y header sin sobrescribir la identidad real autenticada
  if (rolActual === 'tutor' && typeof usuarioSesion !== 'undefined' && usuarioSesion) {
    if (!usuarioSesion.alumnoDni) {
      usuarioSesion.alumnoDni = String(dni);
      localStorage.setItem('boletin_usuario', JSON.stringify(usuarioSesion));
    }
    actualizarHeaderUsuario();
  }

  // 2. Reconstruimos las materias del boletín según la jurisdicción y el ciclo educativo del alumno
  const cursoNombre = (alumno && alumno.curso) ? alumno.curso : (datosMemoria.estudiante && datosMemoria.estudiante.curso ? datosMemoria.estudiante.curso : '');
  let ciclo = 'basico';
  if (DB_ESCOLAR && DB_ESCOLAR.cursos) {
    const cursoObj = DB_ESCOLAR.cursos.find(c => c.nombre === cursoNombre || c.id === cursoNombre);
    if (cursoObj && cursoObj.ciclo) {
      ciclo = cursoObj.ciclo;
    } else if (/^[456]/.test(cursoNombre)) {
      ciclo = 'orientado';
    }
  } else if (/^[456]/.test(cursoNombre)) {
    ciclo = 'orientado';
  }

  const catalogoJuris = CATALOGO_ACADEMICO[jurisActiva] || CATALOGO_ACADEMICO.formosa;
  const materiasOficiales = catalogoJuris[ciclo] || catalogoJuris.basico;
  const anioStr = cursoNombre.includes('°') ? cursoNombre.split('°')[0] + '°' : (cursoNombre ? cursoNombre.charAt(0) + '°' : '');

  datosMemoria.materias = materiasOficiales.map(nomMat => ({
    nombre: nomMat,
    tipo: 'C',
    anio: anioStr,
    notas: {},
    condicion: (nomMat.toLowerCase().includes('tutoría') || nomMat.toLowerCase().includes('tutoria')) ? 'Conceptual' : 'En Curso'
  }));

  // Sincronizar previas del alumno activo desde la base de datos
  if (alumno && !alumno.previas) {
    alumno.previas = [];
  }
  if (typeof sincronizarPreviasDeAlumno === 'function') {
    await sincronizarPreviasDeAlumno(dni, idInst, jurisActiva);
  }

  try {
    // Le pasamos el DNI y la institución por la URL (GET) a notas.php
    const respuesta = await fetch(`api/notas.php?dni=${dni}&id_institucion=${idInst}&jurisdiccion=${jurisActiva}`);

    if (respuesta.ok) {
      const notasBD = await respuesta.json();

      // Si trajo notas, las acomodamos en el diseño del boletín
      if (Array.isArray(notasBD) && notasBD.length > 0) {
        const esBsAs = datosMemoria.jurisdiccion === 'Buenos Aires';

        notasBD.forEach(notaReal => {
          // Buscamos la fila de esa materia en el catálogo oficial del ciclo
          let matObj = (datosMemoria.materias || []).find(m =>
            m && m.nombre && (m.nombre.toLowerCase() === (notaReal.materia || '').toLowerCase() || sonMateriasEquivalentes(m.nombre, notaReal.materia))
          );
          if (!matObj) {
            matObj = (datosMemoria.materias || []).find(m => m && m.nombre === notaReal.materia);
          }
          if (!matObj) {
            // Solo agregar materia extra si NO pertenece exclusivamente al otro ciclo educativo
            const materiasCicloOpuesto = (ciclo === 'orientado')
              ? (catalogoJuris.basico || [])
              : (catalogoJuris.orientado || []);

            const perteneceOtroCiclo = materiasCicloOpuesto.some(mOp =>
              mOp.toLowerCase() === (notaReal.materia || '').toLowerCase() || sonMateriasEquivalentes(mOp, notaReal.materia)
            );

            if (!perteneceOtroCiclo) {
              matObj = {
                nombre: notaReal.materia,
                tipo: 'C',
                anio: anioStr,
                notas: {},
                condicion: 'En Curso'
              };
              if (!Array.isArray(datosMemoria.materias)) datosMemoria.materias = [];
              datosMemoria.materias.push(matObj);
            }
          }

          if (matObj) {
            if (!matObj.notas) matObj.notas = {};

            const p = (notaReal.periodo || '').toLowerCase().trim();
            const num = (notaReal.nota_numerica !== null && notaReal.nota_numerica !== '' && !isNaN(Number(notaReal.nota_numerica)))
              ? Number(notaReal.nota_numerica)
              : null;
            const conc = notaReal.valoracion_conceptual || null;

            // Acomodamos según la provincia (PBA o Formosa)
            if (esBsAs) {
              const esC1 = p === 'c1' || p.includes('1° cuat') || p.includes('1 cuat') || p.includes('primer cuat') || (p.includes('1') && p.includes('cuat'));
              const esC2 = p === 'c2' || p.includes('2° cuat') || p.includes('2 cuat') || p.includes('segundo cuat') || (p.includes('2') && p.includes('cuat'));
              const esRit = p === 'rit_dic' || p.includes('rit') || p.includes('intensif');

              if (esC1) {
                matObj.notas.c1_val = conc;
                matObj.notas.c1_nota = num;
                if (alumno) {
                  if (!alumno.notasPba) alumno.notasPba = {};
                  if (!alumno.notasPba[matObj.nombre]) alumno.notasPba[matObj.nombre] = {};
                  alumno.notasPba[matObj.nombre].c1_val = conc;
                  alumno.notasPba[matObj.nombre].c1_nota = num;
                  alumno.notasPba[matObj.nombre].obs = notaReal.observacion || '';
                }
              } else if (esC2) {
                matObj.notas.c2_val = conc;
                matObj.notas.c2_nota = num;
                if (alumno) {
                  if (!alumno.notasPba) alumno.notasPba = {};
                  if (!alumno.notasPba[matObj.nombre]) alumno.notasPba[matObj.nombre] = {};
                  alumno.notasPba[matObj.nombre].c2_val = conc;
                  alumno.notasPba[matObj.nombre].c2_nota = num;
                  alumno.notasPba[matObj.nombre].obs = notaReal.observacion || '';
                }
              } else if (esRit) {
                matObj.notas.rit_dic = num;
                if (alumno) {
                  if (!alumno.notasPba) alumno.notasPba = {};
                  if (!alumno.notasPba[matObj.nombre]) alumno.notasPba[matObj.nombre] = {};
                  alumno.notasPba[matObj.nombre].rit_dic = num;
                }
              }
            } else {
              // Formosa (Trimestral)
              const esT1 = p === 't1' || (p.includes('1') && p.includes('trim') && !p.includes('cuat')) || p.includes('primer trim');
              const esT2 = p === 't2' || (p.includes('2') && p.includes('trim') && !p.includes('cuat')) || p.includes('segundo trim');
              const esT3 = p === 't3' || (p.includes('3') && p.includes('trim') && !p.includes('cuat')) || p.includes('tercer trim');
              const esRec = p === 'rec_dic' || (p.includes('rec') && p.includes('dic'));
              const esPair = p === 'pair' || p.includes('pair');

              if (esT1) {
                matObj.notas.t1_n = num;
                matObj.notas.t1_c = conc;
                if (alumno) {
                  if (!alumno.notasFormosa) alumno.notasFormosa = {};
                  if (!alumno.notasFormosa[matObj.nombre]) alumno.notasFormosa[matObj.nombre] = {};
                  alumno.notasFormosa[matObj.nombre].t1_n = num;
                  alumno.notasFormosa[matObj.nombre].t1_c = conc;
                  alumno.notasFormosa[matObj.nombre].obs = notaReal.observacion || '';
                }
              } else if (esT2) {
                matObj.notas.t2_n = num;
                matObj.notas.t2_c = conc;
                if (alumno) {
                  if (!alumno.notasFormosa) alumno.notasFormosa = {};
                  if (!alumno.notasFormosa[matObj.nombre]) alumno.notasFormosa[matObj.nombre] = {};
                  alumno.notasFormosa[matObj.nombre].t2_n = num;
                  alumno.notasFormosa[matObj.nombre].t2_c = conc;
                  alumno.notasFormosa[matObj.nombre].obs = notaReal.observacion || '';
                }
              } else if (esT3) {
                matObj.notas.t3_n = num;
                matObj.notas.t3_c = conc;
                if (alumno) {
                  if (!alumno.notasFormosa) alumno.notasFormosa = {};
                  if (!alumno.notasFormosa[matObj.nombre]) alumno.notasFormosa[matObj.nombre] = {};
                  alumno.notasFormosa[matObj.nombre].t3_n = num;
                  alumno.notasFormosa[matObj.nombre].t3_c = conc;
                  alumno.notasFormosa[matObj.nombre].obs = notaReal.observacion || '';
                }
              } else if (esRec) {
                matObj.notas.rec_dic = num;
              } else if (esPair) {
                matObj.notas.pair = num;
              }
            }
          }
        });
      }
    }
  } catch (err) {
    console.error("Aviso: No se pudieron traer las notas de MySQL:", err);
  }

  // 3.1 Traer asistencia real del alumno desde MySQL (todos los períodos)
  // Reset previo de inasistencias para no arrastrar las del estudiante anterior
  if (jurisActiva === 'pba') {
    datosMemoria.inasistencias = { c1: 0, c2: '-', total: 0 };
  } else {
    datosMemoria.inasistencias = { t1: 0, t2: 0, t3: '-', total: 0 };
  }

  try {
    const respAsist = await fetch(`api/asistencia.php?dni=${dni}&id_institucion=${idInst}`);
    if (respAsist.ok) {
      const asistBD = await respAsist.json();
      if (Array.isArray(asistBD) && asistBD.length > 0) {
        if (alumno) {
          if (!alumno.asistenciasPeriodos) alumno.asistenciasPeriodos = {};

          asistBD.forEach(reg => {
            const p = normalizarNombrePeriodo(reg.periodo, jurisActiva);
            const dias = parseInt(reg.dias_habiles, 10) || (jurisActiva === 'pba' ? 82 : 96);
            const pres = parseInt(reg.asistencias, 10) || 0;
            const faltas = parseInt(reg.inasistencias, 10) || 0;
            const just = parseInt(reg.justificadas, 10) || 0;
            alumno.asistenciasPeriodos[p] = {
              dias: dias,
              asistencias: pres,
              inasistencias: faltas,
              justificadas: just
            };
          });

          const resumen = obtenerDatosAsistenciaAlumno(alumno, null);
          alumno.diasHabiles = resumen.dias;
          alumno.totalAsistencias = resumen.asistencias;
          alumno.totalInasistencias = resumen.inasistencias;
          alumno.justificadas = resumen.justificadas;
          alumno.asistencia = (resumen.justificadas > 0)
            ? `Días Hábiles: ${resumen.dias} • Total Asistencias: ${resumen.asistencias} • Inasistencias: ${resumen.inasistencias} (Justificadas: ${resumen.justificadas})`
            : `Días Hábiles: ${resumen.dias} • Total Asistencias: ${resumen.asistencias} • Inasistencias: ${resumen.inasistencias}`;

          datosMemoria.asistencia = alumno.asistencia;
          sincronizarInasistenciasBoletin(alumno);
        }
      } else {
        // Si el estudiante no tiene asistencias cargadas en la BD, resetear a 0 inasistencias
        if (alumno) {
          alumno.asistenciasPeriodos = {};
          const dias = (jurisActiva === 'pba' ? 82 : 96);
          alumno.diasHabiles = dias;
          alumno.totalAsistencias = dias;
          alumno.totalInasistencias = 0;
          alumno.justificadas = 0;
          alumno.asistencia = `Días Hábiles: ${dias} • Total Asistencias: ${dias} • Inasistencias: 0`;
        }
        datosMemoria.asistencia = alumno ? alumno.asistencia : (jurisActiva === 'pba' ? 'Días Hábiles: 82 • Inasistencias: 0' : 'Días Hábiles: 96 • Inasistencias: 0');
        if (jurisActiva === 'pba') {
          datosMemoria.inasistencias = { c1: 0, c2: '-', total: 0 };
        } else {
          datosMemoria.inasistencias = { t1: 0, t2: 0, t3: '-', total: 0 };
        }
      }
    }
  } catch (errAsist) {
    console.warn("Aviso: No se pudo sincronizar asistencia individual desde MySQL:", errAsist);
  }

  // 4. Le decimos a la página que dibuje el boletín con los datos frescos
  if (typeof renderizarPortal === 'function') {
    renderizarPortal(datosMemoria);
  }
  if (rolActual === 'tutor') {
    if (typeof renderizarAsistenciaTutor === 'function') renderizarAsistenciaTutor();
    if (typeof renderizarMesasTutor === 'function') renderizarMesasTutor();
  }
}

// GESTIÓN Y REGISTRO DE ASISTENCIA POR CURSO (ROL PRECEPTOR)

let asistenciaCursoSeleccionado = '2-3';
let asistenciaPeriodoSeleccionado = '1° Trimestre';
let asistenciaPaginaActual = 1;
const ASISTENCIA_POR_PAGINA = 15;

// Poblar selector de cursos para la carga de asistencia con optgroups 
function poblarSelectorCursosAsistencia() {
  const sel = document.getElementById('selectAsistenciaCurso');
  if (!sel || !DB_ESCOLAR || !DB_ESCOLAR.cursos) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const cursos = (DB_ESCOLAR.cursos || []).filter(c => !c.institucionId || c.institucionId === instActiva);
  let html = '';

  // 1. Ciclo Básico
  const basico = cursos.filter(c => (c.ciclo || 'basico') === 'basico');
  if (basico.length > 0) {
    html += `<optgroup label="Ciclo Básico">`;
    basico.forEach(c => {
      html += `<option value="${c.id}" ${c.id === asistenciaCursoSeleccionado ? 'selected' : ''}>${c.nombre}</option>`;
    });
    html += `</optgroup>`;
  }

  // 2. Orientaciones dinámicas
  const orientado = cursos.filter(c => c.ciclo === 'orientado');
  const orientacionesMap = {};
  orientado.forEach(c => {
    const ori = c.orientacion || 'Ciclo Orientado';
    if (!orientacionesMap[ori]) orientacionesMap[ori] = [];
    orientacionesMap[ori].push(c);
  });

  Object.keys(orientacionesMap).forEach(oriNombre => {
    html += `<optgroup label="${oriNombre}">`;
    orientacionesMap[oriNombre].forEach(c => {
      html += `<option value="${c.id}" ${c.id === asistenciaCursoSeleccionado ? 'selected' : ''}>${c.nombre} (${oriNombre})</option>`;
    });
    html += `</optgroup>`;
  });

  sel.innerHTML = html;

  // Si el valor seleccionado no existe en las opciones, seleccionar la primera
  const opciones = Array.from(sel.options);
  if (!opciones.some(o => o.value === asistenciaCursoSeleccionado)) {
    if (opciones.length > 0) {
      asistenciaCursoSeleccionado = opciones[0].value;
      sel.value = asistenciaCursoSeleccionado;
    }
  } else {
    sel.value = asistenciaCursoSeleccionado;
  }
}

// Poblar selector de períodos según la escuela/jurisdicción activa (Trimestres en Formosa, Cuatrimestres en PBA)
function poblarSelectorPeriodosAsistencia() {
  const sel = document.getElementById('selectAsistenciaPeriodo');
  if (!sel) return;
  const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
    ? DB_ESCOLAR.configuracion.jurisdiccion
    : "formosa";

  let opciones = [];
  if (jurisActiva === 'pba') {
    opciones = ['1° Cuatrimestre', '2° Cuatrimestre'];
  } else {
    opciones = ['1° Trimestre', '2° Trimestre', '3° Trimestre'];
  }

  // Si el valor seleccionado actual no pertenece a las nuevas opciones, resetear al primero
  if (!opciones.includes(asistenciaPeriodoSeleccionado)) {
    asistenciaPeriodoSeleccionado = opciones[0];
  }

  sel.innerHTML = opciones.map(p => `<option value="${p}" ${p === asistenciaPeriodoSeleccionado ? 'selected' : ''}>${p}</option>`).join('');
  sel.value = asistenciaPeriodoSeleccionado;

  // Ajustar el valor sugerido en Días Hábiles Global según la jurisdicción
  const inputDiasGlobal = document.getElementById('inputDiasHabilesGlobal');
  if (inputDiasGlobal) {
    inputDiasGlobal.value = (jurisActiva === 'pba') ? 82 : 96;
  }
}

// Evento al cambiar de período en la carga de asistencia
function alCambiarPeriodoAsistencia(nuevoPeriodo) {
  asistenciaPeriodoSeleccionado = nuevoPeriodo || '1° Trimestre';
  asistenciaPaginaActual = 1;
  renderizarTablaAsistencia();
}

// Evento al cambiar curso en el selector de asistencia
function alCambiarCursoAsistencia(cursoId) {
  asistenciaCursoSeleccionado = cursoId || '2-3';
  asistenciaPaginaActual = 1;
  renderizarTablaAsistencia();
}

// Cambiar de página en la tabla de Asistencia
function cambiarPaginaAsistencia(nuevaPagina) {
  asistenciaPaginaActual = nuevaPagina;
  renderizarTablaAsistencia();
  const tabla = document.getElementById('tbodyAsistenciaAlumnos');
  if (tabla) {
    tabla.closest('.table-responsive')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

// Helper para normalizar nombres canónicos de períodos de asistencia
function normalizarNombrePeriodo(p, juris = 'formosa') {
  if (!p) return (juris === 'pba' ? '1° Cuatrimestre' : '1° Trimestre');
  const str = String(p).toLowerCase().trim();
  if (str.includes('cuat') || str.startsWith('c')) {
    if (str.includes('2') || str === 'c2') return '2° Cuatrimestre';
    return '1° Cuatrimestre';
  }
  if (str.includes('trim') || str.startsWith('t')) {
    if (str.includes('2') || str === 't2') return '2° Trimestre';
    if (str.includes('3') || str === 't3') return '3° Trimestre';
    return '1° Trimestre';
  }
  return p;
}

// Extraer o desglosar datos de asistencia del alumno con soporte retrocompatible y por período
function obtenerDatosAsistenciaAlumno(alum, periodoTarget = null) {
  const jurisActiva = (alum && alum.jurisdiccion)
    ? alum.jurisdiccion
    : ((DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa");
  const diasPorDefecto = (jurisActiva === 'pba') ? 82 : 96;

  if (!alum.asistenciasPeriodos) {
    alum.asistenciasPeriodos = {};
  }

  // 1. Si se solicita un período específico
  if (periodoTarget) {
    const pNorm = normalizarNombrePeriodo(periodoTarget, jurisActiva);
    if (alum.asistenciasPeriodos[pNorm]) {
      const reg = alum.asistenciasPeriodos[pNorm];
      let dias = parseInt(reg.dias, 10) || diasPorDefecto;
      let faltas = parseInt(reg.inasistencias, 10) || 0;
      let just = parseInt(reg.justificadas, 10) || 0;
      let asist = (reg.asistencias !== undefined && reg.asistencias !== null && !isNaN(reg.asistencias))
        ? parseInt(reg.asistencias, 10)
        : Math.max(0, dias - faltas);
      if (just > faltas) just = faltas;
      const injust = Math.max(0, faltas - just);
      const porcentaje = dias > 0 ? Math.max(0, Math.min(100, Math.round((asist / dias) * 100))) : 100;
      return { dias, asistencias: asist, inasistencias: faltas, justificadas: just, injustificadas: injust, porcentaje };
    }

    // Si es el primer período y el alumno tiene propiedades iniciales globales
    const esPrimerPeriodo = (pNorm === '1° Trimestre' || pNorm === '1° Cuatrimestre');
    if (esPrimerPeriodo && (alum.totalInasistencias !== undefined || alum.diasHabiles !== undefined)) {
      let dias = parseInt(alum.diasHabiles, 10) || diasPorDefecto;
      let faltas = parseInt(alum.totalInasistencias, 10) || 0;
      let just = parseInt(alum.justificadas, 10) || 0;
      let asist = parseInt(alum.totalAsistencias, 10);
      if (isNaN(asist)) asist = Math.max(0, dias - faltas);
      if (just > faltas) just = faltas;
      const injust = Math.max(0, faltas - just);
      const porcentaje = dias > 0 ? Math.max(0, Math.min(100, Math.round((asist / dias) * 100))) : 100;
      alum.asistenciasPeriodos[pNorm] = { dias, asistencias: asist, inasistencias: faltas, justificadas: just };
      return { dias, asistencias: asist, inasistencias: faltas, justificadas: just, injustificadas: injust, porcentaje };
    }

    // Para cualquier otro período no cargado aún, retornar valores limpios
    return {
      dias: diasPorDefecto,
      asistencias: diasPorDefecto,
      inasistencias: 0,
      justificadas: 0,
      injustificadas: 0,
      porcentaje: 100
    };
  }

  // 2. Si NO se especifica período: resumen acumulado total de todos los períodos cargados
  const periodosKeys = Object.keys(alum.asistenciasPeriodos);
  if (periodosKeys.length > 0) {
    let sumDias = 0;
    let sumAsist = 0;
    let sumFaltas = 0;
    let sumJust = 0;

    periodosKeys.forEach(pk => {
      const p = alum.asistenciasPeriodos[pk];
      sumDias += (parseInt(p.dias, 10) || 0);
      sumAsist += (parseInt(p.asistencias, 10) || 0);
      sumFaltas += (parseInt(p.inasistencias, 10) || 0);
      sumJust += (parseInt(p.justificadas, 10) || 0);
    });

    if (sumDias <= 0) sumDias = diasPorDefecto;
    if (sumJust > sumFaltas) sumJust = sumFaltas;
    const injust = Math.max(0, sumFaltas - sumJust);
    const porcentaje = sumDias > 0 ? Math.max(0, Math.min(100, Math.round((sumAsist / sumDias) * 100))) : 100;

    return {
      dias: sumDias,
      asistencias: sumAsist,
      inasistencias: sumFaltas,
      justificadas: sumJust,
      injustificadas: injust,
      porcentaje
    };
  }

  // Fallback con propiedades globales simples
  let dias = parseInt(alum.diasHabiles, 10) || diasPorDefecto;
  let faltas = parseInt(alum.totalInasistencias, 10) || 0;
  let just = parseInt(alum.justificadas, 10) || 0;
  let asist = (alum.totalAsistencias !== undefined && alum.totalAsistencias !== null && !isNaN(alum.totalAsistencias))
    ? parseInt(alum.totalAsistencias, 10)
    : Math.max(0, dias - faltas);
  if (just > faltas) just = faltas;
  const injust = Math.max(0, faltas - just);
  const porcentaje = dias > 0 ? Math.max(0, Math.min(100, Math.round((asist / dias) * 100))) : 100;

  return { dias, asistencias: asist, inasistencias: faltas, justificadas: just, injustificadas: injust, porcentaje };
}

// Sincronizar estructura de inasistencias en datosMemoria para el boletín escolar activo
function sincronizarInasistenciasBoletin(alum) {
  if (!datosMemoria) return;
  const juris = (alum && alum.jurisdiccion)
    ? alum.jurisdiccion
    : ((DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : 'formosa');

  if (juris === 'pba') {
    const c1Reg = (alum.asistenciasPeriodos && alum.asistenciasPeriodos['1° Cuatrimestre']);
    const c2Reg = (alum.asistenciasPeriodos && alum.asistenciasPeriodos['2° Cuatrimestre']);

    const c1 = c1Reg ? c1Reg.inasistencias : (alum.totalInasistencias !== undefined ? alum.totalInasistencias : 0);
    const c2 = c2Reg ? c2Reg.inasistencias : '-';

    let total = 0;
    if (typeof c1 === 'number') total += c1;
    if (typeof c2 === 'number') total += c2;

    datosMemoria.inasistencias = {
      c1: c1,
      c2: c2,
      total: total
    };
  } else {
    const t1Reg = (alum.asistenciasPeriodos && alum.asistenciasPeriodos['1° Trimestre']);
    const t2Reg = (alum.asistenciasPeriodos && alum.asistenciasPeriodos['2° Trimestre']);
    const t3Reg = (alum.asistenciasPeriodos && alum.asistenciasPeriodos['3° Trimestre']);

    const t1 = t1Reg ? t1Reg.inasistencias : (alum.totalInasistencias !== undefined ? alum.totalInasistencias : 0);
    const t2 = t2Reg ? t2Reg.inasistencias : '-';
    const t3 = t3Reg ? t3Reg.inasistencias : '-';

    let total = 0;
    if (typeof t1 === 'number') total += t1;
    if (typeof t2 === 'number') total += t2;
    if (typeof t3 === 'number') total += t3;

    datosMemoria.inasistencias = {
      t1: t1,
      t2: t2,
      t3: t3,
      total: total
    };
  }

  const elAsist = document.getElementById('asistencia-info');
  if (elAsist) elAsist.textContent = alum.asistencia;
}

// Calcular badge de estado según inasistencias acumuladas
function calcularEstadoAsistenciaBadge(inasistencias) {
  if (inasistencias <= 15) {
    return `<span class="badge badge-green" title="Asistencia regular (hasta 15 inasistencias)"><i class="fa-solid fa-check"></i> Regular</span>`;
  } else if (inasistencias <= 20) {
    return `<span class="badge badge-amber" title="Riesgo de regularidad (> 15 inasistencias)"><i class="fa-solid fa-triangle-exclamation"></i> Alerta Faltas</span>`;
  } else {
    return `<span class="badge badge-red" title="Límite reglamentario excedido (> 20 inasistencias)"><i class="fa-solid fa-circle-exclamation"></i> Límite Excedido</span>`;
  }
}

// Renderizar tabla completa de asistencias para el curso y período seleccionado (paginada a 15 alumnos)
function renderizarTablaAsistencia() {
  const tbody = document.getElementById('tbodyAsistenciaAlumnos');
  const paginacionBox = document.getElementById('paginacionAsistencia');
  if (!tbody || !DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const periodoActual = asistenciaPeriodoSeleccionado || (jurisActiva === 'pba' ? '1° Cuatrimestre' : '1° Trimestre');

  const alumnosCurso = obtenerAlumnosEscuelaActiva().filter(a => a.cursoId === asistenciaCursoSeleccionado);
  const cursoObj = (DB_ESCOLAR.cursos || []).find(c => c.id === asistenciaCursoSeleccionado);
  const nombreCurso = cursoObj ? cursoObj.nombre : asistenciaCursoSeleccionado;

  // Actualizar badge superior
  const badgeStats = document.getElementById('badgeAsistenciaStats');
  if (badgeStats) {
    badgeStats.textContent = `${nombreCurso} • ${periodoActual} • ${alumnosCurso.length} Estudiante(s)`;
  }

  if (alumnosCurso.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: #64748b;"></i>
          No hay alumnos registrados en <strong>${nombreCurso}</strong>. Podés incorporar estudiantes desde la pestaña <strong>Padrón de Alumnos</strong>.
        </td>
      </tr>
    `;
    if (paginacionBox) paginacionBox.innerHTML = '';
    actualizarFooterEstadisticasAsistencia([]);
    return;
  }

  // Paginación a 15 alumnos por página
  const totalAlumnos = alumnosCurso.length;
  const totalPaginas = Math.max(1, Math.ceil(totalAlumnos / ASISTENCIA_POR_PAGINA));
  if (asistenciaPaginaActual > totalPaginas) asistenciaPaginaActual = totalPaginas;
  if (asistenciaPaginaActual < 1) asistenciaPaginaActual = 1;

  const inicio = (asistenciaPaginaActual - 1) * ASISTENCIA_POR_PAGINA;
  const fin = inicio + ASISTENCIA_POR_PAGINA;
  const alumnosPagina = alumnosCurso.slice(inicio, fin);

  let html = '';
  alumnosPagina.forEach((alum, index) => {
    const indiceGlobal = inicio + index + 1;
    const datos = obtenerDatosAsistenciaAlumno(alum, periodoActual);
    const badgeEstado = calcularEstadoAsistenciaBadge(datos.inasistencias);
    const colorPorc = datos.porcentaje >= 85 ? '#4ade80' : datos.porcentaje >= 75 ? '#facc15' : '#f87171';

    html += `
      <tr id="filaAsist_${alum.dni}">
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${indiceGlobal}</td>
        <td style="font-family: monospace; font-size: 0.82rem; color: #94a3b8;">${alum.dni}</td>
        <td>
          <div class="text-white" style="font-weight: 700; font-size: 0.88rem;">${alum.nombre}</div>
          <div style="font-size: 0.72rem; color: var(--text-muted);">${alum.tutor ? 'Tutor: ' + alum.tutor : ''}</div>
        </td>
        <td style="text-align: center;">
          <input type="number" 
                 class="input-asist-dias" 
                 id="inputDias_${alum.dni}" 
                 value="${datos.dias}" 
                 min="1" 
                 max="300"
                 oninput="alCambiarValoresFilaAsist('${alum.dni}', 'dias')"
                 title="Total de Días Hábiles del período">
        </td>
        <td style="text-align: center;">
          <input type="number" 
                 class="input-asist-pres" 
                 id="inputPres_${alum.dni}" 
                 value="${datos.asistencias}" 
                 min="0" 
                 max="${datos.dias}"
                 oninput="alCambiarValoresFilaAsist('${alum.dni}', 'pres')"
                 title="Total de Asistencias (presencias) en este período">
        </td>
        <td style="text-align: center;">
          <input type="number" 
                 class="input-asist-total" 
                 id="inputFaltas_${alum.dni}" 
                 value="${datos.inasistencias}" 
                 min="0" 
                 max="150"
                 oninput="alCambiarValoresFilaAsist('${alum.dni}', 'faltas')"
                 title="Total de Inasistencias en este período">
        </td>
        <td style="text-align: center;">
          <input type="number" 
                 class="input-asist-just" 
                 id="inputJust_${alum.dni}" 
                 value="${datos.justificadas}" 
                 min="0" 
                 max="150"
                 oninput="alCambiarValoresFilaAsist('${alum.dni}', 'just')"
                 title="Inasistencias justificadas en este período">
        </td>
        <td style="text-align: center; font-weight: 700; color: #cbd5e1; font-size: 0.85rem;" id="celdaInjust_${alum.dni}">
          ${datos.injustificadas}
        </td>
        <td style="text-align: center;" id="celdaPorc_${alum.dni}">
          <span style="font-weight: 700; font-size: 0.88rem; color: ${colorPorc};">
            ${datos.porcentaje}%
          </span>
        </td>
        <td style="text-align: center;" id="celdaEstado_${alum.dni}">
          ${badgeEstado}
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;

  // Renderizar controles de paginación
  if (paginacionBox) {
    paginacionBox.innerHTML = generarHtmlPaginacion({
      totalItems: totalAlumnos,
      porPagina: ASISTENCIA_POR_PAGINA,
      paginaActual: asistenciaPaginaActual,
      nombreFuncionCambio: 'cambiarPaginaAsistencia',
      etiquetaItems: 'estudiantes'
    });
  }

  actualizarFooterEstadisticasAsistencia(alumnosCurso);
}

// Actualización bidireccional y en tiempo real de los valores de asistencia de una fila
function alCambiarValoresFilaAsist(dni, campoModificado) {
  const inputDias = document.getElementById(`inputDias_${dni}`);
  const inputPres = document.getElementById(`inputPres_${dni}`);
  const inputFaltas = document.getElementById(`inputFaltas_${dni}`);
  const inputJust = document.getElementById(`inputJust_${dni}`);
  const celdaInjust = document.getElementById(`celdaInjust_${dni}`);
  const celdaPorc = document.getElementById(`celdaPorc_${dni}`);
  const celdaEstado = document.getElementById(`celdaEstado_${dni}`);

  if (!inputDias || !inputPres || !inputFaltas || !inputJust) return;

  let dias = parseInt(inputDias.value, 10);
  if (isNaN(dias) || dias <= 0) dias = 1;

  let pres = parseInt(inputPres.value, 10);
  if (isNaN(pres) || pres < 0) pres = 0;

  let faltas = parseInt(inputFaltas.value, 10);
  if (isNaN(faltas) || faltas < 0) faltas = 0;

  let just = parseInt(inputJust.value, 10);
  if (isNaN(just) || just < 0) just = 0;

  // Lógica de cálculo reactivo
  if (campoModificado === 'pres') {
    if (pres > dias) pres = dias;
    inputPres.value = pres;
    faltas = Math.max(0, dias - pres);
    inputFaltas.value = faltas;
  } else if (campoModificado === 'faltas' || campoModificado === 'dias') {
    if (faltas > dias) faltas = dias;
    pres = Math.max(0, dias - faltas);
    inputPres.value = pres;
  }

  // Las justificadas no pueden superar las inasistencias totales
  if (just > faltas) {
    just = faltas;
    inputJust.value = just;
  }

  const injust = Math.max(0, faltas - just);
  const porcentaje = dias > 0 ? Math.max(0, Math.min(100, Math.round((pres / dias) * 100))) : 100;

  if (celdaInjust) celdaInjust.textContent = injust;

  if (celdaPorc) {
    const colorPorc = porcentaje >= 85 ? '#4ade80' : porcentaje >= 75 ? '#facc15' : '#f87171';
    celdaPorc.innerHTML = `<span style="font-weight: 700; font-size: 0.88rem; color: ${colorPorc};">${porcentaje}%</span>`;
  }

  if (celdaEstado) {
    celdaEstado.innerHTML = calcularEstadoAsistenciaBadge(faltas);
  }

  // Guardar en caliente en memoria para evitar pérdida si cambia foco o pestaña
  const alum = DB_ESCOLAR.alumnos.find(a => a.dni === String(dni));
  if (alum) {
    if (!alum.asistenciasPeriodos) alum.asistenciasPeriodos = {};
    const periodoActual = asistenciaPeriodoSeleccionado || (alum.jurisdiccion === 'pba' ? '1° Cuatrimestre' : '1° Trimestre');
    alum.asistenciasPeriodos[periodoActual] = {
      dias: dias,
      asistencias: pres,
      inasistencias: faltas,
      justificadas: just
    };
  }

  recalcularFooterEstadisticasEnVivo();
}

// Aplicar el valor global de días hábiles a todos los alumnos del curso actual (todas las páginas)
function aplicarDiasHabilesATodos() {
  const inputGlobal = document.getElementById('inputDiasHabilesGlobal');
  if (!inputGlobal) return;
  const valor = parseInt(inputGlobal.value, 10);
  if (isNaN(valor) || valor <= 0) {
    mostrarToast('Por favor ingresá un número válido de días hábiles (mayor a 0).', 'warning');
    return;
  }

  const alumnosCurso = obtenerAlumnosEscuelaActiva().filter(a => a.cursoId === asistenciaCursoSeleccionado);
  if (alumnosCurso.length === 0) {
    mostrarToast('No hay alumnos en el curso para actualizar.', 'warning');
    return;
  }

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const periodoActual = asistenciaPeriodoSeleccionado || (jurisActiva === 'pba' ? '1° Cuatrimestre' : '1° Trimestre');

  alumnosCurso.forEach(alum => {
    if (!alum.asistenciasPeriodos) alum.asistenciasPeriodos = {};
    if (!alum.asistenciasPeriodos[periodoActual]) {
      alum.asistenciasPeriodos[periodoActual] = {
        dias: valor,
        asistencias: valor,
        inasistencias: 0,
        justificadas: 0
      };
    } else {
      alum.asistenciasPeriodos[periodoActual].dias = valor;
      if (alum.asistenciasPeriodos[periodoActual].asistencias > valor) {
        alum.asistenciasPeriodos[periodoActual].asistencias = valor;
      }
    }
  });

  const inputs = document.querySelectorAll('#tbodyAsistenciaAlumnos .input-asist-dias');
  inputs.forEach(inp => {
    inp.value = valor;
    const dni = inp.id.replace('inputDias_', '');
    alCambiarValoresFilaAsist(dni, 'dias');
  });

  mostrarToast(`Se aplicaron ${valor} días hábiles a toda la clase (${alumnosCurso.length} estudiantes).`, 'info');
}

// Guardar y persistir las asistencias de todo el curso en MySQL y LocalStorage
async function guardarAsistenciasCurso() {
  if (!DB_ESCOLAR || !DB_ESCOLAR.alumnos) return;

  const btnGuardar = document.getElementById('btnGuardarAsistenciasCurso');
  const textoOriginal = btnGuardar ? btnGuardar.innerHTML : '';
  if (btnGuardar) {
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando en BD...`;
  }

  const alumnosCurso = obtenerAlumnosEscuelaActiva().filter(a => a.cursoId === asistenciaCursoSeleccionado);
  if (alumnosCurso.length === 0) {
    mostrarToast('No hay alumnos para guardar en este curso.', 'warning');
    if (btnGuardar) {
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = textoOriginal;
    }
    return;
  }

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = jurisActiva === 'pba' ? 2 : 1;
  const periodoActual = asistenciaPeriodoSeleccionado || (jurisActiva === 'pba' ? '1° Cuatrimestre' : '1° Trimestre');

  const datosParaMySQL = [];
  let actualizados = 0;

  alumnosCurso.forEach(alum => {
    const inputDias = document.getElementById(`inputDias_${alum.dni}`);
    const inputPres = document.getElementById(`inputPres_${alum.dni}`);
    const inputFaltas = document.getElementById(`inputFaltas_${alum.dni}`);
    const inputJust = document.getElementById(`inputJust_${alum.dni}`);

    let dias, pres, faltas, just;

    if (inputDias && inputPres && inputFaltas && inputJust) {
      dias = parseInt(inputDias.value, 10) || (jurisActiva === 'pba' ? 82 : 96);
      pres = parseInt(inputPres.value, 10) || 0;
      faltas = parseInt(inputFaltas.value, 10) || 0;
      just = parseInt(inputJust.value, 10) || 0;
      if (just > faltas) just = faltas;
    } else {
      const datosMem = obtenerDatosAsistenciaAlumno(alum, periodoActual);
      dias = datosMem.dias || (jurisActiva === 'pba' ? 82 : 96);
      pres = datosMem.asistencias || 0;
      faltas = datosMem.inasistencias || 0;
      just = datosMem.justificadas || 0;
    }

      if (!alum.asistenciasPeriodos) alum.asistenciasPeriodos = {};
      alum.asistenciasPeriodos[periodoActual] = {
        dias: dias,
        asistencias: pres,
        inasistencias: faltas,
        justificadas: just
      };

      // Recalcular resumen acumulado del alumno
      const resumenTotal = obtenerDatosAsistenciaAlumno(alum, null);
      alum.diasHabiles = resumenTotal.dias;
      alum.totalAsistencias = resumenTotal.asistencias;
      alum.totalInasistencias = resumenTotal.inasistencias;
      alum.justificadas = resumenTotal.justificadas;

      if (resumenTotal.justificadas > 0) {
        alum.asistencia = `Días Hábiles: ${resumenTotal.dias} • Total Asistencias: ${resumenTotal.asistencias} • Inasistencias: ${resumenTotal.inasistencias} (Justificadas: ${resumenTotal.justificadas})`;
      } else {
        alum.asistencia = `Días Hábiles: ${resumenTotal.dias} • Total Asistencias: ${resumenTotal.asistencias} • Inasistencias: ${resumenTotal.inasistencias}`;
      }

      // Sincronizar inmediatamente si este alumno está visible en el boletín
      if (alumnoActivoDni === alum.dni && datosMemoria) {
        datosMemoria.asistencia = alum.asistencia;
        sincronizarInasistenciasBoletin(alum);
      }

      datosParaMySQL.push({
        dni_estudiante: String(alum.dni),
        periodo: periodoActual,
        dias_habiles: dias,
        asistencias: pres,
        inasistencias: faltas,
        justificadas: just,
        id_institucion: idInst
      });

      actualizados++;
  });

  // Guardar en MySQL
  try {
    const respuesta = await fetch('api/asistencia.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosParaMySQL)
    });
    const resJSON = await respuesta.json();

    if (respuesta.ok) {
      // Persistir en LocalStorage
      guardarBaseDatosEscolar();
      if (btnGuardar) {
        btnGuardar.style.backgroundColor = '#16a34a';
        btnGuardar.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Guardado en BD!`;
        setTimeout(() => {
          btnGuardar.style.backgroundColor = '';
          btnGuardar.disabled = false;
          btnGuardar.innerHTML = textoOriginal;
        }, 2500);
      }
      mostrarToast(`¡Asistencias de ${periodoActual} guardadas en la base de datos! (${actualizados} alumno/s)`, 'success');
      recalcularFooterEstadisticasEnVivo();
      if (typeof renderizarBoletinPreview === 'function') renderizarBoletinPreview();
      if (typeof renderizarPortal === 'function' && datosMemoria) renderizarPortal(datosMemoria);
    } else {
      throw new Error(resJSON.error || "Error al guardar en el servidor");
    }
  } catch (error) {
    console.error("Error al guardar asistencias en MySQL:", error);
    guardarBaseDatosEscolar();
    if (btnGuardar) {
      btnGuardar.style.backgroundColor = '#dc2626';
      btnGuardar.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error al conectar`;
      setTimeout(() => {
        btnGuardar.style.backgroundColor = '';
        btnGuardar.disabled = false;
        btnGuardar.innerHTML = textoOriginal;
      }, 3000);
    }
    mostrarToast('No se pudo guardar en la base de datos, intentalo de nuevo.', 'error');
  }
}

// Actualizar tarjetas de estadísticas del pie de la tabla de asistencias
function actualizarFooterEstadisticasAsistencia(alumnos) {
  const footer = document.getElementById('resumenAsistenciaFooter');
  if (!footer) return;

  if (!alumnos || alumnos.length === 0) {
    footer.innerHTML = '';
    return;
  }

  let totalAlumnos = alumnos.length;
  let sumaPorcentajes = 0;
  let regulares = 0;
  let enAlerta = 0;
  let excedidos = 0;

  alumnos.forEach(alum => {
    const d = obtenerDatosAsistenciaAlumno(alum);
    sumaPorcentajes += d.porcentaje;
    if (d.inasistencias <= 15) {
      regulares++;
    } else if (d.inasistencias <= 20) {
      enAlerta++;
    } else {
      excedidos++;
    }
  });

  const promedioAsistencia = Math.round(sumaPorcentajes / totalAlumnos);

  footer.innerHTML = `
    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-blue">
        <i class="fa-solid fa-users"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Matrícula del Curso</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #fff;">${totalAlumnos} Estudiantes</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-green">
        <i class="fa-solid fa-chart-line"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Promedio Asistencia</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #4ade80;">${promedioAsistencia}%</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-amber">
        <i class="fa-solid fa-triangle-exclamation"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Alerta de Faltas</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: ${enAlerta > 0 ? '#facc15' : '#fff'};">${enAlerta} (> 15 faltas)</div>
      </div>
    </div>

    <div class="card-stat-asistencia">
      <div class="stat-icon-asist badge badge-red">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>
      <div>
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Límite Excedido</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: ${excedidos > 0 ? '#f87171' : '#fff'};">${excedidos} (> 20 faltas)</div>
      </div>
    </div>
  `;
}

// Recalcular en tiempo real el footer cuando el usuario edita inputs en la tabla
// Recalcular en tiempo real el footer cuando el usuario edita inputs en la tabla
function recalcularFooterEstadisticasEnVivo() {
  const alumnosCurso = obtenerAlumnosEscuelaActiva().filter(a => a.cursoId === asistenciaCursoSeleccionado);
  if (alumnosCurso.length === 0) return;
  actualizarFooterEstadisticasAsistencia(alumnosCurso);
}



// 18. GESTIÓN INTEGRAL DE MESAS DE EXAMEN (PRECEPTOR Y ALUMNOS/TUTORES)

// Sincronizar mesas de examen y alumnos inscriptos desde MySQL
async function sincronizarMesasDesdeMySQL() {
  try {
    const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
      ? DB_ESCOLAR.configuracion.jurisdiccion
      : "formosa";
    const idInst = jurisActiva === 'pba' ? 2 : 1;
    const instActiva = idInst === 2 ? 'inst-pba' : 'inst-formosa';

    const resp = await fetch(`api/mesas.php?id_institucion=${idInst}`);
    if (!resp.ok) return;
    const mesasBD = await resp.json();
    if (!Array.isArray(mesasBD)) return;

    if (!DB_ESCOLAR.mesasExamen) DB_ESCOLAR.mesasExamen = [];

    // Conservar mesas de la otra institución para no pisarlas
    const otrasMesas = DB_ESCOLAR.mesasExamen.filter(m => {
      if (m.institucionId) return m.institucionId !== instActiva;
      if (m.id_institucion) return parseInt(m.id_institucion, 10) !== idInst;
      return false;
    });

    const mesasMapeadas = mesasBD.map(m => {
      let ciclo = m.ciclo || 'basico';
      const cursoStr = m.curso || '';
      if (cursoStr.toLowerCase().includes('orientado') || /^[456]/.test(cursoStr)) {
        ciclo = 'orientado';
      } else if (cursoStr.toLowerCase().includes('general') || cursoStr.toLowerCase().includes('ambos')) {
        ciclo = 'general';
      }

      return {
        id: m.id || m.codigo_mesa || `mesa-${m.id_db}`,
        id_db: m.id_db || m.id,
        codigo_mesa: m.codigo_mesa || m.id,
        materia: m.materia,
        curso: m.curso || (idInst === 2 ? '4° Única' : '2° III'),
        ciclo: ciclo,
        mes: m.mes || 'Diciembre',
        turno: m.turno || `Turno ${m.mes || 'Diciembre'} 2026`,
        docentes: m.docentes || 'A designar',
        fecha: m.fecha || '',
        hora: m.hora || '08:00',
        estado: m.estado || 'abierta',
        institucionId: instActiva,
        id_institucion: idInst,
        inscriptos: (m.inscriptos || []).map(i => ({
          dni: String(i.dni),
          nombre: i.nombre,
          curso: i.curso || (idInst === 2 ? '4° Única' : '2° III'),
          condicion: i.condicion || 'Regular',
          fechaInscripcion: i.fechaInscripcion || i.fecha_inscripcion || ''
        }))
      };
    });

    DB_ESCOLAR.mesasExamen = [...otrasMesas, ...mesasMapeadas];
    guardarBaseDatosEscolar();
  } catch (err) {
    console.warn("Aviso al sincronizar mesas desde MySQL:", err);
  }
}

// 1. Preceptor: Renderizar tabla y estadísticas de mesas de examen 
function renderizarMesasPreceptor() {
  const tbody = document.getElementById('tbodyMesasExamenPreceptor');
  const gridStats = document.getElementById('gridStatsMesasPreceptor');
  if (!tbody || !DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const mesas = (DB_ESCOLAR.mesasExamen || []).filter(m => !m.institucionId || m.institucionId === instActiva);

  // Estadísticas generales y desglose de condición (Regular vs Libre)
  const totalMesas = mesas.length;
  let totalInscriptos = 0;
  let totalRegulares = 0;
  let totalLibres = 0;
  const mesasAbiertas = mesas.filter(m => m.estado === 'abierta').length;

  mesas.forEach(m => {
    (m.inscriptos || []).forEach(i => {
      totalInscriptos++;
      if (i.condicion === 'Libre') totalLibres++;
      else totalRegulares++;
    });
  });

  if (gridStats) {
    gridStats.innerHTML = `
      <div class="card" style="padding: 0.85rem 1rem; border-left: 3px solid #38bdf8; background: #111827;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">
          <i class="fa-solid fa-graduation-cap text-blue"></i> Total Mesas Oficiales
        </div>
        <div style="font-size: 1.4rem; font-weight: 800; color: #fff; margin-top: 0.35rem;">
          ${totalMesas}
        </div>
        <div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">
          ${mesasAbiertas} habilitadas para inscripción
        </div>
      </div>

      <div class="card" style="padding: 0.85rem 1rem; border-left: 3px solid #4ade80; background: #111827;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">
          <i class="fa-solid fa-user-check text-white"></i> Alumnos Inscriptos
        </div>
        <div style="font-size: 1.4rem; font-weight: 800; color: #4ade80; margin-top: 0.35rem;">
          ${totalInscriptos}
        </div>
        <div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">
          En el padrón general de exámenes
        </div>
      </div>

      <div class="card" style="padding: 0.85rem 1rem; border-left: 3px solid #fbbf24; background: #111827;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">
          <i class="fa-solid fa-user-tag text-amber"></i> Condición Registrada
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #fbbf24; margin-top: 0.35rem;">
          ${totalRegulares} <span style="font-size: 0.8rem; font-weight: 600; color: #86efac;">Reg.</span> • ${totalLibres} <span style="font-size: 0.8rem; font-weight: 600; color: #fde047;">Libres</span>
        </div>
        <div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">
          Distribución por condición de examen
        </div>
      </div>

      <div class="card" style="padding: 0.85rem 1rem; border-left: 3px solid #a855f7; background: #111827;">
        <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; letter-spacing: 0.04em;">
          <i class="fa-solid fa-calendar-days" style="color: #a855f7;"></i> Mes de Examen Principal
        </div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #e9d5ff; margin-top: 0.35rem; line-height: 1.2;">
          Mesa de Diciembre 2026
        </div>
        <div class="text-muted" style="font-size: 0.72rem; margin-top: 2px;">
          Turno complementario Febrero / Marzo
        </div>
      </div>
    `;
  }

  if (mesas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-folder-open text-dim" style="font-size: 1.75rem; margin-bottom: 0.5rem; display: block;"></i>
          No hay mesas de examen configuradas aún.<br>
          <button type="button" class="btn-success" onclick="abrirModalCrearMesa()" style="margin-top: 0.75rem; font-size: 0.8rem;">
            <i class="fa-solid fa-calendar-check"></i> Crear la primera Mesa de Examen
          </button>
        </td>
      </tr>
    `;
    return;
  }

  let html = '';
  mesas.forEach((mesa, idx) => {
    const inscriptos = mesa.inscriptos || [];
    const cant = inscriptos.length;
    const cantReg = inscriptos.filter(i => (i.condicion || 'Regular') === 'Regular').length;
    const cantLib = inscriptos.filter(i => i.condicion === 'Libre').length;

    // Formatear fecha DD/MM/AAAA
    let fechaFmt = mesa.fecha;
    if (mesa.fecha && mesa.fecha.includes('-')) {
      const p = mesa.fecha.split('-');
      if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
    }

    // Badge de Ciclo
    let badgeCiclo = '';
    if (mesa.ciclo === 'basico') {
      badgeCiclo = '<span class="badge badge-blue" style="font-size: 0.68rem; margin-top: 3px;"><i class="fa-solid fa-shapes"></i> Básico (1°-3°)</span>';
    } else if (mesa.ciclo === 'orientado') {
      badgeCiclo = '<span class="badge badge-purple" style="font-size: 0.68rem; margin-top: 3px;"><i class="fa-solid fa-compass"></i> Orientado (4°-6°)</span>';
    } else {
      badgeCiclo = '<span class="badge badge-gray" style="font-size: 0.68rem; margin-top: 3px;"><i class="fa-solid fa-layer-group"></i> General</span>';
    }

    // Badge de Mes
    const mesNombre = mesa.mes || 'Diciembre';
    const badgeMes = `<span class="badge badge-amber" style="font-weight: 700; font-size: 0.74rem;"><i class="fa-solid fa-calendar"></i> Mesa de ${mesNombre}</span>`;

    // Badge de Estado
    const badgeEstado = mesa.estado === 'abierta'
      ? '<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Abierta</span>'
      : '<span class="badge badge-gray"><i class="fa-solid fa-ban"></i> Cerrada</span>';

    html += `
      <tr>
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">${mesa.materia}</div>
          <div style="margin-top: 3px; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
            <span class="badge badge-purple" style="font-size: 0.7rem; font-weight: 700;">
              <i class="fa-solid fa-graduation-cap"></i> ${mesa.curso || 'Ciclo Básico'}
            </span>
          </div>
        </td>
        <td style="text-align: center;">
          ${badgeMes}
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${mesa.turno || 'Turno Regular'}</div>
        </td>
        <td>
          <div class="text-secondary" style="font-size: 0.85rem;"><i class="fa-solid fa-chalkboard-user" style="color: #38bdf8; margin-right: 4px;"></i> ${mesa.docentes || 'A designar'}</div>
        </td>
        <td style="text-align: center;">
          <div class="text-white" style="font-weight: 700; font-size: 0.85rem;"><i class="fa-solid fa-calendar-day" style="color: #38bdf8; margin-right: 4px;"></i> ${fechaFmt}</div>
          <div class="text-blue" style="font-size: 0.78rem; font-weight: 600;"><i class="fa-solid fa-clock" style="margin-right: 2px;"></i> ${mesa.hora} hs</div>
        </td>
        <td style="text-align: center;">
          <span class="badge badge-blue" style="font-weight: 700; font-size: 0.76rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="verInscriptosMesa('${mesa.id}')" title="Hacé clic para ver los alumnos inscriptos">
            <i class="fa-solid fa-users"></i> ${cant} Inscriptos
          </span>
          <div class="text-muted" style="font-size: 0.7rem; margin-top: 3px;">
            <span class="text-green" style="font-weight: 600;">${cantReg} Reg.</span> • <span class="text-amber" style="font-weight: 600;">${cantLib} Libres</span>
          </div>
        </td>
        <td style="text-align: center;">
          ${badgeEstado}
        </td>
        <td style="text-align: center; white-space: nowrap;">
          <div style="display: flex; gap: 0.45rem; justify-content: center; align-items: center;">
            <button type="button" class="btn-action-icon btn-action-edit" onclick="editarMesaModal('${mesa.id}')" title="Editar mesa de examen">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-action-icon btn-action-delete" onclick="eliminarMesaExamen('${mesa.id}')" title="Eliminar mesa">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

// Abrir modal de creación de mesa de examen
function abrirModalCrearMesa() {
  const modal = document.getElementById('modalMesaExamen');
  const titulo = document.getElementById('tituloModalMesa');
  const inputId = document.getElementById('inputMesaId');
  const inputMat = document.getElementById('inputMesaMateria');
  const inputCur = document.getElementById('inputMesaCurso');
  const selMes = document.getElementById('selectMesaMes');
  const selTur = document.getElementById('selectMesaTurno');
  const inputDoc = document.getElementById('inputMesaDocentes');
  const inputFec = document.getElementById('inputMesaFecha');
  const inputHor = document.getElementById('inputMesaHora');
  const selEst = document.getElementById('selectMesaEstado');

  const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";

  if (titulo) titulo.innerHTML = '<i class="fa-solid fa-graduation-cap text-blue"></i> Cargar Nueva Mesa de Examen';
  if (inputId) inputId.value = '';
  if (inputMat) inputMat.value = '';
  if (inputCur) inputCur.value = (jurisActiva === 'pba' ? '4° Única' : '2° III');
  if (selMes) selMes.value = 'Diciembre';
  if (selTur) selTur.value = 'Turno Diciembre 2026';
  if (inputDoc) inputDoc.value = '';
  if (inputFec) inputFec.value = '2026-12-15';
  if (inputHor) inputHor.value = '08:00';
  if (selEst) selEst.value = 'abierta';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalMesaExamen() {
  const modal = document.getElementById('modalMesaExamen');
  if (modal) modal.style.display = 'none';
}

// Abrir modal para editar mesa existente
function editarMesaModal(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  const modal = document.getElementById('modalMesaExamen');
  const titulo = document.getElementById('tituloModalMesa');
  const inputId = document.getElementById('inputMesaId');
  const inputMat = document.getElementById('inputMesaMateria');
  const inputCur = document.getElementById('inputMesaCurso');
  const selMes = document.getElementById('selectMesaMes');
  const selTur = document.getElementById('selectMesaTurno');
  const inputDoc = document.getElementById('inputMesaDocentes');
  const inputFec = document.getElementById('inputMesaFecha');
  const inputHor = document.getElementById('inputMesaHora');
  const selEst = document.getElementById('selectMesaEstado');

  if (titulo) titulo.innerHTML = `<i class="fa-solid fa-pen-to-square text-blue"></i> Editar Mesa de Examen: ${mesa.materia}`;
  if (inputId) inputId.value = mesa.id;
  if (inputMat) inputMat.value = mesa.materia || '';
  if (inputCur) inputCur.value = mesa.curso || (mesa.ciclo === 'orientado' ? 'Ciclo Orientado' : 'Ciclo Básico');
  if (selMes) selMes.value = mesa.mes || 'Diciembre';
  if (selTur) selTur.value = mesa.turno || 'Turno Diciembre 2026';
  if (inputDoc) inputDoc.value = mesa.docentes || '';
  if (inputFec) inputFec.value = mesa.fecha || '';
  if (inputHor) inputHor.value = mesa.hora || '08:00';
  if (selEst) selEst.value = mesa.estado || 'abierta';

  if (modal) modal.style.display = 'flex';
}

// Guardar formulario de mesa de examen
async function guardarMesaExamenForm(e) {
  if (e && e.preventDefault) e.preventDefault();
  if (!DB_ESCOLAR) return;
  if (!DB_ESCOLAR.mesasExamen) DB_ESCOLAR.mesasExamen = [];

  const inputId = document.getElementById('inputMesaId');
  const inputMat = document.getElementById('inputMesaMateria');
  const inputCur = document.getElementById('inputMesaCurso');
  const selMes = document.getElementById('selectMesaMes');
  const selTur = document.getElementById('selectMesaTurno');
  const inputDoc = document.getElementById('inputMesaDocentes');
  const inputFec = document.getElementById('inputMesaFecha');
  const inputHor = document.getElementById('inputMesaHora');
  const selEst = document.getElementById('selectMesaEstado');

  const id = inputId && inputId.value ? inputId.value : `mesa-${Date.now()}`;
  const materia = (inputMat ? inputMat.value : '').trim();
  const curso = (inputCur ? inputCur.value : '').trim() || 'Ciclo Básico';
  const mes = selMes ? selMes.value : 'Diciembre';
  const turno = selTur ? selTur.value : `Turno ${mes} 2026`;
  const docentes = (inputDoc ? inputDoc.value : '').trim() || 'A designar';
  const fecha = inputFec ? inputFec.value : '';
  const hora = inputHor ? inputHor.value : '08:00';
  const estado = selEst ? selEst.value : 'abierta';

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = (jurisActiva === 'pba') ? 2 : 1;
  const instActiva = (idInst === 2) ? 'inst-pba' : 'inst-formosa';

  // Derivar ciclo para compatibilidad
  let ciclo = 'basico';
  if (curso.toLowerCase().includes('orientado') || /^[456]/.test(curso)) {
    ciclo = 'orientado';
  } else if (curso.toLowerCase().includes('general') || curso.toLowerCase().includes('ambos')) {
    ciclo = 'general';
  }

  const indice = DB_ESCOLAR.mesasExamen.findIndex(m => m.id === id);
  let idDb = 0;
  if (indice !== -1) {
    idDb = DB_ESCOLAR.mesasExamen[indice].id_db || 0;
    const inscriptosPrevios = DB_ESCOLAR.mesasExamen[indice].inscriptos || [];
    DB_ESCOLAR.mesasExamen[indice] = {
      id,
      id_db: idDb,
      codigo_mesa: DB_ESCOLAR.mesasExamen[indice].codigo_mesa || id,
      materia,
      curso,
      ciclo,
      mes,
      turno,
      docentes,
      fecha,
      hora,
      estado,
      institucionId: DB_ESCOLAR.mesasExamen[indice].institucionId || instActiva,
      id_institucion: idInst,
      inscriptos: inscriptosPrevios
    };
    mostrarToast(`Mesa de ${materia} (${curso}) actualizada.`);
  } else {
    DB_ESCOLAR.mesasExamen.push({
      id,
      codigo_mesa: id,
      materia,
      curso,
      ciclo,
      mes,
      turno,
      docentes,
      fecha,
      hora,
      estado,
      institucionId: instActiva,
      id_institucion: idInst,
      inscriptos: []
    });
    mostrarToast(`¡Mesa de ${materia} (${curso}) creada con éxito!`);
  }

  guardarBaseDatosEscolar();
  cerrarModalMesaExamen();
  renderizarMesasPreceptor();
  if (pestanaTutorActiva === 'mesas') renderizarMesasTutor();

  // Guardar en MySQL
  try {
    const resp = await fetch('api/mesas.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_mesa',
        id: id,
        id_db: idDb,
        materia: materia,
        curso: curso,
        mes: mes,
        turno: turno,
        docentes: docentes,
        fecha: fecha,
        hora: hora,
        estado: estado,
        id_institucion: idInst
      })
    });
    const resJSON = await resp.json();
    if (resp.ok && resJSON.id_db) {
      const mesaAct = DB_ESCOLAR.mesasExamen.find(m => m.id === id);
      if (mesaAct) mesaAct.id_db = resJSON.id_db;
      guardarBaseDatosEscolar();
    }
  } catch (errMySQL) {
    console.warn("Aviso al guardar mesa en MySQL:", errMySQL);
  }
}

// Eliminar mesa de examen con confirmación elegante
function eliminarMesaExamen(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  const cantInsc = (mesa.inscriptos || []).length;
  const alertaTexto = cantInsc > 0
    ? `¡Atención! Hay ${cantInsc} alumno(s) inscripto(s) en esta mesa que perderán su registro de examen.`
    : 'Esta mesa de examen oficial será eliminada del calendario escolar.';

  mostrarModalConfirmacion({
    titulo: '¿Eliminar Mesa de Examen?',
    mensaje: `¿Deseás eliminar la mesa oficial de ${mesa.materia}?`,
    detalles: [
      { label: 'Materia', valor: mesa.materia, colorClase: 'text-white' },
      { label: 'Curso', valor: mesa.curso || 'Ciclo Básico', colorClase: 'text-blue' },
      { label: 'Mes de Examen', valor: mesa.mes || 'Diciembre', badge: 'badge-amber' },
      { label: 'Tribunal Docente', valor: mesa.docentes || 'A designar', colorClase: 'text-secondary' },
      { label: 'Día y Hora', valor: `${mesa.fecha || 'Sin fecha'} • ${mesa.hora || '08:00'} hs`, colorClase: 'text-muted' },
      { label: 'Inscriptos', valor: `${cantInsc} alumno(s)`, badge: cantInsc > 0 ? 'badge-red' : 'badge-green' }
    ],
    alerta: alertaTexto,
    textoBoton: 'Sí, Eliminar Mesa',
    icono: 'fa-solid fa-graduation-cap',
    onConfirm: async () => {
      const idDb = mesa.id_db || 0;
      DB_ESCOLAR.mesasExamen = DB_ESCOLAR.mesasExamen.filter(m => m.id !== mesaId);
      guardarBaseDatosEscolar();
      mostrarToast(`Mesa de ${mesa.materia} eliminada.`, 'info');
      renderizarMesasPreceptor();
      if (pestanaTutorActiva === 'mesas') renderizarMesasTutor();

      // Eliminar de MySQL
      try {
        await fetch('api/mesas.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_mesa',
            id: mesaId,
            id_db: idDb
          })
        });
      } catch (errDel) {
        console.warn("Aviso al eliminar mesa de MySQL:", errDel);
      }
    }
  });
}

// Ver inscriptos de una mesa (Modal Preceptor)
let mesaActivaVerInscriptosId = null;

function verInscriptosMesa(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  mesaActivaVerInscriptosId = mesaId;
  const modal = document.getElementById('modalVerInscriptosMesa');
  const sub = document.getElementById('subtituloInscriptosMesa');
  const badgeTotal = document.getElementById('badgeTotalInscriptosMesa');
  const tbody = document.getElementById('tbodyInscriptosMesa');

  const inscriptos = mesa.inscriptos || [];
  const cantReg = inscriptos.filter(i => (i.condicion || 'Regular') === 'Regular').length;
  const cantLib = inscriptos.filter(i => i.condicion === 'Libre').length;

  let fechaFmt = mesa.fecha;
  if (mesa.fecha && mesa.fecha.includes('-')) {
    const p = mesa.fecha.split('-');
    if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
  }

  if (sub) {
    sub.innerHTML = `<strong>${mesa.materia}</strong> • Mesa de ${mesa.mes || 'Diciembre'} • ${fechaFmt} a las ${mesa.hora} hs • Tribunal: ${mesa.docentes || 'A designar'}`;
  }

  if (badgeTotal) {
    badgeTotal.textContent = `${inscriptos.length} Inscriptos (${cantReg} Regulares • ${cantLib} Libres)`;
    badgeTotal.className = 'badge badge-blue';
  }

  if (tbody) {
    if (inscriptos.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            <i class="fa-solid fa-user-xmark" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: #475569;"></i>
            No hay alumnos inscriptos aún a esta mesa de examen.
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = inscriptos.map((alum, idx) => {
        const cond = alum.condicion || 'Regular';
        const badgeCond = cond === 'Libre'
          ? `<span class="badge badge-amber" style="font-size: 0.72rem;"><i class="fa-solid fa-book-open"></i> Libre</span>`
          : `<span class="badge badge-green" style="font-size: 0.72rem;"><i class="fa-solid fa-user-check"></i> Regular</span>`;

        return `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
            <td class="text-blue" style="font-weight: 700; font-family: monospace;">${alum.dni}</td>
            <td class="text-white" style="font-weight: 600;">${alum.nombre}</td>
            <td><span class="badge badge-purple" style="font-size: 0.72rem;">${alum.curso || '-'}</span></td>
            <td style="text-align: center;">${badgeCond}</td>
            <td style="text-align: center; font-size: 0.78rem; color: #cbd5e1;">${alum.fechaInscripcion || '-'}</td>
            <td style="text-align: center;">
              <button type="button" class="btn-action-icon btn-action-delete" style="padding: 0.25rem 0.6rem; font-size: 0.75rem; width: auto; height: auto;" onclick="darDeBajaAlumnoDesdePreceptor('${mesa.id}', '${alum.dni}')" title="Dar de baja de la mesa">
                <i class="fa-solid fa-user-minus"></i> Baja
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (modal) modal.style.display = 'flex';
}

function cerrarModalVerInscriptos() {
  const modal = document.getElementById('modalVerInscriptosMesa');
  if (modal) modal.style.display = 'none';
  mesaActivaVerInscriptosId = null;
}

// Dar de baja alumno desde el preceptor con confirmación elegante
function darDeBajaAlumnoDesdePreceptor(mesaId, dni) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  const alumno = (mesa.inscriptos || []).find(a => a.dni === dni);
  const nombre = alumno ? alumno.nombre : `DNI ${dni}`;
  const condicion = alumno ? (alumno.condicion || 'Regular') : 'Regular';

  mostrarModalConfirmacion({
    titulo: '¿Dar de Baja Inscripción?',
    mensaje: `¿Deseás remover a ${nombre} de la mesa de examen?`,
    detalles: [
      { label: 'Estudiante', valor: nombre, colorClase: 'text-white' },
      { label: 'DNI Alumno', valor: dni, colorClase: 'text-blue' },
      { label: 'Materia', valor: mesa.materia, colorClase: 'text-white' },
      { label: 'Condición', valor: condicion.toUpperCase(), badge: condicion === 'Libre' ? 'badge-amber' : 'badge-green' },
      { label: 'Turno Examen', valor: mesa.mes || 'Diciembre', badge: 'badge-blue' }
    ],
    alerta: 'El alumno dejará de figurar en el acta oficial de examen y se liberará su lugar.',
    textoBoton: 'Sí, Dar de Baja',
    icono: 'fa-solid fa-user-minus',
    onConfirm: async () => {
      mesa.inscriptos = (mesa.inscriptos || []).filter(a => a.dni !== dni);
      guardarBaseDatosEscolar();
      mostrarToast(`Se dio de baja la inscripción de ${nombre}.`, 'info');
      verInscriptosMesa(mesaId);
      renderizarMesasPreceptor();
      if (pestanaTutorActiva === 'mesas') renderizarMesasTutor();

      // Dar de baja en MySQL
      try {
        await fetch('api/mesas.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'baja_inscripcion',
            mesa_id: mesaId,
            dni: dni
          })
        });
      } catch (errBaja) {
        console.warn("Aviso al dar de baja en MySQL:", errBaja);
      }
    }
  });
}

// Imprimir Acta Oficial de Examen
function imprimirActaMesa() {
  document.body.classList.add('imprimiendo-acta-mesa');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('imprimiendo-acta-mesa');
  }, 1000);
}

// 2. MODAL Y SELECCIÓN DE CONDICIÓN AL INSCRIBIRSE (REGULAR / LIBRE)
function abrirModalInscripcionAlumno(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  if (mesa.estado === 'cerrada') {
    alert("Esta mesa de examen se encuentra cerrada para nuevas inscripciones.");
    return;
  }

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const alumnoActual = obtenerAlumnoActivo() ||
    (datosMemoria && datosMemoria.estudiante ? {
      dni: datosMemoria.estudiante.dni || (jurisActiva === 'pba' ? '48763736' : '34567890'),
      nombre: datosMemoria.estudiante.nombre || (jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO'),
      curso: datosMemoria.estudiante.curso || (jurisActiva === 'pba' ? '4° Única' : '2° III')
    } : {
      dni: jurisActiva === 'pba' ? '48763736' : '34567890',
      nombre: jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO',
      curso: jurisActiva === 'pba' ? '4° Única' : '2° III'
    });

  const modal = document.getElementById('modalInscripcionMesaAlumno');
  const inputId = document.getElementById('inputInscripcionMesaId');
  const infoBox = document.getElementById('infoMesaInscripcionAlumno');

  if (inputId) inputId.value = mesa.id;

  let fechaFmt = mesa.fecha;
  if (mesa.fecha && mesa.fecha.includes('-')) {
    const p = mesa.fecha.split('-');
    if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
  }

  if (infoBox) {
    infoBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #334155; padding-bottom: 0.45rem; margin-bottom: 0.45rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <div style="font-size: 1.05rem; font-weight: 800; color: #fff;">${mesa.materia}</div>
          <div style="font-size: 0.76rem; color: #fbbf24; margin-top: 2px; font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-calendar-days"></i> Mesa de ${mesa.mes || 'Diciembre'} — ${mesa.turno || 'Turno Regular'}
          </div>
        </div>
        <span class="badge badge-purple" style="font-size: 0.72rem; padding: 0.25rem 0.6rem;">${mesa.ciclo === 'basico' ? 'Ciclo Básico' : mesa.ciclo === 'orientado' ? 'Ciclo Orientado' : 'General'}</span>
      </div>
      <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem; font-size: 0.78rem; color: #cbd5e1;">
        <div><i class="fa-solid fa-calendar-day text-white"></i> <strong>Fecha:</strong> ${fechaFmt}</div>
        <div><i class="fa-solid fa-clock text-white"></i> <strong>Horario:</strong> ${mesa.hora} hs</div>
        <div><i class="fa-solid fa-chalkboard-user text-blue"></i> <strong>Tribunal:</strong> ${mesa.docentes || 'A designar'}</div>
      </div>
      <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 0.45rem; border-top: 1px dashed #1e293b; padding-top: 0.35rem;">
        <i class="fa-solid fa-user-graduate text-blue"></i> <strong>Estudiante:</strong> <span style="color: #fff; font-weight: 700;">${alumnoActual.nombre}</span> (DNI ${alumnoActual.dni} • ${alumnoActual.curso || '2° III'})
      </div>
    `;
  }

  // Marcar Regular por defecto
  const radios = document.getElementsByName('radioCondicionRendir');
  radios.forEach(r => {
    if (r.value === 'Regular') r.checked = true;
  });
  alCambiarRadioCondicion();

  if (modal) modal.style.display = 'flex';
}

function cerrarModalInscripcionAlumno() {
  const modal = document.getElementById('modalInscripcionMesaAlumno');
  if (modal) modal.style.display = 'none';
}

function alCambiarRadioCondicion() {
  const radios = document.getElementsByName('radioCondicionRendir');
  let cond = 'Regular';
  radios.forEach(r => {
    if (r.checked) cond = r.value;
  });

  const lblReg = document.getElementById('labelCondicionRegular');
  const lblLib = document.getElementById('labelCondicionLibre');

  if (lblReg && lblLib) {
    if (cond === 'Regular') {
      lblReg.style.borderColor = '#22c55e';
      lblReg.style.background = 'rgba(34, 197, 94, 0.08)';
      lblLib.style.borderColor = '#334155';
      lblLib.style.background = '#111827';
    } else {
      lblLib.style.borderColor = '#f59e0b';
      lblLib.style.background = 'rgba(245, 158, 11, 0.08)';
      lblReg.style.borderColor = '#334155';
      lblReg.style.background = '#111827';
    }
  }
}

function confirmarInscripcionAlumno() {
  const inputId = document.getElementById('inputInscripcionMesaId');
  if (!inputId || !inputId.value) return;

  const mesaId = inputId.value;
  const radios = document.getElementsByName('radioCondicionRendir');
  let condicion = 'Regular';
  radios.forEach(r => {
    if (r.checked) condicion = r.value;
  });

  cerrarModalInscripcionAlumno();
  inscribirAlumnoAMesa(mesaId, condicion);
}

// Inscribir alumno activo a una mesa de examen con su condición 
async function inscribirAlumnoAMesa(mesaId, condicion = 'Regular') {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  if (mesa.estado === 'cerrada') {
    alert("Esta mesa de examen se encuentra cerrada para nuevas inscripciones.");
    return;
  }

  // Obtener alumno activo
  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = (jurisActiva === 'pba') ? 2 : 1;
  const alumnoActual = obtenerAlumnoActivo() ||
    (datosMemoria && datosMemoria.estudiante ? {
      dni: datosMemoria.estudiante.dni || (jurisActiva === 'pba' ? '48763736' : '34567890'),
      nombre: datosMemoria.estudiante.nombre || (jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO'),
      curso: datosMemoria.estudiante.curso || (jurisActiva === 'pba' ? '4° Única' : '2° III')
    } : {
      dni: jurisActiva === 'pba' ? '48763736' : '34567890',
      nombre: jurisActiva === 'pba' ? 'PLEININGER, URIEL LUCIANO' : 'GÓMEZ, MATEO',
      curso: jurisActiva === 'pba' ? '4° Única' : '2° III'
    });

  if (!alumnoActual) {
    alert("No se pudo identificar al alumno activo.");
    return;
  }

  if (!mesa.inscriptos) mesa.inscriptos = [];

  // Validar si ya está inscripto
  if (mesa.inscriptos.some(i => i.dni === alumnoActual.dni)) {
    mostrarToast("Ya estás inscripto en esta mesa de examen.");
    verComprobanteInscripcion(mesaId);
    return;
  }

  // Registrar inscripción con condición elegida (Regular o Libre)
  const fechaAhora = new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
  mesa.inscriptos.push({
    dni: alumnoActual.dni,
    nombre: alumnoActual.nombre,
    curso: alumnoActual.curso || '2° III',
    condicion: condicion || 'Regular',
    fechaInscripcion: fechaAhora
  });

  guardarBaseDatosEscolar();
  mostrarToast(`¡Inscripción confirmada como Alumno ${condicion} en ${mesa.materia} (${mesa.mes || 'Diciembre'})!`);

  // Refrescar ambas vistas
  renderizarMesasTutor();
  renderizarMesasPreceptor();

  // Abrir comprobante oficial automáticamente
  verComprobanteInscripcion(mesaId);

  // Persistir en MySQL
  try {
    await fetch('api/mesas.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'inscribir',
        mesa_id: mesaId,
        dni: alumnoActual.dni,
        nombre: alumnoActual.nombre,
        curso: alumnoActual.curso || '2° III',
        condicion: condicion || 'Regular',
        fechaInscripcion: fechaAhora,
        id_institucion: idInst
      })
    });
  } catch (errInsc) {
    console.warn("Aviso al guardar inscripción en MySQL:", errInsc);
  }
}

// Cancelar inscripción de un alumno con confirmación elegante
function cancelarInscripcionMesa(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  const alumnoActual = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni) ||
    (DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos[0]) ||
    { dni: alumnoActivoDni, nombre: 'Estudiante' };

  mostrarModalConfirmacion({
    titulo: '¿Cancelar Inscripción a Mesa?',
    mensaje: `¿Deseás anular tu inscripción para rendir el examen de ${mesa.materia}?`,
    detalles: [
      { label: 'Materia', valor: mesa.materia, colorClase: 'text-white' },
      { label: 'Turno Examen', valor: mesa.mes || 'Diciembre', badge: 'badge-blue' },
      { label: 'Fecha y Hora', valor: `${mesa.fecha || 'A confirmar'} • ${mesa.hora || '08:00'} hs`, colorClase: 'text-secondary' }
    ],
    alerta: 'Podrás volver a inscribirte siempre que el período de inscripción continúe abierto.',
    textoBoton: 'Sí, Cancelar Inscripción',
    icono: 'fa-solid fa-calendar-xmark',
    onConfirm: async () => {
      mesa.inscriptos = (mesa.inscriptos || []).filter(i => i.dni !== alumnoActual.dni);
      guardarBaseDatosEscolar();
      mostrarToast(`Inscripción cancelada.`, 'info');
      renderizarMesasTutor();
      renderizarMesasPreceptor();

      // Cancelar en MySQL
      try {
        await fetch('api/mesas.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'cancelar_inscripcion',
            mesa_id: mesaId,
            dni: alumnoActual.dni
          })
        });
      } catch (errDel) {
        console.warn("Aviso al cancelar inscripción en MySQL:", errDel);
      }
    }
  });
}

// Ver Comprobante Oficial de Inscripción (Modal)
function verComprobanteInscripcion(mesaId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.mesasExamen) return;
  const mesa = DB_ESCOLAR.mesasExamen.find(m => m.id === mesaId);
  if (!mesa) return;

  const alumnoActual = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni) ||
    (DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos[0]) ||
    (datosMemoria && datosMemoria.estudiante ? {
      dni: datosMemoria.estudiante.dni || '34567890',
      nombre: datosMemoria.estudiante.nombre || 'GÓMEZ, MATEO',
      curso: datosMemoria.estudiante.curso || '2° III',
      tutor: datosMemoria.estudiante.tutor || 'Gómez Pedro',
      dniTutor: '20123456'
    } : {
      dni: alumnoActivoDni || '34567890',
      nombre: 'GÓMEZ, MATEO',
      curso: '2° III',
      tutor: 'Gómez Pedro',
      dniTutor: '20123456'
    });

  const inscObj = (mesa.inscriptos || []).find(i => i.dni === alumnoActual.dni) || {
    condicion: 'Regular',
    fechaInscripcion: new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })
  };

  const condicion = inscObj.condicion || 'Regular';
  const esLibre = condicion === 'Libre';

  const modal = document.getElementById('modalComprobanteInscripcion');
  const cuerpo = document.getElementById('cuerpoComprobanteInscripcion');
  if (!modal || !cuerpo) return;

  // Datos de institución activa
  const inst = (DB_ESCOLAR.instituciones || []).find(i => i.id === DB_ESCOLAR.institucionActivaId) || {
    nombre: 'EPES N° 54 "GOBERNADOR JUAN JOSÉ SILVA"',
    cue: '3400325-00',
    distrito: 'Formosa Capital',
    jurisdiccion: 'formosa'
  };

  // Formatear fecha
  let fechaFmt = mesa.fecha;
  if (mesa.fecha && mesa.fecha.includes('-')) {
    const p = mesa.fecha.split('-');
    if (p.length === 3) fechaFmt = `${p[2]}/${p[1]}/${p[0]}`;
  }

  // Código de validación único
  const hashVerif = `EXAM-${(mesa.mes || 'DIC').slice(0, 3).toUpperCase()}-${mesa.id.toUpperCase()}-${alumnoActual.dni.slice(-4)}-${Date.now().toString(36).toUpperCase()}`;

  cuerpo.innerHTML = `
    <!-- Membrete y Título Horizontal Oficial -->
    <div style="border-bottom: 2px solid #38bdf8; padding-bottom: 0.6rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
      <div>
        <div style="font-size: 0.68rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.05em;">Ministerio de Educación y Cultura</div>
        <div style="font-size: 0.96rem; font-weight: 800; color: #fff;">${inst.nombre}</div>
        <div style="font-size: 0.7rem; color: #94a3b8;">C.U.E.: ${inst.cue || '3400325-00'} • Distrito: ${inst.distrito || 'Sede Central'}</div>
      </div>
      <div style="text-align: center;">
        <h4 style="margin: 0; font-size: 0.95rem; font-weight: 800; color: #fff; letter-spacing: 0.02em;">
          CONSTANCIA DE INSCRIPCIÓN A MESA DE EXAMEN
        </h4>
        <div style="font-size: 0.75rem; color: #fbbf24; margin-top: 2px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;">
          <i class="fa-solid fa-calendar-days"></i> Mesa de ${(mesa.mes || 'Diciembre').toUpperCase()} • ${mesa.turno || `Turno ${mesa.mes || 'Diciembre'} 2026`}
        </div>
      </div>
      <div style="text-align: right;">
        <span class="badge ${esLibre ? 'badge-amber' : 'badge-green'}" style="font-size: 0.76rem; padding: 0.35rem 0.7rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
          <i class="${esLibre ? 'fa-solid fa-book-open' : 'fa-solid fa-circle-check'}"></i> ALUMNO ${condicion.toUpperCase()}
        </span>
        <div style="font-size: 0.68rem; color: #38bdf8; font-family: monospace; margin-top: 3px;">
          ${hashVerif}
        </div>
      </div>
    </div>

    <!-- Contenido en 2 Columnas Horizontales -->
    <div class="modal-grid-2col">
      
      <!-- Columna Izquierda: Condición Registrada + Datos del Estudiante -->
      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
        
        <!-- Condición Registrada -->
        <div style="background: ${esLibre ? 'rgba(245, 158, 11, 0.1)' : 'rgba(34, 197, 94, 0.1)'}; border: 1.5px solid ${esLibre ? '#f59e0b' : '#22c55e'}; border-radius: 8px; padding: 0.65rem 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">Condición Registrada</span>
            <span class="badge ${esLibre ? 'badge-amber' : 'badge-green'}" style="font-size: 0.68rem; padding: 0.15rem 0.45rem;">
              ${esLibre ? 'Examen Programa Completo' : 'Examen Cursada Regular'}
            </span>
          </div>
          <div style="font-size: 1.05rem; font-weight: 800; color: ${esLibre ? '#fbbf24' : '#4ade80'}; margin-top: 3px; display: flex; align-items: center; gap: 0.4rem;">
            <i class="${esLibre ? 'fa-solid fa-book-open' : 'fa-solid fa-user-check'}"></i> ALUMNO ${condicion.toUpperCase()}
          </div>
          <div style="font-size: 0.72rem; color: #cbd5e1; margin-top: 3px; line-height: 1.35;">
            ${esLibre
      ? 'Rinde con la totalidad de los contenidos curriculares del programa mediante evaluación escrita y oral.'
      : 'Acreditación de regularidad anual según normativa jurisdiccional y plan de estudios institucional.'}
          </div>
        </div>

        <!-- Datos del Estudiante -->
        <div style="background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 0.7rem 0.85rem; flex: 1;">
          <div style="font-size: 0.7rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-user-graduate"></i> Datos del Estudiante
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; font-size: 0.79rem;">
            <div style="grid-column: span 2;">
              <span class="text-muted" style="font-size: 0.72rem;">Apellido y Nombre:</span>
              <div style="color: #fff; font-weight: 700;">${alumnoActual.nombre}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">D.N.I.:</span>
              <div style="color: #38bdf8; font-family: monospace; font-weight: 700;">${alumnoActual.dni}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">Curso y División:</span>
              <div style="color: #fff; font-weight: 600;">${alumnoActual.curso || '2° III'}</div>
            </div>
            <div style="grid-column: span 2;">
              <span class="text-muted" style="font-size: 0.72rem;">Tutor / Responsable:</span>
              <div class="text-secondary">${alumnoActual.tutor || 'Tutor Registrado'}</div>
            </div>
          </div>
        </div>

      </div>

      <!-- Columna Derecha: Detalle de la Mesa + Requisitos Reglamentarios -->
      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
        
        <!-- Detalle de la Mesa -->
        <div style="background: #111827; border: 1px solid #1e293b; border-radius: 8px; padding: 0.7rem 0.85rem;">
          <div style="font-size: 0.7rem; font-weight: 700; color: #fbbf24; text-transform: uppercase; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-book-bookmark"></i> Detalle de la Mesa de Examen
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.45rem; font-size: 0.79rem;">
            <div style="grid-column: span 2;">
              <span class="text-muted" style="font-size: 0.72rem;">Materia / Espacio Curricular:</span>
              <div style="color: #fff; font-size: 0.88rem; font-weight: 700;">${mesa.materia}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">Mes del Examen:</span>
              <div style="color: #fbbf24; font-weight: 700;">Mesa de ${mesa.mes || 'Diciembre'}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">Ciclo:</span>
              <div class="text-secondary">${mesa.ciclo === 'basico' ? 'Ciclo Básico' : mesa.ciclo === 'orientado' ? 'Ciclo Orientado' : 'General'}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">Día del Examen:</span>
              <div style="color: #4ade80; font-weight: 700;">${fechaFmt}</div>
            </div>
            <div>
              <span class="text-muted" style="font-size: 0.72rem;">Horario de Presentación:</span>
              <div style="color: #4ade80; font-weight: 700;">${mesa.hora} hs</div>
            </div>
            <div style="grid-column: span 2;">
              <span class="text-muted" style="font-size: 0.72rem;">Tribunal Docente:</span>
              <div class="text-secondary">${mesa.docentes || 'A designar'}</div>
            </div>
          </div>
        </div>

        <!-- Requisitos Reglamentarios -->
        <div style="background: rgba(56, 189, 248, 0.08); border: 1px dashed rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 0.6rem 0.85rem; font-size: 0.72rem; color: #94a3b8; line-height: 1.4; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <strong style="color: #38bdf8; display: inline-flex; align-items: center; gap: 0.3rem;">
              <i class="fa-solid fa-circle-exclamation"></i> Requisitos Obligatorios:
            </strong>
            Presentarse con D.N.I. físico o digital original, uniforme reglamentario o vestimenta institucional y útiles necesarios. Estar 15 minutos antes de la hora fijada.
          </div>
          <div style="margin-top: 0.4rem; padding-top: 0.35rem; border-top: 1px dashed rgba(56, 189, 248, 0.2); display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem;">
            <span><strong class="text-secondary">Inscripción:</strong> ${inscObj.fechaInscripcion || '14/10/2026'}</span>
            <span class="text-white"><i class="fa-solid fa-circle-check"></i> Registro Confirmado</span>
          </div>
        </div>

      </div>

    </div>
  `;

  modal.style.display = 'flex';
}

function cerrarModalComprobante() {
  const modal = document.getElementById('modalComprobanteInscripcion');
  if (modal) modal.style.display = 'none';
}

function imprimirComprobanteInscripcion() {
  document.body.classList.add('imprimiendo-comprobante');
  window.print();
  setTimeout(() => {
    document.body.classList.remove('imprimiendo-comprobante');
  }, 1000);
}

// 19. GESTIÓN INTEGRAL DE NOTIFICACIONES Y COMUNICADOS 

// Sincronizar notificaciones y estado de lectura desde MySQL
async function sincronizarNotificacionesDesdeMySQL() {
  try {
    const jurisActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion)
      ? DB_ESCOLAR.configuracion.jurisdiccion
      : "formosa";
    const idInst = jurisActiva === 'pba' ? 2 : 1;
    const instActiva = idInst === 2 ? 'inst-pba' : 'inst-formosa';

    // Obtener DNI del usuario activo para saber qué avisos ya leyó
    let dniUsuario = '';
    if (typeof usuarioSesion !== 'undefined' && usuarioSesion) {
      dniUsuario = usuarioSesion.dni || usuarioSesion.alumnoDni || '';
    }
    if (!dniUsuario && alumnoActivoDni) {
      dniUsuario = alumnoActivoDni;
    }

    const resp = await fetch(`api/notificaciones.php?id_institucion=${idInst}&dni=${dniUsuario}`);
    if (!resp.ok) return;
    const notifsBD = await resp.json();
    if (!Array.isArray(notifsBD)) return;

    if (!DB_ESCOLAR.notificaciones) DB_ESCOLAR.notificaciones = [];

    // Conservar notificaciones de otras instituciones
    const otrasNotifs = DB_ESCOLAR.notificaciones.filter(n => {
      if (n.institucionId) return n.institucionId !== instActiva;
      if (n.id_institucion) return parseInt(n.id_institucion, 10) !== idInst;
      return false;
    });

    const notifsMapeadas = notifsBD.map(n => ({
      id: n.id || n.codigo_notificacion || `notif-${n.id_db}`,
      id_db: n.id_db || n.id,
      codigo_notificacion: n.codigo_notificacion || n.id,
      titulo: n.titulo,
      contenido: n.contenido,
      categoria: n.categoria || 'Boletines y Calificaciones',
      prioridad: n.prioridad || 'normal',
      color: n.color || '#38bdf8',
      fecha: n.fecha || '',
      emisor: n.emisor || 'Preceptoría',
      destinatario: n.destinatario || 'Todos los Cursos y Familias',
      estado: n.estado || 'activa',
      institucionId: instActiva,
      id_institucion: idInst,
      leido: n.leido === true,
      fecha_lectura: n.fecha_lectura || null
    }));

    DB_ESCOLAR.notificaciones = [...otrasNotifs, ...notifsMapeadas];
    guardarBaseDatosEscolar();
  } catch (err) {
    console.warn("Aviso al sincronizar notificaciones desde MySQL:", err);
  }
}

// 1. Preceptor: Renderizar tabla y estadísticas de notificaciones
function renderizarNotificacionesPreceptor() {
  const tbody = document.getElementById('tbodyNotificacionesPreceptor');
  const gridStats = document.getElementById('gridStatsNotificacionesPreceptor');
  if (!tbody || !DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const notifs = (DB_ESCOLAR.notificaciones || []).filter(n => !n.institucionId || n.institucionId === instActiva);
  const activas = notifs.filter(n => n.estado !== 'archivada');
  const urgentes = notifs.filter(n => n.prioridad === 'urgente' || n.prioridad === 'alta');

  if (gridStats) {
    gridStats.innerHTML = `
      <div class="stat-metric-card">
        <div class="stat-metric-label"><i class="fa-solid fa-bullhorn text-blue"></i> Total Comunicados</div>
        <div class="stat-metric-value">${notifs.length}</div>
        <div class="text-blue" style="font-size: 0.72rem; margin-top: 2px;">Avisos institucionales creados</div>
      </div>

      <div class="stat-metric-card">
        <div class="stat-metric-label"><i class="fa-solid fa-envelope-open-text text-white"></i> Comunicados Activos</div>
        <div class="stat-metric-value text-green">${activas.length}</div>
        <div class="text-green" style="font-size: 0.72rem; margin-top: 2px;">Visibles para familias y alumnos</div>
      </div>

      <div class="stat-metric-card">
        <div class="stat-metric-label"><i class="fa-solid fa-triangle-exclamation text-amber"></i> Alta Prioridad / Urgentes</div>
        <div class="stat-metric-value text-amber">${urgentes.length}</div>
        <div class="text-amber" style="font-size: 0.72rem; margin-top: 2px;">Convocatorias o alertas directas</div>
      </div>
    `;
  }

  if (notifs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          <i class="fa-solid fa-bell-slash text-dim" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          No hay notificaciones ni avisos creados en la institución.<br>
          <button type="button" class="btn-toolbar-action btn-toolbar-primary" style="margin-top: 0.75rem;" onclick="abrirModalCrearNotificacion()">
            <i class="fa-solid fa-bell"></i> Crear Primer Comunicado
          </button>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = notifs.map((n, idx) => {
    // Badges según categoría y prioridad
    let badgePrioridad = `<span class="badge badge-blue" style="font-size: 0.72rem;"><i class="fa-solid fa-circle-info"></i> Normal</span>`;
    if (n.prioridad === 'urgente') {
      badgePrioridad = `<span class="badge badge-red" style="font-size: 0.72rem;"><i class="fa-solid fa-triangle-exclamation"></i> Urgente</span>`;
    } else if (n.prioridad === 'alta') {
      badgePrioridad = `<span class="badge badge-amber" style="font-size: 0.72rem;"><i class="fa-solid fa-bell"></i> Alta</span>`;
    } else if (n.prioridad === 'positiva') {
      badgePrioridad = `<span class="badge badge-green" style="font-size: 0.72rem;"><i class="fa-solid fa-circle-check"></i> Institucional</span>`;
    }

    let badgeCat = `<span class="badge badge-blue" style="font-size: 0.72rem;">${n.categoria || 'Aviso General'}</span>`;
    if (n.categoria === 'Reunión de Familias') {
      badgeCat = `<span class="badge badge-green" style="font-size: 0.72rem;"><i class="fa-solid fa-users"></i> ${n.categoria}</span>`;
    } else if (n.categoria === 'Mesas de Examen') {
      badgeCat = `<span class="badge badge-purple" style="font-size: 0.72rem;"><i class="fa-solid fa-graduation-cap"></i> ${n.categoria}</span>`;
    } else if (n.categoria === 'Atención y Preceptoría') {
      badgeCat = `<span class="badge badge-amber" style="font-size: 0.72rem;"><i class="fa-solid fa-clock"></i> ${n.categoria}</span>`;
    }

    const previewTexto = (n.contenido && n.contenido.length > 95)
      ? n.contenido.slice(0, 95) + '...'
      : (n.contenido || '');

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
        <td>
          <div style="font-weight: 700; color: #fff; font-size: 0.88rem; margin-bottom: 2px;">
            ${n.titulo}
          </div>
          <div class="text-muted" style="font-size: 0.74rem; line-height: 1.35;">
            ${previewTexto}
          </div>
        </td>
        <td style="text-align: center;">${badgeCat}</td>
        <td>
          <span style="font-size: 0.76rem; color: #cbd5e1; font-weight: 600;">
            <i class="fa-solid fa-user-group" style="color: #38bdf8; margin-right: 3px;"></i> ${n.destinatario || 'Todos los Cursos'}
          </span>
        </td>
        <td style="text-align: center;">
          <div class="text-secondary" style="font-size: 0.76rem; font-weight: 600;">${n.emisor || 'Preceptoría'}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">${n.fecha || '-'}</div>
        </td>
        <td style="text-align: center;">${badgePrioridad}</td>
        <td style="text-align: center; white-space: nowrap;">
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.45rem;">
            <button type="button" class="btn-action-icon btn-action-view" onclick="verNotificacionDetalle('${n.id}')" title="Ver comunicado completo">
              <i class="fa-solid fa-eye"></i>
            </button>
            <button type="button" class="btn-action-icon btn-action-edit" onclick="editarNotificacionModal('${n.id}')" title="Editar comunicado">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button type="button" class="btn-action-icon btn-action-delete" onclick="eliminarNotificacion('${n.id}')" title="Eliminar comunicado">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 2. Abrir modal para crear nueva notificación
function abrirModalCrearNotificacion() {
  const modal = document.getElementById('modalNotificacion');
  const inputId = document.getElementById('inputNotifId');
  const tituloModal = document.getElementById('tituloModalNotificacion');
  const inputTitulo = document.getElementById('inputNotifTitulo');
  const selectCat = document.getElementById('selectNotifCategoria');
  const selectPrio = document.getElementById('selectNotifPrioridad');
  const selectDest = document.getElementById('selectNotifDestinatario');
  const inputEmisor = document.getElementById('inputNotifEmisor');
  const textareaCont = document.getElementById('textareaNotifContenido');

  if (inputId) inputId.value = '';
  if (tituloModal) {
    tituloModal.innerHTML = `<i class="fa-solid fa-bullhorn text-blue"></i> Redactar Notificación Institucional`;
  }
  if (inputTitulo) inputTitulo.value = '';
  if (selectCat) selectCat.value = 'Boletines y Calificaciones';
  if (selectPrio) selectPrio.value = 'normal';
  if (selectDest) selectDest.value = 'Todos los Cursos y Familias';
  if (inputEmisor) inputEmisor.value = 'Preceptoría';
  if (textareaCont) textareaCont.value = '';

  if (modal) modal.style.display = 'flex';
}

function cerrarModalNotificacion() {
  const modal = document.getElementById('modalNotificacion');
  if (modal) modal.style.display = 'none';
}

// 3. Abrir modal para editar notificación existente
function editarNotificacionModal(notifId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;
  const notif = DB_ESCOLAR.notificaciones.find(n => n.id === notifId);
  if (!notif) return;

  const modal = document.getElementById('modalNotificacion');
  const inputId = document.getElementById('inputNotifId');
  const tituloModal = document.getElementById('tituloModalNotificacion');
  const inputTitulo = document.getElementById('inputNotifTitulo');
  const selectCat = document.getElementById('selectNotifCategoria');
  const selectPrio = document.getElementById('selectNotifPrioridad');
  const selectDest = document.getElementById('selectNotifDestinatario');
  const inputEmisor = document.getElementById('inputNotifEmisor');
  const textareaCont = document.getElementById('textareaNotifContenido');

  if (inputId) inputId.value = notif.id;
  if (tituloModal) {
    tituloModal.innerHTML = `<i class="fa-solid fa-pen-to-square text-blue"></i> Editar Notificación Institucional`;
  }
  if (inputTitulo) inputTitulo.value = notif.titulo || '';
  if (selectCat) selectCat.value = notif.categoria || 'Boletines y Calificaciones';
  if (selectPrio) selectPrio.value = notif.prioridad || 'normal';
  if (selectDest) selectDest.value = notif.destinatario || 'Todos los Cursos y Familias';
  if (inputEmisor) inputEmisor.value = notif.emisor || 'Preceptoría';
  if (textareaCont) textareaCont.value = notif.contenido || '';

  if (modal) modal.style.display = 'flex';
}

// 4. Guardar notificación (Crear o Editar)
async function guardarNotificacionForm(event) {
  if (event) event.preventDefault();
  if (!DB_ESCOLAR) return;
  if (!DB_ESCOLAR.notificaciones) DB_ESCOLAR.notificaciones = [];

  const inputId = document.getElementById('inputNotifId');
  const inputTitulo = document.getElementById('inputNotifTitulo');
  const selectCat = document.getElementById('selectNotifCategoria');
  const selectPrio = document.getElementById('selectNotifPrioridad');
  const selectDest = document.getElementById('selectNotifDestinatario');
  const inputEmisor = document.getElementById('inputNotifEmisor');
  const textareaCont = document.getElementById('textareaNotifContenido');

  if (!inputTitulo || !textareaCont) return;

  const id = inputId ? inputId.value.trim() : '';
  const titulo = inputTitulo.value.trim();
  const categoria = selectCat ? selectCat.value : 'Boletines y Calificaciones';
  const prioridad = selectPrio ? selectPrio.value : 'normal';
  const destinatario = selectDest ? selectDest.value : 'Todos los Cursos y Familias';
  const emisor = (inputEmisor && inputEmisor.value.trim()) ? inputEmisor.value.trim() : 'Preceptoría';
  const contenido = textareaCont.value.trim();

  if (!titulo || !contenido) {
    alert("Por favor completá el título y el mensaje de la notificación.");
    return;
  }

  // Mapear color según prioridad
  let color = '#38bdf8';
  if (prioridad === 'urgente') color = '#ef4444';
  else if (prioridad === 'alta') color = '#f59e0b';
  else if (prioridad === 'positiva') color = '#22c55e';

  // Formatear fecha actual
  const fechaHoy = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
  const idInst = (jurisActiva === 'pba') ? 2 : 1;
  const instActiva = (idInst === 2) ? 'inst-pba' : 'inst-formosa';

  let idDb = 0;
  let targetId = id;
  if (id) {
    // Modo Edición
    const idx = DB_ESCOLAR.notificaciones.findIndex(n => n.id === id);
    if (idx !== -1) {
      idDb = DB_ESCOLAR.notificaciones[idx].id_db || 0;
      DB_ESCOLAR.notificaciones[idx] = {
        ...DB_ESCOLAR.notificaciones[idx],
        titulo,
        categoria,
        prioridad,
        color,
        destinatario,
        emisor,
        contenido,
        id_institucion: idInst,
        institucionId: instActiva,
        fechaModificacion: fechaHoy
      };
      mostrarToast(`Notificación "${titulo}" actualizada correctamente.`);
    }
  } else {
    // Modo Creación
    targetId = 'notif-' + Date.now();
    const nuevaNotif = {
      id: targetId,
      codigo_notificacion: targetId,
      titulo,
      categoria,
      prioridad,
      color,
      fecha: fechaHoy,
      emisor,
      destinatario,
      contenido,
      estado: 'activa',
      institucionId: instActiva,
      id_institucion: idInst,
      leido: false
    };
    DB_ESCOLAR.notificaciones.unshift(nuevaNotif);
    mostrarToast(`¡Nueva notificación publicada con éxito!`);
  }

  guardarBaseDatosEscolar();
  cerrarModalNotificacion();
  renderizarNotificacionesPreceptor();
  renderizarNotificacionesTutor();

  // Guardar en MySQL
  try {
    const resp = await fetch('api/notificaciones.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'guardar_notificacion',
        id: targetId,
        id_db: idDb,
        titulo: titulo,
        contenido: contenido,
        categoria: categoria,
        prioridad: prioridad,
        color: color,
        emisor: emisor,
        destinatario: destinatario,
        fecha: fechaHoy,
        id_institucion: idInst
      })
    });
    const resJSON = await resp.json();
    if (resp.ok && resJSON.id_db) {
      const notifItem = DB_ESCOLAR.notificaciones.find(n => n.id === targetId);
      if (notifItem) {
        notifItem.id_db = resJSON.id_db;
        guardarBaseDatosEscolar();
      }
    }
  } catch (errMySQL) {
    console.warn("Aviso al guardar notificación en MySQL:", errMySQL);
  }
}

// 5. Eliminar notificación con confirmación elegante
function eliminarNotificacion(notifId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;
  const notif = DB_ESCOLAR.notificaciones.find(n => n.id === notifId);
  if (!notif) return;

  const prioBadge = notif.prioridad === 'urgente' ? 'badge-red' : (notif.prioridad === 'alta' ? 'badge-amber' : 'badge-blue');

  mostrarModalConfirmacion({
    titulo: '¿Eliminar Comunicado Institucional?',
    mensaje: `¿Estás seguro de que deseás eliminar este aviso oficial?`,
    detalles: [
      { label: 'Título', valor: notif.titulo, colorClase: 'text-white' },
      { label: 'Categoría', valor: notif.categoria || 'General', badge: 'badge-blue' },
      { label: 'Prioridad', valor: (notif.prioridad || 'normal').toUpperCase(), badge: prioBadge },
      { label: 'Destinatario', valor: notif.destinatario || 'Todos los Cursos', colorClase: 'text-secondary' },
      { label: 'Fecha de Emisión', valor: notif.fecha || '-', colorClase: 'text-muted' }
    ],
    alerta: 'El comunicado dejará de ser visible para los tutores, alumnos y docentes en el portal.',
    textoBoton: 'Sí, Eliminar Comunicado',
    icono: 'fa-solid fa-bullhorn',
    onConfirm: async () => {
      const idDb = notif.id_db || 0;
      DB_ESCOLAR.notificaciones = DB_ESCOLAR.notificaciones.filter(n => n.id !== notifId);
      guardarBaseDatosEscolar();
      mostrarToast(`Se eliminó la notificación "${notif.titulo}".`, 'info');
      renderizarNotificacionesPreceptor();
      renderizarNotificacionesTutor();

      // Eliminar de MySQL
      try {
        await fetch('api/notificaciones.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accion: 'eliminar_notificacion',
            id: notifId,
            id_db: idDb
          })
        });
      } catch (errDel) {
        console.warn("Aviso al eliminar notificación de MySQL:", errDel);
      }
    }
  });
}

// 6. Ver detalle de notificación en modal
function verNotificacionDetalle(notifId) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;
  const notif = DB_ESCOLAR.notificaciones.find(n => n.id === notifId);
  if (!notif) return;

  const modal = document.getElementById('modalVerNotificacion');
  const headerTit = document.getElementById('verNotifHeaderTitulo');
  const headerSub = document.getElementById('verNotifHeaderSub');
  const cuerpo = document.getElementById('cuerpoVerNotificacion');

  if (headerTit) headerTit.innerHTML = `<i class="fa-solid fa-bell" style="color: ${notif.color || '#38bdf8'};"></i> ${notif.titulo}`;
  if (headerSub) headerSub.textContent = `${notif.emisor || 'Preceptoría'} • ${notif.fecha || '-'} • Para: ${notif.destinatario || 'Todos los Cursos'}`;

  let badgePrio = `<span class="badge badge-blue"><i class="fa-solid fa-circle-info"></i> Normal</span>`;
  if (notif.prioridad === 'urgente') badgePrio = `<span class="badge badge-red"><i class="fa-solid fa-triangle-exclamation"></i> Urgente</span>`;
  else if (notif.prioridad === 'alta') badgePrio = `<span class="badge badge-amber"><i class="fa-solid fa-bell"></i> Alta</span>`;
  else if (notif.prioridad === 'positiva') badgePrio = `<span class="badge badge-green"><i class="fa-solid fa-circle-check"></i> Institucional</span>`;

  if (cuerpo) {
    cuerpo.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed #334155; padding-bottom: 0.65rem; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
        <span class="badge badge-purple">${notif.categoria || 'Aviso General'}</span>
        ${badgePrio}
      </div>
      <div style="background: #111827; border-left: 4px solid ${notif.color || '#38bdf8'}; border-radius: 8px; padding: 1rem 1.25rem; font-size: 0.86rem; color: #cbd5e1; line-height: 1.6; white-space: pre-wrap;">${notif.contenido}</div>
      <div style="margin-top: 0.85rem; font-size: 0.74rem; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
        <span><i class="fa-solid fa-user-tie text-blue"></i> Emisor: <strong>${notif.emisor || 'Preceptoría'}</strong></span>
        <span><i class="fa-solid fa-calendar-day text-white"></i> Fecha: <strong>${notif.fecha || '-'}</strong></span>
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
}

function cerrarModalVerNotificacion() {
  const modal = document.getElementById('modalVerNotificacion');
  if (modal) modal.style.display = 'none';
}

// 7. Tutor / Alumno: Renderizar panel de notificaciones en tiempo real con confirmación de lectura ("leído como check")
function renderizarNotificacionesTutor() {
  const cont = document.getElementById('contenedorNotificacionesTutor');
  const badgeCount = document.getElementById('badgeTutorNotifCount');
  if (!cont || !DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;

  const instActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : (DB_ESCOLAR.institucionActivaId || 'inst-formosa');
  const notifs = (DB_ESCOLAR.notificaciones || []).filter(n => (!n.institucionId || n.institucionId === instActiva) && n.estado !== 'archivada');

  const total = notifs.length;
  const noLeidas = notifs.filter(n => !n.leido).length;

  if (badgeCount) {
    if (noLeidas > 0) {
      badgeCount.innerHTML = `<span class="badge badge-amber"><i class="fa-solid fa-bell"></i> ${total} ${total === 1 ? 'Aviso' : 'Avisos'} (${noLeidas} sin leer)</span>`;
    } else {
      badgeCount.innerHTML = `<span class="badge badge-green"><i class="fa-solid fa-check-double"></i> Al día (${total} ${total === 1 ? 'leído' : 'leídos'})</span>`;
    }
  }

  const navNotif = document.getElementById('navLinkTutorNotif');
  if (navNotif) {
    navNotif.innerHTML = `<i class="fa-solid fa-bell"></i> Notificaciones ${noLeidas > 0 ? `<span class="badge badge-red" style="font-size: 0.68rem; padding: 0.15rem 0.45rem; margin-left: 4px; border-radius: 999px;">${noLeidas}</span>` : ''}`;
  }

  if (notifs.length === 0) {
    cont.innerHTML = `
      <div class="card" style="padding: 2.5rem; text-align: center; background: #0f172a; border-radius: 8px;">
        <i class="fa-solid fa-bell-slash" style="font-size: 2rem; color: #475569; margin-bottom: 0.5rem; display: block;"></i>
        <h4 style="margin: 0; color: #fff; font-size: 1rem;">No hay avisos o comunicaciones pendientes</h4>
        <p style="margin: 0.35rem 0 0; font-size: 0.8rem; color: var(--text-muted);">
          Los nuevos comunicados y avisos institucionales cargados por preceptoría aparecerán automáticamente en esta sección.
        </p>
      </div>
    `;
    return;
  }

  cont.innerHTML = notifs.map(n => {
    // Determinar badge según prioridad o categoría
    let badgePrioridad = '';
    if (n.prioridad === 'urgente') {
      badgePrioridad = `<span class="badge badge-red" style="font-size: 0.72rem;"><i class="fa-solid fa-triangle-exclamation"></i> Urgente</span>`;
    } else if (n.prioridad === 'alta') {
      badgePrioridad = `<span class="badge badge-amber" style="font-size: 0.72rem;"><i class="fa-solid fa-bell"></i> Importante</span>`;
    }

    let badgeCat = `<span class="badge badge-blue">${n.categoria || 'Aviso General'}</span>`;
    if (n.categoria === 'Reunión de Familias') {
      badgeCat = `<span class="badge badge-green">${n.categoria}</span>`;
    } else if (n.categoria === 'Mesas de Examen') {
      badgeCat = `<span class="badge badge-purple">${n.categoria}</span>`;
    } else if (n.categoria === 'Atención y Preceptoría') {
      badgeCat = `<span class="badge badge-amber">${n.categoria}</span>`;
    }

    const borderColor = n.color || (n.prioridad === 'urgente' ? '#ef4444' : n.prioridad === 'alta' ? '#f59e0b' : '#38bdf8');
    const esLeido = !!n.leido;

    const badgeEstadoLectura = esLeido
      ? `<span class="badge badge-green" style="font-size: 0.7rem;"><i class="fa-solid fa-check-double"></i> Leído</span>`
      : `<span class="badge badge-amber" style="font-size: 0.7rem;"><i class="fa-solid fa-bell"></i> Sin leer</span>`;

    const botonCheckLeido = esLeido
      ? `<button type="button" class="btn-check-leido activo" onclick="marcarNotificacionLeida('${n.id}', false)" title="Hacé clic si deseás marcar este aviso como no leído">
           <i class="fa-solid fa-circle-check text-green"></i> <strong>Leído</strong>
         </button>`
      : `<button type="button" class="btn-check-leido pendiente" onclick="marcarNotificacionLeida('${n.id}', true)" title="Confirmá que leíste este comunicado oficial">
           <i class="fa-regular fa-circle-check"></i> <strong>Marcar como leído</strong>
         </button>`;

    return `
      <div class="card" style="padding: 1.25rem 1.4rem; background: ${esLeido ? '#0f172a' : '#131e36'}; border-left: 4px solid ${borderColor}; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2); transition: all 0.2s ease;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            ${badgeCat}
            ${badgePrioridad}
            ${badgeEstadoLectura}
          </div>
          <span style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.35rem;">
            <i class="fa-solid fa-clock"></i> ${n.fecha || '-'} • <strong>${n.emisor || 'Preceptoría'}</strong>
          </span>
        </div>

        <h3 style="margin: 0 0 0.45rem 0; font-size: 1rem; font-weight: 700; color: #fff;">
          ${n.titulo}
        </h3>

        <p style="margin: 0; font-size: 0.85rem; color: #cbd5e1; line-height: 1.55; white-space: pre-wrap;">${n.contenido}</p>

        <div style="margin-top: 0.75rem; padding-top: 0.6rem; border-top: 1px dashed #1e293b; font-size: 0.74rem; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <span><i class="fa-solid fa-user-group text-blue"></i> Dirigido a: <strong>${n.destinatario || 'Todos los Cursos'}</strong></span>
          <div>
            ${botonCheckLeido}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Marcar notificación como leída (Alumno / Tutor)
async function marcarNotificacionLeida(notifId, nuevoEstado = true) {
  if (!DB_ESCOLAR || !DB_ESCOLAR.notificaciones) return;
  const notif = DB_ESCOLAR.notificaciones.find(n => n.id === notifId);
  if (!notif) return;

  notif.leido = nuevoEstado;
  guardarBaseDatosEscolar();
  renderizarNotificacionesTutor();

  mostrarToast(nuevoEstado ? '¡Comunicado marcado como leído!' : 'Comunicado marcado como pendiente');

  // Obtener DNI y rol del usuario actual
  let dniUsuario = '';
  let rolUsuario = 'estudiante';
  if (typeof usuarioSesion !== 'undefined' && usuarioSesion) {
    dniUsuario = usuarioSesion.dni || usuarioSesion.alumnoDni || '';
    rolUsuario = usuarioSesion.rol || 'estudiante';
  }
  if (!dniUsuario && alumnoActivoDni) {
    dniUsuario = alumnoActivoDni;
  }

  // Persistir en MySQL
  try {
    await fetch('api/notificaciones.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accion: 'marcar_leido',
        notificacion_id: notifId,
        dni: dniUsuario,
        rol: rolUsuario,
        leido: nuevoEstado
      })
    });
  } catch (errMySQL) {
    console.warn("Aviso al guardar lectura en MySQL:", errMySQL);
  }
}

// 20. BOOTSTRAP DEL PORTAL
initBaseDatosEscolar();
inicializarSesionPortal();

// Determinar qué archivo cargar según los datos de la institución
const cfgInicial = (DB_ESCOLAR && DB_ESCOLAR.configuracion) ? DB_ESCOLAR.configuracion : {};
const archivoInicial = cfgInicial.jurisdiccion === 'pba' ? 'data/pba.json' : 'data/formosa.json';

cargarDatos(archivoInicial).then(async () => {
  await refrescarPadronDesdeMySQL();
  sincronizarSesionYAlumno();
  if (alumnoActivoDni) {
    await cargarAlumnoEnBoletin(alumnoActivoDni);
  }
});

// Listener de tecla ESC para cerrar modales flotantes
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modalBorrar = document.getElementById('modalConfirmarBorradoPlanilla');
    if (modalBorrar && modalBorrar.style.display !== 'none') {
      cerrarModalConfirmarBorrado();
    }
  }
});

// (GET)
async function refrescarPadronDesdeMySQL() {
  try {
    const jurisActiva = (DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.jurisdiccion) ? DB_ESCOLAR.configuracion.jurisdiccion : "formosa";
    const idInst = jurisActiva === 'pba' ? 2 : 1;

    // Traer estudiantes de la base de datos MySQL
    const respuesta = await fetch(`api/alumnos.php?id_institucion=${idInst}&jurisdiccion=${jurisActiva}`);
    const alumnosBD = await respuesta.json();

    if (respuesta.ok && Array.isArray(alumnosBD)) {
      const alumnosFiltrados = alumnosBD.filter(bd => {
        if (bd.id_institucion) return parseInt(bd.id_institucion, 10) === idInst;
        if (bd.jurisdiccion) return (bd.jurisdiccion || '').toLowerCase() === jurisActiva.toLowerCase();
        return idInst === 1;
      });

      // Conservar alumnos de otras instituciones para no pisarlos
      const otrosAlumnos = (DB_ESCOLAR.alumnos || []).filter(a => {
        if (a.institucionId) return a.institucionId !== (jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa');
        if (a.jurisdiccion) return a.jurisdiccion.toLowerCase() !== jurisActiva.toLowerCase();
        return jurisActiva !== 'formosa';
      });

      const nuevosAlumnosEscuela = alumnosFiltrados.map(bd => {
        const alumExistente = DB_ESCOLAR.alumnos ? DB_ESCOLAR.alumnos.find(a => a.dni === String(bd.dni)) : null;

        let anioNorm = String(bd.curso || '').replace('°', '').trim();
        let secUpper = String(bd.seccion || '').trim().toUpperCase();

        let idDelCurso = null;

        // 1. Si la sección de la BD contiene explícitamente la orientación (CS / SOC o CN / NAT), buscar el curso oficial correspondiente
        if (secUpper.includes('CS') || secUpper.includes('SOC')) {
          const cFound = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => {
            if (c.institucionId && c.institucionId !== (jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa')) return false;
            if (String(c.anio) !== anioNorm) return false;
            const oriUpper = (c.orientacion || '').trim().toUpperCase();
            if (!oriUpper.includes('SOCIAL')) return false;
            const divUpper = (c.division || '').trim().toUpperCase();
            return secUpper.includes(divUpper) || divUpper === secUpper;
          }) : null;
          if (cFound) idDelCurso = cFound.id;
        } else if (secUpper.includes('CN') || secUpper.includes('NAT')) {
          const cFound = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => {
            if (c.institucionId && c.institucionId !== (jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa')) return false;
            if (String(c.anio) !== anioNorm) return false;
            const oriUpper = (c.orientacion || '').trim().toUpperCase();
            if (!oriUpper.includes('NATURAL')) return false;
            const divUpper = (c.division || '').trim().toUpperCase();
            return secUpper.includes(divUpper) || divUpper === secUpper;
          }) : null;
          if (cFound) idDelCurso = cFound.id;
        }

        // 2. Si no tiene sufijo de orientación en BD pero en memoria ya teníamos un cursoId asignado (respetando año y división)
        if (!idDelCurso && alumExistente && alumExistente.cursoId) {
          const cMem = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => c.id === alumExistente.cursoId) : null;
          if (cMem && String(cMem.anio) === anioNorm) {
            const divUpper = (cMem.division || '').trim().toUpperCase();
            if (!secUpper || secUpper.includes(divUpper) || divUpper === secUpper) {
              idDelCurso = cMem.id;
            }
          }
        }

        // 3. Si sigue sin resolverse, buscar por coincidencia de año y división
        if (!idDelCurso) {
          let cursoEncontrado = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => {
            if (c.institucionId && c.institucionId !== (jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa')) return false;
            if (String(c.anio) !== anioNorm) return false;
            const divUpper = (c.division || '').trim().toUpperCase();
            return secUpper.startsWith(divUpper) || divUpper === secUpper;
          }) : null;

          idDelCurso = cursoEncontrado ? cursoEncontrado.id : (jurisActiva === 'pba' ? 'pba-4-u' : '2-3');
        }

        const cursoObj = DB_ESCOLAR.cursos ? DB_ESCOLAR.cursos.find(c => c.id === idDelCurso) : null;
        const cursoFormateado = cursoObj ? cursoObj.nombre : ((bd.curso ? (bd.curso.includes('°') ? bd.curso : bd.curso + '°') : (jurisActiva === 'pba' ? '4°' : '2°')) + ' ' + (bd.seccion || (jurisActiva === 'pba' ? 'Única' : 'III')));
        const nombreCompleto = bd.apellido ? `${bd.apellido.toUpperCase()}, ${bd.nombre.toUpperCase()}` : bd.nombre;

        return {
          idDB: bd.id,
          dni: String(bd.dni),
          nombre: nombreCompleto,
          institucionId: jurisActiva === 'pba' ? 'inst-pba' : 'inst-formosa',
          jurisdiccion: bd.jurisdiccion || jurisActiva,
          cursoId: idDelCurso,
          curso: cursoFormateado,
          tutor: bd.nombre_tutor || (jurisActiva === 'pba' ? 'Pleininger Cristian' : 'Gómez Pedro'),
          dniTutor: bd.dni_tutor || ((alumExistente && alumExistente.dniTutor) ? alumExistente.dniTutor : (jurisActiva === 'pba' ? '28123456' : '20123456')),
          emailAlumno: bd.email_estudiante || ((alumExistente && alumExistente.emailAlumno) ? alumExistente.emailAlumno : `${bd.nombre.toLowerCase()}.${bd.apellido.toLowerCase()}@escuela.edu.ar`),
          emailTutor: bd.email_tutor || ((alumExistente && alumExistente.emailTutor) ? alumExistente.emailTutor : (jurisActiva === 'pba' ? 'cristian@gmail.com' : 'pedro@gmail.com')),
          claveAcceso: bd.clave_acceso || String(bd.dni || '').slice(-4),
          notasFormosa: (alumExistente && alumExistente.notasFormosa) ? alumExistente.notasFormosa : {},
          notasPba: (alumExistente && alumExistente.notasPba) ? alumExistente.notasPba : {}
        };
      });

      DB_ESCOLAR.alumnos = [...otrosAlumnos, ...nuevosAlumnosEscuela];

      // 3. Cargar las notas registradas en MySQL para la escuela activa
      try {
        const respNotas = await fetch(`api/notas.php?id_institucion=${idInst}&jurisdiccion=${jurisActiva}`);
        const notasBD = await respNotas.json();
        if (respNotas.ok && Array.isArray(notasBD)) {
          notasBD.forEach(n => {
            const alum = DB_ESCOLAR.alumnos.find(a => a.dni === String(n.dni_estudiante));
            if (!alum) return;
            const materia = n.materia;
            const periodo = n.periodo;
            const num = n.nota_numerica !== null && n.nota_numerica !== '' ? Number(n.nota_numerica) : null;
            const conc = n.valoracion_conceptual || null;
            const obs = n.observacion || '';

            const pNorm = String(periodo || '').toLowerCase().trim();
            let pKey = '';
            // CRÍTICO: Verificar cuatrimestre ANTES de trimestre porque "cuatrimestre" contiene la subcadena "trim"!
            if (pNorm === 'c1' || (pNorm.includes('1') && pNorm.includes('cuat'))) pKey = 'c1';
            else if (pNorm === 'c2' || (pNorm.includes('2') && pNorm.includes('cuat'))) pKey = 'c2';
            else if (pNorm === 'rit_dic' || (pNorm.includes('dic') && (jurisActiva === 'pba' || pNorm.includes('rit')))) pKey = 'rit_dic';
            else if (pNorm === 'rit_feb' || (pNorm.includes('feb') && (jurisActiva === 'pba' || pNorm.includes('rit')))) pKey = 'rit_feb';
            else if (pNorm === 't1' || (pNorm.includes('1') && pNorm.includes('trim') && !pNorm.includes('cuat'))) pKey = 't1';
            else if (pNorm === 't2' || (pNorm.includes('2') && pNorm.includes('trim') && !pNorm.includes('cuat'))) pKey = 't2';
            else if (pNorm === 't3' || (pNorm.includes('3') && pNorm.includes('trim') && !pNorm.includes('cuat'))) pKey = 't3';
            else if (pNorm === 'rec_dic' || (pNorm.includes('dic') && jurisActiva !== 'pba')) pKey = 'rec_dic';
            else if (pNorm === 'pair' || pNorm.includes('pair') || pNorm.includes('feb')) pKey = 'pair';
            else pKey = pNorm;

            const esPbaAlumno = (alum.institucionId === 'inst-pba') || (alum.jurisdiccion === 'pba') || (jurisActiva === 'pba');

            if (esPbaAlumno) {
              if (!alum.notasPba) alum.notasPba = {};
              if (!alum.notasPba[materia]) alum.notasPba[materia] = {};
              if (pKey === 'c1') {
                alum.notasPba[materia].c1_val = conc || (num !== null ? (num >= 7 ? 'TEA' : (num >= 4 ? 'TEP' : 'TED')) : 'TEA');
                alum.notasPba[materia].c1_nota = num;
              } else if (pKey === 'c2') {
                alum.notasPba[materia].c2_val = conc || (num !== null ? (num >= 7 ? 'TEA' : (num >= 4 ? 'TEP' : 'TED')) : 'TEA');
                alum.notasPba[materia].c2_nota = num;
              } else if (pKey === 'rit_dic') {
                alum.notasPba[materia].rit_dic = num;
              }
              alum.notasPba[materia].obs = obs;
            } else {
              if (!alum.notasFormosa) alum.notasFormosa = {};
              if (!alum.notasFormosa[materia]) alum.notasFormosa[materia] = {};
              if (pKey === 't1') {
                alum.notasFormosa[materia].t1_n = num;
                alum.notasFormosa[materia].t1_c = conc;
              } else if (pKey === 't2') {
                alum.notasFormosa[materia].t2_n = num;
                alum.notasFormosa[materia].t2_c = conc;
              } else if (pKey === 't3') {
                alum.notasFormosa[materia].t3_n = num;
                alum.notasFormosa[materia].t3_c = conc;
              } else if (pKey === 'rec_dic') {
                alum.notasFormosa[materia].rec_dic = num;
              } else if (pKey === 'pair') {
                alum.notasFormosa[materia].pair = num;
              }
              alum.notasFormosa[materia].obs = obs;
            }
          });
        }
      } catch (errNotas) {
        console.warn("Aviso al sincronizar notas desde MySQL:", errNotas);
      }

      // 4. Sincronizar asistencias registradas en MySQL para la escuela activa
      try {
        const respAsist = await fetch(`api/asistencia.php?id_institucion=${idInst}&jurisdiccion=${jurisActiva}`);
        if (respAsist.ok) {
          const asistBD = await respAsist.json();
          if (Array.isArray(asistBD)) {
            asistBD.forEach(a => {
              const alum = DB_ESCOLAR.alumnos.find(al => al.dni === String(a.dni_estudiante));
              if (!alum) return;
              if (!alum.asistenciasPeriodos) alum.asistenciasPeriodos = {};
              const p = normalizarNombrePeriodo(a.periodo, jurisActiva);
              const dias = parseInt(a.dias_habiles, 10) || (jurisActiva === 'pba' ? 82 : 96);
              const pres = parseInt(a.asistencias, 10) || 0;
              const faltas = parseInt(a.inasistencias, 10) || 0;
              const just = parseInt(a.justificadas, 10) || 0;

              alum.asistenciasPeriodos[p] = {
                dias: dias,
                asistencias: pres,
                inasistencias: faltas,
                justificadas: just
              };
            });

            // Recalcular agregados para cada alumno de la escuela activa
            const alumnosEscuela = obtenerAlumnosEscuelaActiva();
            alumnosEscuela.forEach(alum => {
              if (alum.asistenciasPeriodos && Object.keys(alum.asistenciasPeriodos).length > 0) {
                const resumen = obtenerDatosAsistenciaAlumno(alum, null);
                alum.diasHabiles = resumen.dias;
                alum.totalAsistencias = resumen.asistencias;
                alum.totalInasistencias = resumen.inasistencias;
                alum.justificadas = resumen.justificadas;
                alum.asistencia = (resumen.justificadas > 0)
                  ? `Días Hábiles: ${resumen.dias} • Total Asistencias: ${resumen.asistencias} • Inasistencias: ${resumen.inasistencias} (Justificadas: ${resumen.justificadas})`
                  : `Días Hábiles: ${resumen.dias} • Total Asistencias: ${resumen.asistencias} • Inasistencias: ${resumen.inasistencias}`;

                if (alum.dni === alumnoActivoDni && datosMemoria) {
                  datosMemoria.asistencia = alum.asistencia;
                  sincronizarInasistenciasBoletin(alum);
                }
              }
            });
          }
        }
      } catch (errAsist) {
        console.warn("Aviso al sincronizar asistencias desde MySQL:", errAsist);
      }

      // 5. Sincronizar mesas de examen registradas en MySQL para la escuela activa
      if (typeof sincronizarMesasDesdeMySQL === 'function') {
        await sincronizarMesasDesdeMySQL();
      }

      // 6. Sincronizar notificaciones oficiales desde MySQL para la escuela activa
      if (typeof sincronizarNotificacionesDesdeMySQL === 'function') {
        await sincronizarNotificacionesDesdeMySQL();
      }

      // 7. Sincronizar institución y estructura curricular (cursos/divisiones) desde MySQL
      if (typeof sincronizarInstitucionYCursosDesdeMySQL === 'function') {
        await sincronizarInstitucionYCursosDesdeMySQL();
      }

      // Guardar en localStorage después de actualizar notas, asistencias, mesas, notificaciones e institución desde MySQL
      guardarBaseDatosEscolar();

      // Asegurar que el alumno activo pertenezca exclusivamente a la escuela activa
      const alumnosEscuelaActiva = obtenerAlumnosEscuelaActiva();
      if (!alumnosEscuelaActiva.some(a => a.dni === alumnoActivoDni)) {
        alumnoActivoDni = alumnosEscuelaActiva.length > 0 ? alumnosEscuelaActiva[0].dni : (jurisActiva === 'pba' ? '48763736' : '34567890');
      }

      renderizarPadronAlumnos();
      poblarSelectorPreviewAlumnos();
      if (typeof renderizarMesasPreceptor === 'function') renderizarMesasPreceptor();
      if (typeof renderizarMesasTutor === 'function') renderizarMesasTutor();
      if (typeof renderizarNotificacionesPreceptor === 'function') renderizarNotificacionesPreceptor();
      if (typeof renderizarNotificacionesTutor === 'function') renderizarNotificacionesTutor();
      if (typeof renderizarEstructuraCurricular === 'function') renderizarEstructuraCurricular();
      if (typeof sincronizarPlanillasCargadas === 'function') {
        sincronizarPlanillasCargadas();
        renderizarListaPlanillasGuardadas();
      }
      if (typeof renderizarTablaCargaDocente === 'function') {
        renderizarTablaCargaDocente();
      }

      await cargarAlumnoEnBoletin(alumnoActivoDni);
      if (rolActual === 'preceptor') {
        if (typeof renderizarBoletinPreview === 'function') {
          renderizarBoletinPreview();
        }
      } else {
        asegurarUbicacionBoletin();
        if (typeof renderizarPortal === 'function' && datosMemoria) {
          renderizarPortal(datosMemoria);
        }
      }
    }
  } catch (error) {
    console.error("No se pudo sincronizar el padrón desde MySQL:", error);
  }
}

// Hacemos que se actualice solo cada vez que tocas la pestaña "Padrón de Alumnos"
const botonTabAlumnos = document.getElementById('btnTabPrecAlumnos');
if (botonTabAlumnos) {
  botonTabAlumnos.addEventListener('click', refrescarPadronDesdeMySQL);
}

// ==========================================
// GESTIÓN DE MATERIAS PREVIAS Y EQUIVALENCIAS
// ==========================================

function gestionarPreviasDeAlumno(dni) {
  alumnoActivoDni = dni;
  cambiarPestanaPreceptor('boletin');
  const sel = document.getElementById('selectPreviewAlumno');
  if (sel) sel.value = dni;
  cambiarAlumnoPreview(dni);
  setTimeout(() => {
    const el = document.getElementById('seccionBloqueInferiorPrevias');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 250);
}

function abrirModalCargarPrevia() {
  const modal = document.getElementById('modalCargarPrevia');
  if (!modal) return;

  const alumno = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni) || (DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos[0]);
  const alumnoNombre = alumno ? alumno.nombre : 'Estudiante';
  const alumnoDni = alumno ? alumno.dni : alumnoActivoDni;

  document.getElementById('modalPreviaTitulo').textContent = 'Cargar Materia Previa';
  document.getElementById('modalPreviaSubtitulo').textContent = 'Asignación individual y control de aprobación';
  document.getElementById('modalPreviaAlumnoNombre').textContent = `${alumnoNombre} (DNI ${alumnoDni})`;
  document.getElementById('inputPreviaId').value = '';
  document.getElementById('inputPreviaDni').value = alumnoDni;
  document.getElementById('inputPreviaMateria').value = '';
  document.getElementById('selectPreviaTipo').value = 'Previa';
  document.getElementById('selectPreviaCurso').value = '1° Año';
  document.getElementById('selectPreviaEstado').value = 'Pendiente';
  document.getElementById('inputPreviaNota').value = '';

  const inputFechaAprob = document.getElementById('inputPreviaFechaAprobacion');
  if (inputFechaAprob) inputFechaAprob.value = '';
  const inputLibro = document.getElementById('inputPreviaLibroFolio');
  if (inputLibro) inputLibro.value = '';
  const inputFecha = document.getElementById('inputPreviaFecha');
  if (inputFecha) inputFecha.value = '';

  alCambiarEstadoPreviaModal('Pendiente');

  modal.style.display = 'flex';
}

function alCambiarEstadoPreviaModal(valor) {
  const cajaAprobacion = document.getElementById('cajaDatosAprobacionPrevia');
  const cajaTurno = document.getElementById('cajaTurnoEstimadoPrevia');
  const badge = document.getElementById('badgeEstadoPreviaModal');
  const inputFechaAprob = document.getElementById('inputPreviaFechaAprobacion');

  const esAprobada = valor === 'Aprobada';
  const esEnCurso = valor === 'En Curso';

  if (badge) {
    if (esAprobada) {
      badge.className = 'badge badge-green';
      badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Aprobada / Pasó';
    } else if (esEnCurso) {
      badge.className = 'badge badge-blue';
      badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> En Cursada';
    } else {
      badge.className = 'badge badge-amber';
      badge.innerHTML = '<i class="fa-solid fa-clock"></i> Pendiente';
    }
  }

  if (cajaAprobacion) {
    cajaAprobacion.style.display = esAprobada ? 'block' : 'none';
  }
  if (cajaTurno) {
    cajaTurno.style.display = esAprobada ? 'none' : 'block';
  }

  if (esAprobada && inputFechaAprob && !inputFechaAprob.value) {
    const hoy = new Date().toISOString().split('T')[0];
    inputFechaAprob.value = hoy;
  }
}

function editarPreviaModal(id) {
  const modal = document.getElementById('modalCargarPrevia');
  if (!modal || !datosMemoria || !datosMemoria.bloqueInferior) return;

  const items = datosMemoria.bloqueInferior.items || [];
  const item = items.find(x => String(x.id) === String(id)) || items.find(x => String(x.id) === String(`prev_${id}`)) || items[id] || items[0];
  if (!item) return;

  const alumno = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni) || (DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos[0]);
  const alumnoNombre = alumno ? alumno.nombre : 'Estudiante';

  document.getElementById('modalPreviaTitulo').textContent = 'Editar Materia Previa / Equivalencia';
  document.getElementById('modalPreviaSubtitulo').textContent = 'Modificá la materia, condición de aprobación o fecha';
  document.getElementById('modalPreviaAlumnoNombre').textContent = `${alumnoNombre} (DNI ${alumnoActivoDni})`;
  document.getElementById('inputPreviaId').value = item.id || id;
  document.getElementById('inputPreviaDni').value = alumnoActivoDni;
  document.getElementById('inputPreviaMateria').value = item.materia || item.c3 || item.nombre_materia || '';
  document.getElementById('selectPreviaTipo').value = item.tipo || item.c1 || 'Previa';
  document.getElementById('selectPreviaCurso').value = item.curso_origen || item.cursoOrigen || item.c2 || '1° Año';

  const estado = item.estado || item.c4 || 'Pendiente';
  document.getElementById('selectPreviaEstado').value = estado;
  document.getElementById('inputPreviaNota').value = (item.calificacion !== null && item.calificacion !== undefined && item.calificacion !== '-') ? item.calificacion : '';

  const inputFechaAprob = document.getElementById('inputPreviaFechaAprobacion');
  if (inputFechaAprob) {
    inputFechaAprob.value = item.fecha_aprobacion || '';
  }

  const inputFecha = document.getElementById('inputPreviaFecha');
  if (inputFecha) {
    const valFecha = item.fecha || '';
    inputFecha.value = (valFecha !== (item.curso_origen || item.cursoOrigen || item.c2)) ? valFecha : '';
  }

  alCambiarEstadoPreviaModal(estado);

  modal.style.display = 'flex';
}

function cerrarModalCargarPrevia(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  const modal = document.getElementById('modalCargarPrevia');
  if (modal) modal.style.display = 'none';
}

let previaIdABorrar = null;

function abrirModalConfirmarBorrarPrevia(id) {
  previaIdABorrar = id;
  const modal = document.getElementById('modalConfirmarBorrarPrevia');
  if (!modal) {
    if (confirm('¿Estás seguro de que querés eliminar esta materia previa del alumno?')) {
      eliminarPreviaModal(id);
    }
    return;
  }

  const items = (datosMemoria && datosMemoria.bloqueInferior && Array.isArray(datosMemoria.bloqueInferior.items))
    ? datosMemoria.bloqueInferior.items
    : [];
  const item = items.find(x => String(x.id) === String(id));
  const materiaNombre = item ? (item.materia || item.c3 || item.nombre_materia || 'esta materia') : 'esta materia';

  const alum = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni) || (DB_ESCOLAR.alumnos && DB_ESCOLAR.alumnos[0]);
  const alumnoNombre = alum ? alum.nombre : 'el estudiante';

  const elMat = document.getElementById('borrarPreviaNombreMateria');
  if (elMat) elMat.textContent = materiaNombre;
  const elAlum = document.getElementById('borrarPreviaNombreAlumno');
  if (elAlum) elAlum.textContent = alumnoNombre;

  modal.style.display = 'flex';
}

function cerrarModalConfirmarBorrarPrevia(event) {
  if (event && event.target && event.target !== event.currentTarget) return;
  const modal = document.getElementById('modalConfirmarBorrarPrevia');
  if (modal) modal.style.display = 'none';
  previaIdABorrar = null;
}

async function confirmarBorradoPreviaDefinitivo() {
  if (!previaIdABorrar) return;
  const id = previaIdABorrar;
  const btn = document.getElementById('btnConfirmarBorrarPreviaAccion');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Eliminando...';
  }

  try {
    if (id && !String(id).startsWith('prev_')) {
      await fetch(`api/previas.php?id=${id}`, { method: 'DELETE' });
    }

    if (datosMemoria && datosMemoria.bloqueInferior && Array.isArray(datosMemoria.bloqueInferior.items)) {
      datosMemoria.bloqueInferior.items = datosMemoria.bloqueInferior.items.filter(x => String(x.id) !== String(id));
      const alum = (DB_ESCOLAR.alumnos || []).find(a => a.dni === alumnoActivoDni);
      if (alum) alum.previas = [...datosMemoria.bloqueInferior.items];
      renderizarPortal(datosMemoria);
    }

    cerrarModalConfirmarBorrarPrevia();
    mostrarToast('Materia previa eliminada correctamente.', 'info');
  } catch (err) {
    console.error("Error al eliminar previa:", err);
    mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Sí, Eliminar Previa';
    }
  }
}

function eliminarPreviaModal(id) {
  abrirModalConfirmarBorrarPrevia(id);
}

async function guardarPreviaAlumno(e) {
  if (e) e.preventDefault();
  const id = document.getElementById('inputPreviaId').value.trim();
  const dni = document.getElementById('inputPreviaDni').value.trim() || alumnoActivoDni;
  const materia = document.getElementById('inputPreviaMateria').value.trim();
  const tipo = document.getElementById('selectPreviaTipo').value;
  const cursoOrigen = document.getElementById('selectPreviaCurso').value;
  const estado = document.getElementById('selectPreviaEstado').value;
  const nota = document.getElementById('inputPreviaNota').value.trim();
  const fechaAprobacion = document.getElementById('inputPreviaFechaAprobacion') ? document.getElementById('inputPreviaFechaAprobacion').value.trim() : null;
  const fechaTurno = document.getElementById('inputPreviaFecha') ? document.getElementById('inputPreviaFecha').value.trim() : '';

  if (!materia) {
    mostrarToast('Por favor completá la materia.', 'warning');
    return;
  }

  const instActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : ((DB_ESCOLAR && DB_ESCOLAR.institucionActivaId) || 'inst-formosa');
  const idInst = instActiva === 'inst-pba' ? 2 : 1;

  const datosEnvio = {
    dni_estudiante: dni,
    materia: materia,
    calificacion: nota || null,
    estado: estado,
    curso_origen: cursoOrigen,
    fecha: fechaTurno || cursoOrigen,
    fecha_aprobacion: estado === 'Aprobada' ? (fechaAprobacion || new Date().toISOString().split('T')[0]) : null,
    id_institucion: idInst
  };

  const btn = document.getElementById('btnGuardarPrevia');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
  }

  try {
    let resp;
    if (id && !String(id).startsWith('prev_')) {
      datosEnvio.id = parseInt(id, 10);
      resp = await fetch('api/previas.php', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEnvio)
      });
    } else {
      resp = await fetch('api/previas.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosEnvio)
      });
    }

    const resultado = await resp.json();
    if (!resp.ok) {
      throw new Error(resultado.error || 'Error al guardar');
    }

    // Actualizar datos en memoria local
    if (!datosMemoria.bloqueInferior) datosMemoria.bloqueInferior = {};
    if (!Array.isArray(datosMemoria.bloqueInferior.items)) datosMemoria.bloqueInferior.items = [];

    const nuevoId = resultado.id || id || `prev_${Date.now()}`;
    const objPrevia = {
      id: nuevoId,
      c1: tipo,
      c2: cursoOrigen,
      c3: materia,
      c4: estado,
      tipo: tipo,
      cursoOrigen: cursoOrigen,
      curso_origen: cursoOrigen,
      materia: materia,
      nombre_materia: materia,
      calificacion: nota || null,
      estado: estado,
      fecha: fechaTurno || cursoOrigen,
      fecha_aprobacion: datosEnvio.fecha_aprobacion,
      id_institucion: idInst
    };

    if (id) {
      const idx = datosMemoria.bloqueInferior.items.findIndex(x => String(x.id) === String(id));
      if (idx !== -1) {
        datosMemoria.bloqueInferior.items[idx] = objPrevia;
      } else {
        datosMemoria.bloqueInferior.items.push(objPrevia);
      }
    } else {
      datosMemoria.bloqueInferior.items.push(objPrevia);
    }

    const alum = (DB_ESCOLAR.alumnos || []).find(a => a.dni === String(dni));
    if (alum) alum.previas = [...datosMemoria.bloqueInferior.items];

    renderizarPortal(datosMemoria);
    cerrarModalCargarPrevia();
    mostrarToast('Guardado correctamente.', 'success');
  } catch (err) {
    console.error("Error al guardar previa:", err);
    mostrarToast('No se guardó correctamente, intentalo de nuevo.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Previa';
    }
  }
}

async function sincronizarPreviasDeAlumno(dni, idInst, juris) {
  try {
    if (!idInst) {
      const instActiva = (DB_ESCOLAR && DB_ESCOLAR.configuracion && DB_ESCOLAR.configuracion.id) ? DB_ESCOLAR.configuracion.id : ((DB_ESCOLAR && DB_ESCOLAR.institucionActivaId) || 'inst-formosa');
      idInst = instActiva === 'inst-pba' ? 2 : 1;
    }
    const params = new URLSearchParams({ dni: String(dni), id_institucion: String(idInst) });
    if (juris) params.append('jurisdiccion', juris);
    const res = await fetch(`api/previas.php?${params.toString()}`);
    if (res.ok) {
      const previasBD = await res.json();
      if (Array.isArray(previasBD)) {
        const alum = (DB_ESCOLAR.alumnos || []).find(a => a.dni === String(dni));
        const previasFormateadas = previasBD.map(p => ({
          id: p.id,
          c1: (p.estado && p.estado.toLowerCase().includes('equiv')) ? 'Equivalencia' : 'Previa',
          c2: p.curso_origen || p.fecha || '1° Año',
          c3: p.materia,
          c4: p.estado || 'Pendiente',
          tipo: (p.estado && p.estado.toLowerCase().includes('equiv')) ? 'Equivalencia' : 'Previa',
          cursoOrigen: p.curso_origen || p.fecha || '1° Año',
          curso_origen: p.curso_origen || p.fecha || '1° Año',
          materia: p.materia,
          nombre_materia: p.materia,
          calificacion: p.calificacion,
          estado: p.estado,
          fecha: p.fecha,
          fecha_aprobacion: p.fecha_aprobacion,
          id_institucion: p.id_institucion
        }));

        if (alum) alum.previas = previasFormateadas;

        if (alumnoActivoDni === String(dni) && datosMemoria) {
          if (!datosMemoria.bloqueInferior) datosMemoria.bloqueInferior = {};
          datosMemoria.bloqueInferior.items = previasFormateadas;
          renderizarPortal(datosMemoria);
        }
      }
    }
  } catch (err) {
    console.warn("Aviso al sincronizar previas desde BD:", err);
  }
}

// INTEGRACIÓN EXTERNA: CALENDARIO DE FERIADOS OFICIALES POR MES 
let feriadosCargados2026 = [];
let mesFeriadosSeleccionado = String(new Date().getMonth() + 1);

const NOMBRES_MESES_OFICIALES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// Fallback oficial y completo para 2026 (Argentina)
const FERIADOS_OFICIALES_2026_FALLBACK = [
  { dia: 1, mes: 1, motivo: "Año Nuevo", tipo: "inamovible" },
  { dia: 16, mes: 2, motivo: "Carnaval", tipo: "inamovible" },
  { dia: 17, mes: 2, motivo: "Carnaval", tipo: "inamovible" },
  { dia: 23, mes: 3, motivo: "Puente turístico no laborable", tipo: "puente" },
  { dia: 24, mes: 3, motivo: "Día Nacional de la Memoria por la Verdad y la Justicia", tipo: "inamovible" },
  { dia: 2, mes: 4, motivo: "Día del Veterano y de los Caídos en la Guerra de Malvinas", tipo: "inamovible" },
  { dia: 3, mes: 4, motivo: "Viernes Santo", tipo: "inamovible" },
  { dia: 1, mes: 5, motivo: "Día del Trabajador", tipo: "inamovible" },
  { dia: 25, mes: 5, motivo: "Día de la Revolución de Mayo", tipo: "inamovible" },
  { dia: 15, mes: 6, motivo: "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes", tipo: "trasladable" },
  { dia: 20, mes: 6, motivo: "Paso a la Inmortalidad del Gral. Manuel Belgrano", tipo: "inamovible" },
  { dia: 9, mes: 7, motivo: "Día de la Independencia", tipo: "inamovible" },
  { dia: 10, mes: 7, motivo: "Puente turístico no laborable", tipo: "puente" },
  { dia: 17, mes: 8, motivo: "Paso a la Inmortalidad del Gral. José de San Martín", tipo: "trasladable" },
  { dia: 12, mes: 10, motivo: "Día del Respeto a la Diversidad Cultural", tipo: "trasladable" },
  { dia: 9, mes: 11, motivo: "Feriado Nacional", tipo: "inamovible" },
  { dia: 23, mes: 11, motivo: "Día de la Soberanía Nacional", tipo: "trasladable" },
  { dia: 7, mes: 12, motivo: "Puente turístico no laborable", tipo: "puente" },
  { dia: 8, mes: 12, motivo: "Día de la Inmaculada Concepción de María", tipo: "inamovible" },
  { dia: 25, mes: 12, motivo: "Navidad", tipo: "inamovible" }
];

function obtenerEtiquetaTipoFeriado(tipo) {
  if (tipo === 'puente') return 'Puente Turístico';
  if (tipo === 'trasladable') return 'Feriado Trasladable';
  return 'Feriado Nacional (Sin Clases)';
}

async function cargarFeriadosAPI(forzar = false) {
  if (feriadosCargados2026.length > 0 && !forzar) {
    renderizarComponenteFeriados(mesFeriadosSeleccionado);
    return;
  }

  try {
    const añoActual = new Date().getFullYear() || 2026;
    let normalizados = [];

    // 1. Intentamos consultar la API oficial pública 
    try {
      const respAlt = await fetch(`https://api.argentinadatos.com/v1/feriados/${añoActual}`);
      if (respAlt.ok) {
        const rawAlt = await respAlt.json();
        if (Array.isArray(rawAlt) && rawAlt.length > 0) {
          normalizados = rawAlt.map(f => {
            let dia = f.dia;
            let mes = f.mes;
            if (!dia && f.fecha) {
              const p = f.fecha.split('-');
              mes = parseInt(p[1], 10);
              dia = parseInt(p[2], 10);
            }
            return {
              dia: Number(dia),
              mes: Number(mes),
              motivo: f.nombre || f.motivo || 'Feriado Nacional',
              tipo: f.tipo || 'inamovible'
            };
          });
        }
      }
    } catch (eAlt) {
      console.warn("api.argentinadatos.com no respondió, intentando alternativa...", eAlt);
    }

    // 2. Si falló, probamos la segunda API
    if (normalizados.length === 0) {
      try {
        const respNolaborables = await fetch(`https://nolaborables.com.ar/api/v2/feriados/${añoActual}`);
        if (respNolaborables.ok) {
          const raw = await respNolaborables.json();
          if (Array.isArray(raw) && raw.length > 0) {
            normalizados = raw.map(f => ({
              dia: Number(f.dia),
              mes: Number(f.mes),
              motivo: f.motivo || f.nombre || 'Feriado Nacional',
              tipo: f.tipo || 'inamovible'
            }));
          }
        }
      } catch (e1) {
        console.warn("nolaborables.com.ar no respondió, utilizando calendario oficial...", e1);
      }
    }

    // 3. Fallback de contingencia oficial (sin clases)
    if (normalizados.length === 0) {
      normalizados = FERIADOS_OFICIALES_2026_FALLBACK;
    }

    feriadosCargados2026 = normalizados;
    renderizarComponenteFeriados(mesFeriadosSeleccionado);

    if (forzar && typeof mostrarToast === 'function') {
      mostrarToast('Calendario de feriados 2026 sincronizado con éxito.', 'success');
    }
  } catch (error) {
    console.error("Error al cargar feriados:", error);
    feriadosCargados2026 = FERIADOS_OFICIALES_2026_FALLBACK;
    renderizarComponenteFeriados(mesFeriadosSeleccionado);
  }
}

function cambiarMesFeriados(nuevoMes) {
  mesFeriadosSeleccionado = String(nuevoMes);

  // Sincronizar selectores en ambos paneles
  const selPreceptor = document.getElementById('selectMesFeriadosPreceptor');
  const selTutor = document.getElementById('selectMesFeriadosTutor');
  if (selPreceptor) selPreceptor.value = mesFeriadosSeleccionado;
  if (selTutor) selTutor.value = mesFeriadosSeleccionado;

  renderizarComponenteFeriados(mesFeriadosSeleccionado);
}

function renderizarComponenteFeriados(mesFiltro) {
  const listaPreceptor = document.getElementById('listaFeriadosPreceptor');
  const listaTutor = document.getElementById('listaFeriadosTutor');
  if (!listaPreceptor && !listaTutor) return;

  const pad = (n) => String(n).padStart(2, '0');

  let htmlContenido = '';

  if (mesFiltro === 'todos') {
    // Agrupado por mes para todo el ciclo lectivo
    let htmlGrupos = [];
    for (let m = 1; m <= 12; m++) {
      const feriadosDelMes = feriadosCargados2026.filter(f => f.mes === m);
      if (feriadosDelMes.length > 0) {
        const chips = feriadosDelMes.map(f => `
          <div class="feriado-chip">
            <span class="feriado-chip-fecha">${pad(f.dia)}/${pad(f.mes)}</span>
            <span class="feriado-chip-nombre">${f.motivo}</span>
            <span class="feriado-chip-badge ${f.tipo || ''}">${obtenerEtiquetaTipoFeriado(f.tipo)}</span>
          </div>
        `).join('');

        htmlGrupos.push(`
          <div style="width: 100%; margin-bottom: 0.5rem;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #38bdf8; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <i class="fa-solid fa-calendar-day"></i> ${NOMBRES_MESES_OFICIALES[m]} 2026
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">${chips}</div>
          </div>
        `);
      }
    }
    htmlContenido = htmlGrupos.length > 0
      ? htmlGrupos.join('')
      : `<div style="color: #94a3b8; font-size: 0.8rem;">No hay feriados cargados.</div>`;
  } else {
    // Mes individual (ej: Octubre)
    const m = Number(mesFiltro);
    const nombreMes = NOMBRES_MESES_OFICIALES[m] || 'Mes Seleccionado';
    const feriadosDelMes = feriadosCargados2026.filter(f => f.mes === m);

    if (feriadosDelMes.length > 0) {
      htmlContenido = feriadosDelMes.map(f => `
        <div class="feriado-chip">
          <span class="feriado-chip-fecha">${pad(f.dia)}/${pad(f.mes)}</span>
          <span class="feriado-chip-nombre">${f.motivo}</span>
          <span class="feriado-chip-badge ${f.tipo || ''}">${obtenerEtiquetaTipoFeriado(f.tipo)}</span>
        </div>
      `).join('');
    } else {
      htmlContenido = `
        <div style="color: #94a3b8; font-size: 0.82rem; padding: 0.35rem 0; display: flex; align-items: center; gap: 0.45rem;">
          <i class="fa-solid fa-circle-check text-green"></i>
          <span>No se registran feriados nacionales ni días no laborables en <strong>${nombreMes}</strong>. Días hábiles habituales de cursada.</span>
        </div>
      `;
    }
  }

  if (listaPreceptor) listaPreceptor.innerHTML = htmlContenido;
  if (listaTutor) listaTutor.innerHTML = htmlContenido;

  // Asegurar que los selects reflejen el mes seleccionado
  const selPreceptor = document.getElementById('selectMesFeriadosPreceptor');
  const selTutor = document.getElementById('selectMesFeriadosTutor');
  if (selPreceptor && selPreceptor.value !== String(mesFiltro)) selPreceptor.value = String(mesFiltro);
  if (selTutor && selTutor.value !== String(mesFiltro)) selTutor.value = String(mesFiltro);
}


function avisarFeriadosDelMes(forzar = false) {
  cargarFeriadosAPI(forzar);
}

function actualizarFeriadosDesdeAPI(forzar = true) {
  cargarFeriadosAPI(forzar);
}

// Inicialización automática al cargar el documento
document.addEventListener('DOMContentLoaded', () => {
  cargarFeriadosAPI(false);
});

// Limpieza permanente de fragmentos hash (#) en la URL
window.addEventListener('hashchange', () => {
  if (window.location.hash) {
    try {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    } catch (e) {}
  }
});

