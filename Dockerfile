# 1. Usar una imagen ligera de Node.js
FROM node:20-alpine

# 2. Crear la carpeta de trabajo dentro del contenedor
WORKDIR /app

# 3. Copiar los archivos de dependencias
COPY package*.json ./

# 4. Instalar las dependencias (producción y desarrollo para compilar)
RUN npm install

# 5. Copiar todo tu código TypeScript y la configuración
COPY . .

# 6. Compilar TypeScript a JavaScript puro
RUN npm run build

# 7. Exponer el puerto 80 (el que usará el Gateway)
EXPOSE 80

# 8. Comando para iniciar el Gateway compilado
CMD ["npm", "start"]