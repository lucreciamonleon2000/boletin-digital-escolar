<?php


require_once __DIR__ . "/config.php";

// CORS centralizado en config.php

if ($_SERVER["REQUEST_METHOD"] === "POST") {
    require_once __DIR__ . "/notas.php";
    exit;
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    header("Allow: GET, POST, OPTIONS");
    http_response_code(405);

    echo json_encode([
        "error" => "Este endpoint solo permite consultas GET o POST"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

require_once __DIR__ . "/conexion.php";

$dni = trim($_GET["dni"] ?? "");
$idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
$jurisdiccion = trim($_GET["jurisdiccion"] ?? "");

if ($dni === "" || !ctype_digit($dni)) {
    http_response_code(400);
    echo json_encode([
        "error" => "Ingresá un DNI válido"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Buscamos al estudiante y su institución.
    $where = ["e.dni = ?"];
    $params = [$dni];
    if ($idInstitucion !== null && $idInstitucion > 0) {
        $where[] = "e.id_institucion = ?";
        $params[] = $idInstitucion;
    } elseif ($jurisdiccion !== "") {
        $where[] = "LOWER(e.jurisdiccion) = LOWER(?)";
        $params[] = $jurisdiccion;
    }

    $sqlEstudiante = "
        SELECT
            e.*,
            i.nombre AS inst_nombre,
            i.subtitulo AS inst_subtitulo,
            i.regimen
        FROM estudiantes e
        INNER JOIN instituciones i ON e.id_institucion = i.id
        WHERE " . implode(" AND ", $where) . "
        LIMIT 1
    ";

    $consulta = $conexion->prepare($sqlEstudiante);
    $consulta->execute($params);

    $estudiante = $consulta->fetch();

    if (!$estudiante) {
        http_response_code(404);
        echo json_encode([
            "error" => "No se encontró el estudiante para esa institución/jurisdicción"
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Buscamos las materias y sus calificaciones desde la tabla notas filtradas por institución
    $sqlMaterias = "
        SELECT
            materia AS nombre_materia,
            periodo,
            nota_numerica,
            valoracion_conceptual,
            observacion
        FROM notas
        WHERE dni_estudiante = ? AND (id_institucion = ? OR id_institucion IS NULL)
    ";

    $consulta = $conexion->prepare($sqlMaterias);
    $consulta->execute([$dni, $estudiante["id_institucion"]]);
    $materias = $consulta->fetchAll();

    // Buscamos las materias pendientes filtradas por institución
    $sqlPrevias = "
        SELECT
            id,
            materia,
            materia AS nombre_materia,
            calificacion,
            estado,
            fecha,
            curso_origen,
            fecha_aprobacion
        FROM previas
        WHERE dni_estudiante = ? AND (id_institucion = ? OR id_institucion IS NULL)
    ";

    $consulta = $conexion->prepare($sqlPrevias);
    $consulta->execute([$dni, $estudiante["id_institucion"]]);
    $previas = $consulta->fetchAll();

    // Consultamos las asistencias filtradas por institución
    $sqlAsistencia = "
        SELECT
            dias_habiles AS total_clases,
            asistencias AS presentu,
            inasistencias AS ausentes_injustificados,
            justificadas AS ausentes_justificados
        FROM asistencias
        WHERE dni_estudiante = ? AND (id_institucion = ? OR id_institucion IS NULL)
    ";

    $consulta = $conexion->prepare($sqlAsistencia);
    $consulta->execute([$dni, $estudiante["id_institucion"]]);
    $asistencia = $consulta->fetch();

    if (!$asistencia) {
        $asistencia = [
            "total_clases" => 0,
            "presentu" => 0,
            "ausentes_injustificados" => 0,
            "ausentes_justificados" => 0,
            "porcentaje_asistencia" => "0%"
        ];
    }

    // Armamos los datos que necesita el frontend.
    $respuesta = [
        "jurisdiccion" => $jurisdiccion,
        "institucion" => [
            "nombre" => $estudiante["inst_nombre"],
            "subtitulo" => $estudiante["inst_subtitulo"],
            "regimen" => $estudiante["regimen"]
        ],
        "estudiante" => [
            "nombre" => $estudiante["apellido"] . ", " . $estudiante["nombre"],
            "curso" => (strpos($estudiante["curso"], '°') !== false ? $estudiante["curso"] : $estudiante["curso"] . "°") . " " . $estudiante["seccion"],
            "dni" => $estudiante["dni"],
            "tutor" => $estudiante["nombre_tutor"]
        ],
        "columnas" => [
            "periodos" => $estudiante["regimen"] === "Trimestral"
                ? ["1° Trimestre", "2° Trimestre", "3° Trimestre"]
                : ["1° Cuatrimestre", "2° Cuatrimestre"]
        ],
        "materias" => $materias,
        "bloqueInferior" => [
            "titulo" => "Materias Previas / Pendientes",
            "columnas" => [
                "Materia",
                "Calificación",
                "Estado",
                "Fecha"
            ],
            "items" => $previas
        ],
        "asistencia" => $asistencia
    ];

    http_response_code(200);
    echo json_encode($respuesta, JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    error_log("Error consultando el boletín: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "error" => "No se pudo consultar el boletín"
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    error_log("Error en boletin.php: " . $e->getMessage());

    http_response_code(500);
    echo json_encode([
        "error" => "Ocurrió un error interno al consultar el boletín"
    ], JSON_UNESCAPED_UNICODE);
}
