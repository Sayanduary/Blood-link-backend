/**
 * Restrict routes based on user roles
 * @param {...string} roles - Allowed roles (e.g. 'admin', 'donor', 'ngo')
 * @returns {function} Middleware function
 */
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

/**
 * Check if user is an admin
 */
export const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

/**
 * Check if user is accessing their own resource
 * @param {Function} getResourceUserId - Function to extract user ID from resource
 * @returns {function} Middleware function
 */
export const isResourceOwner = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      const resourceUserId = await getResourceUserId(req);
      const currentUser = req.user.id.toString();
      if (req.user.role === 'admin' || (resourceUserId && resourceUserId.toString() === currentUser)) {
        return next();
      }
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this resource'
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        error: error.message
      });
    }
  };
};