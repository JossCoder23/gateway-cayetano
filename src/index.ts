import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import dotenv from 'dotenv';
import { verifyToken } from './middleware/auth.middleware';
import jwt from 'jsonwebtoken';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

// ==========================================
// 1. RUTA PÚBLICA (Go Auth Service)
// ==========================================
// Todo lo que empiece con /auth va a Go. No pide token porque aquí se loguean.
app.use('/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/auth': '',
    },
    on: {
        // AGREGAMOS ": any" a req para que TS no chille por el .body
        proxyReq: (proxyReq, req: any, res) => {
            if (req.body && Object.keys(req.body).length > 0) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Type', 'application/json');
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        }
    }
}));

app.get('/dev/mock-login', (req, res) => {
    // Simulamos que Go validó a un usuario en la base de datos
    const payloadFalso = {
        user_id: "uuid-simulado-999",
        role: "LEAD" // Cambia esto a "ADMIN" si quieres probar otras cosas
    };

    const secret = process.env.JWT_SECRET || 'fallback_secret';
    
    // Firmamos el token aquí mismo
    const token = jwt.sign(payloadFalso, secret, { expiresIn: '1h' });

    res.json({
        mensaje: "Este es un token simulado para desarrollo",
        token: token
    });
});

// ==========================================
// 2. RUTA PRIVADA (Laravel Leads & Events)
// ==========================================
// Todo lo que empiece con /api pasa por el Middleware (Portero) primero.
app.use('/api', verifyToken, createProxyMiddleware({
    target: process.env.LEADS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/api': '', 
    },
    on: {
        proxyReq: (proxyReq, req: any, res) => {
            // 1. Inyectar Headers de Identidad (SIEMPRE se hace)
            if (req.user) {
                const userRole = (Array.isArray(req.user.roles) && req.user.roles.length > 0) 
                    ? req.user.roles[0] 
                    : (req.user.role || 'GUEST');

                proxyReq.setHeader('x-user-id', String(req.user.user_id || ''));
                proxyReq.setHeader('x-user-role', String(userRole));
            }

            // 2. LOGICA ANTI-ERROR 500:
            // Si es un archivo (multipart), NO tocamos el body. 
            // Esto evita que el proxy intente serializar el binario del Excel/CSV.
            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('multipart/form-data')) {
                return; // Salimos de la función y dejamos que el stream pase directo
            }

            // 3. Solo para peticiones JSON normales (como Login o Create)
            if (req.body && Object.keys(req.body).length > 0) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            }
        }
    }
}));

// ==========================================
// 3. RUTA PRIVADA (Node.js Mapbox 3D)
// ==========================================
// Todo lo que empiece con /map va al servicio de alta concurrencia
app.use('/map', verifyToken, createProxyMiddleware({
    target: process.env.MAP_SERVICE_URL,
    changeOrigin: true,
}));

// Iniciar el Gateway
app.listen(PORT, () => {
    console.log(`🚀 API Gateway TypeScript corriendo en el puerto ${PORT}`);
    console.log(`🛡️  Modo de seguridad centralizada: ACTIVO`);
});