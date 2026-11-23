<?php
require_once __DIR__ . '/conexion.php';

// Protección de migraciones (TP N.º 2)
protegerMigracion();

header("Content-Type: application/json; charset=UTF-8");

try {
    // 1. Crear tabla notificaciones
    $sqlNotif = "CREATE TABLE IF NOT EXISTS notificaciones (
        id INT AUTO_INCREMENT PRIMARY KEY,
        codigo_notificacion VARCHAR(50) DEFAULT NULL,
        titulo VARCHAR(255) NOT NULL,
        contenido TEXT NOT NULL,
        categoria VARCHAR(100) DEFAULT 'Boletines y Calificaciones',
        prioridad VARCHAR(50) DEFAULT 'normal',
        color VARCHAR(20) DEFAULT '#38bdf8',
        fecha VARCHAR(20) NOT NULL,
        emisor VARCHAR(150) DEFAULT 'Preceptoría',
        destinatario VARCHAR(255) DEFAULT 'Todos los Cursos y Familias',
        estado VARCHAR(50) DEFAULT 'activa',
        id_institucion INT NOT NULL DEFAULT 1,
        creado_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        KEY idx_inst (id_institucion),
        CONSTRAINT fk_notif_inst FOREIGN KEY (id_institucion) REFERENCES instituciones(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    $conexion->exec($sqlNotif);

    // 2. Crear tabla notificaciones_lecturas (para tracking de leído por alumno/tutor)
    $sqlLecturas = "CREATE TABLE IF NOT EXISTS notificaciones_lecturas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_notificacion INT NOT NULL,
        codigo_notificacion VARCHAR(50) DEFAULT NULL,
        dni_usuario VARCHAR(20) NOT NULL,
        rol_usuario VARCHAR(50) DEFAULT 'estudiante',
        leido_el TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_notif_usuario (id_notificacion, dni_usuario),
        KEY idx_notif (id_notificacion),
        KEY idx_dni (dni_usuario),
        CONSTRAINT fk_notif_lectura FOREIGN KEY (id_notificacion) REFERENCES notificaciones(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    $conexion->exec($sqlLecturas);

    // 3. Verificar si ya existen notificaciones creadas
    $count = $conexion->query("SELECT COUNT(*) FROM notificaciones")->fetchColumn();
    $insertadas = 0;

    if ($count == 0) {
        // Seed Formosa (id_institucion = 1)
        $notifsFormosa = [
            [
                'codigo' => 'notif-1',
                'titulo' => 'Cierre de Calificaciones y Descarga del Reporte Digital',
                'categoria' => 'Boletines y Calificaciones',
                'prioridad' => 'normal',
                'color' => '#38bdf8',
                'fecha' => '10/10/2026',
                'emisor' => 'Dirección EPES N° 19',
                'destinatario' => 'Todos los Cursos y Familias - EPES N° 19',
                'contenido' => 'Estimados tutores: Ya se encuentran registradas y visadas las calificaciones del presente período lectivo. Pueden acceder a la pestaña Boletín Oficial para consultar notas o descargar PDF.',
                'estado' => 'activa',
                'id_institucion' => 1
            ],
            [
                'codigo' => 'notif-2',
                'titulo' => 'Convocatoria a Encuentro de Familias y Diálogo Pedagógico',
                'categoria' => 'Reunión de Familias',
                'prioridad' => 'alta',
                'color' => '#22c55e',
                'fecha' => '24/10/2026',
                'emisor' => 'Preceptoría EPES N° 19',
                'destinatario' => 'Familias EPES N° 19 (Laguna Naineck)',
                'contenido' => 'Invitamos a las familias a la reunión presencial de seguimiento pedagógico en el SUM de la EPES N° 19 Vuelta de Obligado.',
                'estado' => 'activa',
                'id_institucion' => 1
            ],
            [
                'codigo' => 'notif-3',
                'titulo' => 'Canales de Contacto y Horarios de Atención Institucional',
                'categoria' => 'Atención y Preceptoría',
                'prioridad' => 'normal',
                'color' => '#fbbf24',
                'fecha' => '12/10/2026',
                'emisor' => 'Secretaría EPES N° 19',
                'destinatario' => 'Comunidad Educativa EPES N° 19',
                'contenido' => 'Recordamos que el horario de atención para consultas y trámites de reincorporación es de 07:30 a 12:30 hs (Mañana) y 13:00 a 18:00 hs (Tarde).',
                'estado' => 'activa',
                'id_institucion' => 1
            ]
        ];

        // Seed PBA (id_institucion = 2)
        $notifsPba = [
            [
                'codigo' => 'notif-pba-1',
                'titulo' => 'Publicación de Valoraciones R.I.T.E. - 1° Cuatrimestre',
                'categoria' => 'Boletines y Calificaciones',
                'prioridad' => 'normal',
                'color' => '#38bdf8',
                'fecha' => '11/10/2026',
                'emisor' => 'Dirección E.E.S. N° 5',
                'destinatario' => 'Familias y Estudiantes E.E.S. N° 5',
                'contenido' => 'Se encuentran publicadas en la plataforma las valoraciones pedagógicas del 1° Cuatrimestre (TEA, TEP, TED) según normativa vigente de la DGCyE de la Provincia de Buenos Aires.',
                'estado' => 'activa',
                'id_institucion' => 2
            ],
            [
                'codigo' => 'notif-pba-2',
                'titulo' => 'Acompañamiento e Intensificación de Aprendizajes R.I.T.E.',
                'categoria' => 'Mesas de Examen',
                'prioridad' => 'alta',
                'color' => '#22c55e',
                'fecha' => '20/10/2026',
                'emisor' => 'Preceptoría E.E.S. N° 5',
                'destinatario' => 'Estudiantes con Trayectorias en Proceso (TEP / TED)',
                'contenido' => 'Informamos las fechas del período de intensificación y compensación pedagógica para materias previas y pendientes en la E.E.S. N° 5 Distrito PUAN.',
                'estado' => 'activa',
                'id_institucion' => 2
            ],
            [
                'codigo' => 'notif-pba-3',
                'titulo' => 'Atención a Familias y Trámites Administrativos',
                'categoria' => 'Atención y Preceptoría',
                'prioridad' => 'normal',
                'color' => '#fbbf24',
                'fecha' => '14/10/2026',
                'emisor' => 'Secretaría E.E.S. N° 5',
                'destinatario' => 'Familias E.E.S. N° 5',
                'contenido' => 'El equipo de preceptoría atenderá consultas presenciales y constancias de alumno regular de lunes a viernes en el turno mañana.',
                'estado' => 'activa',
                'id_institucion' => 2
            ]
        ];

        $stmtIns = $conexion->prepare("
            INSERT INTO notificaciones (codigo_notificacion, titulo, contenido, categoria, prioridad, color, fecha, emisor, destinatario, estado, id_institucion)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        foreach (array_merge($notifsFormosa, $notifsPba) as $n) {
            $stmtIns->execute([
                $n['codigo'],
                $n['titulo'],
                $n['contenido'],
                $n['categoria'],
                $n['prioridad'],
                $n['color'],
                $n['fecha'],
                $n['emisor'],
                $n['destinatario'],
                $n['estado'],
                $n['id_institucion']
            ]);
            $insertadas++;
        }
    }

    echo json_encode([
        'exito' => true,
        'mensaje' => 'Tablas notificaciones y notificaciones_lecturas creadas correctamente en MySQL',
        'insertadas' => $insertadas
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    echo json_encode([
        'exito' => false,
        'error' => 'Error en la migración de notificaciones: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
