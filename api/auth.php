<?php

require_once __DIR__ . "/config.php";
require_once __DIR__ . "/conexion.php";
require_once __DIR__ . "/servicios.php";

function buscarEstudianteAuth(PDO $conexion, string $whereSql, array $params = []): ?array {
    $sql = "SELECT e.id, e.dni, e.nombre, e.apellido, e.jurisdiccion, e.id_institucion,
                   e.curso, e.seccion, e.nombre_tutor,
                   COALESCE(NULLIF(e.clave_acceso, ''), RIGHT(e.dni, 4)) AS clave_acceso,
                   e.email_estudiante, e.email_tutor, e.dni_tutor,
                   COALESCE(
                       i.nombre,
                       CASE WHEN e.id_institucion = 2 THEN 'E.E.S. N° 5' ELSE 'EPES N° 19 Vuelta de Obligado' END
                   ) AS nombre_institucion
            FROM estudiantes e
            LEFT JOIN instituciones i ON i.id = e.id_institucion
            WHERE $whereSql
            LIMIT 1";
    $stmt = $conexion->prepare($sql);
    $stmt->execute($params);
    $fila = $stmt->fetch(PDO::FETCH_ASSOC);
    return $fila ?: null;
}

function obtenerEstudiantePlantillaGoogle(PDO $conexion, int $idInstitucionPref = 0): array {
    if ($idInstitucionPref > 0) {
        $fila = buscarEstudianteAuth($conexion, "e.id_institucion = ?", [$idInstitucionPref]);
        if ($fila) {
            return formatearHijoTutor($fila);
        }
    }

    $filaDefecto = buscarEstudianteAuth($conexion, "e.dni = ?", ["48763736"]);
    if ($filaDefecto) {
        return formatearHijoTutor($filaDefecto);
    }

    $filaCualquiera = buscarEstudianteAuth($conexion, "1 = 1 ORDER BY e.id ASC");
    if ($filaCualquiera) {
        return formatearHijoTutor($filaCualquiera);
    }

    return [
        "id" => 0,
        "dni" => "48763736",
        "nombre" => "Estudiante",
        "apellido" => "Invitado",
        "nombre_completo" => "Estudiante Invitado",
        "curso" => "4°",
        "seccion" => "Única",
        "jurisdiccion" => "pba",
        "id_institucion" => 2,
        "institucion" => "E.E.S. N° 5",
        "nombre_tutor" => "Sin tutor asignado",
        "email_tutor" => "",
        "dni_tutor" => "",
        "email_estudiante" => "",
        "clave_acceso" => "3736"
    ];
}

function emitirRespuestaAuth(array $usuarioData, ?array $hijo = null, string $mensaje = "Sesión iniciada con éxito"): void {
    $tokenPayload = [
        "sub" => $usuarioData["id"],
        "nombre" => $usuarioData["nombre"],
        "email" => $usuarioData["email"],
        "rol" => $usuarioData["rol"]
    ];
    if (!empty($usuarioData["alumno_dni"])) {
        $tokenPayload["alumno_dni"] = $usuarioData["alumno_dni"];
    }
    if (!empty($usuarioData["id_institucion"])) {
        $tokenPayload["id_institucion"] = (int)$usuarioData["id_institucion"];
    }

    $token = generarJwt($tokenPayload, 2592000);

    $respuesta = [
        "ok" => true,
        "mensaje" => $mensaje,
        "token" => $token,
        "tipo" => "Bearer",
        "usuario" => $usuarioData
    ];
    if ($hijo !== null) {
        $respuesta["hijo"] = $hijo;
    }
    responder(200, $respuesta);
}

$metodo = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($metodo === "POST") {
    asegurarColumnasAccesoEstudiantes($conexion);

    $datos = leerJsonBody();

    $emailOUser = trim((string)($datos["email"] ?? ($datos["usuario"] ?? "")));
    $password = trim((string)($datos["password"] ?? ($datos["clave"] ?? "")));
    $rolSolicitado = strtolower(trim((string)($datos["rol"] ?? "")));
    $rolNorm = $rolSolicitado;
    if ($rolNorm === "padre") {
        $rolNorm = "tutor";
    } elseif ($rolNorm === "alumno") {
        $rolNorm = "estudiante";
    }
    $metodoAuth = strtolower(trim((string)($datos["metodo"] ?? "credenciales")));
    $nombreEnviado = trim((string)($datos["nombre"] ?? ""));
    $idInstitucionPref = isset($datos["id_institucion"]) ? (int)$datos["id_institucion"] : 0;
    $emailLower = strtolower($emailOUser);

    $passwordsPreceptor = array_values(array_unique(array_filter([
        getenv("PRECEPTOR_PASS") ?: null,
        getenv("PRECEPTOR_PASSWORD") ?: null,
        "admin123"
    ])));

    $usuariosStaff = [
        "preceptor" => [
            "id" => 1,
            "nombre" => "Prof. Daniel Martínez",
            "email" => "preceptor@escuela.edu.ar",
            "rol" => "preceptor",
            "aliases" => ["preceptor@escuela.edu.ar"],
            "passwords" => $passwordsPreceptor
        ]
    ];

    $rolesStaff = ["preceptor", "docente", "administrador", "admin"];

    // 1. ACCESO CON GOOGLE (Abierto para pruebas como Estudiante con datos reales de Gmail,
    //    o reconocimiento automático 1-a-1 si el correo pertenece a un Tutor en el padrón)
    if ($metodoAuth === "google" || $metodoAuth === "google_real") {
        if ($emailOUser === "") {
            responder(400, [
                "error" => "Se requiere el correo de la cuenta de Google.",
                "codigo" => "AUTH_GOOGLE_EMAIL_REQUERIDO"
            ]);
        }

        $esCorreoStaff = false;
        foreach ($usuariosStaff as $st) {
            if (in_array($emailLower, $st["aliases"], true)) {
                $esCorreoStaff = true;
                break;
            }
        }
        if (in_array($rolNorm, $rolesStaff, true) || $esCorreoStaff) {
            responder(403, [
                "error" => "El acceso institucional (Preceptor/Docente) requiere correo y contraseña institucional.",
                "codigo" => "AUTH_GOOGLE_STAFF_BLOQUEADO"
            ]);
        }

        // Verificar si el correo de Google pertenece a un Tutor (relación estricta 1 Tutor -> 1 Estudiante)
        $filaHijo = buscarEstudianteAuth($conexion, "LOWER(COALESCE(e.email_tutor, '')) = ?", [$emailLower]);
        if ($filaHijo) {
            $hijo = formatearHijoTutor($filaHijo);
            $nombreTutor = $nombreEnviado !== "" ? $nombreEnviado : ($hijo["nombre_tutor"] !== "" ? $hijo["nombre_tutor"] : "Tutor/a");
            emitirRespuestaAuth([
                "id" => 1000 + (int)$hijo["id"],
                "nombre" => $nombreTutor,
                "email" => $emailOUser,
                "rol" => "tutor",
                "dni" => $hijo["dni_tutor"],
                "alumno_dni" => $hijo["dni"],
                "id_institucion" => $hijo["id_institucion"],
                "jurisdiccion" => $hijo["jurisdiccion"],
                "institucion" => $hijo["institucion"],
                "es_google_cuenta" => true,
                "en_padron" => true
            ], $hijo, "Tutor reconocido automáticamente");
        }

        // Acceso exclusivo de Tutores por Google: cualquier otra cuenta de Google ingresa con rol Tutor
        $plantilla = obtenerEstudiantePlantillaGoogle($conexion, $idInstitucionPref);
        $localPart = strstr($emailOUser, "@", true);
        $nombreFallback = ucwords(str_replace([".", "_", "-"], " ", $localPart !== false ? $localPart : $emailOUser));
        $nombreReal = $nombreEnviado !== "" ? $nombreEnviado : ($nombreFallback !== "" ? $nombreFallback : "Tutor Google");

        emitirRespuestaAuth([
            "id" => 9000 + (abs(crc32($emailLower)) % 90000),
            "nombre" => $nombreReal,
            "email" => $emailOUser,
            "rol" => "tutor",
            "dni" => "",
            "alumno_dni" => $plantilla["dni"],
            "id_institucion" => $plantilla["id_institucion"],
            "jurisdiccion" => $plantilla["jurisdiccion"],
            "curso" => $plantilla["curso"],
            "seccion" => $plantilla["seccion"],
            "institucion" => $plantilla["institucion"],
            "nombre_tutor" => $nombreReal,
            "es_google_cuenta" => true,
            "en_padron" => false
        ], $plantilla, "Acceso con Google habilitado como Tutor");
    }

    // 2. ATAJOS DEMO DEL PORTAL WEB
    if ($metodoAuth === "demo") {
        if ($rolNorm === "preceptor" || $emailLower === "preceptor@escuela.edu.ar") {
            $st = $usuariosStaff["preceptor"];
            emitirRespuestaAuth([
                "id" => $st["id"],
                "nombre" => $st["nombre"],
                "email" => $st["email"],
                "rol" => $st["rol"]
            ]);
        }

        if ($rolNorm === "estudiante" || $rolNorm === "alumno" || strpos($emailLower, "mateo") !== false || strpos($emailLower, "estudiante") !== false) {
            $filaEst = buscarEstudianteAuth($conexion, "e.dni = ?", ["34567890"]) ?: buscarEstudianteAuth($conexion, "1 = 1 ORDER BY e.id ASC");
            $est = $filaEst ? formatearHijoTutor($filaEst) : obtenerEstudiantePlantillaGoogle($conexion, 1);
            emitirRespuestaAuth([
                "id" => 2000 + (int)$est["id"],
                "nombre" => $est["nombre_completo"],
                "email" => $est["email_estudiante"] ?: "mateo.gomez@escuela.edu.ar",
                "rol" => "alumno",
                "dni" => $est["dni"],
                "alumno_dni" => $est["dni"],
                "id_institucion" => $est["id_institucion"],
                "jurisdiccion" => $est["jurisdiccion"],
                "curso" => $est["curso"],
                "seccion" => $est["seccion"],
                "institucion" => $est["institucion"],
                "nombre_tutor" => $est["nombre_tutor"],
                "es_google_cuenta" => false,
                "en_padron" => true
            ]);
        }

        $filaHijo = buscarEstudianteAuth($conexion, "e.dni = ?", ["34567890"]) ?: buscarEstudianteAuth($conexion, "1 = 1 ORDER BY e.id ASC");
        $hijo = $filaHijo ? formatearHijoTutor($filaHijo) : obtenerEstudiantePlantillaGoogle($conexion, 1);
        emitirRespuestaAuth([
            "id" => 1000 + (int)$hijo["id"],
            "nombre" => $nombreEnviado !== "" ? $nombreEnviado : ($hijo["nombre_tutor"] ?: "Pedro Gómez"),
            "email" => $hijo["email_tutor"] ?: "pedro@gmail.com",
            "rol" => "tutor",
            "dni" => $hijo["dni_tutor"],
            "alumno_dni" => $hijo["dni"],
            "id_institucion" => $hijo["id_institucion"],
            "jurisdiccion" => $hijo["jurisdiccion"],
            "institucion" => $hijo["institucion"],
            "es_google_cuenta" => false,
            "en_padron" => true
        ], $hijo);
    }

    if ($emailOUser === "") {
        responder(400, [
            "error" => "Debe ingresar un usuario, DNI o correo electrónico.",
            "codigo" => "AUTH_CAMPOS_REQUERIDOS"
        ]);
    }

    // 3. LOGIN DE STAFF INSTITUCIONAL (Único Preceptor/Docente: preceptor@escuela.edu.ar)
    $staffEncontrado = null;
    foreach ($usuariosStaff as $st) {
        if (in_array($emailLower, $st["aliases"], true)) {
            $staffEncontrado = $st;
            break;
        }
    }
    if (!$staffEncontrado && ($metodoAuth === "institucional" || in_array($rolNorm, $rolesStaff, true))) {
        responder(401, [
            "error" => "Usuario o contraseña institucional incorrectos.",
            "codigo" => "AUTH_STAFF_INVALIDO"
        ]);
    }

    if ($staffEncontrado) {
        if ($password === "" || !in_array($password, $staffEncontrado["passwords"], true)) {
            responder(401, [
                "error" => "Contraseña incorrecta para el usuario institucional.",
                "codigo" => "AUTH_PASSWORD_INVALIDO"
            ]);
        }

        emitirRespuestaAuth([
            "id" => $staffEncontrado["id"],
            "nombre" => $staffEncontrado["nombre"],
            "email" => $staffEncontrado["email"],
            "rol" => $staffEncontrado["rol"]
        ]);
    }

    // 4. LOGIN EXCLUSIVO DE ALUMNOS POR DNI + CLAVE (rol = alumno)
    if (preg_match('/^\d{7,8}$/', $emailOUser)) {
        if ($rolNorm === "tutor") {
            responder(401, [
                "error" => "Los tutores deben ingresar con su correo electrónico y contraseña, o con Google.",
                "codigo" => "AUTH_TUTOR_EMAIL_REQUERIDO"
            ]);
        }

        $filaEst = buscarEstudianteAuth($conexion, "e.dni = ?", [$emailOUser]);
        if ($filaEst) {
            $est = formatearHijoTutor($filaEst);
            $claveEsperada = $est["clave_acceso"] !== "" ? $est["clave_acceso"] : generarClaveInicialAlumno($est["dni"]);
            if ($password === "" || $password !== $claveEsperada) {
                responder(401, [
                    "error" => "Clave incorrecta. Recordá que tu clave inicial son los últimos 4 dígitos de tu DNI.",
                    "codigo" => "AUTH_CLAVE_ALUMNO_INVALIDA"
                ]);
            }

            emitirRespuestaAuth([
                "id" => 2000 + (int)$est["id"],
                "nombre" => $est["nombre_completo"],
                "email" => $est["email_estudiante"] !== "" ? $est["email_estudiante"] : ($est["dni"] . "@alumno.escuela.edu.ar"),
                "rol" => "alumno",
                "dni" => $est["dni"],
                "alumno_dni" => $est["dni"],
                "id_institucion" => $est["id_institucion"],
                "jurisdiccion" => $est["jurisdiccion"],
                "curso" => $est["curso"],
                "seccion" => $est["seccion"],
                "institucion" => $est["institucion"],
                "nombre_tutor" => $est["nombre_tutor"],
                "es_google_cuenta" => false,
                "en_padron" => true
            ], null, "Ingreso de alumno verificado en padrón");
        }

        responder(401, [
            "error" => "El DNI ingresado no figura en el padrón oficial de alumnos. Consultá en Preceptoría para darte de alta.",
            "codigo" => "AUTH_DNI_NO_REGISTRADO"
        ]);
    }

    // 5. LOGIN EXCLUSIVO DE TUTORES POR CORREO ELECTRÓNICO + CLAVE (tutor123)
    $filaTutorEmail = buscarEstudianteAuth($conexion, "LOWER(COALESCE(e.email_tutor, '')) = ?", [$emailLower]);
    if ($filaTutorEmail) {
        $hijo = formatearHijoTutor($filaTutorEmail);
        if ($password !== "tutor123") {
            responder(401, [
                "error" => "Contraseña incorrecta para la cuenta de Tutor.",
                "codigo" => "AUTH_PASSWORD_INVALIDO"
            ]);
        }

        emitirRespuestaAuth([
            "id" => 1000 + (int)$hijo["id"],
            "nombre" => $hijo["nombre_tutor"] !== "" ? $hijo["nombre_tutor"] : "Tutor/a Responsable",
            "email" => $hijo["email_tutor"] !== "" ? $hijo["email_tutor"] : $emailOUser,
            "rol" => "tutor",
            "dni" => $hijo["dni_tutor"],
            "alumno_dni" => $hijo["dni"],
            "id_institucion" => $hijo["id_institucion"],
            "jurisdiccion" => $hijo["jurisdiccion"],
            "institucion" => $hijo["institucion"],
            "es_google_cuenta" => false,
            "en_padron" => true
        ], $hijo, "Tutor autenticado");
    }

    // Los alumnos NO ingresan manualmente por correo electrónico (solo DNI + clave)
    $filaEstEmail = buscarEstudianteAuth($conexion, "LOWER(COALESCE(e.email_estudiante, '')) = ?", [$emailLower]);
    if ($filaEstEmail) {
        responder(401, [
            "error" => "Los alumnos deben ingresar únicamente con su DNI y clave (sin correo electrónico).",
            "codigo" => "AUTH_ALUMNO_SOLO_DNI"
        ]);
    }

    // Registro explícito manual desde formulario web (opcional cuando aún no tiene alta de preceptor)
    if ($metodoAuth === "registro_manual") {
        $dniReg = preg_replace('/\D+/', '', (string)($datos["dni"] ?? ""));
        $filaPorDni = $dniReg !== "" ? buscarEstudianteAuth($conexion, "e.dni = ?", [$dniReg]) : null;
        $plantilla = $filaPorDni ? formatearHijoTutor($filaPorDni) : obtenerEstudiantePlantillaGoogle($conexion, $idInstitucionPref);
        $esTutorReg = ($rolNorm === "tutor");
        emitirRespuestaAuth([
            "id" => rand(3000, 9999),
            "nombre" => $nombreEnviado !== "" ? $nombreEnviado : ($esTutorReg ? "Familiar / Tutor" : "Alumno"),
            "email" => $emailOUser,
            "rol" => $esTutorReg ? "tutor" : "alumno",
            "dni" => $dniReg,
            "alumno_dni" => $plantilla["dni"],
            "id_institucion" => $plantilla["id_institucion"],
            "jurisdiccion" => $plantilla["jurisdiccion"],
            "curso" => $plantilla["curso"],
            "seccion" => $plantilla["seccion"],
            "institucion" => $plantilla["institucion"],
            "es_google_cuenta" => false,
            "en_padron" => ($filaPorDni !== null)
        ], $esTutorReg ? $plantilla : null, "Registro web completado");
    }

    responder(401, [
        "error" => "Usuario o DNI no registrado en el padrón escolar. Alumnos: DNI + clave. Tutores: correo + clave o Google.",
        "codigo" => "AUTH_NO_REGISTRADO"
    ]);
}

if ($metodo === "GET") {
    // Valida el token actual que venga en la cabecera Authorization
    $usuario = requerirAutenticacion();
    responder(200, [
        "ok" => true,
        "mensaje" => "Token válido y sesión activa",
        "usuario" => $usuario
    ]);
}

responder(405, ["error" => "Método no permitido"]);

