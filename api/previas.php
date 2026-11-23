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

if ($metodo === "GET") {
    $dni = isset($_GET["dni"]) ? trim((string)$_GET["dni"]) : "";
    $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
    $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : "";

    $where = [];
    $params = [];

    if ($dni !== "") {
        $where[] = "p.dni_estudiante = ?";
        $params[] = $dni;
    }
    if ($idInstitucion !== null && $idInstitucion > 0) {
        $where[] = "p.id_institucion = ?";
        $params[] = $idInstitucion;
    }
    if ($jurisdiccion !== "") {
        $where[] = "LOWER(e.jurisdiccion) = LOWER(?)";
        $params[] = $jurisdiccion;
    }

    $sql = "SELECT p.id, p.dni_estudiante, p.materia, p.calificacion, p.estado, p.fecha, p.curso_origen, p.fecha_aprobacion, p.id_institucion 
            FROM previas p
            LEFT JOIN estudiantes e ON p.dni_estudiante = e.dni";
    if (count($where) > 0) {
        $sql .= " WHERE " . implode(" AND ", $where);
    }
    $sql .= " ORDER BY p.id DESC";

    try {
        $stmt = $conexion->prepare($sql);
        $stmt->execute($params);
        $resultado = $stmt->fetchAll(PDO::FETCH_ASSOC);
        responder(200, $resultado);
    } catch (PDOException $e) {
       error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "POST") {
    $datos = leerJsonBody();

    $dni = isset($datos["dni_estudiante"]) ? trim((string)$datos["dni_estudiante"]) : "";
    $materia = isset($datos["materia"]) ? trim((string)$datos["materia"]) : "";
    $calificacion = isset($datos["calificacion"]) && $datos["calificacion"] !== "" ? trim((string)$datos["calificacion"]) : null;
    $estado = isset($datos["estado"]) && $datos["estado"] !== "" ? trim((string)$datos["estado"]) : "Pendiente";
    $fecha = isset($datos["fecha"]) ? trim((string)$datos["fecha"]) : "";
    $cursoOrigen = isset($datos["curso_origen"]) && $datos["curso_origen"] !== "" ? trim((string)$datos["curso_origen"]) : "1° Año";
    $fechaAprobacion = isset($datos["fecha_aprobacion"]) && $datos["fecha_aprobacion"] !== "" ? trim((string)$datos["fecha_aprobacion"]) : null;

    $idInst = isset($datos["id_institucion"]) && $datos["id_institucion"] !== "" ? intval($datos["id_institucion"]) : null;
    if (!$idInst && $dni !== "") {
        $stFind = $conexion->prepare("SELECT id_institucion FROM estudiantes WHERE dni = ?");
        $stFind->execute([$dni]);
        $rowInst = $stFind->fetch(PDO::FETCH_ASSOC);
        if ($rowInst && $rowInst["id_institucion"]) {
            $idInst = intval($rowInst["id_institucion"]);
        }
    }

    if ($dni === "" || $materia === "") {
        responder(400, ["error" => "El DNI del estudiante y la materia son obligatorios"]);
    }

    try {
        $stmt = $conexion->prepare(
            "INSERT INTO previas (dni_estudiante, materia, calificacion, estado, fecha, curso_origen, fecha_aprobacion, id_institucion) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$dni, $materia, $calificacion, $estado, $fecha, $cursoOrigen, $fechaAprobacion, $idInst]);
        $nuevoId = $conexion->lastInsertId();

        responder(201, [
            "status" => "ok",
            "mensaje" => "Materia previa registrada correctamente",
            "id" => $nuevoId
        ]);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "PUT") {
    $cuerpo = file_get_contents("php://input");
    $datos = json_decode($cuerpo, true);

    if (!is_array($datos) || !isset($datos["id"])) {
        responder(400, ["error" => "Se requiere el ID de la previa a modificar"]);
    }

    $id = (int)$datos["id"];
    $materia = isset($datos["materia"]) ? trim((string)$datos["materia"]) : "";
    $calificacion = isset($datos["calificacion"]) && $datos["calificacion"] !== "" ? trim((string)$datos["calificacion"]) : null;
    $estado = isset($datos["estado"]) && $datos["estado"] !== "" ? trim((string)$datos["estado"]) : "Pendiente";
    $fecha = isset($datos["fecha"]) ? trim((string)$datos["fecha"]) : "";
    $cursoOrigen = isset($datos["curso_origen"]) && $datos["curso_origen"] !== "" ? trim((string)$datos["curso_origen"]) : "1° Año";
    $fechaAprobacion = isset($datos["fecha_aprobacion"]) && $datos["fecha_aprobacion"] !== "" ? trim((string)$datos["fecha_aprobacion"]) : null;

    if ($id <= 0 || $materia === "") {
        responder(400, ["error" => "El ID y la materia son obligatorios"]);
    }

    try {
        $stmt = $conexion->prepare(
            "UPDATE previas 
             SET materia = ?, calificacion = ?, estado = ?, fecha = ?, curso_origen = ?, fecha_aprobacion = ? 
             WHERE id = ?"
        );
        $stmt->execute([$materia, $calificacion, $estado, $fecha, $cursoOrigen, $fechaAprobacion, $id]);

        responder(200, [
            "status" => "ok",
            "mensaje" => "Materia previa actualizada correctamente"
        ]);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

if ($metodo === "DELETE") {
    $cuerpo = file_get_contents("php://input");
    $datos = json_decode($cuerpo, true);

    $id = 0;
    if (is_array($datos) && isset($datos["id"])) {
        $id = (int)$datos["id"];
    } elseif (isset($_GET["id"])) {
        $id = (int)$_GET["id"];
    }

    if ($id <= 0) {
        responder(400, ["error" => "ID no válido para eliminar"]);
    }

    try {
        $stmt = $conexion->prepare("DELETE FROM previas WHERE id = ?");
        $stmt->execute([$id]);

        responder(200, [
            "status" => "ok",
            "mensaje" => "Materia previa eliminada correctamente"
        ]);
    } catch (PDOException $e) {
        error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

responder(405, ["error" => "Método no permitido"]);
