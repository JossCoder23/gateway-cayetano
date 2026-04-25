import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado: Token no proporcionado' });
    }

    try {
        const secret = process.env.JWT_SECRET || 'fallback_secret';
        const decoded = jwt.verify(token, secret) as any;

        // 1. Inyectamos el ID (Usamos user_id que es como viene en tu JWT)
        req.headers['X-User-Id'] = decoded.user_id || 'anonymous';

        // 2. OPTIMIZACIÓN DE ROL: 
        // Verificamos si existe 'roles' como array y tomamos el primero, 
        // o si existe 'role' como string, o ponemos 'GUEST' por defecto.
        const userRole = 
            (Array.isArray(decoded.roles) && decoded.roles.length > 0) ? decoded.roles[0] : 
            (decoded.role) ? decoded.role : 
            'GUEST';

        // Seteamos el header asegurándonos de que NUNCA sea undefined
        req.headers['X-User-Role'] = String(userRole);

        next();
    } catch (error) {
        console.error('Error en validación de token:', error);
        return res.status(403).json({ error: 'Token inválido o expirado' });
    }
};