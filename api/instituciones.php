<?php
// api/instituciones.php
// API para gestión de datos institucionales, ciclos educativos, divisiones y orientaciones

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");



if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit;
}

require_once __DIR__ . "/conexion.php";

// Helpers modulares provistos por conexion.php -> config.php (responder, leerJsonBody)

$metodo = $_SERVER["REQUEST_METHOD"];

// GET: Obtener instituciones y sus cursos/divisiones
if ($metodo === "GET") {
    $idInstitucion = isset($_GET["id_institucion"]) && $_GET["id_institucion"] !== "" ? intval($_GET["id_institucion"]) : null;
    $jurisdiccion = isset($_GET["jurisdiccion"]) ? trim(strtolower($_GET["jurisdiccion"])) : "";

    if ($idInstitucion === null && $jurisdiccion !== "") {
        $idInstitucion = ($jurisdiccion === "pba") ? 2 : 1;
    }

    try {
        // Obtener instituciones
        if ($idInstitucion !== null && $idInstitucion > 0) {
            $stmtInst = $conexion->prepare("SELECT * FROM instituciones WHERE id = ?");
            $stmtInst->execute([$idInstitucion]);
        } else {
            $stmtInst = $conexion->query("SELECT * FROM instituciones ORDER BY id ASC");
        }
        $instituciones = $stmtInst->fetchAll(PDO::FETCH_ASSOC);

        // Obtener cursos para cada institución encontrada
        $resultado = [];
        foreach ($instituciones as $inst) {
            $idInst = intval($inst["id"]);
            $instKey = ($idInst === 2) ? "inst-pba" : "inst-formosa";

            $stmtCursos = $conexion->prepare("
                SELECT * FROM cursos 
                WHERE id_institucion = ? 
                ORDER BY ciclo ASC, anio ASC, division ASC
            ");
            $stmtCursos->execute([$idInst]);
            $cursosDb = $stmtCursos->fetchAll(PDO::FETCH_ASSOC);

            $cursosMapeados = [];
            $orientaciones = [];

            foreach ($cursosDb as $c) {
                $cursosMapeados[] = [
                    "id" => $c["codigo_curso"] ?: (string)$c["id"],
                    "id_db" => intval($c["id"]),
                    "codigo_curso" => $c["codigo_curso"],
                    "nombre" => $c["nombre"],
                    "turno" => $c["turno"] ?: "Turno Mañana",
                    "ciclo" => $c["ciclo"] ?: "basico",
                    "anio" => intval($c["anio"]),
                    "division" => $c["division"],
                    "orientacion" => $c["orientacion"] ?: ($c["ciclo"] === "orientado" ? "Ciencias Naturales" : "Ciclo Básico"),
                    "institucionId" => $instKey,
                    "id_institucion" => $idInst
                ];

                if (!empty($c["orientacion"]) && !in_array($c["orientacion"], $orientaciones)) {
                    $orientaciones[] = $c["orientacion"];
                }
            }

            $resultado[] = [
                "id" => $instKey,
                "id_db" => $idInst,
                "nombre" => $inst["nombre"],
                "cue" => $inst["cue"] ?: ($idInst === 2 ? "0604123-00" : "3400124-00"),
                "nivel" => $inst["nivel"] ?: "Secundario",
                "subtitulo" => $inst["subtitulo"],
                "regimen" => $inst["regimen"],
                "jurisdiccion" => $inst["jurisdiccion"] ?: ($idInst === 2 ? "pba" : "formosa"),
                "configurado" => true,
                "orientaciones" => $orientaciones,
                "cursos" => $cursosMapeados
            ];
        }

        // Si se solicitó una institución específica, devolver el objeto directamente o en array
        if ($idInstitucion !== null && count($resultado) === 1) {
            responder(200, $resultado[0]);
        }

        responder(200, $resultado);
    } catch (PDOException $e) {
       error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}

// POST: Modificar datos de institución, cursos, divisiones u orientaciones
if ($metodo === "POST") {
    $datos = leerJsonBody();

    $accion = isset($datos["accion"]) ? trim($datos["accion"]) : "guardar_institucion";

    try {
        // ACCIÓN 1: GUARDAR O EDITAR DATOS DE LA INSTITUCIÓN
        if ($accion === "guardar_institucion") {
            $idInstitucion = isset($datos["id_institucion"]) ? intval($datos["id_institucion"]) : 0;
            $jurisdiccion = isset($datos["jurisdiccion"]) ? trim(strtolower($datos["jurisdiccion"])) : "";

            if ($idInstitucion <= 0 && $jurisdiccion !== "") {
                $idInstitucion = ($jurisdiccion === "pba") ? 2 : 1;
            }
            if ($idInstitucion <= 0) {
                $idInstitucion = 1;
            }

            $nombre = isset($datos["nombre"]) ? trim($datos["nombre"]) : "";
            $cue = isset($datos["cue"]) ? trim($datos["cue"]) : "";
            $nivel = isset($datos["nivel"]) ? trim($datos["nivel"]) : "Secundario";
            $subtitulo = isset($datos["subtitulo"]) ? trim($datos["subtitulo"]) : "";
            $regimen = isset($datos["regimen"]) ? trim($datos["regimen"]) : "";

            if ($nombre === "") {
                responder(400, ["error" => "El nombre de la institución es obligatorio"]);
            }

            if ($regimen === "") {
                $regimen = ($idInstitucion === 2 || $jurisdiccion === "pba")
                    ? "Secundaria Cuatrimestral (R.I.T.E.)"
                    : "Secundaria 3 Trimestres con PAIR";
            }
            if ($jurisdiccion === "") {
                $jurisdiccion = ($idInstitucion === 2) ? "pba" : "formosa";
            }

            $stmtUpd = $conexion->prepare("
                UPDATE instituciones 
                SET nombre = ?, cue = ?, nivel = ?, subtitulo = ?, regimen = ?, jurisdiccion = ?
                WHERE id = ?
            ");
            $stmtUpd->execute([$nombre, $cue, $nivel, $subtitulo, $regimen, $jurisdiccion, $idInstitucion]);

            responder(200, [
                "mensaje" => "Datos de la institución guardados con éxito en MySQL",
                "id_institucion" => $idInstitucion,
                "nombre" => $nombre,
                "cue" => $cue,
                "nivel" => $nivel,
                "subtitulo" => $subtitulo,
                "regimen" => $regimen,
                "jurisdiccion" => $jurisdiccion
            ]);
        }

        // ACCIÓN 2: GUARDAR O EDITAR UN CURSO / DIVISIÓN
        if ($accion === "guardar_curso") {
            $idInstitucion = isset($datos["id_institucion"]) ? intval($datos["id_institucion"]) : 0;
            $codigoCurso = isset($datos["codigo_curso"]) ? trim($datos["codigo_curso"]) : (isset($datos["id"]) ? trim($datos["id"]) : "");
            $nombre = isset($datos["nombre"]) ? trim($datos["nombre"]) : "";
            $turno = isset($datos["turno"]) && trim($datos["turno"]) !== "" ? trim($datos["turno"]) : "Turno Mañana";
            $ciclo = isset($datos["ciclo"]) && in_array(trim($datos["ciclo"]), ["basico", "orientado"]) ? trim($datos["ciclo"]) : "basico";
            $anio = isset($datos["anio"]) ? intval($datos["anio"]) : 1;
            $division = isset($datos["division"]) && trim($datos["division"]) !== "" ? trim($datos["division"]) : "I";
            $orientacion = isset($datos["orientacion"]) && trim($datos["orientacion"]) !== "" ? trim($datos["orientacion"]) : ($ciclo === "orientado" ? "Ciencias Naturales" : "Ciclo Básico");

            if ($idInstitucion <= 0) {
                responder(400, ["error" => "ID de institución obligatorio"]);
            }
            if ($nombre === "") {
                $nombre = $anio . "° " . $division;
            }

            // Generar código si no viene
            if ($codigoCurso === "") {
                $prefijo = ($idInstitucion === 2) ? "pba-" : "";
                $codOri = ($ciclo === "orientado") ? ("-" . strtolower(substr(preg_replace('/[^a-zA-Z]/', '', $orientacion), 0, 2)) . "-") : "-";
                $codigoCurso = $prefijo . $anio . $codOri . strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $division));
            }

            // Verificar si el curso ya existe
            $stmtCheck = $conexion->prepare("SELECT id FROM cursos WHERE codigo_curso = ? OR (id_institucion = ? AND anio = ? AND division = ? AND orientacion = ?) LIMIT 1");
            $stmtCheck->execute([$codigoCurso, $idInstitucion, $anio, $division, $orientacion]);
            $cursoExistente = $stmtCheck->fetch(PDO::FETCH_ASSOC);

            if ($cursoExistente) {
                // Actualizar
                $stmtUpdCurso = $conexion->prepare("
                    UPDATE cursos 
                    SET nombre = ?, turno = ?, ciclo = ?, anio = ?, division = ?, orientacion = ?, id_institucion = ?
                    WHERE id = ?
                ");
                $stmtUpdCurso->execute([$nombre, $turno, $ciclo, $anio, $division, $orientacion, $idInstitucion, $cursoExistente["id"]]);

                responder(200, [
                    "mensaje" => "División / Curso actualizado con éxito en MySQL",
                    "id" => $codigoCurso,
                    "id_db" => intval($cursoExistente["id"])
                ]);
            } else {
                // Insertar
                $stmtInsCurso = $conexion->prepare("
                    INSERT INTO cursos (codigo_curso, nombre, turno, ciclo, anio, division, orientacion, id_institucion)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmtInsCurso->execute([$codigoCurso, $nombre, $turno, $ciclo, $anio, $division, $orientacion, $idInstitucion]);
                $nuevoId = $conexion->lastInsertId();

                responder(201, [
                    "mensaje" => "División / Curso creado con éxito en MySQL",
                    "id" => $codigoCurso,
                    "id_db" => intval($nuevoId)
                ]);
            }
        }

        // ACCIÓN 3: RENOMBRAR UNA ORIENTACIÓN EN TODOS SUS CURSOS
        if ($accion === "renombrar_orientacion") {
            $idInstitucion = isset($datos["id_institucion"]) ? intval($datos["id_institucion"]) : 0;
            $orientacionAnterior = isset($datos["orientacion_anterior"]) ? trim($datos["orientacion_anterior"]) : "";
            $orientacionNueva = isset($datos["orientacion_nueva"]) ? trim($datos["orientacion_nueva"]) : "";

            if ($idInstitucion <= 0 || $orientacionAnterior === "" || $orientacionNueva === "") {
                responder(400, ["error" => "Parámetros obligatorios incompletos (id_institucion, orientacion_anterior, orientacion_nueva)"]);
            }

            $stmtRenom = $conexion->prepare("
                UPDATE cursos 
                SET orientacion = ? 
                WHERE id_institucion = ? AND orientacion = ?
            ");
            $stmtRenom->execute([$orientacionNueva, $idInstitucion, $orientacionAnterior]);
            $afectados = $stmtRenom->rowCount();

            responder(200, [
                "mensaje" => "Orientación renombrada de '$orientacionAnterior' a '$orientacionNueva' con éxito",
                "cursos_afectados" => $afectados,
                "orientacion_anterior" => $orientacionAnterior,
                "orientacion_nueva" => $orientacionNueva
            ]);
        }

        // ACCIÓN 4: ELIMINAR UN CURSO / DIVISIÓN
        if ($accion === "eliminar_curso") {
            $codigoCurso = isset($datos["codigo_curso"]) ? trim($datos["codigo_curso"]) : (isset($datos["id"]) ? trim($datos["id"]) : "");
            $idDb = isset($datos["id_db"]) ? intval($datos["id_db"]) : 0;

            if ($idDb > 0) {
                $stmtDel = $conexion->prepare("DELETE FROM cursos WHERE id = ?");
                $stmtDel->execute([$idDb]);
            } elseif ($codigoCurso !== "") {
                $stmtDel = $conexion->prepare("DELETE FROM cursos WHERE codigo_curso = ?");
                $stmtDel->execute([$codigoCurso]);
            } else {
                responder(400, ["error" => "ID o código de curso no especificado"]);
            }

            responder(200, ["mensaje" => "División / Curso eliminado correctamente de MySQL"]);
        }

        responder(400, ["error" => "Acción no reconocida"]);

    } catch (PDOException $e) {
       error_log("Error: " . $e->getMessage());
    responder(500, ["error" => "Error interno del servidor"]);
    }
}
