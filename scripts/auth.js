// SISTEMA DE AUTENTICACIÓN Y ACCESO 
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === 'true') {
    localStorage.removeItem('boletin_sesion_activa');
    localStorage.removeItem('boletin_usuario');
    mostrarToast('Has cerrado sesión correctamente.', 'info');
  } else if (urlParams.get('cambiar_perfil') === 'true') {
    mostrarToast('Ingresá nuevamente con Google para elegir tu rol o estudiante.', 'info');
  }
});

// Control del Selector de Rol en la Landing
function cambiarRolLanding(rol) {
  const btnTutor = document.getElementById('fbRoleBtnTutor');
  const btnPreceptor = document.getElementById('fbRoleBtnPreceptor');
  const boxTutor = document.getElementById('fbFormTutorBox');
  const boxPreceptor = document.getElementById('fbFormPreceptorBox');

  if (rol === 'tutor') {
    tipoRegistroActual = 'comun';
    if (btnTutor) btnTutor.classList.add('active');
    if (btnPreceptor) btnPreceptor.classList.remove('active');
    if (boxTutor) boxTutor.style.display = 'flex';
    if (boxPreceptor) boxPreceptor.style.display = 'none';
  } else {
    tipoRegistroActual = 'institucional';
    if (btnTutor) btnTutor.classList.remove('active');
    if (btnPreceptor) btnPreceptor.classList.add('active');
    if (boxTutor) boxTutor.style.display = 'none';
    if (boxPreceptor) boxPreceptor.style.display = 'flex';
  }
}

async function autenticarEnBackend(payload) {
  const res = await fetch('api/auth.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const msg = (data && data.error) ? data.error : 'No se pudo validar el acceso con el servidor.';
    throw { esErrorApi: true, status: res.status, message: msg };
  }

  return data || {};
}

function finalizarRedireccionPortal(usuario, token) {
  if (token) {
    localStorage.setItem('boletin_token', token);
  }
  localStorage.setItem('boletin_sesion_activa', 'true');
  localStorage.setItem('boletin_usuario', JSON.stringify(usuario));

  const rol = (usuario.rol || '').toLowerCase();
  let rolTexto = 'Tutor/a';
  if (rol === 'administrador' || rol === 'admin') {
    rolTexto = 'Administrador';
  } else if (rol === 'docente') {
    rolTexto = 'Docente';
  } else if (rol === 'preceptor') {
    rolTexto = 'Preceptor/a';
  } else if (rol === 'estudiante' || rol === 'alumno') {
    rolTexto = rol === 'alumno' ? 'Alumno' : 'Estudiante';
  }

  mostrarToast(`Iniciando sesión como ${usuario.nombre || 'Usuario'} (${rolTexto})...`, 'success');
  setTimeout(() => {
    window.location.href = 'portal.html';
  }, 450);
}

function combinarUsuarioConRespuesta(usuarioOriginal, dataApi) {
  const apiUser = (dataApi && dataApi.usuario) ? dataApi.usuario : {};
  const hijo = (dataApi && dataApi.hijo) ? dataApi.hijo : null;
  return {
    ...usuarioOriginal,
    ...apiUser,
    avatar: usuarioOriginal.avatar || apiUser.avatar || ((apiUser.rol === 'estudiante' || apiUser.rol === 'alumno')
      ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
      : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100'),
    alumnoDni: apiUser.alumno_dni || (hijo && hijo.dni) || apiUser.dni || usuarioOriginal.alumnoDni || '',
    id_institucion: apiUser.id_institucion || (hijo && hijo.id_institucion) || usuarioOriginal.id_institucion || 1,
    jurisdiccion: apiUser.jurisdiccion || (hijo && hijo.jurisdiccion) || usuarioOriginal.jurisdiccion || 'formosa',
    hijo: hijo || usuarioOriginal.hijo || null
  };
}

// Iniciar sesión y redirigir (validación real contra MySQL / JWT en api/auth.php)
async function ingresarAlPortal(usuario) {
  try {
    const data = await autenticarEnBackend(usuario);
    const usuarioFinal = combinarUsuarioConRespuesta(usuario, data);
    finalizarRedireccionPortal(usuarioFinal, data.token);
  } catch (err) {
    if (err && err.esErrorApi) {
      mostrarToast(err.message, 'warning');
      return;
    }
    console.warn('No se pudo contactar api/auth.php, usando modo offline local:', err);
    finalizarRedireccionPortal(usuario, null);
  }
}

// Login Familia / Alumnos desde formulario Landing
async function procesarLoginLandingTutor(e) {
  e.preventDefault();
  const input = document.getElementById('fbInputTutorUser').value.trim();
  const passEl = document.getElementById('fbInputTutorPass');
  const password = passEl ? passEl.value : '';

  if (!input) {
    mostrarToast('Ingresá tu DNI de estudiante o correo de tutor.', 'warning');
    return;
  }

  try {
    const data = await autenticarEnBackend({
      email: input,
      usuario: input,
      password: password,
      metodo: 'credenciales'
    });

    const usuarioFinal = combinarUsuarioConRespuesta({
      metodo: 'credenciales',
      avatar: (data.usuario && (data.usuario.rol === 'estudiante' || data.usuario.rol === 'alumno'))
        ? 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
        : 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100'
    }, data);

    if ((usuarioFinal.rol || '').toLowerCase() === 'tutor' && data.hijo) {
      mostrarModalHijoUnicoTutor(usuarioFinal, data.hijo, data.token);
      return;
    }

    finalizarRedireccionPortal(usuarioFinal, data.token);
  } catch (err) {
    mostrarToast((err && err.message) ? err.message : 'No se pudo verificar el ingreso.', 'warning');
  }
}

// Login Preceptor desde formulario Landing
async function procesarLoginLandingPreceptor(e) {
  e.preventDefault();
  const input = document.getElementById('fbInputPreceptorUser').value.trim();
  const passEl = document.getElementById('fbInputPreceptorPass');
  const password = passEl ? passEl.value : '';

  const usuario = {
    nombre: 'Prof. Daniel Martínez',
    email: input || 'preceptor@escuela.edu.ar',
    password: password,
    rol: 'preceptor',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
    metodo: 'institucional'
  };

  await ingresarAlPortal(usuario);
}

// Atajos Demo 1-Clic
function demoLogin(tipo) {
  if (tipo === 'preceptor') {
    ingresarAlPortal({
      nombre: 'Prof. Daniel Martínez',
      email: 'preceptor@escuela.edu.ar',
      rol: 'preceptor',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
      metodo: 'demo'
    });
  } else if (tipo === 'alumno' || tipo === 'estudiante') {
    ingresarAlPortal({
      nombre: 'Mateo Gómez',
      email: 'mateo.gomez@escuela.edu.ar',
      rol: 'alumno',
      alumnoDni: '34567890',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      metodo: 'demo'
    });
  } else {
    ingresarAlPortal({
      nombre: 'Pedro Gómez',
      email: 'pedro@gmail.com',
      rol: 'padre',
      alumnoDni: '34567890',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100',
      metodo: 'demo'
    });
  }
}

// Selector Google de respaldo / ingreso por correo Google (Exclusivo Tutor / Estudiante)
function iniciarSesionGoogle(esRegistro = false) {
  const modal = document.getElementById('modalGoogleChooser');
  if (modal) modal.style.display = 'flex';
}

function cerrarGoogleChooser() {
  const modal = document.getElementById('modalGoogleChooser');
  if (modal) modal.style.display = 'none';
}

function seleccionarCuentaGoogle(nombre, email, avatar, rol) {
  cerrarGoogleChooser();
  // Blindaje estricto de seguridad: Preceptor, Docente y Administrador NUNCA pueden ingresar vía Google
  if (rol === 'preceptor' || rol === 'docente' || rol === 'administrador' || rol === 'admin') {
    mostrarToast('Acceso institucional restringido: Preceptoría requiere correo y contraseña institucional.', 'warning');
    return;
  }
  procesarAccesoGoogle({
    displayName: nombre,
    email: email,
    photoURL: avatar
  });
}

function seleccionarCuentaGoogleCustom(e) {
  if (e) e.preventDefault();
  const emailEl = document.getElementById('googleChooserEmail');
  const nomEl = document.getElementById('googleChooserNombre');
  const email = emailEl ? emailEl.value.trim() : '';
  const nombre = nomEl ? nomEl.value.trim() : '';

  if (!email || !email.includes('@')) {
    mostrarToast('Ingresá un correo electrónico de Google válido.', 'warning');
    return;
  }
  cerrarGoogleChooser();
  procesarAccesoGoogle({
    displayName: nombre || email.split('@')[0],
    email: email,
    photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'
  });
}

// Modal de Registro: Configuración de Roles y Validación
let tipoRegistroActual = 'comun';

function configurarModalSegunTipo(tipo = 'comun') {
  tipoRegistroActual = (tipo === 'institucional' || tipo === 'preceptor' || tipo === 'docente' || tipo === 'administrador' || tipo === 'admin')
    ? 'institucional'
    : 'comun';

  const modalTitle = document.getElementById('authModalTitle');
  const modalSubtitle = document.getElementById('authModalSubtitle');
  const googleGuide = document.getElementById('authGoogleGuide');
  const sectionTag = document.getElementById('authSectionTag');
  const sectionDesc = document.getElementById('authSectionDesc');
  const selRol = document.getElementById('regRolSelect');
  const boxPin = document.getElementById('boxRegCodigoPreceptor');
  const btnSubmit = document.getElementById('btnAuthSubmit');
  const btnSubmitText = document.getElementById('btnAuthSubmitText');
  const btnSubmitIcon = document.getElementById('btnAuthSubmitIcon');
  const btnGoogle = document.getElementById('btnGoogleRegister');
  const socialBadge = document.getElementById('authSocialBadge');
  const socialPerks = document.getElementById('authSocialPerks');

  if (tipoRegistroActual === 'institucional') {
    if (modalTitle) modalTitle.textContent = 'Solicitud de Alta Institucional';
    if (modalSubtitle) modalSubtitle.textContent = 'Sistema de Boletín Digital • Registro Oficial de Personal Escolar';

    // Ocultar botón de Google en el alta institucional
    if (btnGoogle) btnGoogle.style.display = 'none';

    if (socialBadge) {
      socialBadge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Seguridad Institucional';
      socialBadge.style.background = 'rgba(251, 191, 36, 0.15)';
      socialBadge.style.color = '#fbbf24';
      socialBadge.style.borderColor = 'rgba(251, 191, 36, 0.3)';
    }

    if (googleGuide) {
      googleGuide.innerHTML = 'El registro mediante Google está <strong>exclusivamente habilitado para Tutores y Estudiantes</strong>.<br><br>Por seguridad escolar, el personal institucional debe registrarse obligatoriamente mediante este formulario con validación de PIN escolar.';
    }

    if (socialPerks) {
      socialPerks.innerHTML = `
        <div class="perk-item">
          <i class="fa-solid fa-lock" style="color: #fbbf24;"></i>
          <span>Exclusivo formulario con clave PIN</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-user-shield" style="color: #fbbf24;"></i>
          <span>Protección contra accesos no autorizados</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-ban" style="color: #f87171;"></i>
          <span>Google deshabilitado para Preceptoría</span>
        </div>
      `;
    }

    if (sectionTag) {
      sectionTag.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Formulario de Alta Institucional';
      sectionTag.style.background = 'rgba(251, 191, 36, 0.12)';
      sectionTag.style.color = '#fbbf24';
      sectionTag.style.borderColor = 'rgba(251, 191, 36, 0.3)';
    }
    if (sectionDesc) sectionDesc.textContent = 'Habilitación oficial para directivos, preceptoría y docentes';

    if (selRol) {
      selRol.innerHTML = `
        <option value="administrador">Administrador</option>
        <option value="preceptor" selected>Preceptor/a</option>
        <option value="docente">Docente</option>
      `;
    }

    if (boxPin) boxPin.style.display = 'block';

    if (btnSubmit) {
      btnSubmit.className = 'btn-auth-submit btn-preceptor';
    }
    if (btnSubmitIcon) {
      btnSubmitIcon.className = 'fa-solid fa-shield-halved';
    }
    if (btnSubmitText) {
      btnSubmitText.textContent = 'Validar PIN y Solicitar Alta';
    }
  } else {
    // Cuentas comunes: estrictamente Estudiante y Tutor/a
    if (modalTitle) modalTitle.textContent = 'Registrarse en el Portal Escolar';
    if (modalSubtitle) modalSubtitle.textContent = 'Sistema de Boletín Digital • Registro Oficial de Nuevo Usuario';

    // Mostrar botón de Google para familias y alumnos
    if (btnGoogle) btnGoogle.style.display = 'inline-flex';

    if (socialBadge) {
      socialBadge.innerHTML = '<i class="fa-solid fa-bolt"></i> Acceso Rápido';
      socialBadge.style.background = 'rgba(56, 189, 248, 0.12)';
      socialBadge.style.color = '#38bdf8';
      socialBadge.style.borderColor = 'rgba(56, 189, 248, 0.25)';
    }

    if (googleGuide) {
      googleGuide.innerHTML = '¿Tenés cuenta de Google? Creá o vinculá tu perfil de <strong>Tutor o Estudiante</strong> en un solo clic, sin contraseñas adicionales:';
    }

    if (socialPerks) {
      socialPerks.innerHTML = `
        <div class="perk-item">
          <i class="fa-solid fa-circle-check"></i>
          <span>Sincronización oficial inmediata</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-circle-check"></i>
          <span>Sin recordar nuevas claves</span>
        </div>
        <div class="perk-item">
          <i class="fa-solid fa-circle-check"></i>
          <span>Exclusivo para Tutor y Alumno</span>
        </div>
      `;
    }

    if (sectionTag) {
      sectionTag.innerHTML = '<i class="fa-solid fa-user-pen"></i> Formulario de Familias y Alumnos';
      sectionTag.style.background = 'rgba(56, 189, 248, 0.1)';
      sectionTag.style.color = '#38bdf8';
      sectionTag.style.borderColor = 'rgba(56, 189, 248, 0.25)';
    }
    if (sectionDesc) sectionDesc.textContent = 'Ingresá tus datos para el legajo y seguimiento escolar digital';

    if (selRol) {
      selRol.innerHTML = `
        <option value="estudiante">Estudiante</option>
        <option value="padre" selected>Tutor/a</option>
      `;
    }

    if (boxPin) boxPin.style.display = 'none';

    if (btnSubmit) {
      btnSubmit.className = 'btn-auth-submit btn-tutor';
    }
    if (btnSubmitIcon) {
      btnSubmitIcon.className = 'fa-solid fa-user-check';
    }
    if (btnSubmitText) {
      btnSubmitText.textContent = 'Crear Cuenta y Acceder al Portal';
    }
  }
}

function abrirModalAuth(arg1 = 'comun', arg2 = null) {
  const modal = document.getElementById('modalAuth');
  if (modal) modal.style.display = 'flex';

  let tipo = 'comun';
  let rolTarget = null;

  if (arg1 === 'institucional' || arg1 === 'preceptor' || arg1 === 'docente' || arg1 === 'administrador' ||
    arg2 === 'institucional' || arg2 === 'preceptor' || arg2 === 'docente' || arg2 === 'administrador') {
    tipo = 'institucional';
    rolTarget = (arg1 !== 'institucional' && arg1 !== 'register' && arg1) ? arg1 : (arg2 || 'preceptor');
  } else {
    tipo = 'comun';
    rolTarget = (arg1 === 'estudiante' || arg2 === 'estudiante' || arg1 === 'alumno' || arg2 === 'alumno') ? 'estudiante' : 'padre';
  }

  configurarModalSegunTipo(tipo);

  const sel = document.getElementById('regRolSelect');
  if (sel && rolTarget) {
    sel.value = rolTarget;
  }
  alCambiarRolRegistro();
}

function cerrarModalAuth() {
  const modal = document.getElementById('modalAuth');
  if (modal) modal.style.display = 'none';
  tipoRegistroActual = 'comun';
}

function alCambiarRolRegistro() {
  const sel = document.getElementById('regRolSelect');
  const boxPin = document.getElementById('boxRegCodigoPreceptor');
  if (!sel || !boxPin) return;

  const rolesInstitucionales = ['preceptor', 'docente', 'administrador', 'admin'];
  if (rolesInstitucionales.includes(sel.value)) {
    boxPin.style.display = 'block';
  } else {
    boxPin.style.display = 'none';
  }
}

function procesarRegistro(e) {
  e.preventDefault();
  const nombre = document.getElementById('regNombre').value.trim();
  const dni = document.getElementById('regDni').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const rol = document.getElementById('regRolSelect').value;
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  const pinInput = document.getElementById('regCodigoPreceptor');
  const codigoPreceptor = pinInput ? pinInput.value.trim().toUpperCase() : '';

  if (!/^\d{8}$/.test(dni)) {
    mostrarToast('El DNI debe tener exactamente 8 dígitos numéricos.', 'warning');
    return;
  }

  if (pass !== passConfirm) {
    mostrarToast('Las contraseñas no coinciden. Por favor verificá.', 'warning');
    return;
  }

  const rolesInstitucionales = ['preceptor', 'docente', 'administrador', 'admin'];
  const esInstitucional = rolesInstitucionales.includes(rol);

  if (esInstitucional) {
    if (codigoPreceptor !== 'DOCENTE2026' && codigoPreceptor.length < 4) {
      mostrarToast('Código PIN institucional incorrecto (Código demo: DOCENTE2026)', 'warning');
      return;
    }
  }

  let avatar = null;
  if (rol === 'administrador' || rol === 'admin') {
    avatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
  } else if (rol === 'docente') {
    avatar = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100';
  } else if (rol === 'preceptor') {
    avatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100';
  } else if (rol === 'estudiante') {
    avatar = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
  } else {
    avatar = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
  }

  ingresarAlPortal({
    nombre,
    dni,
    email,
    password: pass,
    rol,
    codigo_preceptor: codigoPreceptor,
    avatar,
    metodo: 'registro_manual'
  });
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

// RECONOCIMIENTO 1-A-1 DE TUTOR / ACCESO ABIERTO DE ESTUDIANTE CON GOOGLE
let sesionTutorPendiente = null;

// Procesa el acceso cuando Google Auth devuelve el usuario autenticado
async function procesarAccesoGoogle(user) {
  if (!user || !user.email) {
    mostrarToast('No se recibió el correo de la cuenta de Google.', 'warning');
    return;
  }

  const baseUsuario = {
    nombre: user.displayName || user.email.split('@')[0],
    email: user.email,
    avatar: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
    metodo: 'google'
  };

  try {
    const data = await autenticarEnBackend({
      email: user.email,
      nombre: user.displayName || '',
      metodo: 'google'
    });

    const usuarioFinal = combinarUsuarioConRespuesta(baseUsuario, data);

    // Si Google corresponde a un Tutor vinculado 1-a-1, mostrar tarjeta de su hijo/a para ingresar
    if ((usuarioFinal.rol || '').toLowerCase() === 'tutor' && data.hijo) {
      mostrarModalHijoUnicoTutor(usuarioFinal, data.hijo, data.token);
      return;
    }

    // Cualquier otro Gmail (ej. docente probando) ingresa directo como Estudiante con su perfil de Google
    finalizarRedireccionPortal(usuarioFinal, data.token);
  } catch (err) {
    if (err && err.esErrorApi) {
      mostrarToast(err.message, 'warning');
      return;
    }

    // Respaldo offline limpio si el servidor PHP no responde
    const emailLower = user.email.toLowerCase().trim();
    if (emailLower === 'cristian@gmail.com' || emailLower.includes('cristian.pleininger')) {
      mostrarModalHijoUnicoTutor(
        { ...baseUsuario, rol: 'tutor', es_google_cuenta: true, alumnoDni: '48763736', id_institucion: 2, jurisdiccion: 'pba' },
        { dni: '48763736', nombre_completo: 'Uriel Luciano Pleininger', curso: '4°', seccion: 'Única', institucion: 'E.E.S. N° 5 (Buenos Aires)' },
        null
      );
      return;
    }
    if (emailLower === 'pedro@gmail.com' || emailLower.includes('pedro.gomez')) {
      mostrarModalHijoUnicoTutor(
        { ...baseUsuario, rol: 'tutor', es_google_cuenta: true, alumnoDni: '34567890', id_institucion: 1, jurisdiccion: 'formosa' },
        { dni: '34567890', nombre_completo: 'Mateo Gómez', curso: '2°', seccion: 'III', institucion: 'EPES N° 19 Vuelta de Obligado' },
        null
      );
      return;
    }

    mostrarModalHijoUnicoTutor(
      { ...baseUsuario, rol: 'tutor', es_google_cuenta: true, alumnoDni: '48763736', id_institucion: 2, jurisdiccion: 'pba' },
      { dni: '48763736', nombre_completo: 'Uriel Luciano Pleininger', curso: '4°', seccion: 'Única', institucion: 'E.E.S. N° 5 (Buenos Aires)' },
      null
    );
  }
}

function mostrarModalHijoUnicoTutor(usuarioTutor, hijo, token) {
  sesionTutorPendiente = { usuario: usuarioTutor, hijo: hijo, token: token };

  const modal = document.getElementById('modalGoogleRol');
  const avatar = document.getElementById('googleModalAvatar');
  const nombre = document.getElementById('googleModalNombre');
  const email = document.getElementById('googleModalEmail');

  if (avatar) avatar.src = usuarioTutor.avatar || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100';
  if (nombre) nombre.textContent = usuarioTutor.nombre || 'Tutor/a Responsable';
  if (email) email.textContent = usuarioTutor.email || 'tutor@escuela.edu.ar';

  const nombreHijo = hijo.nombre_completo || `${hijo.nombre || ''} ${hijo.apellido || ''}`.trim() || 'Estudiante vinculado';
  const nomEl = document.getElementById('hijoUnicoNombre');
  const metaEl = document.getElementById('hijoUnicoMeta');
  const escEl = document.getElementById('hijoUnicoEscuela');
  const btnLbl = document.getElementById('labelNombreHijoBtn');

  if (nomEl) nomEl.textContent = nombreHijo;
  if (metaEl) metaEl.textContent = `DNI ${hijo.dni || '-'} • ${(hijo.curso || '')} ${(hijo.seccion || '')}`.trim();
  if (escEl) escEl.textContent = hijo.institucion || (Number(hijo.id_institucion) === 2 ? 'E.E.S. N° 5 (Buenos Aires)' : 'EPES N° 19 Vuelta de Obligado');
  if (btnLbl) btnLbl.textContent = nombreHijo;

  if (modal) modal.style.display = 'flex';
}

function cerrarModalGoogleRol() {
  sesionTutorPendiente = null;
  const modal = document.getElementById('modalGoogleRol');
  if (modal) modal.style.display = 'none';
}

function confirmarIngresoTutorGoogle() {
  if (!sesionTutorPendiente || !sesionTutorPendiente.usuario) {
    mostrarToast('No se encontró un estudiante vinculado.', 'warning');
    return;
  }
  const { usuario, hijo, token } = sesionTutorPendiente;
  const usuarioConfirmado = {
    ...usuario,
    rol: 'tutor',
    alumnoDni: hijo.dni || usuario.alumnoDni,
    alumnoNombre: hijo.nombre_completo || '',
    id_institucion: hijo.id_institucion || usuario.id_institucion,
    jurisdiccion: hijo.jurisdiccion || usuario.jurisdiccion
  };
  cerrarModalGoogleRol();
  finalizarRedireccionPortal(usuarioConfirmado, token);
}

