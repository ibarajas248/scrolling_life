#!/bin/sh
set -eu

MYSQL_CONTAINER="${MYSQL_CONTAINER:-lienzo-mysql-1}"
DB_NAME="${GRAPH_MYSQL_DATABASE:-scrollinglife_graph}"
DB_USER="${GRAPH_MYSQL_USER:-scrollinglife_graph}"
ENV_FILE="${GRAPH_ENV_FILE:-/opt/scrolling_life_next/graph-backend/.env}"
CRED_FILE="${GRAPH_CREDENTIALS_FILE:-/root/scrollinglife_graph_mysql_credentials.env}"

if ! docker ps --format '{{.Names}}' | grep -qx "$MYSQL_CONTAINER"; then
  echo "mysql_container_not_running=$MYSQL_CONTAINER" >&2
  exit 1
fi

DB_PASSWORD=""
if [ -f "$CRED_FILE" ]; then
  DB_PASSWORD="$(awk -F= '$1 == "MYSQL_PASSWORD" { print $2 }' "$CRED_FILE" | tail -n 1)"
fi

if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD="$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32)"
fi

SQL_FILE="$(mktemp)"
cat > "$SQL_FILE" <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'%'
  IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'%'
  IDENTIFIED BY '$DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, INDEX, ALTER
  ON \`$DB_NAME\`.*
  TO '$DB_USER'@'%';
FLUSH PRIVILEGES;
SQL

docker exec -i "$MYSQL_CONTAINER" sh -lc 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"' < "$SQL_FILE"
rm -f "$SQL_FILE"

mkdir -p "$(dirname "$ENV_FILE")"
umask 077
cat > "$ENV_FILE" <<EOF
GRAPH_DB_DRIVER=mysql
MYSQL_HOST=$MYSQL_CONTAINER
MYSQL_PORT=3306
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASSWORD
MYSQL_CONNECTION_LIMIT=8
EOF
chmod 600 "$ENV_FILE"

MYSQL_IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$MYSQL_CONTAINER" | awk '{print $1}')"
cat > "$CRED_FILE" <<EOF
WORKBENCH_METHOD=Standard TCP/IP over SSH
SSH_HOST=2.24.99.177
SSH_USER=root
MYSQL_HOST=$MYSQL_IP
MYSQL_PORT=3306
MYSQL_DATABASE=$DB_NAME
MYSQL_USER=$DB_USER
MYSQL_PASSWORD=$DB_PASSWORD
NOTE=MySQL no esta abierto publicamente; usar conexion TCP/IP over SSH en MySQL Workbench.
EOF
chmod 600 "$CRED_FILE"

echo "mysql_ready=true"
echo "credentials_file=$CRED_FILE"
echo "mysql_host=$MYSQL_IP"
echo "mysql_database=$DB_NAME"
echo "mysql_user=$DB_USER"
