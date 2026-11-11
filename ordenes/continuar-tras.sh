#!/bin/zsh
# Espera a que aparezca en main un commit cuyo asunto contenga <patrón> y entonces
# lanza run-chain.sh con el resto de argumentos. Sobrevive a cuelgues del chat (lanzar con nohup).
# Uso: ordenes/continuar-tras.sh "<patrón>" <marca> perfil:orden[:archivo] ...
cd "/Users/omar/Desktop/Claude/Script 28" || exit 1
pattern="$1"; shift
for i in {1..240}; do   # hasta 4 horas
  if git log --format=%s -15 | grep -qE -- "^(feat|fix)\($pattern\)"; then
    exec ordenes/run-chain.sh "$@"
  fi
  sleep 60
done
echo "FALLO: no apareció el commit '$pattern' en 4 horas" > "ordenes/$1.status"
