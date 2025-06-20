import jwt from "jsonwebtoken";

export const requireSignIn = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).send({ success: false, message: "No token provided" });

    const token = authHeader.split(' ')[1];

    if (!token) return res.status(401).send({ success: false, message: "No token provided" });

    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not defined.");
      return res.status(500).send({ success: false, message: "Internal Server Error" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach user info
    next(); // Proceed to the next middleware/route handler
  } catch (err) {
    console.error(err);
    return res.status(401).send({ success: false, message: "Invalid or expired token" });
  }
};

// isAdmin.js
export const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 1) {
    return next(); // Proceed if admin
  }
  return res.status(403).send({ success: false, message: "Access denied - Admins only." });
};

