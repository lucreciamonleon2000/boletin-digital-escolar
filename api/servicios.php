
<?php


require_once __DIR__ . "/config.php";

/**
 * Envía un aviso por correo.
 * Si el servicio falla, devuelve un estado de error
 * para que la operación principal pueda continuar.
 */
function enviarCorreoAviso(string $asunto, string $mensaje): array {
    if (RESEND_API_KEY === "" || EMAIL_AVISOS === "") {
        error_log("Correo no enviado: falta configurar Resend o EMAIL_AVISOS");
        return ["status" => "simulado"];
    }

    if (!function_exists("curl_init")) {
        error_log("No está habilitada la extensión cURL");
        return ["status" => "error"];
    }

    $datos = [
        "from" => "Boletin Digital <onboarding@resend.dev>",
        "to" => [EMAIL_AVISOS],
        "subject" => $asunto,
        "html" => "<p>" .
            nl2br(htmlspecialchars($mensaje, ENT_QUOTES, "UTF-8")) .
            "</p>"
    ];

    $ch = curl_init("https://api.resend.com/emails");

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($datos),
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . RESEND_API_KEY,
            "Content-Type: application/json"
        ],
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_TIMEOUT => 5
    ]);

    $respuesta = curl_exec($ch);
    $codigoHTTP = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);

    curl_close($ch);

    if ($respuesta === false) {
        error_log("Error al enviar correo con Resend: " . $error);
        return ["status" => "error"];
    }

    if ($codigoHTTP < 200 || $codigoHTTP >= 300) {
        error_log("Resend respondió con el código HTTP " . $codigoHTTP);
        return ["status" => "error"];
    }

    return ["status" => "enviado"];
}

/**
 * Garantiza que la tabla estudiantes cuente con las columnas de acceso
 * (clave_acceso, email_estudiante, email_tutor, dni_tutor) e inicializa
 * valores por defecto seguros sin romper instalaciones existentes.
 */
function asegurarColumnasAccesoEstudiantes(PDO $conexion): void {
    static $verificado = false;
    if ($verificado) {
        return;
    }
    $verificado = true;

    try {
        $colsStmt = $conexion->query("SHOW COLUMNS FROM estudiantes");
        $columnasExistentes = [];
        foreach ($colsStmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
            if (isset($col["Field"])) {
                $columnasExistentes[strtolower($col["Field"])] = true;
            }
        }

        $columnasRequeridas = [
            "clave_acceso" => "VARCHAR(50) DEFAULT NULL",
            "email_estudiante" => "VARCHAR(120) DEFAULT NULL",
            "email_tutor" => "VARCHAR(120) DEFAULT NULL",
            "dni_tutor" => "VARCHAR(20) DEFAULT NULL"
        ];

        $huboCambio = false;
        foreach ($columnasRequeridas as $nombreCol => $definicion) {
            if (!isset($columnasExistentes[$nombreCol])) {
                $conexion->exec("ALTER TABLE estudiantes ADD COLUMN `$nombreCol` $definicion");
                $huboCambio = true;
            }
        }

        // Inicializar claves provisorias faltantes (últimos 4 dígitos del DNI)
        $conexion->exec(
            "UPDATE estudiantes
             SET clave_acceso = RIGHT(dni, 4)
             WHERE (clave_acceso IS NULL OR clave_acceso = '')
               AND dni IS NOT NULL
               AND CHAR_LENGTH(dni) >= 4"
        );

        // Vínculos 1-a-1 de prueba para los registros base (incluye migración desde correos semilla previos)
        $semillas = [
            ["34567890", "mateo.gomez@escuela.edu.ar", "pedro@gmail.com", "pedro.gomez@gmail.com", "24567890"],
            ["48763736", "uriel.pleininger@escuela.edu.ar", "cristian@gmail.com", "cristian.pleininger@gmail.com", "28763736"]
        ];
        $stmtSemilla = $conexion->prepare(
            "UPDATE estudiantes
             SET email_estudiante = COALESCE(NULLIF(email_estudiante, ''), ?),
                 email_tutor = CASE
                     WHEN email_tutor IS NULL OR email_tutor = '' OR LOWER(email_tutor) = ? THEN ?
                     ELSE email_tutor
                 END,
                 dni_tutor = COALESCE(NULLIF(dni_tutor, ''), ?)
             WHERE dni = ?"
        );
        foreach ($semillas as $s) {
            $stmtSemilla->execute([$s[1], $s[3], $s[2], $s[4], $s[0]]);
        }
    } catch (Throwable $e) {
        error_log("No se pudo verificar columnas de acceso en estudiantes: " . $e->getMessage());
    }
}

/**
 * Calcula la clave inicial provisoria del estudiante (por defecto los últimos 4 dígitos del DNI).
 */
function generarClaveInicialAlumno(string $dni, ?string $claveIngresada = null): string {
    $clave = trim((string)($claveIngresada ?? ""));
    if ($clave !== "") {
        return $clave;
    }
    $dniLimpio = preg_replace('/\D+/', '', $dni);
    if (strlen($dniLimpio) >= 4) {
        return substr($dniLimpio, -4);
    }
    return $dniLimpio !== "" ? $dniLimpio : "1234";
}

/**
 * Normaliza la estructura de un estudiante/hijo vinculado para respuestas de auth.php.
 */
function formatearHijoTutor(array $fila): array {
    $nombre = trim((string)($fila["nombre"] ?? ""));
    $apellido = trim((string)($fila["apellido"] ?? ""));
    $nombreCompleto = trim($nombre . " " . $apellido);
    $dni = trim((string)($fila["dni"] ?? ""));
    $idInst = (int)($fila["id_institucion"] ?? 1);
    $institucion = trim((string)($fila["nombre_institucion"] ?? ""));
    if ($institucion === "") {
        $institucion = ($idInst === 2) ? "E.E.S. N° 5" : "EPES N° 19 Vuelta de Obligado";
    }
    return [
        "id" => (int)($fila["id"] ?? 0),
        "dni" => $dni,
        "nombre" => $nombre,
        "apellido" => $apellido,
        "nombre_completo" => $nombreCompleto,
        "curso" => trim((string)($fila["curso"] ?? "")),
        "seccion" => trim((string)($fila["seccion"] ?? "")),
        "jurisdiccion" => trim((string)($fila["jurisdiccion"] ?? ($idInst === 2 ? "pba" : "formosa"))),
        "id_institucion" => $idInst,
        "institucion" => $institucion,
        "nombre_tutor" => trim((string)($fila["nombre_tutor"] ?? "")),
        "email_tutor" => trim((string)($fila["email_tutor"] ?? "")),
        "dni_tutor" => trim((string)($fila["dni_tutor"] ?? "")),
        "email_estudiante" => trim((string)($fila["email_estudiante"] ?? "")),
        "clave_acceso" => trim((string)($fila["clave_acceso"] ?? generarClaveInicialAlumno($dni)))
    ];
}

// Si el script es consultado directamente por HTTP 
if (basename($_SERVER["SCRIPT_FILENAME"] ?? "") === "servicios.php") {
    header("Content-Type: application/json; charset=UTF-8");
    $configurado = (defined("RESEND_API_KEY") && RESEND_API_KEY !== "" && defined("EMAIL_AVISOS") && EMAIL_AVISOS !== "");
    echo json_encode([
        "servicio" => "Resend Cloud API (Envío de Mails)",
        "estado" => $configurado ? "activo" : "simulado_sin_clave",
        "degradacion_elegante" => true,
        "descripcion" => "Servicio backend para avisos automáticos a tutores ante altas y novedades académicas.",
        "integrado_en" => "api/alumnos.php (POST)",
        "email_avisos" => (defined("EMAIL_AVISOS") && EMAIL_AVISOS !== "") ? EMAIL_AVISOS : "No configurado (modo simulado local)"
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

