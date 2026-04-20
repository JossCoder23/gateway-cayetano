import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    // 1. Extraer el token del header "Authorization: Bearer <token>"
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    try {
        // 2. Verificar la firma del token usando la clave secreta
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(token, secret) as any;

        // 3. LA MAGIA: Inyectar el ID y el Rol en los headers de la petición
        // Así, Laravel y Node.js sabrán quién es el usuario sin consultar a la base de datos
        req.headers['X-User-Id'] = decoded.user_id;
        req.headers['X-User-Role'] = decoded.role;

        // 4. Dejar pasar la petición al microservicio de destino
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};