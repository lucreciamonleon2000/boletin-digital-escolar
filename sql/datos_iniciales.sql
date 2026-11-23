-- =============================================================================
-- BOLETÍN DIGITAL ESCOLAR - DATOS INICIALES Y DE PRUEBA
-- Archivo: sql/datos_iniciales.sql
-- Descripción: Carga datos de prueba para las dos escuelas oficiales del sistema:
--   1. EPES N° 19 Vuelta de Obligado (Jurisdicción Formosa - Régimen Trimestral con PAIR)
--   2. E.E.S. N° 5 (Jurisdicción Buenos Aires - Régimen Cuatrimestral con R.I.T.E.)
-- =============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. INSTITUCIONES EDUCATIVAS (FORMOSA = 1, BUENOS AIRES = 2)
-- -----------------------------------------------------------------------------
INSERT INTO `instituciones` (`id`, `nombre`, `cue`, `nivel`, `subtitulo`, `regimen`, `jurisdiccion`) VALUES
(1, 'EPES N° 19 Vuelta de Obligado', '3400124-00', 'Secundario', 'Delegación Zonal Pilcomayo | Laguna Naineck', 'Secundaria 3 Trimestres con PAIR', 'formosa'),
(2, 'E.E.S. N° 5', '0604123-00', 'Secundario', 'Ciclo Lectivo 2026', 'Secundaria Cuatrimestral (R.I.T.E.)', 'pba')
ON DUPLICATE KEY UPDATE 
  `nombre` = VALUES(`nombre`),
  `cue` = VALUES(`cue`),
  `nivel` = VALUES(`nivel`),
  `subtitulo` = VALUES(`subtitulo`),
  `regimen` = VALUES(`regimen`),
  `jurisdiccion` = VALUES(`jurisdiccion`);

-- -----------------------------------------------------------------------------
-- 2. ESTRUCTURA CURRICULAR: CURSOS Y DIVISIONES
-- -----------------------------------------------------------------------------
-- Formosa (id_institucion = 1): Ciclo Básico y Ciclo Orientado (Naturales y Sociales)
INSERT INTO `cursos` (`id`, `codigo_curso`, `nombre`, `turno`, `ciclo`, `anio`, `division`, `orientacion`, `id_institucion`) VALUES
-- Ciclo Básico
(1,  '1-1',    '1° I',   'Turno Mañana', 'basico',    1, 'I',   'Ciclo Básico', 1),
(2,  '1-2',    '1° II',  'Turno Tarde',  'basico',    1, 'II',  'Ciclo Básico', 1),
(3,  '1-3',    '1° III', 'Turno Mañana', 'basico',    1, 'III', 'Ciclo Básico', 1),
(4,  '2-1',    '2° I',   'Turno Mañana', 'basico',    2, 'I',   'Ciclo Básico', 1),
(5,  '2-2',    '2° II',  'Turno Tarde',  'basico',    2, 'II',  'Ciclo Básico', 1),
(6,  '2-3',    '2° III', 'Turno Mañana', 'basico',    2, 'III', 'Ciclo Básico', 1),
(7,  '3-1',    '3° I',   'Turno Mañana', 'basico',    3, 'I',   'Ciclo Básico', 1),
(8,  '3-2',    '3° II',  'Turno Tarde',  'basico',    3, 'II',  'Ciclo Básico', 1),
(9,  '3-3',    '3° III', 'Turno Mañana', 'basico',    3, 'III', 'Ciclo Básico', 1),

-- Ciclo Orientado - Ciencias Naturales
(10, '4-cn-1', '4° I',   'Turno Mañana', 'orientado', 4, 'I',   'Ciencias Naturales', 1),
(11, '4-cn-2', '4° II',  'Turno Tarde',  'orientado', 4, 'II',  'Ciencias Naturales', 1),
(12, '5-cn-1', '5° I',   'Turno Mañana', 'orientado', 5, 'I',   'Ciencias Naturales', 1),
(13, '5-cn-2', '5° II',  'Turno Tarde',  'orientado', 5, 'II',  'Ciencias Naturales', 1),
(14, '6-cn-1', '6° I',   'Turno Tarde',  'orientado', 6, 'I',   'Ciencias Naturales', 1),

-- Ciclo Orientado - Ciencias Sociales
(15, '4-cs-1', '4° I',   'Turno Mañana', 'orientado', 4, 'I',   'Ciencias Sociales', 1),
(16, '4-cs-2', '4° II',  'Turno Tarde',  'orientado', 4, 'II',  'Ciencias Sociales', 1),
(17, '5-cs-1', '5° I',   'Turno Mañana', 'orientado', 5, 'I',   'Ciencias Sociales', 1),
(18, '5-cs-2', '5° II',  'Turno Tarde',  'orientado', 5, 'II',  'Ciencias Sociales', 1),
(19, '6-cs-1', '6° I',   'Turno Mañana', 'orientado', 6, 'I',   'Ciencias Sociales', 1),
(20, '6-cs-2', '6° II',  'Turno Tarde',  'orientado', 6, 'II',  'Ciencias Sociales', 1),

-- Buenos Aires (id_institucion = 2): Ciclo Básico y Ciclo Orientado
(21, 'pba-1-u', '1° Única', 'Turno Mañana', 'basico',    1, 'Única', 'Ciclo Básico',     2),
(22, 'pba-2-u', '2° Única', 'Turno Mañana', 'basico',    2, 'Única', 'Ciclo Básico',     2),
(23, 'pba-3-u', '3° Única', 'Turno Mañana', 'basico',    3, 'Única', 'Ciclo Básico',     2),
(24, 'pba-4-u', '4° Única', 'Turno Mañana', 'orientado', 4, 'Única', 'Ciencias Sociales', 2),
(25, 'pba-5-u', '5° Única', 'Turno Mañana', 'orientado', 5, 'Única', 'Ciencias Sociales', 2),
(26, 'pba-6-u', '6° Única', 'Turno Mañana', 'orientado', 6, 'Única', 'Ciencias Sociales', 2)
ON DUPLICATE KEY UPDATE 
  `nombre` = VALUES(`nombre`),
  `turno` = VALUES(`turno`),
  `ciclo` = VALUES(`ciclo`),
  `anio` = VALUES(`anio`),
  `division` = VALUES(`division`),
  `orientacion` = VALUES(`orientacion`);

-- -----------------------------------------------------------------------------
-- 3. ESTUDIANTES DE EJEMPLO
-- -----------------------------------------------------------------------------
INSERT INTO `estudiantes` (`id`, `dni`, `nombre`, `apellido`, `jurisdiccion`, `id_institucion`, `curso`, `seccion`, `nombre_tutor`, `clave_acceso`, `email_estudiante`, `email_tutor`, `dni_tutor`) VALUES
-- Formosa (Institución 1)
(1, '34567890', 'Mateo',            'Gómez',     'formosa', 1, '2°', 'III',    'Gómez Pedro',         '7890', 'mateo.gomez@escuela.edu.ar',    'pedro@gmail.com',               '24567890'),
(2, '49901234', 'Lucas',            'Benítez',   'formosa', 1, '4°', 'I (CS)', 'Benítez Juan Carlos', '1234', 'lucas.benitez@escuela.edu.ar',  'juancarlos.benitez@gmail.com',  '23901234'),
(3, '50345678', 'Joaquín Alejandro','Medina',    'formosa', 1, '5°', 'I (CS)', 'Medina Roberto',      '5678', 'joaquin.medina@escuela.edu.ar', 'roberto.medina@gmail.com',      '25345678'),
(4, '50456789', 'Camila Belén',     'Ríos',      'formosa', 1, '6°', 'I (CS)', 'Ríos Marcela',        '6789', 'camila.rios@escuela.edu.ar',    'marcela.rios@gmail.com',        '26456789'),
(5, '49876543', 'Lucía',            'Fernández', 'formosa', 1, '4°', 'I (CN)', 'Fernández Esteban',   '6543', 'lucia.fernandez@escuela.edu.ar','esteban.fernandez@gmail.com',   '24876543'),
(6, '50123456', 'Tomás',            'Vera',      'formosa', 1, '5°', 'I (CN)', 'Vera Sandra',         '3456', 'tomas.vera@escuela.edu.ar',     'sandra.vera@gmail.com',         '25123456'),

-- Buenos Aires (Institución 2)
(7, '48763736', 'Uriel Luciano',    'Pleininger','pba',     2, '4°', 'Única',  'Pleininger Cristian', '3736', 'uriel.pleininger@escuela.edu.ar','cristian@gmail.com',            '28763736'),
(8, '47100001', 'Valentina',        'Morales',   'pba',     2, '1°', 'Única',  'Morales Laura',       '0001', 'valentina.morales@escuela.edu.ar','laura.morales@gmail.com',      '27100001'),
(9, '47100002', 'Lautaro',          'Benítez',   'pba',     2, '2°', 'Única',  'Benítez Carlos',      '0002', 'lautaro.benitez@escuela.edu.ar','carlos.benitez@gmail.com',      '27100002'),
(10,'47100003', 'Gianella',         'Ríos',      'pba',     2, '3°', 'Única',  'Ríos Marta',          '0003', 'gianella.rios@escuela.edu.ar',  'marta.rios@gmail.com',          '27100003'),
(11,'47100004', 'Alma',             'Paredes',   'pba',     2, '5°', 'Única',  'Paredes Julio',       '0004', 'alma.paredes@escuela.edu.ar',   'julio.paredes@gmail.com',       '27100004'),
(12,'47100005', 'Diego',            'Morales',   'pba',     2, '6°', 'Única',  'Morales Andrés',      '0005', 'diego.morales@escuela.edu.ar',  'andres.morales@gmail.com',      '27100005')
ON DUPLICATE KEY UPDATE 
  `nombre` = VALUES(`nombre`),
  `apellido` = VALUES(`apellido`),
  `curso` = VALUES(`curso`),
  `seccion` = VALUES(`seccion`),
  `nombre_tutor` = VALUES(`nombre_tutor`),
  `clave_acceso` = COALESCE(`clave_acceso`, VALUES(`clave_acceso`)),
  `email_estudiante` = COALESCE(`email_estudiante`, VALUES(`email_estudiante`)),
  `email_tutor` = COALESCE(`email_tutor`, VALUES(`email_tutor`)),
  `dni_tutor` = COALESCE(`dni_tutor`, VALUES(`dni_tutor`));

-- -----------------------------------------------------------------------------
-- 4. MATERIAS
-- -----------------------------------------------------------------------------
INSERT INTO `materias` (`id`, `nombre_materia`) VALUES
(1,  'Lengua y Literatura'),
(2,  'Matemática'),
(3,  'Geografía'),
(4,  'Seminarios o Talleres de Historia'),
(5,  'Formación Ética y Compromiso Comunitario'),
(6,  'Educación Física'),
(7,  'Físico - Química'),
(8,  'Biología'),
(9,  'Educación Tecnológica'),
(10, 'Lengua Extranjera (Inglés)'),
(11, 'Educación Artística (Música)'),
(12, 'Tutoría: Fortalecimiento del Estudiante'),
(13, 'Historia'),
(14, 'Física'),
(15, 'Química'),
(16, 'Filosofía'),
(17, 'Economía'),
(18, 'Tecnologías de la Información y Comunicación'),
(19, 'Prácticas del Lenguaje'),
(20, 'Literatura'),
(21, 'Ciencias Sociales'),
(22, 'Ciencias Naturales'),
(23, 'Construcción de Ciudadanía'),
(24, 'NTICX'),
(25, 'Psicología'),
(26, 'Introducción a la Comunicación')
ON DUPLICATE KEY UPDATE `nombre_materia` = VALUES(`nombre_materia`);

-- -----------------------------------------------------------------------------
-- 5. NOTAS Y CALIFICACIONES DE EJEMPLO
-- -----------------------------------------------------------------------------
-- Formosa: Alumno Mateo Gómez (DNI 34567890 - 2° III Ciclo Básico)
INSERT INTO `notas` (`id`, `dni_estudiante`, `materia`, `periodo`, `nota_numerica`, `valoracion_conceptual`, `observacion`, `id_institucion`) VALUES
(1,  '34567890', 'Lengua y Literatura',                     '1° Trimestre', 8,  'MB', 'Muy buena participación oral y escrita.', 1),
(2,  '34567890', 'Matemática',                              '1° Trimestre', 9,  'SO', 'Excelente resolución en álgebra y geometría.', 1),
(3,  '34567890', 'Geografía',                               '1° Trimestre', 8,  'MB', 'Presenta trabajos prácticos completos.', 1),
(4,  '34567890', 'Seminarios o Talleres de Historia',       '1° Trimestre', 7,  'B',  'Cumple con los contenidos requeridos.', 1),
(5,  '34567890', 'Formación Ética y Compromiso Comunitario', '1° Trimestre', 8,  'MB', 'Comprometido en debates grupales.', 1),
(6,  '34567890', 'Educación Física',                        '1° Trimestre', 9,  'SO', 'Destacada participación deportiva.', 1),
(7,  '34567890', 'Físico - Química',                        '1° Trimestre', 7,  'B',  'Buen manejo en actividades de laboratorio.', 1),
(8,  '34567890', 'Biología',                                '1° Trimestre', 8,  'MB', 'Correcta entrega de esquemas conceptuales.', 1),
(9,  '34567890', 'Educación Tecnológica',                   '1° Trimestre', 8,  'MB', 'Muy buen desarrollo en proyectos técnicos.', 1),
(10, '34567890', 'Lengua Extranjera (Inglés)',              '1° Trimestre', 9,  'SO', 'Fluidez en lectura y comprensión.', 1),
(11, '34567890', 'Educación Artística (Música)',            '1° Trimestre', 10, 'SO', 'Excelente destreza auditiva y musical.', 1),

-- Formosa: Alumno Lucas Benítez (DNI 49901234 - 4° I Ciclo Orientado Cs. Sociales)
(12, '49901234', 'Lengua y Literatura',                          '1° Trimestre', 9,  'SO', 'Lecturas al día y excelentes ensayos.', 1),
(13, '49901234', 'Matemática',                                   '1° Trimestre', 7,  'B',  'Aprobado satisfactoriamente.', 1),
(14, '49901234', 'Historia',                                     '1° Trimestre', 8,  'MB', 'Buen análisis de fuentes históricas.', 1),
(15, '49901234', 'Geografía',                                    '1° Trimestre', 8,  'MB', 'Comprensión sólida de cartografía.', 1),
(16, '49901234', 'Física',                                       '1° Trimestre', 7,  'B',  'Resuelve problemas de cinemática.', 1),
(17, '49901234', 'Química',                                      '1° Trimestre', 10, 'SO', 'Excelente desempeño en estequiometría.', 1),
(18, '49901234', 'Filosofía',                                    '1° Trimestre', 6,  'B',  'Participación activa en reflexiones éticas.', 1),
(19, '49901234', 'Economía',                                     '1° Trimestre', 5,  'R',  'Requiere afianzar conceptos macroeconómicos.', 1),
(20, '49901234', 'Lengua Extranjera (Inglés)',                   '1° Trimestre', 10, 'SO', 'Excelente dominio de vocabulario.', 1),
(21, '49901234', 'Educación Física',                             '1° Trimestre', 8,  'MB', 'Asistencia y condición física destacada.', 1),
(22, '49901234', 'Tecnologías de la Información y Comunicación', '1° Trimestre', 8,  'MB', 'Dominio de herramientas digitales.', 1),

-- Buenos Aires: Alumno Uriel Pleininger (DNI 48763736 - 4° Única Ciclo Orientado R.I.T.E.)
(23, '48763736', 'Literatura',                     '1° Cuatrimestre', 8,  'TEA', 'Trayectoria Educativa Avanzada. Cumple objetivos.', 2),
(24, '48763736', 'Matemática',                     '1° Cuatrimestre', 7,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(25, '48763736', 'Historia',                       '1° Cuatrimestre', 5,  'TEP', 'Trayectoria Educativa en Proceso. Reforzar temas.', 2),
(26, '48763736', 'Geografía',                      '1° Cuatrimestre', 9,  'TEA', 'Trayectoria Educativa Avanzada con honores.', 2),
(27, '48763736', 'Introducción a la Física',       '1° Cuatrimestre', 7,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(28, '48763736', 'Biología',                       '1° Cuatrimestre', 6,  'TEP', 'Trayectoria Educativa en Proceso.', 2),
(29, '48763736', 'Inglés',                         '1° Cuatrimestre', 8,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(30, '48763736', 'Educación Física',               '1° Cuatrimestre', 9,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(31, '48763736', 'NTICX',                          '1° Cuatrimestre', 8,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(32, '48763736', 'Psicología',                     '1° Cuatrimestre', 7,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(33, '48763736', 'Introducción a la Comunicación', '1° Cuatrimestre', 8,  'TEA', 'Trayectoria Educativa Avanzada.', 2),
(34, '48763736', 'Construcción Ciudadana',         '1° Cuatrimestre', 9,  'TEA', 'Trayectoria Educativa Avanzada.', 2)
ON DUPLICATE KEY UPDATE 
  `nota_numerica` = VALUES(`nota_numerica`),
  `valoracion_conceptual` = VALUES(`valoracion_conceptual`),
  `observacion` = VALUES(`observacion`);

-- -----------------------------------------------------------------------------
-- 6. ASISTENCIAS
-- -----------------------------------------------------------------------------
INSERT INTO `asistencias` (`id`, `dni_estudiante`, `periodo`, `dias_habiles`, `asistencias`, `inasistencias`, `justificadas`, `id_institucion`) VALUES
(1, '34567890', '1° Trimestre',    96, 96, 0,  0, 1),
(2, '49901234', '1° Trimestre',    96, 94, 2,  2, 1),
(3, '50345678', '1° Trimestre',    96, 95, 1,  1, 1),
(4, '50456789', '1° Trimestre',    96, 96, 0,  0, 1),
(5, '48763736', '1° Cuatrimestre', 82, 65, 17, 0, 2),
(6, '47100001', '1° Cuatrimestre', 82, 80, 2,  2, 2)
ON DUPLICATE KEY UPDATE 
  `dias_habiles` = VALUES(`dias_habiles`),
  `asistencias` = VALUES(`asistencias`),
  `inasistencias` = VALUES(`inasistencias`),
  `justificadas` = VALUES(`justificadas`);

-- -----------------------------------------------------------------------------
-- 7. MESAS DE EXAMEN
-- -----------------------------------------------------------------------------
INSERT INTO `mesas_examen` (`id`, `codigo_mesa`, `materia`, `curso`, `mes`, `turno`, `docentes`, `fecha`, `hora`, `estado`, `id_institucion`) VALUES
(1, 'MESA-FOR-01', 'Matemática',                   'Ciclo Básico',    'Diciembre', 'Turno Diciembre 2026', 'Prof. Ramírez, Prof. Gómez',     '2026-12-14', '08:00', 'abierta', 1),
(2, 'MESA-FOR-02', 'Lengua Extranjera (Inglés)',   'Ciclo Básico',    'Diciembre', 'Turno Diciembre 2026', 'Prof. Martínez, Prof. Benítez',   '2026-12-16', '10:30', 'abierta', 1),
(3, 'MESA-FOR-03', 'Física',                       'Ciclo Orientado', 'Diciembre', 'Turno Diciembre 2026', 'Prof. Acosta, Prof. Fernández',   '2026-12-18', '08:30', 'abierta', 1),
(4, 'MESA-PBA-01', 'Historia',                     '4° Año',          'Diciembre', 'Turno Diciembre 2026', 'Prof. Gómez, Prof. Silva',        '2026-12-07', '08:00', 'abierta', 2),
(5, 'MESA-PBA-02', 'Biología',                     '4° Año',          'Diciembre', 'Turno Diciembre 2026', 'Prof. Herrera, Prof. Vega',       '2026-12-09', '09:00', 'abierta', 2)
ON DUPLICATE KEY UPDATE 
  `materia` = VALUES(`materia`),
  `curso` = VALUES(`curso`),
  `fecha` = VALUES(`fecha`),
  `hora` = VALUES(`hora`),
  `docentes` = VALUES(`docentes`);

-- -----------------------------------------------------------------------------
-- 8. INSCRIPCIONES A MESAS DE EXAMEN
-- -----------------------------------------------------------------------------
INSERT INTO `inscripciones_mesas` (`id`, `id_mesa`, `codigo_mesa`, `dni_estudiante`, `nombre_estudiante`, `curso`, `condicion`, `fecha_inscripcion`, `estado`, `id_institucion`) VALUES
(1, 1, 'MESA-FOR-01', '34567890', 'GÓMEZ, MATEO',             '2° III',   'Regular', '12/10/2026 14:30', 'confirmada', 1),
(2, 2, 'MESA-FOR-02', '34567890', 'GÓMEZ, MATEO',             '2° III',   'Regular', '14/10/2026 11:20', 'confirmada', 1),
(3, 4, 'MESA-PBA-01', '48763736', 'PLEININGER, URIEL LUCIANO', '4° Única', 'Regular', '20/11/2026 09:15', 'confirmada', 2)
ON DUPLICATE KEY UPDATE 
  `condicion` = VALUES(`condicion`),
  `estado` = VALUES(`estado`);

-- -----------------------------------------------------------------------------
-- 9. NOTIFICACIONES INSTITUCIONALES
-- -----------------------------------------------------------------------------
INSERT INTO `notificaciones` (`id`, `codigo_notificacion`, `titulo`, `contenido`, `categoria`, `prioridad`, `color`, `fecha`, `emisor`, `destinatario`, `estado`, `id_institucion`) VALUES
(1, 'NOTIF-FOR-01', 'Publicación Oficial de Calificaciones del 1° Trimestre', 
 'Se informa a los tutores que se encuentran publicadas y ratificadas las calificaciones correspondientes al primer periodo lectivo trimestral.', 
 'Boletines y Calificaciones', 'alta', '#38bdf8', '2026-06-15', 'Secretaría Académica', 'Todos los Cursos', 'activa', 1),

(2, 'NOTIF-FOR-02', 'Convocatoria a Mesas de Examen Previas - Turno Diciembre', 
 'Se encuentra abierta la inscripción formal para mesas de previas y libres del ciclo lectivo 2026. Consultar fechas con Preceptoría.', 
 'Mesas de Examen', 'normal', '#a855f7', '2026-11-01', 'Preceptoría General', 'Ciclo Básico y Orientado', 'activa', 1),

(3, 'NOTIF-PBA-01', 'Cierre de Valoración Pedagógica del 1° Cuatrimestre (R.I.T.E.)', 
 'Familias: se encuentra disponible el informe de valoración conceptual (TEA / TEP / TED) de cada espacio curricular en el portal oficial.', 
 'R.I.T.E. y Calificaciones', 'alta', '#10b981', '2026-07-10', 'Equipo Directivo', 'Comunidad Educativa', 'activa', 2)
ON DUPLICATE KEY UPDATE 
  `titulo` = VALUES(`titulo`),
  `contenido` = VALUES(`contenido`),
  `fecha` = VALUES(`fecha`);

-- -----------------------------------------------------------------------------
-- 10. MATERIAS PREVIAS Y EQUIVALENCIAS
-- -----------------------------------------------------------------------------
INSERT INTO `previas` (`id`, `dni_estudiante`, `materia`, `calificacion`, `estado`, `fecha`, `curso_origen`, `fecha_aprobacion`, `id_institucion`) VALUES
(1, '34567890', 'Geografía', '8', 'Aprobada', '15/12/2025', '1° Año', '15/12/2025', 1),
(2, '49901234', 'Biología',  '7', 'Aprobada', '18/12/2025', '2° Año', '18/12/2025', 1),
(3, '50345678', 'Física',    '6', 'Pendiente', 'A rendir',   '3° Año', NULL,         1),
(4, '48763736', 'Historia',  '8', 'Aprobada', '14/12/2025', '2° Año', '14/12/2025', 2)
ON DUPLICATE KEY UPDATE 
  `calificacion` = VALUES(`calificacion`),
  `estado` = VALUES(`estado`),
  `fecha_aprobacion` = VALUES(`fecha_aprobacion`);

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
-- FIN DE DATOS INICIALES
-- =============================================================================
