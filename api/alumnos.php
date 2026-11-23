<?php

header("Content-Type: application/json; charset=UTF-8");

require_once "conexion.php";
require_once "servicios.php";

// Para GET: listar o consultar un estudiante.
// Para POST: registrar.
// Para PUT: modificar.
// Para DELETE: eliminar.

// Reutilización de helpers modulares (DRY)
function leerDatos(): array {
    return leerJsonBody();
}

function extraerCamposAccesoAlumno(array $datos, string $dni, ?array $actual = null): array {
    $claveIngresada = array_key_exists("clave_acceso", $datos) ? trim((string)$datos["clave_acceso"]) : "";
    $claveExistente = $actual ? trim((string)($actual["clave_acceso"] ?? "")) : "";
    $claveFinal = $claveIngresada !== ""
        ? $claveIngresada
        : ($claveExistente !== "" ? $claveExistente : generarClaveInicialAlumno($dni));

    $resolverOpcional = static function (string $campo) use ($datos, $actual): ?string {
        if (array_key_exists($campo, $datos)) {
            $val = trim((string)($datos[$campo] ?? ""));
            return $val !== "" ? $val : null;
        }
        return $actual ? ($actual[$campo] ?? null) : null;
    };

    return [
        "clave_acceso" => $claveFinal,
        "email_estudiante" => $resolverOpcional("email_estudiante"),
        "email_tutor" => $resolverOpcional("email_tutor"),
        "dni_tutor" => $resolverOpcional("dni_tutor")
    ];
}

function validarEstudiante($datos, $completo = true) {
    $campos = [
        "dni",
        "nombre",
        "apellido",
        "jurisdiccion",
        "id_institucion",
        "curso",
        "seccion",
        "nombre_tutor"
    ];

    if ($completo) {
        foreach ($campos as $campo) {
            if (!isset($datos[$campo]) ||
                (is_string($datos[$campo]) && trim($datos[$campo]) === "")) {
                responder(422, [
                    "error" => "Falta completar el campo: " . $campo
                ]);
            }
        }
    }

    if (isset($datos["dni"])) {
        $dniStr = trim((string)$datos["dni"]);
        if (!ctype_digit($dniStr) || strlen($dniStr) !== 8) {
            responder(422, ["error" => "El DNI debe tener exactamente 8 dígitos numéricos"]);
        }
    }

    if (isset($datos["id_institucion"]) &&
        filter_var($datos["id_institucion"], FILTER_VALIDATE_INT) === false) {
        responder(422, ["error" => "El id de la institución debe ser un número entero"]);
    }

    foreach (["nombre", "apellido", "jurisdiccion", "curso",
              "seccion", "nombre_tutor"] as $campo) {
        if (isset($datos[$campo]) &&
            (!is_string($datos[$campo]) || trim($datos[$campo]) === "")) {
            responder(422, ["error" => "El campo " . $campo . " no es válido"]);
        }
    }

    $camposOpcional = ["clave_acceso", "email_estudiante", "email_tutor", "dni_tutor"];
    foreach ($camposOpcional as $campoOp) {
        if (isset($datos[$campoOp]) && !is_string($datos[$campoOp]) && !is_numeric($datos[$campoOp])) {
            responder(422, ["error" => "El campo " . $campoOp . " no es válido"]);
        }
    }

    return $datos;
}

try {
    asegurarColumnasAccesoEstudiantes($conexion);
    $metodo = $_SERVER["REQUEST_METHOD"];

    switch ($metodo) {
        case "GET":
            if (isset($_GET["id"])) {
                $id = filter_var($_GET["id"], FILTER_VALIDATE_INT);

                if ($id === false || $id < 1) {
                    responder(400, ["error" => "El id no es válido"]);
                }

                $consulta = $conexion->prepare(
                    "SELECT id, dni, nombre, apellido, jurisdiccion,
                            id_institucion, curso, seccion, nombre_tutor,
                            COALESCE(NULLIF(clave_acceso, ''), RIGHT(dni, 4)) AS clave_acceso,
                            email_estudiante, email_tutor, dni_tutor
                     FROM estudiantes
                     WHERE id = ?"
                );
                $consulta->execute([$id]);
                $alumno = $consulta->fetch();

                if (!$alumno) {
                    responder(404, ["error" => "Estudiante no encontrado"]);
                }

                responder(200, $alumno);
            }

            $where = [];
            $params = [];

            if (isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "") {
                $where[] = "id_institucion = ?";
                $params[] = (int)$_GET["id_institucion"];
            }

            if (isset($_GET["jurisdiccion"]) && trim($_GET["jurisdiccion"]) !== "") {
                $where[] = "LOWER(jurisdiccion) = LOWER(?)";
                $params[] = trim($_GET["jurisdiccion"]);
            }

            $sql = "SELECT id, dni, nombre, apellido, jurisdiccion,
                           id_institucion, curso, seccion, nombre_tutor,
                           COALESCE(NULLIF(clave_acceso, ''), RIGHT(dni, 4)) AS clave_acceso,
                           email_estudiante, email_tutor, dni_tutor
                    FROM estudiantes";
            if (!empty($where)) {
                $sql .= " WHERE " . implode(" AND ", $where);
            }
            $sql .= " ORDER BY apellido, nombre";

            $consulta = $conexion->prepare($sql);
            $consulta->execute($params);

            responder(200, $consulta->fetchAll());

        case "POST":
            $usuarioAutenticado = requerirAutenticacion(["preceptor", "administrador", "admin"]);
            $datos = validarEstudiante(leerDatos());

            // Verificamos que la institución exista.
            $consulta = $conexion->prepare(
                "SELECT id FROM instituciones WHERE id = ?"
            );
            $consulta->execute([$datos["id_institucion"]]);

            if (!$consulta->fetch()) {
                responder(422, ["error" => "La institución no existe"]);
            }

            // Evitamos duplicar o actualizamos si ya existe en la misma jurisdicción
            $consulta = $conexion->prepare(
                "SELECT id, clave_acceso, email_estudiante, email_tutor, dni_tutor
                 FROM estudiantes
                 WHERE dni = ? AND jurisdiccion = ?"
            );
            $consulta->execute([
                $datos["dni"],
                trim($datos["jurisdiccion"])
            ]);
            $estudianteExistente = $consulta->fetch();

            if ($estudianteExistente) {
                $idExistente = (int)$estudianteExistente["id"];
                $camposAcceso = extraerCamposAccesoAlumno($datos, (string)$datos["dni"], $estudianteExistente);
                $consultaUpdate = $conexion->prepare(
                    "UPDATE estudiantes
                     SET dni = ?, nombre = ?, apellido = ?, jurisdiccion = ?,
                         id_institucion = ?, curso = ?, seccion = ?, nombre_tutor = ?,
                         clave_acceso = ?, email_estudiante = ?, email_tutor = ?, dni_tutor = ?
                     WHERE id = ?"
                );
                $consultaUpdate->execute([
                    $datos["dni"],
                    trim($datos["nombre"]),
                    trim($datos["apellido"]),
                    trim($datos["jurisdiccion"]),
                    $datos["id_institucion"],
                    trim($datos["curso"]),
                    trim($datos["seccion"]),
                    trim($datos["nombre_tutor"]),
                    $camposAcceso["clave_acceso"],
                    $camposAcceso["email_estudiante"],
                    $camposAcceso["email_tutor"],
                    $camposAcceso["dni_tutor"],
                    $idExistente
                ]);

                responder(200, [
                    "mensaje" => "Estudiante actualizado correctamente",
                    "id" => $idExistente,
                    "credenciales_alumno" => [
                        "usuario" => (string)$datos["dni"],
                        "clave_provisoria" => $camposAcceso["clave_acceso"]
                    ]
                ]);
            }

            $camposAcceso = extraerCamposAccesoAlumno($datos, (string)$datos["dni"]);
            $consulta = $conexion->prepare(
                "INSERT INTO estudiantes
                 (dni, nombre, apellido, jurisdiccion, id_institucion,
                  curso, seccion, nombre_tutor,
                  clave_acceso, email_estudiante, email_tutor, dni_tutor)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );

            $consulta->execute([
                $datos["dni"],
                trim($datos["nombre"]),
                trim($datos["apellido"]),
                trim($datos["jurisdiccion"]),
                $datos["id_institucion"],
                trim($datos["curso"]),
                trim($datos["seccion"]),
                trim($datos["nombre_tutor"]),
                $camposAcceso["clave_acceso"],
                $camposAcceso["email_estudiante"],
                $camposAcceso["email_tutor"],
                $camposAcceso["dni_tutor"]
            ]);

            $idNuevo = (int)$conexion->lastInsertId();

            // R4 y R5: Integración externa backend (Resend) con degradación elegante
            $asuntoAviso = "Alta de Estudiante: " . trim($datos["nombre"]) . " " . trim($datos["apellido"]);
            $mensajeAviso = "Se ha registrado un nuevo estudiante en el sistema oficial del Boletín Digital:\n\n" .
                "• Alumno/a: " . trim($datos["nombre"]) . " " . trim($datos["apellido"]) . "\n" .
                "• DNI: " . $datos["dni"] . "\n" .
                "• Curso y División: " . trim($datos["curso"]) . " " . trim($datos["seccion"]) . "\n" .
                "• Tutor/a a cargo: " . trim($datos["nombre_tutor"]) . "\n" .
                "• Acceso al portal: Usuario " . $datos["dni"] . " | Clave inicial provisoria: " . $camposAcceso["clave_acceso"] . "\n\n" .
                "Notificación automática enviada desde el portal oficial.";

            $resultadoAviso = enviarCorreoAviso($asuntoAviso, $mensajeAviso);

            responder(201, [
                "mensaje" => "Estudiante registrado correctamente",
                "id" => $idNuevo,
                "aviso_email" => $resultadoAviso["status"] ?? "simulado",
                "credenciales_alumno" => [
                    "usuario" => (string)$datos["dni"],
                    "clave_provisoria" => $camposAcceso["clave_acceso"]
                ]
            ]);

        case "PUT":
            $usuarioAutenticado = requerirAutenticacion(["preceptor", "administrador", "admin"]);
            $id = filter_var($_GET["id"] ?? null, FILTER_VALIDATE_INT);
            if ((!$id || $id < 1) && isset($_GET["dni"])) {
                $dniParam = trim((string)$_GET["dni"]);
                $jurisParam = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : null;
                if ($jurisParam) {
                    $qBusca = $conexion->prepare("SELECT id FROM estudiantes WHERE dni = ? AND LOWER(jurisdiccion) = LOWER(?) LIMIT 1");
                    $qBusca->execute([$dniParam, $jurisParam]);
                } else {
                    $qBusca = $conexion->prepare("SELECT id FROM estudiantes WHERE dni = ? LIMIT 1");
                    $qBusca->execute([$dniParam]);
                }
                $fila = $qBusca->fetch();
                if ($fila) {
                    $id = (int)$fila["id"];
                }
            }

            if ($id === false || $id === null || $id < 1) {
                responder(400, ["error" => "Falta un id o DNI válido en la URL"]);
            }

            $datos = validarEstudiante(leerDatos());

            $consulta = $conexion->prepare(
                "SELECT id, clave_acceso, email_estudiante, email_tutor, dni_tutor FROM estudiantes WHERE id = ?"
            );
            $consulta->execute([$id]);
            $actualPut = $consulta->fetch();

            if (!$actualPut) {
                responder(404, ["error" => "Estudiante no encontrado"]);
            }

            $consulta = $conexion->prepare(
                "SELECT id FROM instituciones WHERE id = ?"
            );
            $consulta->execute([$datos["id_institucion"]]);

            if (!$consulta->fetch()) {
                responder(422, ["error" => "La institución no existe"]);
            }

            $consulta = $conexion->prepare(
                "SELECT id FROM estudiantes
                 WHERE dni = ? AND jurisdiccion = ? AND id <> ?"
            );
            $consulta->execute([
                $datos["dni"],
                trim($datos["jurisdiccion"]),
                $id
            ]);

            if ($consulta->fetch()) {
                responder(422, [
                    "error" => "Otro estudiante ya tiene ese DNI en esa jurisdicción"
                ]);
            }

            $camposAccesoPut = extraerCamposAccesoAlumno($datos, (string)$datos["dni"], $actualPut);
            $consulta = $conexion->prepare(
                "UPDATE estudiantes
                 SET dni = ?, nombre = ?, apellido = ?, jurisdiccion = ?,
                     id_institucion = ?, curso = ?, seccion = ?, nombre_tutor = ?,
                     clave_acceso = ?, email_estudiante = ?, email_tutor = ?, dni_tutor = ?
                 WHERE id = ?"
            );

            $consulta->execute([
                $datos["dni"],
                trim($datos["nombre"]),
                trim($datos["apellido"]),
                trim($datos["jurisdiccion"]),
                $datos["id_institucion"],
                trim($datos["curso"]),
                trim($datos["seccion"]),
                trim($datos["nombre_tutor"]),
                $camposAccesoPut["clave_acceso"],
                $camposAccesoPut["email_estudiante"],
                $camposAccesoPut["email_tutor"],
                $camposAccesoPut["dni_tutor"],
                $id
            ]);

            responder(200, [
                "mensaje" => "Estudiante modificado correctamente",
                "credenciales_alumno" => [
                    "usuario" => (string)$datos["dni"],
                    "clave_provisoria" => $camposAccesoPut["clave_acceso"]
                ]
            ]);

        case "DELETE":
            $usuarioAutenticado = requerirAutenticacion(["preceptor", "administrador", "admin"]);
            $id = filter_var($_GET["id"] ?? null, FILTER_VALIDATE_INT);
            if ((!$id || $id < 1) && isset($_GET["dni"])) {
                $dniParam = trim((string)$_GET["dni"]);
                $jurisParam = isset($_GET["jurisdiccion"]) ? trim($_GET["jurisdiccion"]) : null;
                if ($jurisParam) {
                    $qBusca = $conexion->prepare("SELECT id FROM estudiantes WHERE dni = ? AND LOWER(jurisdiccion) = LOWER(?) LIMIT 1");
                    $qBusca->execute([$dniParam, $jurisParam]);
                } else {
                    $qBusca = $conexion->prepare("SELECT id FROM estudiantes WHERE dni = ? LIMIT 1");
                    $qBusca->execute([$dniParam]);
                }
                $fila = $qBusca->fetch();
                if ($fila) {
                    $id = (int)$fila["id"];
                }
            }

            if ($id === false || $id === null || $id < 1) {
                responder(400, ["error" => "Falta un id o DNI válido en la URL"]);
            }

            $consulta = $conexion->prepare(
                "SELECT id FROM estudiantes WHERE id = ?"
            );
            $consulta->execute([$id]);

            if (!$consulta->fetch()) {
                responder(404, ["error" => "Estudiante no encontrado"]);
            }

            $consulta = $conexion->prepare(
                "DELETE FROM estudiantes WHERE id = ?"
            );
            $consulta->execute([$id]);

            responder(200, [
                "mensaje" => "Estudiante eliminado correctamente"
            ]);

        default:
            header("Allow: GET, POST, PUT, DELETE");
            responder(405, ["error" => "Método HTTP no permitido"]);
    }

} catch (PDOException $e) {
    error_log("Error en alumnos.php: " . $e->getMessage());

    if ($e->getCode() === "23000") {
        responder(409, [
            "error" => "No se puede guardar o eliminar el registro por una restricción de la base de datos"
        ]);
    }

    responder(500, ["error" => "Error al consultar la base de datos"]);

} catch (Throwable $e) {
    error_log("Error en alumnos.php: " . $e->getMessage());
    responder(500, ["error" => "Ocurrió un error interno"]);
}
