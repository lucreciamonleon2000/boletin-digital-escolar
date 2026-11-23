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

// GET: Obtener comunicados oficiales de la institución con estado de lectura por usuario/alumno
if ($metodo === "GET") {
    $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
    $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : "";
    $dni = isset($_GET["dni"]) ? trim((string)$_GET["dni"]) : "";

    if ($idInstitucion === null && $jurisdiccion !== "") {
        $idInstitucion = (strtolower($jurisdiccion) === "pba") ? 2 : 1;
    }

    try {
        $sql = "SELECT n.*, 
                       IF(nl.id IS NOT NULL, 1, 0) AS leido,
                       nl.leido_el AS fecha_lectura
                FROM notificaciones n
                LEFT JOIN notificaciones_lecturas nl 
                       ON n.id = nl.id_notificacion AND nl.dni_usuario = ?
                WHERE 1=1";
        $params = [$dni];

        if ($idInstitucion !== null && $idInstitucion > 0) {
            $sql .= " AND n.id_institucion = ?";
            $params[] = $idInstitucion;
        }

        $sql .= " ORDER BY n.id DESC";

        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        $notificacionesDB = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $resultado = [];
        foreach ($notificacionesDB as $n) {
            $instStr = ($n["id_institucion"] == 2) ? "inst-pba" : "inst-formosa";

            // Derivar color según prioridad si no viniera
            $color = $n["color"];
            if (empty($color)) {
                if ($n["prioridad"] === "urgente") $color = "#ef4444";
                elseif ($n["prioridad"] === "alta") $color = "#f59e0b";
                elseif ($n["prioridad"] === "positiva") $color = "#22c55e";
                else $color = "#38bdf8";
            }

            $resultado[] = [
                "id" => !empty($n["codigo_notificacion"]) ? $n["codigo_notificacion"] : (string)$n["id"],
                "id_db" => intval($n["id"]),
                "codigo_notificacion" => $n["codigo_notificacion"],
                "titulo" => $n["titulo"],
                "contenido" => $n["contenido"],
                "categoria" => $n["categoria"] ?: "Boletines y Calificaciones",
                "prioridad" => $n["prioridad"] ?: "normal",
                "color" => $color,
                "fecha" => $n["fecha"],
                "emisor" => $n["emisor"] ?: "Preceptoría",
                "destinatario" => $n["destinatario"] ?: "Todos los Cursos y Familias",
                "estado" => $n["estado"] ?: "activa",
                "institucionId" => $instStr,
                "id_institucion" => intval($n["id_institucion"]),
                "leido" => intval($n["leido"]) === 1,
                "fecha_lectura" => $n["fecha_lectura"]
            ];
        }

        responder(200, $resultado);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

// POST: Crear, editar, eliminar o marcar como leída
if ($metodo === "POST") {
    $datos = leerJsonBody();

    $accion = isset($datos["accion"]) ? trim($datos["accion"]) : "guardar_notificacion";

    try {
        // ACCIÓN 1: GUARDAR O EDITAR NOTIFICACIÓN (PRECEPTOR)
        if ($accion === "guardar_notificacion") {
            $id = isset($datos["id"]) ? trim((string)$datos["id"]) : "";
            $idDb = isset($datos["id_db"]) ? intval($datos["id_db"]) : 0;
            $titulo = isset($datos["titulo"]) ? trim($datos["titulo"]) : "";
            $contenido = isset($datos["contenido"]) ? trim($datos["contenido"]) : "";
            $categoria = isset($datos["categoria"]) ? trim($datos["categoria"]) : "Boletines y Calificaciones";
            $prioridad = isset($datos["prioridad"]) ? trim($datos["prioridad"]) : "normal";
            $emisor = isset($datos["emisor"]) && trim($datos["emisor"]) !== "" ? trim($datos["emisor"]) : "Preceptoría";
            $destinatario = isset($datos["destinatario"]) && trim($datos["destinatario"]) !== "" ? trim($datos["destinatario"]) : "Todos los Cursos y Familias";
            $fecha = isset($datos["fecha"]) && trim($datos["fecha"]) !== "" ? trim($datos["fecha"]) : date("d/m/Y");
            $estado = isset($datos["estado"]) ? trim($datos["estado"]) : "activa";
            $idInst = isset($datos["id_institucion"]) && $datos["id_institucion"] !== "" ? intval($datos["id_institucion"]) : 1;

            if ($titulo === "" || $contenido === "") {
                responder(400, ["error" => "Título y contenido son obligatorios"]);
            }

            // Mapear color
            $color = "#38bdf8";
            if ($prioridad === "urgente") $color = "#ef4444";
            elseif ($prioridad === "alta") $color = "#f59e0b";
            elseif ($prioridad === "positiva") $color = "#22c55e";

            // Buscar si ya existe la notificación
            $notifExistente = null;
            if ($idDb > 0) {
                $stmtCheck = $conexion->prepare("SELECT * FROM notificaciones WHERE id = ? LIMIT 1");
                $stmtCheck->execute([$idDb]);
                $notifExistente = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            }
            if (!$notifExistente && $id !== "") {
                $stmtCheck = $conexion->prepare("SELECT * FROM notificaciones WHERE codigo_notificacion = ? OR id = ? LIMIT 1");
                $stmtCheck->execute([$id, intval($id)]);
                $notifExistente = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            }

            if ($notifExistente) {
                // Actualizar notificación existente
                $stmtUpd = $conexion->prepare("
                    UPDATE notificaciones 
                    SET titulo = ?, contenido = ?, categoria = ?, prioridad = ?, color = ?, fecha = ?, emisor = ?, destinatario = ?, estado = ?, id_institucion = ?
                    WHERE id = ?
                ");
                $stmtUpd->execute([
                    $titulo, $contenido, $categoria, $prioridad, $color, $fecha, $emisor, $destinatario, $estado, $idInst, $notifExistente["id"]
                ]);

                responder(200, [
                    "mensaje" => "Notificación actualizada con éxito en MySQL",
                    "id" => $notifExistente["codigo_notificacion"] ?: (string)$notifExistente["id"],
                    "id_db" => intval($notifExistente["id"])
                ]);
            } else {
                // Insertar nueva notificación
                $codigoNotif = $id !== "" ? $id : ("notif-" . time());
                $stmtIns = $conexion->prepare("
                    INSERT INTO notificaciones (codigo_notificacion, titulo, contenido, categoria, prioridad, color, fecha, emisor, destinatario, estado, id_institucion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtIns->execute([
                    $codigoNotif, $titulo, $contenido, $categoria, $prioridad, $color, $fecha, $emisor, $destinatario, $estado, $idInst
                ]);
                $nuevoIdDb = $conexion->lastInsertId();

                responder(201, [
                    "mensaje" => "Notificación creada con éxito en MySQL",
                    "id" => $codigoNotif,
                    "id_db" => intval($nuevoIdDb)
                ]);
            }
        }

        // ACCIÓN 2: ELIMINAR NOTIFICACIÓN (PRECEPTOR)
        if ($accion === "eliminar_notificacion") {
            $id = isset($datos["id"]) ? trim((string)$datos["id"]) : "";
            $idDb = isset($datos["id_db"]) ? intval($datos["id_db"]) : 0;

            if ($idDb > 0) {
                $stmtDel = $conexion->prepare("DELETE FROM notificaciones WHERE id = ?");
                $stmtDel->execute([$idDb]);
            } elseif ($id !== "") {
                $stmtDel = $conexion->prepare("DELETE FROM notificaciones WHERE codigo_notificacion = ? OR id = ?");
                $stmtDel->execute([$id, intval($id)]);
            } else {
                responder(400, ["error" => "ID de notificación no especificado"]);
            }

            responder(200, ["mensaje" => "Notificación eliminada correctamente de MySQL"]);
        }

        // ACCIÓN 3: MARCAR COMO LEÍDO O NO LEÍDO (ALUMNO / TUTOR)
        if ($accion === "marcar_leido") {
            $notifId = isset($datos["notificacion_id"]) ? trim((string)$datos["notificacion_id"]) : (isset($datos["id"]) ? trim((string)$datos["id"]) : "");
            $dni = isset($datos["dni"]) ? trim((string)$datos["dni"]) : "";
            $rol = isset($datos["rol"]) ? trim((string)$datos["rol"]) : "estudiante";
            $marcar = isset($datos["leido"]) ? (bool)$datos["leido"] : true;

            if ($notifId === "" || $dni === "") {
                responder(400, ["error" => "Parámetros requeridos incompletos (notificacion_id o dni)"]);
            }

            // Buscar la notificación
            $stmtFind = $conexion->prepare("SELECT id, codigo_notificacion FROM notificaciones WHERE codigo_notificacion = ? OR id = ? LIMIT 1");
            $stmtFind->execute([$notifId, intval($notifId)]);
            $notifRow = $stmtFind->fetch(PDO::FETCH_ASSOC);

            if (!$notifRow) {
                responder(404, ["error" => "La notificación no existe en la base de datos"]);
            }

            $idNotifDb = intval($notifRow["id"]);
            $codNotif = $notifRow["codigo_notificacion"];

            if ($marcar) {
                // Insertar o ignorar si ya existe
                $stmtInsLec = $conexion->prepare("
                    INSERT INTO notificaciones_lecturas (id_notificacion, codigo_notificacion, dni_usuario, rol_usuario, leido_el)
                    VALUES (?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE leido_el = NOW()
                ");
                $stmtInsLec->execute([$idNotifDb, $codNotif, $dni, $rol]);

                responder(200, [
                    "mensaje" => "Notificación marcada como leída",
                    "notificacion_id" => $notifId,
                    "dni" => $dni,
                    "leido" => true
                ]);
            } else {
                // Desmarcar (marcar como no leído)
                $stmtDelLec = $conexion->prepare("
                    DELETE FROM notificaciones_lecturas 
                    WHERE id_notificacion = ? AND dni_usuario = ?
                ");
                $stmtDelLec->execute([$idNotifDb, $dni]);

                responder(200, [
                    "mensaje" => "Notificación marcada como no leída",
                    "notificacion_id" => $notifId,
                    "dni" => $dni,
                    "leido" => false
                ]);
            }
        }

        // ACCIÓN 4: MARCAR TODAS COMO LEÍDAS (ALUMNO / TUTOR)
        if ($accion === "marcar_todos_leidos") {
            $dni = isset($datos["dni"]) ? trim((string)$datos["dni"]) : "";
            $rol = isset($datos["rol"]) ? trim((string)$datos["rol"]) : "estudiante";
            $idInst = isset($datos["id_institucion"]) ? intval($datos["id_institucion"]) : 1;

            if ($dni === "") {
                responder(400, ["error" => "DNI no especificado"]);
            }

            // Obtener todas las notificaciones activas de esa institución
            $stmtAll = $conexion->prepare("SELECT id, codigo_notificacion FROM notificaciones WHERE id_institucion = ? AND estado != 'archivada'");
            $stmtAll->execute([$idInst]);
            $todas = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

            $stmtInsAll = $conexion->prepare("
                INSERT INTO notificaciones_lecturas (id_notificacion, codigo_notificacion, dni_usuario, rol_usuario, leido_el)
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE leido_el = NOW()
            ");

            foreach ($todas as $item) {
                $stmtInsAll->execute([$item["id"], $item["codigo_notificacion"], $dni, $rol]);
            }

            responder(200, [
                "mensaje" => "Todos los comunicados fueron marcados como leídos",
                "total" => count($todas)
            ]);
        }

        responder(400, ["error" => "Acción no reconocida"]);

    } catch (PDOException $e) {
       error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

responder(405, ["error" => "Método no permitido"]);
