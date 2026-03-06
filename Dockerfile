FROM node:18-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Compilar la aplicación (si es necesario)
RUN npm run build || echo "No build script found, continuing..."

# Exponer puertos
EXPOSE 3000 5173

# Comando para iniciar
CMD ["npm", "run", "start"]
