<?php
require_once __DIR__ . '/conexion.php';

// Protección de migraciones (TP N.º 2)
protegerMigracion();

try {
    $conexion->exec("
        CREATE TABLE IF NOT EXISTS mesas_examen (
            id INT AUTO_INCREMENT PRIMARY KEY,
            codigo_mesa VARCHAR(50) UNIQUE DEFAULT NULL,
            materia VARCHAR(150) NOT NULL,
            curso VARCHAR(100) DEFAULT 'Ciclo Básico',
            mes VARCHAR(50) DEFAULT 'Diciembre',
            turno VARCHAR(100) DEFAULT 'Turno Diciembre 2026',
            docentes VARCHAR(255) DEFAULT 'A designar',
            fecha VARCHAR(20) DEFAULT NULL,
            hora VARCHAR(10) DEFAULT '08:00',
            estado VARCHAR(20) DEFAULT 'abierta',
            id_institucion INT DEFAULT 1,
            creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $conexion->exec("
        CREATE TABLE IF NOT EXISTS inscripciones_mesas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_mesa INT NOT NULL,
            codigo_mesa VARCHAR(50) DEFAULT NULL,
            dni_estudiante VARCHAR(20) NOT NULL,
            nombre_estudiante VARCHAR(150) DEFAULT NULL,
            curso VARCHAR(50) DEFAULT NULL,
            condicion VARCHAR(30) DEFAULT 'Regular',
            fecha_inscripcion VARCHAR(50) DEFAULT NULL,
            estado VARCHAR(20) DEFAULT 'confirmada',
            id_institucion INT DEFAULT 1,
            creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_mesa_estudiante (id_mesa, dni_estudiante),
            CONSTRAINT fk_mesa_examen FOREIGN KEY (id_mesa) REFERENCES mesas_examen(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    echo "Tablas creadas con éxito.\n";

    // Seed default mesas if table is empty
    $count = $conexion->query("SELECT COUNT(*) FROM mesas_examen")->fetchColumn();
    if ($count == 0) {
        $mesasIniciales = [
            // Formosa (id_institucion = 1)
            [
                'codigo_mesa' => 'mesa-1',
                'materia' => 'Matemática',
                'curso' => '2° III',
                'mes' => 'Diciembre',
                'turno' => 'Turno Diciembre 2026',
                'docentes' => 'Prof. Ramírez, Prof. Gómez',
                'fecha' => '2026-12-14',
                'hora' => '08:00',
                'estado' => 'abierta',
                'id_institucion' => 1,
                'inscriptos' => [
                    ['dni' => '34567890', 'nombre' => 'GÓMEZ, MATEO', 'curso' => '2° III', 'condicion' => 'Regular', 'fecha' => '12/10/2026 14:30']
                ]
            ],
            [
                'codigo_mesa' => 'mesa-2',
                'materia' => 'Lenguas Extranjeras (Inglés)',
                'curso' => '2° III',
                'mes' => 'Diciembre',
                'turno' => 'Turno Diciembre 2026',
                'docentes' => 'Prof. Martínez, Prof. Benítez',
                'fecha' => '2026-12-16',
                'hora' => '10:30',
                'estado' => 'abierta',
                'id_institucion' => 1,
                'inscriptos' => [
                    ['dni' => '34567890', 'nombre' => 'GÓMEZ, MATEO', 'curso' => '2° III', 'condicion' => 'Regular', 'fecha' => '14/10/2026 11:20']
                ]
            ],
            [
                'codigo_mesa' => 'mesa-3',
                'materia' => 'Físico - Química',
                'curso' => 'Ciclo Básico',
                'mes' => 'Diciembre',
                'turno' => 'Turno Diciembre 2026',
                'docentes' => 'Prof. Herrera, Prof. Delgado',
                'fecha' => '2026-12-18',
                'hora' => '08:30',
                'estado' => 'abierta',
                'id_institucion' => 1,
                'inscriptos' => []
            ],
            // Buenos Aires (id_institucion = 2)
            [
                'codigo_mesa' => 'mesa-pba-1',
                'materia' => 'Geografía',
                'curso' => '4° Única',
                'mes' => 'Diciembre',
                'turno' => 'Turno Diciembre 2026',
                'docentes' => 'Prof. Domínguez, Prof. Morales',
                'fecha' => '2026-12-15',
                'hora' => '08:00',
                'estado' => 'abierta',
                'id_institucion' => 2,
                'inscriptos' => [
                    ['dni' => '48763736', 'nombre' => 'PLEININGER, URIEL LUCIANO', 'curso' => '4° Única', 'condicion' => 'Regular', 'fecha' => '11/10/2026 09:30']
                ]
            ],
            [
                'codigo_mesa' => 'mesa-pba-2',
                'materia' => 'Físico-Química',
                'curso' => '4° Única',
                'mes' => 'Diciembre',
                'turno' => 'Turno Diciembre 2026',
                'docentes' => 'Prof. Rossi, Prof. Delgado',
                'fecha' => '2026-12-18',
                'hora' => '10:00',
                'estado' => 'abierta',
                'id_institucion' => 2,
                'inscriptos' => [
                    ['dni' => '48763736', 'nombre' => 'PLEININGER, URIEL LUCIANO', 'curso' => '4° Única', 'condicion' => 'Regular', 'fecha' => '12/10/2026 10:15']
                ]
            ]
        ];

        $stmtMesa = $conexion->prepare("
            INSERT INTO mesas_examen (codigo_mesa, materia, curso, mes, turno, docentes, fecha, hora, estado, id_institucion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmtInsc = $conexion->prepare("
            INSERT INTO inscripciones_mesas (id_mesa, codigo_mesa, dni_estudiante, nombre_estudiante, curso, condicion, fecha_inscripcion, id_institucion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($mesasIniciales as $m) {
            $stmtMesa->execute([
                $m['codigo_mesa'],
                $m['materia'],
                $m['curso'],
                $m['mes'],
                $m['turno'],
                $m['docentes'],
                $m['fecha'],
                $m['hora'],
                $m['estado'],
                $m['id_institucion']
            ]);
            $mesaId = $conexion->lastInsertId();

            foreach ($m['inscriptos'] as $ins) {
                $stmtInsc->execute([
                    $mesaId,
                    $m['codigo_mesa'],
                    $ins['dni'],
                    $ins['nombre'],
                    $ins['curso'],
                    $ins['condicion'],
                    $ins['fecha'],
                    $m['id_institucion']
                ]);
            }
        }
        echo "Mesas e inscripciones iniciales sembradas en MySQL exitosamente.\n";
    } else {
        echo "Las tablas ya contenían $count registros.\n";
    }

} catch (PDOException $e) {
    echo "Error en migración: " . $e->getMessage() . "\n";
}
