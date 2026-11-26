# Étape 1 : Build de l'application React
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --no-fund --fetch-retries=5 --fetch-timeout=300000

COPY . .
# On construit l'app pour la production
RUN npm run build

# Étape 2 : Serveur Nginx pour servir les fichiers
FROM nginx:alpine

# Copier les fichiers buildés dans Nginx
COPY --from=build /app/dist /usr/share/nginx/html
# (Si tu utilises Vite, remplace /app/build par /app/dist)

# Copier une config Nginx personnalisée (on la créera juste après)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]