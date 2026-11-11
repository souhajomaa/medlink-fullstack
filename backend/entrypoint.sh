#!/bin/sh

echo "⏳ Attente de la base de données..."
# On attend que le port 5432 soit accessible
until nc -z db 5432; do
  sleep 1
done

echo "✅ Base de données prête !"
echo "🌱 Exécution du seed..."
npm run seed

echo "🚀 Démarrage du serveur..."
npm start