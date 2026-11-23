<?php
// api/migracion_instituciones_cursos.php
// Migración para ampliar tabla instituciones y crear tabla cursos con divisiones y orientaciones

header("Content-Type: text/plain; charset=UTF-8");
require_once __DIR__ . "/conexion.php";

// Protección de migraciones (TP N.º 2)
protegerMigracion();

echo "=== INICIANDO MIGRACIÓN DE INSTITUCIONES Y CURSOS ===\n\n";

try {
    // 1. Ampliar tabla instituciones si faltan columnas
    echo "1. Verificando columnas de la tabla 'instituciones'...\n";
    $columnasInst = $conexion->query("DESCRIBE instituciones")->fetchAll(PDO::FETCH_COLUMN);

    if (!in_array("cue", $columnasInst)) {
        echo "   -> Agregando columna 'cue' a instituciones...\n";
        $conexion->exec("ALTER TABLE instituciones ADD COLUMN cue VARCHAR(50) NULL DEFAULT '3400124-00' AFTER nombre");
    }
    if (!in_array("nivel", $columnasInst)) {
        echo "   -> Agregando columna 'nivel' a instituciones...\n";
        $conexion->exec("ALTER TABLE instituciones ADD COLUMN nivel VARCHAR(50) NULL DEFAULT 'Secundario' AFTER cue");
    }
    if (!in_array("jurisdiccion", $columnasInst)) {
        echo "   -> Agregando columna 'jurisdiccion' a instituciones...\n";
        $conexion->exec("ALTER TABLE instituciones ADD COLUMN jurisdiccion VARCHAR(20) NULL DEFAULT 'formosa' AFTER regimen");
    }

    // Actualizar datos de las 2 instituciones oficiales
    echo "   -> Actualizando datos iniciales de las instituciones...\n";
    $stmtUpd1 = $conexion->prepare("
        UPDATE instituciones 
        SET nombre = 'EPES N° 19 Vuelta de Obligado',
            cue = '3400124-00',
            nivel = 'Secundario',
            subtitulo = 'Delegación Zonal Pilcomayo | Laguna Naineck | Ciclo Lectivo 2026',
            regimen = 'Secundaria 3 Trimestres con PAIR',
            jurisdiccion = 'formosa'
        WHERE id = 1
    ");
    $stmtUpd1->execute();

    $stmtUpd2 = $conexion->prepare("
        UPDATE instituciones 
        SET nombre = 'E.E.S. N° 5',
            cue = '0604123-00',
            nivel = 'Secundario',
            subtitulo = 'Distrito: PUAN | Nivel Secundario | Ciclo Lectivo 2026',
            regimen = 'Secundaria Cuatrimestral (R.I.T.E.)',
            jurisdiccion = 'pba'
        WHERE id = 2
    ");
    $stmtUpd2->execute();

    echo "   [OK] Tabla instituciones actualizada correctamente.\n\n";

    // 2. Crear tabla cursos
    echo "2. Creando tabla 'cursos' (ciclos, divisiones y orientaciones)...\n";
    $sqlCursos = "
    CREATE TABLE IF NOT EXISTS cursos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo_curso VARCHAR(50) NOT NULL UNIQUE,
        nombre VARCHAR(50) NOT NULL,
        turno VARCHAR(50) NOT NULL DEFAULT 'Turno Mañana',
        ciclo ENUM('basico', 'orientado') NOT NULL DEFAULT 'basico',
        anio INT NOT NULL DEFAULT 1,
        division VARCHAR(50) NOT NULL DEFAULT 'I',
        orientacion VARCHAR(100) NOT NULL DEFAULT 'Ciclo Básico',
        id_institucion INT NOT NULL,
        creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cursos_inst (id_institucion),
        INDEX idx_cursos_ciclo (ciclo),
        INDEX idx_cursos_orientacion (orientacion),
        CONSTRAINT fk_cursos_inst FOREIGN KEY (id_institucion) REFERENCES instituciones(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ";
    $conexion->exec($sqlCursos);
    echo "   [OK] Tabla 'cursos' creada o verificada.\n\n";

    // 3. Sembrar cursos iniciales para Formosa (id=1) y Buenos Aires (id=2)
    echo "3. Sembrando cursos y divisiones oficiales...\n";

    $cursosIniciales = [
        // --- FORMOSA (id_institucion = 1) ---
        // Ciclo Básico Formosa
        ["codigo" => "1-1", "nombre" => "1° I", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 1, "division" => "I", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "1-2", "nombre" => "1° II", "turno" => "Turno Tarde", "ciclo" => "basico", "anio" => 1, "division" => "II", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "1-3", "nombre" => "1° III", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 1, "division" => "III", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "2-1", "nombre" => "2° I", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 2, "division" => "I", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "2-2", "nombre" => "2° II", "turno" => "Turno Tarde", "ciclo" => "basico", "anio" => 2, "division" => "II", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "2-3", "nombre" => "2° III", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 2, "division" => "III", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "3-1", "nombre" => "3° I", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 3, "division" => "I", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "3-2", "nombre" => "3° II", "turno" => "Turno Tarde", "ciclo" => "basico", "anio" => 3, "division" => "II", "orientacion" => "Ciclo Básico", "inst" => 1],
        ["codigo" => "3-3", "nombre" => "3° III", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 3, "division" => "III", "orientacion" => "Ciclo Básico", "inst" => 1],

        // Ciclo Orientado - Ciencias Naturales Formosa
        ["codigo" => "4-cn-1", "nombre" => "4° I", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 4, "division" => "I", "orientacion" => "Ciencias Naturales", "inst" => 1],
        ["codigo" => "4-cn-2", "nombre" => "4° II", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 4, "division" => "II", "orientacion" => "Ciencias Naturales", "inst" => 1],
        ["codigo" => "5-cn-1", "nombre" => "5° I", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 5, "division" => "I", "orientacion" => "Ciencias Naturales", "inst" => 1],
        ["codigo" => "5-cn-2", "nombre" => "5° II", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 5, "division" => "II", "orientacion" => "Ciencias Naturales", "inst" => 1],
        ["codigo" => "6-cn-1", "nombre" => "6° I", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 6, "division" => "I", "orientacion" => "Ciencias Naturales", "inst" => 1],

        // Ciclo Orientado - Ciencias Sociales Formosa
        ["codigo" => "4-cs-1", "nombre" => "4° I", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 4, "division" => "I", "orientacion" => "Ciencias Sociales", "inst" => 1],
        ["codigo" => "4-cs-2", "nombre" => "4° II", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 4, "division" => "II", "orientacion" => "Ciencias Sociales", "inst" => 1],
        ["codigo" => "5-cs-1", "nombre" => "5° I", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 5, "division" => "I", "orientacion" => "Ciencias Sociales", "inst" => 1],
        ["codigo" => "5-cs-2", "nombre" => "5° II", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 5, "division" => "II", "orientacion" => "Ciencias Sociales", "inst" => 1],
        ["codigo" => "6-cs-1", "nombre" => "6° I", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 6, "division" => "I", "orientacion" => "Ciencias Sociales", "inst" => 1],
        ["codigo" => "6-cs-2", "nombre" => "6° II", "turno" => "Turno Tarde", "ciclo" => "orientado", "anio" => 6, "division" => "II", "orientacion" => "Ciencias Sociales", "inst" => 1],

        // --- BUENOS AIRES - E.E.S. N° 5 (id_institucion = 2) ---
        // Ciclo Básico PBA
        ["codigo" => "pba-1-u", "nombre" => "1° Única", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 1, "division" => "Única", "orientacion" => "Ciclo Básico", "inst" => 2],
        ["codigo" => "pba-2-u", "nombre" => "2° Única", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 2, "division" => "Única", "orientacion" => "Ciclo Básico", "inst" => 2],
        ["codigo" => "pba-3-u", "nombre" => "3° Única", "turno" => "Turno Mañana", "ciclo" => "basico", "anio" => 3, "division" => "Única", "orientacion" => "Ciclo Básico", "inst" => 2],

        // Ciclo Orientado PBA
        ["codigo" => "pba-4-u", "nombre" => "4° Única", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 4, "division" => "Única", "orientacion" => "Ciencias Sociales", "inst" => 2],
        ["codigo" => "pba-5-u", "nombre" => "5° Única", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 5, "division" => "Única", "orientacion" => "Ciencias Sociales", "inst" => 2],
        ["codigo" => "pba-6-u", "nombre" => "6° Única", "turno" => "Turno Mañana", "ciclo" => "orientado", "anio" => 6, "division" => "Única", "orientacion" => "Ciencias Sociales", "inst" => 2]
    ];

    $stmtInsertCurso = $conexion->prepare("
        INSERT INTO cursos (codigo_curso, nombre, turno, ciclo, anio, division, orientacion, id_institucion)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE 
            nombre = VALUES(nombre),
            turno = VALUES(turno),
            ciclo = VALUES(ciclo),
            anio = VALUES(anio),
            division = VALUES(division),
            orientacion = VALUES(orientacion),
            id_institucion = VALUES(id_institucion)
    ");

    $insertados = 0;
    foreach ($cursosIniciales as $c) {
        $stmtInsertCurso->execute([
            $c["codigo"],
            $c["nombre"],
            $c["turno"],
            $c["ciclo"],
            $c["anio"],
            $c["division"],
            $c["orientacion"],
            $c["inst"]
        ]);
        $insertados++;
    }

    echo "   [OK] Total de cursos sembrados/actualizados: $insertados.\n\n";
    echo "=== MIGRACIÓN FINALIZADA CON ÉXITO ===\n";

} catch (PDOException $e) {
    echo "ERROR en la migración: " . $e->getMessage() . "\n";
}
