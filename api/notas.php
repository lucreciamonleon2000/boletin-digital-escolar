<?php

require_once __DIR__ . "/conexion.php";

// Helpers modulares provistos por conexion.php -> config.php (responder, leerJsonBody, requerirAutenticacion)

function normalizarPeriodoYEquivalentes($periodo) {
    $p = mb_strtolower(trim((string)$periodo), 'UTF-8');
    
    // Cuatrimestres (PBA) - SIEMPRE verificar cuatrimestre antes de trimestre
    if ($p === 'c1' || (strpos($p, '1') !== false && strpos($p, 'cuat') !== false)) {
        return ['canonico' => '1° Cuatrimestre', 'alias' => ['c1', '1° Cuatrimestre', '1 Cuatrimestre', '1er Cuatrimestre']];
    }
    if ($p === 'c2' || (strpos($p, '2') !== false && strpos($p, 'cuat') !== false)) {
        return ['canonico' => '2° Cuatrimestre', 'alias' => ['c2', '2° Cuatrimestre', '2 Cuatrimestre', '2do Cuatrimestre']];
    }
    if ($p === 'rit_dic' || (strpos($p, 'rit') !== false && strpos($p, 'dic') !== false) || (strpos($p, 'dic') !== false && strpos($p, 'intensif') !== false)) {
        return ['canonico' => 'RITE Diciembre', 'alias' => ['rit_dic', 'RITE Diciembre', 'Intensificación Diciembre']];
    }
    if ($p === 'rit_feb' || (strpos($p, 'rit') !== false && strpos($p, 'feb') !== false) || (strpos($p, 'feb') !== false && strpos($p, 'intensif') !== false)) {
        return ['canonico' => 'RITE Febrero', 'alias' => ['rit_feb', 'RITE Febrero', 'Intensificación Febrero / Marzo']];
    }

    // Trimestres (Formosa) - Solo si NO contiene cuat
    if ($p === 't1' || (strpos($p, '1') !== false && strpos($p, 'trim') !== false && strpos($p, 'cuat') === false)) {
        return ['canonico' => '1° Trimestre', 'alias' => ['t1', '1° Trimestre', '1 Trimestre', '1er Trimestre']];
    }
    if ($p === 't2' || (strpos($p, '2') !== false && strpos($p, 'trim') !== false && strpos($p, 'cuat') === false)) {
        return ['canonico' => '2° Trimestre', 'alias' => ['t2', '2° Trimestre', '2 Trimestre', '2do Trimestre']];
    }
    if ($p === 't3' || (strpos($p, '3') !== false && strpos($p, 'trim') !== false && strpos($p, 'cuat') === false)) {
        return ['canonico' => '3° Trimestre', 'alias' => ['t3', '3° Trimestre', '3 Trimestre', '3er Trimestre']];
    }
    if ($p === 'rec_dic' || (strpos($p, 'rec') !== false && strpos($p, 'dic') !== false)) {
        return ['canonico' => 'Recuperatorio Diciembre', 'alias' => ['rec_dic', 'Recuperatorio Diciembre', 'Período Complementario Diciembre']];
    }
    if ($p === 'pair' || strpos($p, 'pair') !== false || strpos($p, 'feb') !== false) {
        return ['canonico' => 'PAIR', 'alias' => ['pair', 'PAIR', 'PAIR (Feb / Mar)', 'PAIR Febrero / Marzo']];
    }

    return ['canonico' => $periodo, 'alias' => [$periodo]];
}

$metodo = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($metodo === "POST") {
    // Protección de escritura: solo docentes, preceptores o administradores
    $usuarioAutenticado = requerirAutenticacion(["docente", "preceptor", "administrador", "admin"]);

    $datos = leerJsonBody();

    // Normalizar a array de notas (si enviaron un solo objeto, convertirlo a array de 1 elemento)
    $listaNotas = isset($datos[0]) ? $datos : [$datos];
    $guardados = 0;

    try {
        $stmtUpdate = $conexion->prepare(
            "UPDATE notas 
             SET nota_numerica = ?, valoracion_conceptual = ?, observacion = ?, id_institucion = ?, periodo = ? 
             WHERE id = ?"
        );
        $stmtInsert = $conexion->prepare(
            "INSERT INTO notas (dni_estudiante, materia, periodo, nota_numerica, valoracion_conceptual, observacion, id_institucion)
             VALUES (?, ?, ?, ?, ?, ?, ?)"
        );
        $stmtFindInst = $conexion->prepare("SELECT id_institucion FROM estudiantes WHERE dni = ?");

        foreach ($listaNotas as $item) {
            if (!is_array($item)) continue;

            $dni = isset($item["dni_estudiante"]) ? trim((string)$item["dni_estudiante"]) : "";
            $materia = isset($item["materia"]) ? trim((string)$item["materia"]) : "";
            $periodo = isset($item["periodo"]) ? trim((string)$item["periodo"]) : "";

            if ($dni === "" || $materia === "" || $periodo === "") {
                continue;
            }

            $infoPeriodo = normalizarPeriodoYEquivalentes($periodo);
            $periodoCanonico = $infoPeriodo['canonico'];
            $alias = $infoPeriodo['alias'];

            $notaNum = (isset($item["nota_numerica"]) && $item["nota_numerica"] !== "" && !is_null($item["nota_numerica"])) 
                       ? intval($item["nota_numerica"]) 
                       : null;
            $valConc = (isset($item["valoracion_conceptual"]) && $item["valoracion_conceptual"] !== "") 
                       ? trim((string)$item["valoracion_conceptual"]) 
                       : null;
            $obs = isset($item["observacion"]) ? trim((string)$item["observacion"]) : "";

            $idInst = isset($item["id_institucion"]) && $item["id_institucion"] !== "" 
                ? intval($item["id_institucion"]) 
                : null;
            if (!$idInst) {
                $stmtFindInst->execute([$dni]);
                $rowInst = $stmtFindInst->fetch(PDO::FETCH_ASSOC);
                if ($rowInst && $rowInst["id_institucion"]) {
                    $idInst = intval($rowInst["id_institucion"]);
                }
            }

            // Verificar si ya existe nota para este alumno, materia y período 
            $placeholders = implode(',', array_fill(0, count($alias), '?'));
            $paramsCheck = array_merge([$dni, $materia], $alias);
            $stmtCheck = $conexion->prepare(
                "SELECT id FROM notas WHERE dni_estudiante = ? AND materia = ? AND periodo IN ($placeholders) LIMIT 1"
            );
            $stmtCheck->execute($paramsCheck);
            $fila = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($fila) {
                // Actualizar registro existente normalizando al período canónico
                $stmtUpdate->execute([$notaNum, $valConc, $obs, $idInst, $periodoCanonico, $fila["id"]]);
            } else {
                // Insertar nuevo registro
                $stmtInsert->execute([$dni, $materia, $periodoCanonico, $notaNum, $valConc, $obs, $idInst]);
            }

            $guardados++;
        }

        responder(200, [
            "status" => "ok",
            "mensaje" => "Calificaciones guardadas correctamente en MySQL",
            "guardados" => $guardados
        ]);

    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
        responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "GET") {
    try {
        $dni = isset($_GET["dni_estudiante"]) ? trim($_GET["dni_estudiante"]) : (isset($_GET["dni"]) ? trim($_GET["dni"]) : "");
        $materia = isset($_GET["materia"]) ? trim($_GET["materia"]) : "";
        $periodo = isset($_GET["periodo"]) ? trim($_GET["periodo"]) : "";
        $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
        $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : "";

        $where = [];
        $params = [];

        if ($dni !== "") {
            $where[] = "n.dni_estudiante = ?";
            $params[] = $dni;
        }
        if ($materia !== "") {
            $where[] = "n.materia = ?";
            $params[] = $materia;
        }
        if ($periodo !== "") {
            $infoPeriodo = normalizarPeriodoYEquivalentes($periodo);
            $alias = $infoPeriodo['alias'];
            $placeholders = implode(',', array_fill(0, count($alias), '?'));
            $where[] = "n.periodo IN ($placeholders)";
            foreach ($alias as $a) {
                $params[] = $a;
            }
        }
        if ($idInstitucion !== null && $idInstitucion > 0) {
            $where[] = "(n.id_institucion = ? OR n.id_institucion IS NULL)";
            $params[] = $idInstitucion;
        }
        if ($jurisdiccion !== "") {
            $where[] = "(LOWER(e.jurisdiccion) = LOWER(?) OR e.jurisdiccion IS NULL)";
            $params[] = $jurisdiccion;
        }

        $sql = "SELECT n.id, n.dni_estudiante, n.materia, n.periodo, n.nota_numerica, n.valoracion_conceptual, n.observacion, n.id_institucion 
                FROM notas n
                LEFT JOIN estudiantes e ON n.dni_estudiante = e.dni";
        if (count($where) > 0) {
            $sql .= " WHERE " . implode(" AND ", $where);
        }
        $sql .= " ORDER BY n.id ASC";

        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        $resultados = $stmt->fetchAll(PDO::FETCH_ASSOC);

        responder(200, $resultados);

    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
        responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "DELETE") {
    // Protección de eliminación: solo docentes, preceptores o administradores
    $usuarioAutenticado = requerirAutenticacion(["docente", "preceptor", "administrador", "admin"]);

    try {
        $dni = isset($_GET["dni_estudiante"]) ? trim($_GET["dni_estudiante"]) : (isset($_GET["dni"]) ? trim($_GET["dni"]) : "");
        $materia = isset($_GET["materia"]) ? trim($_GET["materia"]) : "";
        $periodo = isset($_GET["periodo"]) ? trim($_GET["periodo"]) : "";
        $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;

        $where = [];
        $params = [];

        if ($dni !== "") {
            $where[] = "dni_estudiante = ?";
            $params[] = $dni;
        }
        if ($materia !== "") {
            $where[] = "materia = ?";
            $params[] = $materia;
        }
        if ($periodo !== "") {
            $infoPeriodo = normalizarPeriodoYEquivalentes($periodo);
            $alias = $infoPeriodo['alias'];
            $placeholders = implode(',', array_fill(0, count($alias), '?'));
            $where[] = "periodo IN ($placeholders)";
            foreach ($alias as $a) {
                $params[] = $a;
            }
        }
        if ($idInstitucion !== null && $idInstitucion > 0) {
            $where[] = "id_institucion = ?";
            $params[] = $idInstitucion;
        }

        if (count($where) === 0) {
            responder(400, ["error" => "Se requiere al menos un parámetro (materia, periodo o dni) para eliminar"]);
        }

        $sql = "DELETE FROM notas WHERE " . implode(" AND ", $where);
        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);

        responder(200, [
            "status" => "ok",
            "mensaje" => "Calificaciones eliminadas correctamente del sistema",
            "filas_afectadas" => $stmt->rowCount()
        ]);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
        responder(500, ["error" => "Error interno del servidor"]);
    }
}

responder(405, ["error" => "Método no permitido"]);
