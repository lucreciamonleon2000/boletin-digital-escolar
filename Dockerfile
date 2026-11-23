FROM php:8.2-cli

# 1. Instalar la extensión PDO MySQL para conectar a la base de datos
RUN docker-php-ext-install pdo pdo_mysql mysqli

# 2. Copiar los archivos del proyecto al contenedor
WORKDIR /var/www/html
COPY . /var/www/html/

ENV PORT=80
EXPOSE 80

# 3. Iniciar el servidor web nativo de PHP escuchando en el puerto dinámico de Railway
CMD ["sh", "-c", "php -S 0.0.0.0:${PORT:-80}"]
