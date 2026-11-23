
/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;
DROP TABLE IF EXISTS `asistencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `asistencias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dni_estudiante` varchar(20) DEFAULT NULL,
  `periodo` varchar(50) DEFAULT NULL,
  `dias_habiles` int(11) DEFAULT NULL,
  `asistencias` int(11) DEFAULT NULL,
  `inasistencias` int(11) DEFAULT NULL,
  `justificadas` int(11) DEFAULT NULL,
  `id_institucion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `cursos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `cursos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo_curso` varchar(50) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `turno` varchar(50) NOT NULL DEFAULT 'Turno Ma├▒ana',
  `ciclo` enum('basico','orientado') NOT NULL DEFAULT 'basico',
  `anio` int(11) NOT NULL DEFAULT 1,
  `division` varchar(50) NOT NULL DEFAULT 'I',
  `orientacion` varchar(100) NOT NULL DEFAULT 'Ciclo B├ísico',
  `id_institucion` int(11) NOT NULL,
  `creado_el` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo_curso` (`codigo_curso`),
  KEY `idx_cursos_inst` (`id_institucion`),
  KEY `idx_cursos_ciclo` (`ciclo`),
  KEY `idx_cursos_orientacion` (`orientacion`),
  CONSTRAINT `fk_cursos_inst` FOREIGN KEY (`id_institucion`) REFERENCES `instituciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `estudiantes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `estudiantes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dni` varchar(20) DEFAULT NULL,
  `nombre` varchar(50) DEFAULT NULL,
  `apellido` varchar(50) DEFAULT NULL,
  `jurisdiccion` varchar(50) DEFAULT NULL,
  `id_institucion` int(11) DEFAULT NULL,
  `curso` varchar(20) DEFAULT NULL,
  `seccion` varchar(20) DEFAULT NULL,
  `nombre_tutor` varchar(100) DEFAULT NULL,
  `clave_acceso` varchar(50) DEFAULT NULL,
  `email_estudiante` varchar(120) DEFAULT NULL,
  `email_tutor` varchar(120) DEFAULT NULL,
  `dni_tutor` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `inscripciones_mesas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `inscripciones_mesas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_mesa` int(11) NOT NULL,
  `codigo_mesa` varchar(50) DEFAULT NULL,
  `dni_estudiante` varchar(20) NOT NULL,
  `nombre_estudiante` varchar(150) DEFAULT NULL,
  `curso` varchar(50) DEFAULT NULL,
  `condicion` varchar(30) DEFAULT 'Regular',
  `fecha_inscripcion` varchar(50) DEFAULT NULL,
  `estado` varchar(20) DEFAULT 'confirmada',
  `id_institucion` int(11) DEFAULT 1,
  `creado_el` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mesa_estudiante` (`id_mesa`,`dni_estudiante`),
  CONSTRAINT `fk_mesa_examen` FOREIGN KEY (`id_mesa`) REFERENCES `mesas_examen` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `instituciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `instituciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) DEFAULT NULL,
  `cue` varchar(50) DEFAULT '3400124-00',
  `nivel` varchar(50) DEFAULT 'Secundario',
  `subtitulo` varchar(100) DEFAULT NULL,
  `regimen` varchar(50) DEFAULT NULL,
  `jurisdiccion` varchar(20) DEFAULT 'formosa',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `materias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `materias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre_materia` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `mesas_examen`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `mesas_examen` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo_mesa` varchar(50) DEFAULT NULL,
  `materia` varchar(150) NOT NULL,
  `curso` varchar(100) DEFAULT 'Ciclo B├ísico',
  `mes` varchar(50) DEFAULT 'Diciembre',
  `turno` varchar(100) DEFAULT 'Turno Diciembre 2026',
  `docentes` varchar(255) DEFAULT 'A designar',
  `fecha` varchar(20) DEFAULT NULL,
  `hora` varchar(10) DEFAULT '08:00',
  `estado` varchar(20) DEFAULT 'abierta',
  `id_institucion` int(11) DEFAULT 1,
  `creado_el` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo_mesa` (`codigo_mesa`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dni_estudiante` varchar(20) DEFAULT NULL,
  `materia` varchar(100) DEFAULT NULL,
  `periodo` varchar(50) DEFAULT NULL,
  `nota_numerica` int(11) DEFAULT NULL,
  `valoracion_conceptual` varchar(20) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `id_institucion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notificaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notificaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo_notificacion` varchar(50) DEFAULT NULL,
  `titulo` varchar(255) NOT NULL,
  `contenido` text NOT NULL,
  `categoria` varchar(100) DEFAULT 'Boletines y Calificaciones',
  `prioridad` varchar(50) DEFAULT 'normal',
  `color` varchar(20) DEFAULT '#38bdf8',
  `fecha` varchar(20) NOT NULL,
  `emisor` varchar(150) DEFAULT 'Preceptor├¡a',
  `destinatario` varchar(255) DEFAULT 'Todos los Cursos y Familias',
  `estado` varchar(50) DEFAULT 'activa',
  `id_institucion` int(11) NOT NULL DEFAULT 1,
  `creado_el` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_inst` (`id_institucion`),
  CONSTRAINT `fk_notif_inst` FOREIGN KEY (`id_institucion`) REFERENCES `instituciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `notificaciones_lecturas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `notificaciones_lecturas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_notificacion` int(11) NOT NULL,
  `codigo_notificacion` varchar(50) DEFAULT NULL,
  `dni_usuario` varchar(20) NOT NULL,
  `rol_usuario` varchar(50) DEFAULT 'estudiante',
  `leido_el` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notif_usuario` (`id_notificacion`,`dni_usuario`),
  KEY `idx_notif` (`id_notificacion`),
  KEY `idx_dni` (`dni_usuario`),
  CONSTRAINT `fk_notif_lectura` FOREIGN KEY (`id_notificacion`) REFERENCES `notificaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
DROP TABLE IF EXISTS `previas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `previas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `dni_estudiante` varchar(20) DEFAULT NULL,
  `materia` varchar(100) DEFAULT NULL,
  `calificacion` varchar(10) DEFAULT NULL,
  `estado` varchar(50) DEFAULT NULL,
  `fecha` varchar(50) DEFAULT NULL,
  `curso_origen` varchar(50) DEFAULT '1┬░ A├▒o',
  `fecha_aprobacion` varchar(50) DEFAULT NULL,
  `id_institucion` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

