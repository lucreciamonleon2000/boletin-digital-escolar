# Portal Académico y Boletín Digital

## 1. Presentación

**Nombre de la app:** Portal Académico y Boletín Digital

**Tema:** Sistema web de gestión académica y boletín digital, pensado para dos jurisdicciones con normativas distintas:

* **Provincia de Formosa** — *EPES N° 19 Vuelta de Obligado* (régimen trimestral con PAIR, Ciclo Básico y Ciclo Orientado en Ciencias Naturales y Ciencias Sociales).
* **Provincia de Buenos Aires** — *E.E.S. N° 5* (régimen cuatrimestral con R.I.T.E.).

Permite a tutores y estudiantes consultar calificaciones, asistencia, materias previas, notificaciones y mesas de examen (con inscripción), y a preceptores/docentes gestionar el padrón escolar, las instituciones y sus cursos, cargar notas por planilla sábana, registrar asistencias, publicar comunicados y administrar mesas de examen.

**Funcionalidades principales:**
* **Boletín oficial** por estudiante, con las columnas de períodos según el régimen de cada provincia y las materias filtradas según el ciclo del curso (Ciclo Básico u Orientado).
* **Carga de calificaciones por planilla sábana**, de a un curso por vez (selector de curso activo).
* **Carga de asistencia** por curso y período, con resumen estadístico.
* **Padrón de alumnos** con alta, edición y baja, paginado de a 15 alumnos por página (igual que la planilla de asistencia).
* **Gestión institucional:** datos de cada escuela, cursos, divisiones y orientaciones.
* **Mesas de examen** con inscripción y baja de estudiantes, y **notificaciones** con marca de leído.
* **Login con Google** (Firebase) y accesos rápidos de demo por rol (tutor, estudiante, preceptor, docente).

**Integrantes:**
* Monleón Lucrecia
* Almazan Alejandro
* Camila Mailen Rodriguez
* Yamila Gisele Peña
* Julieta Cuchan

**URL pública:** <https://boletin-digital-escolar-production.up.railway.app> (desplegada en Railway, ver sección [6. Despliegue](#6-despliegue)).

**Repositorio:** <https://github.com/yamilacode/boletin-digital-escolar>

---

## 2. Cómo correrla en local

### Requisitos
* [XAMPP](https://www.apachefriends.org/) (Apache + PHP 8 + MySQL/MariaDB) con las extensiones **PDO MySQL** y **cURL** habilitadas (vienen activas por defecto).
* Un navegador actualizado y conexión a internet (para Firebase, la API de feriados, las fuentes y los íconos).

### Paso a paso
1. **Ubicar el proyecto dentro de XAMPP.** Copiá (o cloná directamente) la carpeta completa del repositorio dentro de `htdocs`:
   * Windows: `C:\xampp\htdocs\boletin-digital-escolar`
   * Linux/Mac: `/opt/lampp/htdocs/boletin-digital-escolar`

   La estructura queda así:
   ```
   boletin-digital-escolar/
   ├── index.html              ← landing / login
   ├── portal.html             ← portal académico (requiere sesión)
   ├── css/  scripts/  data/   ← estilos, lógica del frontend y datos de respaldo
   ├── api/                    ← backend PHP (endpoints REST + migraciones)
   ├── sql/
   │   ├── schema.sql          ← script de creación de las tablas
   │   └── datos_iniciales.sql ← datos de ejemplo de las dos escuelas
   ├── Dockerfile              ← imagen usada para el despliegue en Railway
   └── .env.example            ← lista de variables de entorno (sin valores reales)
   ```
2. **Iniciar los servicios.** Abrí el Panel de Control de XAMPP y arrancá **Apache** y **MySQL**.
3. **Crear la base de datos con los scripts de `sql/`.**
   1. Entrá a [phpMyAdmin](http://localhost/phpmyadmin) y creá una base llamada `boletin` (cotejamiento `utf8mb4_general_ci`). El nombre coincide con el valor por defecto de `DB_NAME`.
   2. Seleccioná la base `boletin` → pestaña **Importar** → elegí `sql/schema.sql` → **Continuar**. Esto crea las 11 tablas: `instituciones`, `cursos`, `estudiantes`, `materias`, `notas`, `previas`, `asistencias`, `mesas_examen`, `inscripciones_mesas`, `notificaciones` y `notificaciones_lecturas`.
      > [Atención] `schema.sql` hace `DROP TABLE IF EXISTS` antes de cada `CREATE TABLE`: si lo volvés a importar sobre una base con datos, **los borra**.
   3. Con la misma base seleccionada, importá **`sql/datos_iniciales.sql`**. Carga los datos de ejemplo de las dos escuelas: las instituciones (`id = 1` Formosa, `id = 2` PBA), sus cursos y divisiones, 12 estudiantes, materias, notas, asistencias, mesas de examen con inscriptos, notificaciones y previas. Usa `INSERT ... ON DUPLICATE KEY UPDATE`, así que se puede volver a importar sin duplicar registros.

      Por consola es equivalente:
      ```
      mysql -u root boletin < sql/schema.sql
      mysql -u root boletin < sql/datos_iniciales.sql
      ```
   4. *(Opcional)* Las migraciones `api/migracion_instituciones_cursos.php`, `api/migracion_mesas.php` y `api/migracion_notificaciones.php` son de una etapa anterior del proyecto (antes de que existiera `datos_iniciales.sql`). Con los dos scripts de arriba **ya no hace falta correrlas**; sirven para actualizar una base vieja abriéndolas en el navegador (ej. `http://localhost/boletin-digital-escolar/api/migracion_mesas.php`). Son idempotentes.
4. **Configurar las variables de entorno** (ver sección [4](#4-variables-de-entorno)). En XAMPP local **no hace falta configurar nada** si tu MySQL usa el usuario `root` sin contraseña: `api/config.php` usa esos valores por defecto. Si necesitás cambiarlos, o querés probar el envío real de mails, definilas con `SetEnv` en un archivo `api/.htaccess` local (por ejemplo `SetEnv DB_PASS ...`) y **no lo subas al repositorio**, porque contiene valores reales. Usá `.env.example` como lista de referencia. **Ojo:** el backend lee las variables del entorno del servidor (`getenv`/`$_ENV`/`$_SERVER`), no parsea un archivo `.env` por sí solo.
5. **Probar que el backend responde**, por ejemplo:
   * `http://localhost/boletin-digital-escolar/api/instituciones.php` → debe devolver las dos instituciones con sus cursos.
   * `http://localhost/boletin-digital-escolar/api/boletin.php?dni=34567890` → boletín de un estudiante de ejemplo de Formosa (para PBA se puede usar `48763736`).
   * `http://localhost/boletin-digital-escolar/api/servicios.php` → muestra si Resend está `activo` o en modo `simulado_sin_clave`.
6. **Abrir el frontend:** `http://localhost/boletin-digital-escolar/index.html`. Desde la landing se puede ingresar con los accesos rápidos de demo o con **Google** (Firebase). Al ingresar te redirige a `portal.html`, que lee y escribe en MySQL a través de la API.

> [Nota] Hay que abrirlo a través de Apache (`http://localhost/...`), no con doble clic sobre el HTML (`file://`): las llamadas `fetch('api/...')` necesitan el servidor PHP y el login de Google necesita un origen `http(s)`.

---

## 3. Endpoints de la API

Todas las rutas son relativas a la carpeta del proyecto (ej: `http://localhost/boletin-digital-escolar/api/...`). Todas las respuestas son JSON (`Content-Type: application/json; charset=UTF-8`) y todos los endpoints responden `204` a una petición `OPTIONS` (preflight CORS). Los que reciben body esperan JSON con `Content-Type: application/json`; un JSON mal formado devuelve `400`.

Ante un error de base de datos, todos los endpoints registran el detalle en el log del servidor y responden `500` con un mensaje genérico (`"Error interno del servidor"`), sin exponer el texto de la excepción de MySQL.

Varios endpoints usan el patrón **"acción en el body"**: un único `POST` con un campo `accion` que indica la operación.

### Autenticación y Tokens — `api/auth.php` *(Nuevo en TP N.º 2)*

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `POST` | `/api/auth.php` | JSON: `email` o `usuario`, `password` (opcional en demo/desarrollo), `rol` | Token JWT firmado con HMAC-SHA256 (30 días de vigencia) y datos del usuario | `200` éxito · `400` faltan campos · `401` credenciales inválidas |
| `GET` | `/api/auth.php` | Cabecera `Authorization: Bearer <token>` | Verificación del token y datos del usuario autenticado | `200` token válido · `401` token ausente o expirado |

Todos los endpoints que modifican datos (`POST`/`DELETE` en `notas.php`, `POST`/`PUT`/`DELETE` en `alumnos.php`, `POST` en `asistencia.php`) exigen la cabecera `Authorization: Bearer <token>` emitida por este endpoint.

### Estudiantes — `api/alumnos.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/alumnos.php` | Opcional por query: `id_institucion`, `jurisdiccion` (filtros) | Lista de estudiantes (`id, dni, nombre, apellido, jurisdiccion, id_institucion, curso, seccion, nombre_tutor`) | `200` · `500` |
| `GET` | `/api/alumnos.php?id=<int>` | `id` por query | Un estudiante | `200` · `400` id inválido · `404` no encontrado · `500` |
| `POST` | `/api/alumnos.php` | JSON: `dni` (8 dígitos), `nombre, apellido, jurisdiccion, id_institucion, curso, seccion, nombre_tutor`. Si ya existe un estudiante con ese DNI en la misma jurisdicción, **lo actualiza** en lugar de rechazarlo | Alta: `{mensaje, id, aviso_email}` — `aviso_email` es `enviado`, `simulado` o `error` según el resultado de Resend. Actualización: `{mensaje, id}` (no envía mail) | `201` creado · `200` actualizado (DNI existente) · `400` JSON inválido · `422` campo faltante/inválido o institución inexistente · `409` restricción de BD · `500` |
| `PUT` | `/api/alumnos.php?id=<int>` o `/api/alumnos.php?dni=<dni>&jurisdiccion=<juris>` | `id` por query (o, en su lugar, `dni` y opcionalmente `jurisdiccion`) + mismo JSON que el POST | `{mensaje}` | `200` · `400` falta id/DNI · `404` · `422` · `409` · `500` |
| `DELETE` | `/api/alumnos.php?id=<int>` o `/api/alumnos.php?dni=<dni>&jurisdiccion=<juris>` | `id` por query (o `dni` + `jurisdiccion` opcional) | `{mensaje}` | `200` · `400` falta id/DNI · `404` · `409` integridad referencial · `500` |

### Boletín — `api/boletin.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/boletin.php?dni=<dni>` | `dni` (obligatorio, numérico); opcionales `id_institucion` o `jurisdiccion` (`formosa`/`pba`) | Boletín completo: institución, datos del estudiante, columnas de períodos según el régimen, materias con notas, previas/pendientes y asistencia | `200` · `400` DNI inválido · `404` estudiante no encontrado · `405` método no permitido · `500` |
| `POST` | `/api/boletin.php` | Igual que `POST /api/notas.php` (lo reenvía internamente) | Igual que `POST /api/notas.php` | Igual que `notas.php` |

### Notas — `api/notas.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/notas.php` | Filtros opcionales por query: `dni` (o `dni_estudiante`), `materia`, `periodo`, `id_institucion`, `jurisdiccion` | Lista de notas | `200` · `500` |
| `POST` | `/api/notas.php` | JSON: un objeto o un **array** (planilla sábana completa) con `dni_estudiante, materia, periodo` (obligatorios), `nota_numerica, valoracion_conceptual, observacion, id_institucion` (opcionales). Si la nota ya existe para ese alumno/materia/período, la actualiza | `{status, mensaje, guardados}` | `200` · `400` JSON inválido · `500` |
| `DELETE` | `/api/notas.php` | Por query al menos uno de: `materia`, `periodo`, `dni` (+ opcional `id_institucion`) | `{status, mensaje, filas_afectadas}` | `200` · `400` sin filtros · `500` |

Los períodos se normalizan (ej. `t1`, `1er Trimestre` → `1° Trimestre`; `c2` → `2° Cuatrimestre`; también `PAIR`, `RITE Diciembre`, `RITE Febrero`, `Recuperatorio Diciembre`).

### Asistencia — `api/asistencia.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/asistencia.php` | Filtros opcionales por query: `dni` (o `dni_estudiante`), `periodo`, `id_institucion`, `jurisdiccion` | Lista de registros de asistencia por alumno y período | `200` · `500` |
| `POST` | `/api/asistencia.php` | JSON: un objeto o un array (curso completo) con `dni_estudiante`, `periodo`, `dias_habiles`, `asistencias`, `inasistencias`, `justificadas`, `id_institucion`. Crea o actualiza (upsert) | `{mensaje, actualizados}` | `200` · `400` JSON inválido · `500` |

### Previas — `api/previas.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/previas.php` | Filtros opcionales: `dni`, `id_institucion`, `jurisdiccion` | Lista de materias previas | `200` · `500` |
| `POST` | `/api/previas.php` | JSON: `dni_estudiante`, `materia` (obligatorios), `calificacion, estado` (por defecto `Pendiente`), `fecha, curso_origen, fecha_aprobacion, id_institucion` | `{mensaje, id}` | `201` · `400` faltan DNI/materia · `500` |
| `PUT` | `/api/previas.php` | JSON: `id`, `materia` (obligatorios) + los mismos campos opcionales | `{mensaje}` | `200` · `400` falta id/materia · `500` |
| `DELETE` | `/api/previas.php?id=<int>` | `id` por query o en el body JSON | `{mensaje}` | `200` · `400` id inválido · `500` |

### Instituciones y cursos — `api/instituciones.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/instituciones.php` | Opcional: `id_institucion` o `jurisdiccion` | Instituciones con sus cursos, divisiones y orientaciones (un objeto si se filtró por una, si no un array) | `200` · `500` |
| `POST` | `/api/instituciones.php` | JSON con `accion`: <br>• `guardar_institucion` (`nombre` obligatorio, datos institucionales) <br>• `guardar_curso` (`id_institucion` obligatorio, datos del curso; crea o actualiza) <br>• `renombrar_orientacion` (`id_institucion, orientacion_anterior, orientacion_nueva`) <br>• `eliminar_curso` (`id` o `codigo_curso`) | `{mensaje, ...}` | `200` · `201` curso creado · `400` parámetros faltantes o acción no reconocida · `500` |

### Mesas de examen — `api/mesas.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/mesas.php` | Opcional: `id_institucion`, `jurisdiccion`, `dni` | Mesas de examen con sus inscriptos | `200` · `500` |
| `POST` | `/api/mesas.php` | JSON con `accion`: <br>• `guardar_mesa` (`materia` obligatoria, `id` para editar) <br>• `eliminar_mesa` (`id`) <br>• `inscribir` (`mesa_id`, `dni`, `nombre`...) <br>• `cancelar_inscripcion` / `baja_inscripcion` (`mesa_id`, `dni`) | `{mensaje, ...}` | `200` · `201` mesa creada · `400` parámetros faltantes, mesa cerrada o acción no reconocida · `404` la mesa no existe · `500` |

### Notificaciones — `api/notificaciones.php`

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/notificaciones.php` | Opcional: `id_institucion`, `jurisdiccion`, `dni` (para marcar cuáles leyó ese usuario) | Lista de comunicados | `200` · `500` |
| `POST` | `/api/notificaciones.php` | JSON con `accion`: <br>• `guardar_notificacion` (`titulo`, `contenido` obligatorios; `id` para editar) <br>• `eliminar_notificacion` (`id`) <br>• `marcar_leido` (`notificacion_id`, `dni`) <br>• `marcar_todos_leidos` (`dni`) | `{mensaje, ...}` | `200` · `201` creada · `400` parámetros faltantes o acción no reconocida · `404` notificación inexistente · `500` |

### Utilidades

| Método | Ruta | Qué recibe | Qué devuelve | Códigos |
|---|---|---|---|---|
| `GET` | `/api/servicios.php` | Nada | Estado del servicio de correo (`activo` / `simulado_sin_clave`), sin exponer la API key | `200` |
| `GET` | `/api/migracion_*.php` | Nada | Crea/actualiza tablas y siembra datos de ejemplo (opcional, ver sección 2) | `200` (el resultado va en el texto/JSON) |

Cualquier método no soportado devuelve `405`.

---

## 4. Variables de entorno

Se leen en `api/config.php` con la función `entorno()` (prioridad: `getenv()` → `$_ENV` → `$_SERVER` → valor por defecto). La lista está en `.env.example`, sin valores reales. Los archivos `.env` reales están excluidos en `.gitignore` y `.dockerignore`.

| Variable | Para qué sirve |
|---|---|
| `ENTORNO` | `local` o `produccion`. En producción oculta los errores de PHP en pantalla (solo los registra en el log) y exige que `DB_HOST`, `DB_NAME` y `DB_USER` tengan valor; si falta alguna, la API responde `500` sin revelar cuál. |
| `DB_HOST` | Host del servidor MySQL. |
| `DB_PORT` | Puerto del servidor MySQL. |
| `DB_NAME` | Nombre de la base de datos. |
| `DB_USER` | Usuario de conexión a MySQL. |
| `DB_PASS` | Contraseña del usuario de MySQL. |
| `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` | Variables que Railway crea automáticamente al agregar un servicio MySQL. Se usan como respaldo de las `DB_*`: si una `DB_*` no está definida, `config.php` toma la equivalente `MYSQL*`. Así el despliegue funciona referenciando la base de Railway sin copiar credenciales a mano. |
| `RESEND_API_KEY` | Clave secreta de la API de Resend para enviar correos. Si está vacía, el envío queda en modo simulado. |
| `EMAIL_AVISOS` | Casilla de correo destino a la que se envían los avisos automáticos. |
| `JWT_SECRET` | Clave secreta para firmar y verificar tokens JWT de autenticación en la API (TP N.º 2). |
| `MIGRATION_SECRET` | Clave secreta administrativa para autorizar la ejecución de scripts en `api/migracion_*.php` vía HTTP (TP N.º 2). |
| `FRONTEND_ORIGIN` | Origen (dominio) autorizado por CORS para consumir `api/boletin.php` desde otro dominio. |
| `PORT` | Puerto en el que escucha el contenedor (lo define Railway; el `Dockerfile` usa `80` si no existe). |

La configuración de Firebase del frontend (en `index.html`) no es una variable de entorno: es la configuración pública del SDK web, que Firebase diseña para viajar al navegador. La seguridad de Firebase no depende de ocultarla sino de los dominios autorizados configurados en la consola de Firebase.

---

## 5. Servicios externos

La app usa **tres** servicios externos: uno llamado desde el backend y dos desde el navegador.

### 5.1 Resend (envío de correo) — lo llama el **backend**
* **Qué hace:** cuando se da de alta un estudiante nuevo (`POST /api/alumnos.php` con un DNI que no existía), el backend arma un aviso y lo envía por mail mediante la API REST de Resend (`api/servicios.php`, función `enviarCorreoAviso()`, vía cURL).
* **Por qué desde el backend:** Resend requiere una API key secreta (`RESEND_API_KEY`). Si la llamara el navegador, la clave quedaría expuesta a cualquiera que abra las herramientas de desarrollador y podría usarse para mandar correos en nuestro nombre. Desde PHP la clave nunca sale del servidor.
* **Datos personales que salen y hacia dónde:** nombre y apellido del estudiante, DNI, curso y división y nombre del tutor. Viajan a los servidores de Resend (EE.UU.) y de ahí a la casilla configurada en `EMAIL_AVISOS`.
* **Si el servicio falla:** degradación elegante. Si falta la clave o el destinatario, no se intenta el envío y se devuelve `simulado`; si cURL no está disponible, hay timeout (3 s de conexión / 5 s total) o Resend responde con error HTTP, se registra en el log y se devuelve `error`. En todos los casos **el alta del estudiante se guarda igual** (`201`) y la respuesta informa el resultado en `aviso_email`.

### 5.2 Firebase Authentication (login con Google) — lo llama el **navegador**
* **Qué hace:** el botón "Ingresar con Google" de `index.html` usa el SDK web de Firebase (`signInWithPopup` con `GoogleAuthProvider`). Con el usuario devuelto, `scripts/auth.js` le asigna rol y expediente (vinculándolo a un estudiante por DNI) y abre el portal.
* **Por qué desde el navegador:** el flujo de OAuth de Google requiere que el usuario interactúe con un popup de Google en su propio navegador; el SDK de Firebase está diseñado para correr del lado cliente y la configuración que usa es pública. Hacerlo desde el backend no tendría sentido porque el servidor no puede abrir esa ventana de consentimiento.
* **Datos personales que salen y hacia dónde:** el usuario se autentica directamente con Google/Firebase (proyecto `boletin-digital-escolar`). La app recibe de vuelta nombre, email y foto de perfil, que se guardan en el `localStorage` del navegador para mantener la sesión. No se envían al backend.
* **Si el servicio falla:** el error se captura y se muestra un aviso ("No se pudo iniciar sesión con Google: ..."). El resto de la landing sigue funcionando y se puede ingresar con los accesos de demo.

### 5.3 API pública de feriados — la llama el **navegador**
* **Qué hace:** el calendario de feriados del portal (`cargarFeriadosAPI()` en `scripts/app.js`) consulta los feriados nacionales del año en `https://api.argentinadatos.com/v1/feriados/<año>` y, si esa no responde, en `https://nolaborables.com.ar/api/v2/feriados/<año>`.
* **Por qué desde el navegador:** es una API pública, gratuita y sin clave, con datos que no son sensibles. Llamarla directo desde el cliente evita sumar carga y un paso intermedio al backend, sin ningún riesgo de exponer secretos.
* **Datos personales que salen y hacia dónde:** ninguno. Solo se envía el año consultado (y, como en toda petición web, la IP del usuario llega a ese servidor).
* **Si el servicio falla:** hay doble respaldo: si falla la primera API se prueba la segunda, y si fallan ambas se usa un calendario oficial 2026 cargado en el código (`FERIADOS_OFICIALES_2026_FALLBACK`). El usuario siempre ve el calendario.

**Resumen de la decisión:** el criterio fue simple: **si el servicio necesita un secreto, lo llama el backend** (Resend); **si el servicio es público o necesita la interacción del usuario, lo llama el navegador** (feriados y Firebase Auth).

---

## 6. Despliegue

**Proveedor elegido:** [Railway](https://railway.app/), modelo **PaaS** (Platform as a Service).

**URL pública:** <https://boletin-digital-escolar-production.up.railway.app>

**Por qué PaaS y por qué Railway:** el proyecto es un backend PHP + MySQL clásico, y un equipo de estudiantes no tiene tiempo ni necesidad de administrar un servidor. Con un **IaaS** (por ejemplo una VM en AWS EC2) tendríamos que instalar y mantener a mano el sistema operativo, el servidor web, PHP, MySQL, certificados HTTPS y parches de seguridad. Railway, como PaaS, despliega directo desde el repositorio de GitHub, ofrece MySQL administrado en el mismo proyecto, HTTPS automático y un panel para cargar las variables de entorno de la sección 4 sin subirlas al código, que es justamente cómo está pensado `api/config.php`. Además, Railway inyecta las credenciales de su MySQL como variables `MYSQL*`, que `config.php` ya sabe leer.

**Cómo se construye la app (`Dockerfile`):** Railway arma la imagen a partir del `Dockerfile` del repo:
* Parte de `php:8.2-cli` e instala las extensiones `pdo`, `pdo_mysql` y `mysqli`.
* Copia el proyecto a `/var/www/html` (excepto lo listado en `.dockerignore`: `.git`, `.env`, logs).
* Arranca el **servidor web integrado de PHP** (`php -S 0.0.0.0:$PORT`) escuchando en el puerto que asigna Railway.

Primero se probó con la imagen `php:apache`, pero en Railway daba errores de arranque de Apache (`AH00534`, más de un MPM cargado, y problemas para tomar el puerto dinámico). Para no pelear con la configuración de Apache se pasó al servidor integrado de PHP, que no necesita configuración y sirve tanto los archivos estáticos (`index.html`, `css/`, `scripts/`) como los endpoints de `api/`.

**Pasos para volver a desplegar desde cero:**
1. Crear un proyecto en Railway y conectarlo al repositorio de GitHub (rama `main`). Railway detecta el `Dockerfile` y lo usa para construir.
2. Agregar un servicio **MySQL** dentro del mismo proyecto.
3. En el servicio web, cargar las variables de entorno: `ENTORNO=produccion`; las de conexión, ya sea como `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` o referenciando las `MYSQL*` del servicio MySQL; y `RESEND_API_KEY`, `EMAIL_AVISOS` y `FRONTEND_ORIGIN` (la URL pública que asigne Railway).
4. Conectarse a la base de Railway (con los datos de conexión que muestra el panel, desde MySQL Workbench, DBeaver o la consola `mysql`) e importar en orden `sql/schema.sql` y `sql/datos_iniciales.sql`.
5. En **Settings → Networking** del servicio web, generar el dominio público.
6. Agregar ese dominio en **Firebase → Authentication → Settings → Dominios autorizados**, para que funcione el login con Google.
7. Verificar los endpoints (`/api/instituciones.php`, `/api/servicios.php`) y el login contra la URL pública.

Para redesplegar después de un cambio alcanza con hacer `push` a `main`: Railway reconstruye la imagen y publica automáticamente.

---

## 7. Limitaciones conocidas

* ~~**La API no tiene autenticación ni control de roles.**~~ **Resuelto en TP N.º 2:** Se implementó api/auth.php con tokens JWT firmados (HMAC-SHA256). Los endpoints de escritura (POST/DELETE en notas, POST/PUT/DELETE en alumnos, POST en asistencias) exigen Authorization: Bearer <token> y validan los roles permitidos (preceptor, docente, administrador). El cliente web y la app móvil envían este token en cada petición.
* ~~**CORS abierto.**~~ **Resuelto en TP N.º 2:** CORS centralizado en api/config.php mediante aplicarCors(). Solo autoriza el dominio oficial en Railway (https://boletin-digital-escolar-production.up.railway.app), orígenes definidos en FRONTEND_ORIGIN y localhost para desarrollo, admitiendo peticiones preflight OPTIONS y la cabecera Authorization.
* ~~**Las migraciones quedan expuestas por HTTP.**~~ **Resuelto en TP N.º 2:** Todos los archivos api/migracion_*.php cuentan con la función protegerMigracion(), permitiendo ejecución únicamente desde consola CLI o mediante la clave autorizada MIGRATION_SECRET (vía cabecera X-Migration-Key o parámetro ?key=).
* **Servidor web de desarrollo en producción.** El contenedor usa `php -S`, el servidor integrado de PHP, que según la documentación de PHP no está pensado para producción: atiende de a una petición por vez. Alcanza para la demo, pero con muchos usuarios simultáneos habría que volver a Apache/Nginx + PHP-FPM.
* **El alta de un DNI repetido sobrescribe.** `POST /api/alumnos.php` con un DNI que ya existe en la misma jurisdicción actualiza al estudiante existente sin avisar (responde `200`). Si alguien carga por error un DNI ajeno, pisa los datos de ese alumno.
* **Filtros por institución permisivos.** `GET /api/notas.php` y `GET /api/asistencia.php` incluyen también los registros con `id_institucion` o `jurisdiccion` vacíos al filtrar por escuela, por lo que un registro cargado sin institución aparece en las dos escuelas.
* **Validaciones desparejas.** `alumnos.php` valida en detalle (DNI de 8 dígitos, `422` por campo), pero los demás endpoints solo validan los campos obligatorios mínimos y devuelven `400` en lugar de `422`.
* **`schema.sql` borra las tablas.** Al reimportarlo se pierden los datos (ver paso 3 de la sección 2). Además, algunos valores por defecto quedaron con la codificación rota al exportar (por ejemplo, el `DEFAULT` de `cursos.turno` y `cursos.orientacion`); no afecta a los datos de `datos_iniciales.sql`, que cargan esos campos explícitamente.
* **Parte del frontend todavía usa datos locales.** Además de la API, el portal conserva datos de ejemplo de `data/formosa.json` / `data/pba.json` y una copia en `localStorage` (`boletin_db_escolar_v1`) como respaldo.
* **El aviso por mail va siempre a una sola casilla.** Resend envía a `EMAIL_AVISOS`, no al mail de cada tutor (la tabla `estudiantes` no guarda el email del tutor). En el plan gratuito de Resend, además, solo se puede enviar a la casilla verificada de la cuenta.

Se declaran estas limitaciones explícitamente porque, al no haber exposición oral, este README reemplaza esa instancia: un error escondido resta más que una limitación aclarada.

---

## 8. Tecnologías utilizadas

* **Frontend:** HTML5, CSS3 (sistema de diseño modular oscuro/institucional), JavaScript (ES6+, `fetch` contra la API REST), Font Awesome y Google Fonts.
* **Backend:** PHP 8 con PDO (consultas preparadas) y una API REST propia.
* **Base de datos:** MySQL/MariaDB (`sql/schema.sql` + `sql/datos_iniciales.sql`).
* **Despliegue:** Docker (`php:8.2-cli`) en Railway, con MySQL administrado por Railway.
* **Servicios externos:** Resend (backend), Firebase Authentication y API de feriados de Argentina (navegador). Ver sección 5.

---

## 9. Aportes

El grupo trabajó con GitHub, por lo que el detalle de qué hizo cada integrante y cuándo queda registrado en el historial de commits del repositorio (`git log`).
