<?php

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");



if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/conexion.php";

// Helpers modulares provistos por conexion.php -> config.php (responder, leerJsonBody)

$metodo = $_SERVER["REQUEST_METHOD"];

// GET: Listar mesas de examen con sus inscriptos
if ($metodo === "GET") {
    $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
    $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : "";
    $dni = isset($_GET["dni"]) ? trim((string)$_GET["dni"]) : "";

    if ($idInstitucion === null && $jurisdiccion !== "") {
        $idInstitucion = (strtolower($jurisdiccion) === "pba") ? 2 : 1;
    }

    try {
        $sql = "SELECT m.*, i.nombre AS nombre_institucion, i.regimen 
                FROM mesas_examen m
                LEFT JOIN instituciones i ON m.id_institucion = i.id";
        $params = [];
        if ($idInstitucion !== null && $idInstitucion > 0) {
            $sql .= " WHERE m.id_institucion = ?";
            $params[] = $idInstitucion;
        }
        $sql .= " ORDER BY m.fecha ASC, m.hora ASC";

        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        $mesasDB = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $resultado = [];
        $stmtInsc = $conexion->prepare("
            SELECT id, id_mesa, codigo_mesa, dni_estudiante AS dni, nombre_estudiante AS nombre, 
                   curso, condicion, fecha_inscripcion AS fechaInscripcion, estado
            FROM inscripciones_mesas
            WHERE (id_mesa = ? OR (codigo_mesa IS NOT NULL AND codigo_mesa = ?))
              AND estado = 'confirmada'
            ORDER BY id ASC
        ");

        foreach ($mesasDB as $m) {
            $stmtInsc->execute([$m["id"], $m["codigo_mesa"]]);
            $inscriptos = $stmtInsc->fetchAll(PDO::FETCH_ASSOC);

            // Mapear ciclo según el texto del curso para retrocompatibilidad
            $cursoStr = $m["curso"] ?? "";
            $ciclo = "basico";
            if (stripos($cursoStr, "orientado") !== false || preg_match('/^[456]/', $cursoStr)) {
                $ciclo = "orientado";
            } elseif (stripos($cursoStr, "general") !== false || stripos($cursoStr, "ambos") !== false) {
                $ciclo = "general";
            }

            $instIdStr = ($m["id_institucion"] == 2) ? "inst-pba" : "inst-formosa";

            $resultado[] = [
                "id" => !empty($m["codigo_mesa"]) ? $m["codigo_mesa"] : (string)$m["id"],
                "id_db" => intval($m["id"]),
                "codigo_mesa" => $m["codigo_mesa"],
                "materia" => $m["materia"],
                "curso" => $m["curso"],
                "ciclo" => $ciclo,
                "mes" => $m["mes"],
                "turno" => $m["turno"],
                "docentes" => $m["docentes"],
                "fecha" => $m["fecha"],
                "hora" => $m["hora"],
                "estado" => $m["estado"],
                "institucionId" => $instIdStr,
                "id_institucion" => intval($m["id_institucion"]),
                "inscriptos" => $inscriptos
            ];
        }

        responder(200, $resultado);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

// POST: Crear, editar, eliminar mesas o gestionar inscripciones
if ($metodo === "POST") {
    $datos = leerJsonBody();

    $accion = isset($datos["accion"]) ? trim($datos["accion"]) : "guardar_mesa";

    try {
        // ACCIÓN 1: GUARDAR O EDITAR MESA DE EXAMEN (PRECEPTOR)
        if ($accion === "guardar_mesa") {
            $id = isset($datos["id"]) ? trim((string)$datos["id"]) : "";
            $idDb = isset($datos["id_db"]) ? intval($datos["id_db"]) : 0;
            $materia = isset($datos["materia"]) ? trim($datos["materia"]) : "";
            $curso = isset($datos["curso"]) ? trim($datos["curso"]) : "Ciclo Básico";
            $mes = isset($datos["mes"]) ? trim($datos["mes"]) : "Diciembre";
            $turno = isset($datos["turno"]) ? trim($datos["turno"]) : "Turno Diciembre 2026";
            $docentes = isset($datos["docentes"]) ? trim($datos["docentes"]) : "A designar";
            $fecha = isset($datos["fecha"]) ? trim($datos["fecha"]) : date("Y-m-d");
            $hora = isset($datos["hora"]) ? trim($datos["hora"]) : "08:00";
            $estado = isset($datos["estado"]) ? trim($datos["estado"]) : "abierta";
            $idInst = isset($datos["id_institucion"]) && $datos["id_institucion"] !== "" ? intval($datos["id_institucion"]) : 1;

            if ($materia === "") {
                responder(400, ["error" => "El nombre de la materia es requerido"]);
            }

            // Buscar si ya existe la mesa en la base de datos
            $mesaExistente = null;
            if ($idDb > 0) {
                $stmtCheck = $conexion->prepare("SELECT * FROM mesas_examen WHERE id = ? LIMIT 1");
                $stmtCheck->execute([$idDb]);
                $mesaExistente = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            }
            if (!$mesaExistente && $id !== "") {
                $stmtCheck = $conexion->prepare("SELECT * FROM mesas_examen WHERE codigo_mesa = ? OR id = ? LIMIT 1");
                $stmtCheck->execute([$id, intval($id)]);
                $mesaExistente = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            }

            if ($mesaExistente) {
                // Actualizar mesa existente
                $stmtUpdate = $conexion->prepare("
                    UPDATE mesas_examen 
                    SET materia = ?, curso = ?, mes = ?, turno = ?, docentes = ?, fecha = ?, hora = ?, estado = ?, id_institucion = ?
                    WHERE id = ?
                ");
                $stmtUpdate->execute([$materia, $curso, $mes, $turno, $docentes, $fecha, $hora, $estado, $idInst, $mesaExistente["id"]]);
                
                responder(200, [
                    "mensaje" => "Mesa de examen actualizada exitosamente en MySQL",
                    "id" => $mesaExistente["codigo_mesa"] ?: (string)$mesaExistente["id"],
                    "id_db" => intval($mesaExistente["id"])
                ]);
            } else {
                // Insertar nueva mesa
                $codigoMesa = $id !== "" ? $id : ("mesa-" . time());
                $stmtInsert = $conexion->prepare("
                    INSERT INTO mesas_examen (codigo_mesa, materia, curso, mes, turno, docentes, fecha, hora, estado, id_institucion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtInsert->execute([$codigoMesa, $materia, $curso, $mes, $turno, $docentes, $fecha, $hora, $estado, $idInst]);
                $nuevoIdDb = $conexion->lastInsertId();

                responder(201, [
                    "mensaje" => "Mesa de examen creada exitosamente en MySQL",
                    "id" => $codigoMesa,
                    "id_db" => intval($nuevoIdDb)
                ]);
            }
        }

        // ACCIÓN 2: ELIMINAR MESA DE EXAMEN (PRECEPTOR)
        if ($accion === "eliminar_mesa") {
            $id = isset($datos["id"]) ? trim((string)$datos["id"]) : "";
            $idDb = isset($datos["id_db"]) ? intval($datos["id_db"]) : 0;

            if ($idDb > 0) {
                $stmtDel = $conexion->prepare("DELETE FROM mesas_examen WHERE id = ?");
                $stmtDel->execute([$idDb]);
            } elseif ($id !== "") {
                $stmtDel = $conexion->prepare("DELETE FROM mesas_examen WHERE codigo_mesa = ? OR id = ?");
                $stmtDel->execute([$id, intval($id)]);
            } else {
                responder(400, ["error" => "ID de mesa no especificado"]);
            }

            responder(200, ["mensaje" => "Mesa de examen eliminada exitosamente"]);
        }

        // ACCIÓN 3: INSCRIBIR ALUMNO A MESA DE EXAMEN (ALUMNO / TUTOR)
        if ($accion === "inscribir") {
            $mesaId = isset($datos["mesa_id"]) ? trim((string)$datos["mesa_id"]) : (isset($datos["id"]) ? trim((string)$datos["id"]) : "");
            $dni = isset($datos["dni"]) ? trim((string)$datos["dni"]) : "";
            $nombre = isset($datos["nombre"]) ? trim((string)$datos["nombre"]) : "";
            $curso = isset($datos["curso"]) ? trim((string)$datos["curso"]) : "";
            $condicion = isset($datos["condicion"]) ? trim((string)$datos["condicion"]) : "Regular";
            $fechaInscripcion = isset($datos["fechaInscripcion"]) ? trim((string)$datos["fechaInscripcion"]) : date("d/m/Y H:i");
            $idInst = isset($datos["id_institucion"]) && $datos["id_institucion"] !== "" ? intval($datos["id_institucion"]) : 1;

            if ($mesaId === "" || $dni === "") {
                responder(400, ["error" => "Faltan parámetros requeridos (mesa_id o dni)"]);
            }

            // Buscar la mesa en MySQL
            $stmtFindMesa = $conexion->prepare("SELECT id, codigo_mesa, estado, id_institucion FROM mesas_examen WHERE codigo_mesa = ? OR id = ? LIMIT 1");
            $stmtFindMesa->execute([$mesaId, intval($mesaId)]);
            $mesaRow = $stmtFindMesa->fetch(PDO::FETCH_ASSOC);

            if (!$mesaRow) {
                responder(404, ["error" => "La mesa de examen no existe en la base de datos"]);
            }
            if ($mesaRow["estado"] === "cerrada") {
                responder(400, ["error" => "La mesa de examen está cerrada para nuevas inscripciones"]);
            }

            $idMesaDb = intval($mesaRow["id"]);
            $codMesa = $mesaRow["codigo_mesa"];
            $idInst = intval($mesaRow["id_institucion"]);

            // Si no viene nombre o curso, buscar en estudiantes
            if ($nombre === "" || $curso === "") {
                $stmtEst = $conexion->prepare("SELECT nombre, curso FROM estudiantes WHERE dni = ? LIMIT 1");
                $stmtEst->execute([$dni]);
                $estRow = $stmtEst->fetch(PDO::FETCH_ASSOC);
                if ($estRow) {
                    if ($nombre === "") $nombre = $estRow["nombre"];
                    if ($curso === "") $curso = $estRow["curso"];
                }
            }

            // Verificar si ya existe inscripción previa
            $stmtCheckInsc = $conexion->prepare("SELECT id FROM inscripciones_mesas WHERE id_mesa = ? AND dni_estudiante = ? LIMIT 1");
            $stmtCheckInsc->execute([$idMesaDb, $dni]);
            $inscRow = $stmtCheckInsc->fetch(PDO::FETCH_ASSOC);

            if ($inscRow) {
                $stmtUpdInsc = $conexion->prepare("
                    UPDATE inscripciones_mesas 
                    SET condicion = ?, fecha_inscripcion = ?, estado = 'confirmada'
                    WHERE id = ?
                ");
                $stmtUpdInsc->execute([$condicion, $fechaInscripcion, $inscRow["id"]]);
            } else {
                $stmtInsInsc = $conexion->prepare("
                    INSERT INTO inscripciones_mesas (id_mesa, codigo_mesa, dni_estudiante, nombre_estudiante, curso, condicion, fecha_inscripcion, estado, id_institucion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmada', ?)
                ");
                $stmtInsInsc->execute([$idMesaDb, $codMesa, $dni, $nombre, $curso, $condicion, $fechaInscripcion, $idInst]);
            }

            responder(200, [
                "mensaje" => "Inscripción registrada con éxito en MySQL",
                "mesa_id" => $mesaId,
                "dni" => $dni,
                "condicion" => $condicion
            ]);
        }

        // ACCIÓN 4: CANCELAR O DAR DE BAJA INSCRIPCIÓN (ALUMNO O PRECEPTOR)
        if ($accion === "cancelar_inscripcion" || $accion === "baja_inscripcion") {
            $mesaId = isset($datos["mesa_id"]) ? trim((string)$datos["mesa_id"]) : (isset($datos["id"]) ? trim((string)$datos["id"]) : "");
            $dni = isset($datos["dni"]) ? trim((string)$datos["dni"]) : "";

            if ($mesaId === "" || $dni === "") {
                responder(400, ["error" => "Mesa ID o DNI no especificados"]);
            }

            $stmtFindMesa = $conexion->prepare("SELECT id FROM mesas_examen WHERE codigo_mesa = ? OR id = ? LIMIT 1");
            $stmtFindMesa->execute([$mesaId, intval($mesaId)]);
            $mesaRow = $stmtFindMesa->fetch(PDO::FETCH_ASSOC);

            if ($mesaRow) {
                $stmtDel = $conexion->prepare("DELETE FROM inscripciones_mesas WHERE id_mesa = ? AND dni_estudiante = ?");
                $stmtDel->execute([$mesaRow["id"], $dni]);
            }

            responder(200, ["mensaje" => "Inscripción eliminada/cancelada exitosamente"]);
        }

        responder(400, ["error" => "Acción no reconocida"]);

    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

responder(405, ["error" => "Método no permitido"]);
