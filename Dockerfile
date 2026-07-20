# Utilise l'image officielle de build
FROM n8nio/n8n:latest

# Définit le répertoire de travail
WORKDIR /app

# Copie les fichiers nécessaires
COPY . .

# Installe les dépendances
RUN npm install

# Expose le port utilisé par n8n
EXPOSE 5678

# Commande de démarrage
CMD ["n8n", "start"]
