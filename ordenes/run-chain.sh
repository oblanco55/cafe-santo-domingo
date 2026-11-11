#!/bin/zsh
# Ejecuta órdenes de Hermes en cadena con verificación automática por paso.
# Uso: ordenes/run-chain.sh <marca> <perfil:orden[:archivo-requerido]> ...
# Escribe el resultado final en ordenes/<marca>.status (OK o FALLO ...).
cd "/Users/omar/Desktop/Claude/Script 28" || exit 1
mark="$1"; shift
statusfile="ordenes/${mark}.status"
for step in "$@"; do
  profile="${step%%:*}"; rest="${step#*:}"
  order="${rest%%:*}"; required=""
  [[ "$rest" == *:* ]] && required="${rest#*:}"
  "$profile" --reasoning none -z "Eres el desarrollador. Lee el archivo ordenes/${order}.md y ejecuta exactamente esa orden, incluido el commit y push final." --in "$PWD" > "ordenes/${order}-informe.log" 2>&1
  echo "exit=$?" >> "ordenes/${order}-informe.log"
  if ! npx tsc --noEmit > /dev/null 2>&1; then echo "FALLO tsc tras ${order}" > "$statusfile"; exit 1; fi
  if [[ -n "$(git status --porcelain -- src prisma tests)" ]]; then echo "FALLO ${order} dejó cambios sin commit" > "$statusfile"; exit 1; fi
  if [[ -n "$required" && ! -e "$required" ]]; then echo "FALLO ${order} no creó ${required}" > "$statusfile"; exit 1; fi
done
echo "OK" > "$statusfile"
