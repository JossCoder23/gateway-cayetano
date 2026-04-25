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
    target: process.env.AUTH_SERVICE_URL, // http://go-auth.railway.internal:8081
    changeOrigin: true,
    // IMPORTANTE: No uses pathRewrite si Go ya espera el prefijo /auth
    // Si Go tiene r.POST("/auth/login"), deja esto así.
    on: {
        proxyReq: (proxyReq, req, res) => {
            console.log(`[Proxy] Reenviando ${req.method} ${req.url} a Auth Service`);
        },
        error: (err, req, res) => {
            console.error('[Proxy Error]:', err);
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
    on: {
        proxyReq: (proxyReq, req: any, res) => {
            if (req.user && req.user.user_id) {
                // 1. Calculamos el Rol de forma segura (Array o String)
                const userRole = (Array.isArray(req.user.roles) && req.user.roles.length > 0) 
                    ? req.user.roles[0] 
                    : (req.user.role || 'GUEST');

                // 2. Inyectamos los Headers (Normalizamos a minúsculas para NestJS)
                proxyReq.setHeader('x-user-id', String(req.user.user_id));
                proxyReq.setHeader('x-user-role', String(userRole));

                // 3. LOGICA CRÍTICA: Solo re-escribimos el body si NO es Multipart/File
                const contentType = req.headers['content-type'] || '';
                
                if (
                    !contentType.includes('multipart/form-data') && 
                    req.body && 
                    Object.keys(req.body).length > 0
                ) {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
                // Si es multipart (Excel), NO hacemos proxyReq.write, 
                // dejamos que el stream original pase directo.
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