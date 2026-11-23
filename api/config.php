<?php

/**
 * Lectura segura de variables de entorno (R7)
 * Prioridad: getenv() -> $_ENV -> $_SERVER -> valor por defecto
 */
function entorno(string $nombre, string $porDefecto = ""): string {
    $valor = getenv($nombre);
    if ($valor !== false && $valor !== "") {
        return (string)$valor;
    }
    if (isset($_ENV[$nombre]) && $_ENV[$nombre] !== "") {
        return (string)$_ENV[$nombre];
    }
    if (isset($_SERVER[$nombre]) && $_SERVER[$nombre] !== "") {
        return (string)$_SERVER[$nombre];
    }
    return $porDefecto;
}

define("ENTORNO", entorno("ENTORNO", "local"));
$esProduccion = ENTORNO === "produccion";

date_default_timezone_set("America/Argentina/Buenos_Aires");

error_reporting(E_ALL);
ini_set("log_errors", "1");
ini_set("display_errors", $esProduccion ? "0" : "1");

// Datos de conexión (Soporta nombres estándar o las variables automáticas de Railway)
define("DB_HOST", entorno("DB_HOST", entorno("MYSQLHOST", "localhost")));
define("DB_PORT", entorno("DB_PORT", entorno("MYSQLPORT", "3306")));
define("DB_NAME", entorno("DB_NAME", entorno("MYSQLDATABASE", "boletin")));
define("DB_USER", entorno("DB_USER", entorno("MYSQLUSER", "root")));
define("DB_PASS", entorno("DB_PASS", entorno("MYSQLPASSWORD", "")));

// Servicios externos y seguridad
define("RESEND_API_KEY", entorno("RESEND_API_KEY", ""));
define("EMAIL_AVISOS", entorno("EMAIL_AVISOS", ""));
define("FRONTEND_ORIGIN", entorno("FRONTEND_ORIGIN", "https://boletin-digital-escolar-production.up.railway.app"));

// Claves secretas para autenticación y protección de migraciones
define("JWT_SECRET", entorno("JWT_SECRET", "boletin_escolar_jwt_secret_tp2_2026"));
define("MIGRATION_SECRET", entorno("MIGRATION_SECRET", "boletin_migracion_tp2_2026"));

// En producción, verificamos que las credenciales no estén vacías.
if ($esProduccion) {
    if (DB_HOST === "" || DB_NAME === "" || DB_USER === "") {
        error_log("Faltan variables de conexión a la base de datos.");
        http_response_code(500);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode([
            "error" => "Error de configuración del servidor"
        ]);
        exit;
    }
}

// -------------------------------------------------------------
// CONTROL CENTRALIZADO Y RESTRINGIDO DE CORS (TP N.º 2)
// -------------------------------------------------------------
if (!function_exists("aplicarCors")) {
    function aplicarCors(): void {
        $origen = $_SERVER["HTTP_ORIGIN"] ?? "";
        
        $origenesPermitidos = [
            "https://boletin-digital-escolar-production.up.railway.app",
            "http://localhost",
            "http://localhost:80",
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:8080",
            "http://127.0.0.1",
            "http://127.0.0.1:80",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:8080"
        ];

        if (defined("FRONTEND_ORIGIN") && FRONTEND_ORIGIN !== "") {
            $fo = rtrim(FRONTEND_ORIGIN, "/");
            if (!in_array($fo, $origenesPermitidos, true)) {
                $origenesPermitidos[] = $fo;
            }
        }

        $permitir = false;
        if ($origen !== "") {
            $origenLimpio = rtrim($origen, "/");
            if (in_array($origenLimpio, $origenesPermitidos, true)) {
                $permitir = true;
            } elseif (ENTORNO !== "produccion") {
                // En local permitimos localhost con cualquier puerto
                if (preg_match('/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/', $origenLimpio)) {
                    $permitir = true;
                }
            }
        }

        if (!headers_sent()) {
            if ($permitir) {
                header("Access-Control-Allow-Origin: " . $origen);
                header("Access-Control-Allow-Credentials: true");
            } elseif (ENTORNO !== "produccion" && $origen === "") {
                // Peticiones directas o locales sin cabecera origin
                header("Access-Control-Allow-Origin: *");
            }

            header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
            header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Migration-Key");
            header("Vary: Origin");
        }

        if (isset($_SERVER["REQUEST_METHOD"]) && $_SERVER["REQUEST_METHOD"] === "OPTIONS") {
            if (!headers_sent()) {
                http_response_code(204);
            }
            exit;
        }
    }
}

// Aplicar CORS al inicio de cada petición
aplicarCors();

// -------------------------------------------------------------
// HELPERS MODULARES Y REUTILIZABLES
// -------------------------------------------------------------
if (!function_exists("responder")) {
    /**
     * Responde con un código de estado HTTP y datos serializados en JSON.
     * Centraliza las cabeceras HTTP y la salida unificada de la API REST.
     */
    function responder(int $codigo, $datos): void {
        http_response_code($codigo);
        header("Content-Type: application/json; charset=UTF-8");
        echo json_encode($datos, JSON_UNESCAPED_UNICODE);
        exit;
    }
}

if (!function_exists("leerJsonBody")) {
    /**
     * Lee y parsea de forma segura el cuerpo JSON de una petición HTTP
     */
    function leerJsonBody(): array {
        $cuerpo = file_get_contents("php://input");
        if ($cuerpo === false || trim($cuerpo) === "") {
            return [];
        }
        $datos = json_decode($cuerpo, true);
        if (!is_array($datos)) {
            responder(400, ["error" => "El cuerpo JSON no es válido"]);
        }
        return $datos;
    }
}

// -------------------------------------------------------------
// PROTECCIÓN DE MIGRACIONES (TP N.º 2)
// -------------------------------------------------------------
if (!function_exists("protegerMigracion")) {
    /**
     * Bloquea la ejecución de migraciones si no se ejecutan por CLI
     * o sin la clave secreta autorizada.
     */
    function protegerMigracion(): void {
        // Ejecución en consola CLI siempre permitida
        if (php_sapi_name() === "cli") {
            return;
        }

        $claveRecibida = $_SERVER["HTTP_X_MIGRATION_KEY"] ?? ($_GET["key"] ?? ($_GET["token"] ?? ""));

        if ($claveRecibida === "" || !hash_equals(MIGRATION_SECRET, $claveRecibida)) {
            responder(403, [
                "error" => "Acceso denegado: las migraciones de la base de datos están protegidas.",
                "mensaje" => "Ejecute desde CLI o proporcione la clave autorizada en cabecera 'X-Migration-Key' o parámetro '?key='."
            ]);
        }
    }
}

// -------------------------------------------------------------
// SISTEMA DE TOKENS JWT Y AUTENTICACIÓN (TP N.º 2)
// -------------------------------------------------------------
if (!function_exists("base64UrlEncode")) {
    function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}

if (!function_exists("base64UrlDecode")) {
    function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }
}

if (!function_exists("generarJwt")) {
    /**
     * Genera un token JWT firmado con HMAC-SHA256 (validez por defecto: 30 días)
     */
    function generarJwt(array $payload, int $duracionSegundos = 2592000): string {
        $header = json_encode(["alg" => "HS256", "typ" => "JWT"]);
        $ahora = time();
        if (!isset($payload["iat"])) {
            $payload["iat"] = $ahora;
        }
        if (!isset($payload["exp"])) {
            $payload["exp"] = $ahora + $duracionSegundos;
        }
        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

        $h64 = base64UrlEncode($header);
        $p64 = base64UrlEncode($payloadJson);
        $firma = hash_hmac("sha256", "$h64.$p64", JWT_SECRET, true);
        $f64 = base64UrlEncode($firma);

        return "$h64.$p64.$f64";
    }
}

if (!function_exists("verificarJwt")) {
    /**
     * Valida la firma y expiración de un token JWT. Devuelve el payload o null si es inválido.
     */
    function verificarJwt(?string $jwt): ?array {
        if (!$jwt || !is_string($jwt)) {
            return null;
        }
        $partes = explode(".", trim($jwt));
        if (count($partes) !== 3) {
            return null;
        }
        list($h64, $p64, $f64) = $partes;

        $firmaEsperada = hash_hmac("sha256", "$h64.$p64", JWT_SECRET, true);
        $fEsperada64 = base64UrlEncode($firmaEsperada);

        if (!hash_equals($fEsperada64, $f64)) {
            return null;
        }

        $payloadJson = base64UrlDecode($p64);
        $payload = json_decode($payloadJson, true);
        if (!is_array($payload)) {
            return null;
        }

        if (isset($payload["exp"]) && time() > $payload["exp"]) {
            return null; // Token expirado
        }

        return $payload;
    }
}

if (!function_exists("obtenerBearerToken")) {
    /**
     * Extrae el Bearer token de los headers HTTP o del query param
     */
    function obtenerBearerToken(): ?string {
        $headerAuth = "";
        if (!empty($_SERVER["HTTP_AUTHORIZATION"])) {
            $headerAuth = $_SERVER["HTTP_AUTHORIZATION"];
        } elseif (!empty($_SERVER["REDIRECT_HTTP_AUTHORIZATION"])) {
            $headerAuth = $_SERVER["REDIRECT_HTTP_AUTHORIZATION"];
        } elseif (function_exists("getallheaders")) {
            $headers = getallheaders();
            foreach ($headers as $k => $v) {
                if (strcasecmp($k, "Authorization") === 0) {
                    $headerAuth = $v;
                    break;
                }
            }
        }

        if ($headerAuth !== "" && preg_match('/Bearer\s+(.*)$/i', trim($headerAuth), $matches)) {
            return trim($matches[1]);
        }

        if (!empty($_GET["token"])) {
            return trim((string)$_GET["token"]);
        }

        return null;
    }
}

if (!function_exists("requerirAutenticacion")) {
    /**
     * Middleware de autenticación: exige token JWT válido y opcionalmente valida roles.
     * Si no cumple, responde con 401 o 403 y detiene la ejecución.
     */
    function requerirAutenticacion(array $rolesPermitidos = []): array {
        $token = obtenerBearerToken();
        if (!$token) {
            responder(401, [
                "error" => "No autorizado: se requiere cabecera 'Authorization: Bearer <token>' para realizar esta acción.",
                "codigo" => "AUTH_TOKEN_REQUERIDO"
            ]);
        }

        $usuario = verificarJwt($token);
        if (!$usuario) {
            responder(401, [
                "error" => "Token inválido o expirado. Por favor inicie sesión nuevamente.",
                "codigo" => "AUTH_TOKEN_INVALIDO"
            ]);
        }

        if (!empty($rolesPermitidos)) {
            $rolUsuario = strtolower((string)($usuario["rol"] ?? ""));
            $rolesNormalizados = array_map("strtolower", $rolesPermitidos);

            if ($rolUsuario !== "admin" && $rolUsuario !== "administrador" && !in_array($rolUsuario, $rolesNormalizados, true)) {
                responder(403, [
                    "error" => "Acceso denegado: el rol '" . ($usuario["rol"] ?? "desconocido") . "' no tiene permisos para esta acción.",
                    "codigo" => "AUTH_ROL_INSUFICIENTE"
                ]);
            }
        }

        return $usuario;
    }
}
