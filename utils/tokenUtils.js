import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'bloodlink-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token
 * @param {string} id - User ID
 * @param {string} role - User role
 * @param {string} expiresIn - Token expiration (optional)
 * @param {string} type - Token type (auth/reset) (optional)
 * @returns {string}
 */
export const generateToken = (id, role, expiresIn = JWT_EXPIRES_IN, type = 'auth') => {
  return jwt.sign(
    { id, role, type, iat: Math.floor(Date.now() / 1000) },
    JWT_SECRET,
    { expiresIn }
  );
};

/**
 * Verify JWT token
 * @param {string} token
 * @returns {object|null}
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

/**
 * Extract token from request
 * @param {object} req - Express request
 * @returns {string|null}
 */
export const getTokenFromRequest = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    return req.headers.authorization.split(' ')[1];
  }
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  return null;
};