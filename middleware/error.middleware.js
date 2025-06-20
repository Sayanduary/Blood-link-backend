const errorMiddleware = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.log('Error:', err);

    // Mongoose bad ObjectId (CastError)
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new Error(message);
        error.statusCode = 404;
    }

    // MongoDB duplicate key error
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new Error(message);
        error.statusCode = 409; // Conflict is more appropriate than 400
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = new Error(message.join(', '));
        error.statusCode = 400;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = new Error(message);
        error.statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = new Error(message);
        error.statusCode = 401;
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error'
    });
};

export default errorMiddleware;