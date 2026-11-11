# Utiliser une image Node légère
FROM node:20-alpine

# Installer netcat (nécessaire pour que le script attende la base de données)
RUN apk add --no-cache netcat-openbsd

# Créer le dossier de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code
COPY . .

# Rendre le script exécutable
RUN chmod +x entrypoint.sh

# Exposer le port (4000)
EXPOSE 4000

# Lancer le script de démarrage
ENTRYPOINT ["./entrypoint.sh"]