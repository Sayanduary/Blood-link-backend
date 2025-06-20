import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser'
import {PORT} from "./config/env.js";
import connectToDatabase from "./Database/db.js";


dotenv.config();

const app = express();

app.use(express.json()); // Allow parsing JSON bodies
app.use(express.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(cookieParser());


const startServer = async () => {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`Server started on http://localhost:${PORT}`);
    });
};

startServer().catch(console.error);

export default app;

