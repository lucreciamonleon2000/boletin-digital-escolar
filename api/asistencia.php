<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");



if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/conexion.php";

// Helpers modulares provistos por conexion.php -> config.php (responder, leerJsonBody)

function normalizarPeriodoAsistencia($periodo) {
    if (!$periodo) return "1° Trimestre";
    $p = mb_strtolower(trim($periodo), "UTF-8");
    if (preg_match('/^t?1/i', $p) || strpos($p, '1') !== false) {
        if (strpos($p, 'cuat') !== false || strpos($p, 'c1') !== false) return "1° Cuatrimestre";
        return "1° Trimestre";
    }
    if (preg_match('/^t?2/i', $p) || strpos($p, '2') !== false) {
        if (strpos($p, 'cuat') !== false || strpos($p, 'c2') !== false) return "2° Cuatrimestre";
        return "2° Trimestre";
    }
    if (preg_match('/^t?3/i', $p) || strpos($p, '3') !== false) {
        return "3° Trimestre";
    }
    if (strpos($p, 'c1') !== false) return "1° Cuatrimestre";
    if (strpos($p, 'c2') !== false) return "2° Cuatrimestre";
    return trim($periodo);
}

function obtenerEquivalentesPeriodoAsistencia($periodoCanonico) {
    $norm = normalizarPeriodoAsistencia($periodoCanonico);
    switch ($norm) {
        case "1° Trimestre":
            return ["1° Trimestre", "1 Trimestre", "1er Trimestre", "1er trimestre", "1° trimestre", "t1", "T1", "1"];
        case "2° Trimestre":
            return ["2° Trimestre", "2 Trimestre", "2do Trimestre", "2do trimestre", "2° trimestre", "t2", "T2", "2"];
        case "3° Trimestre":
            return ["3° Trimestre", "3 Trimestre", "3er Trimestre", "3er trimestre", "3° trimestre", "t3", "T3", "3"];
        case "1° Cuatrimestre":
            return ["1° Cuatrimestre", "1 Cuatrimestre", "1er Cuatrimestre", "1er cuatrimestre", "1° cuatrimestre", "c1", "C1", "1"];
        case "2° Cuatrimestre":
            return ["2° Cuatrimestre", "2 Cuatrimestre", "2do Cuatrimestre", "2do cuatrimestre", "2° cuatrimestre", "c2", "C2", "2"];
        default:
            return [$periodoCanonico];
    }
}

$metodo = $_SERVER["REQUEST_METHOD"];

if ($metodo === "GET") {
    $dni = isset($_GET["dni"]) ? trim((string)$_GET["dni"]) : (isset($_GET["dni_estudiante"]) ? trim((string)$_GET["dni_estudiante"]) : "");
    $periodo = isset($_GET["periodo"]) ? trim((string)$_GET["periodo"]) : "";
    $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
    $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : "";

    $where = [];
    $params = [];

    if ($dni !== "") {
        $where[] = "a.dni_estudiante = ?";
        $params[] = $dni;
    }
    if ($periodo !== "") {
        $canonico = normalizarPeriodoAsistencia($periodo);
        $equivs = obtenerEquivalentesPeriodoAsistencia($canonico);
        $inPlaceholders = implode(", ", array_fill(0, count($equivs), "?"));
        $where[] = "(a.periodo IN ($inPlaceholders) OR (a.periodo IS NULL AND ? = '1° Trimestre'))";
        foreach ($equivs as $eq) {
            $params[] = $eq;
        }
        $params[] = $canonico;
    }
    if ($idInstitucion !== null && $idInstitucion > 0) {
        $where[] = "(a.id_institucion = ? OR a.id_institucion IS NULL OR e.id_institucion = ?)";
        $params[] = $idInstitucion;
        $params[] = $idInstitucion;
    }
    if ($jurisdiccion !== "") {
        $where[] = "(LOWER(e.jurisdiccion) = LOWER(?) OR e.jurisdiccion IS NULL)";
        $params[] = $jurisdiccion;
    }

    $sql = "SELECT a.id, a.dni_estudiante, a.periodo, a.dias_habiles, a.asistencias, a.inasistencias, a.justificadas, a.id_institucion 
            FROM asistencias a
            LEFT JOIN estudiantes e ON a.dni_estudiante = e.dni";
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY a.id ASC";

    try {
        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Asegurar que el campo periodo venga siempre con nombre normalizado
        foreach ($filas as &$f) {
            if (empty($f["periodo"])) {
                $f["periodo"] = ($idInstitucion === 2 || strtolower($jurisdiccion) === "pba") ? "1° Cuatrimestre" : "1° Trimestre";
            } else {
                $f["periodo"] = normalizarPeriodoAsistencia($f["periodo"]);
            }
        }
        unset($f);

        responder(200, $filas);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
        responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "POST") {
    $usuarioAutenticado = requerirAutenticacion(["preceptor", "docente", "administrador", "admin"]);
    $datos = leerJsonBody();

    // Normalizar a array de registros (soporta envío individual o batch de curso completo)
    $listaAsistencias = isset($datos[0]) ? $datos : [$datos];
    $guardados = 0;

    try {
        $stmtFindInst = $conexion->prepare("SELECT id_institucion FROM estudiantes WHERE dni = ? LIMIT 1");

        foreach ($listaAsistencias as $item) {
            if (!is_array($item)) continue;

            $dni = isset($item["dni_estudiante"]) ? trim((string)$item["dni_estudiante"]) : (isset($item["dni"]) ? trim((string)$item["dni"]) : "");
            if ($dni === "") continue;

            $idInst = isset($item["id_institucion"]) && $item["id_institucion"] !== "" 
                ? intval($item["id_institucion"]) 
                : null;

            if (!$idInst) {
                $stmtFindInst->execute([$dni]);
                $rowInst = $stmtFindInst->fetch(PDO::FETCH_ASSOC);
                if ($rowInst && $rowInst["id_institucion"]) {
                    $idInst = intval($rowInst["id_institucion"]);
                } else {
                    $idInst = 1;
                }
            }

            $periodoDefecto = ($idInst === 2) ? "1° Cuatrimestre" : "1° Trimestre";
            $periodoRaw = isset($item["periodo"]) && trim((string)$item["periodo"]) !== "" ? trim((string)$item["periodo"]) : $periodoDefecto;
            $periodoCanonico = normalizarPeriodoAsistencia($periodoRaw);

            $dias = isset($item["dias_habiles"]) ? max(0, intval($item["dias_habiles"])) : ($idInst === 2 ? 82 : 96);
            $pres = isset($item["asistencias"]) ? max(0, intval($item["asistencias"])) : 0;
            $faltas = isset($item["inasistencias"]) ? max(0, intval($item["inasistencias"])) : 0;
            $just = isset($item["justificadas"]) ? max(0, intval($item["justificadas"])) : 0;
            if ($just > $faltas) $just = $faltas;

            // Buscar si ya existe para este alumno y este periodo (o alias equivalentes)
            $equivs = obtenerEquivalentesPeriodoAsistencia($periodoCanonico);
            $inPlaceholders = implode(", ", array_fill(0, count($equivs), "?"));
            $checkSql = "SELECT id FROM asistencias 
                         WHERE dni_estudiante = ? 
                           AND (periodo IN ($inPlaceholders) OR (periodo IS NULL AND ? = '1° Trimestre'))
                           AND (id_institucion = ? OR id_institucion IS NULL)
                         LIMIT 1";
            $checkParams = [$dni];
            foreach ($equivs as $eq) {
                $checkParams[] = $eq;
            }
            $checkParams[] = $periodoCanonico;
            $checkParams[] = $idInst;

            $stmtCheck = $conexion->prepare($checkSql);
            $stmtCheck->execute($checkParams);
            $fila = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($fila) {
                $stmtUpdate = $conexion->prepare(
                    "UPDATE asistencias 
                     SET periodo = ?, dias_habiles = ?, asistencias = ?, inasistencias = ?, justificadas = ?, id_institucion = ? 
                     WHERE id = ?"
                );
                $stmtUpdate->execute([$periodoCanonico, $dias, $pres, $faltas, $just, $idInst, $fila["id"]]);
            } else {
                $stmtInsert = $conexion->prepare(
                    "INSERT INTO asistencias (dni_estudiante, periodo, dias_habiles, asistencias, inasistencias, justificadas, id_institucion) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)"
                );
                $stmtInsert->execute([$dni, $periodoCanonico, $dias, $pres, $faltas, $just, $idInst]);
            }

            $guardados++;
        }

        responder(200, [
            "mensaje" => "Asistencias guardadas exitosamente en la base de datos.",
            "actualizados" => $guardados
        ]);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
        responder(500, ["error" => "Error interno del servidor"]);
    }
}

responder(405, ["error" => "Método no permitido"]);
