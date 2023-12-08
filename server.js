require('dotenv').config();
require('express-async-errors');
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const path = require('path');
const { logger, logEvents } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const corsOptions = require('./config/corsOptions');
const connectDB = require('./config/dbConn');
const mongoose = require('mongoose');
const PORT = process.env.PORT || 3500;

if (cluster.isMaster) {
    const numCPUs = os.cpus().length;
    console.log(`Master process is running on PID: ${process.pid}`);
    console.log(`Forking for ${numCPUs} CPUs`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork(); // Restart a new worker when one dies
    });
} else {
    const app = express();

    connectDB();

    app.use(logger);
    app.use(cors(corsOptions));
    app.use(express.json());
    app.use(cookieParser());
    app.use('/', express.static(path.join(__dirname, 'public')));
    app.use('/', require('./routes/root'));
    app.use('/auth', require('./routes/authRoutes'));
    app.use('/users', require('./routes/userRoutes'));
    app.use('/tasks', require('./routes/taskRoutes'));

    app.all('*', (req, res) => {
        res.status(404);
        if (req.accepts('html')) {
            res.sendFile(path.join(__dirname, 'views', '404.html'));
        } else if (req.accepts('json')) {
            res.json({ message: '404 Not Found' });
        } else {
            res.type('txt').send('404 Not Found');
        }
    });

    app.use(errorHandler);

    mongoose.connection.once('open', () => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => console.log(`Worker ${process.pid} is running on port ${PORT}`));
    });

    mongoose.connection.on('error', err => {
        console.log(err);
        logEvents(`${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`, 'mongoErrLog.log');
    });
}
