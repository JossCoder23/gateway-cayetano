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

app.use(cors());

// ==========================================
// 1. RUTA PÚBLICA (Go Auth Service)
// ==========================================
// Todo lo que empiece con /auth va a Go. No pide token porque aquí se loguean.
app.use('/auth', createProxyMiddleware({
    target: process.env.AUTH_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/auth': '', // Esto quita el "/auth" para que a Go le llegue solo "/login"
    },
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
    on: {
        error: (err, req, res) => {
            console.error(`[Gateway Error] Fallo al conectar con Leads: ${err.message}`);
            // Verificamos si 'res' es una respuesta HTTP y no un Socket
            if ('writeHead' in res) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    error: 'El servicio de Leads/Events no está disponible en este momento.' 
                }));
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