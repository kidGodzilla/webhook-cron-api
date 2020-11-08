const os = require('os');
require('dotenv').config();
const cluster = require('cluster');

const PORT = process.env.PORT || 5000;
const debug = process.env.DEBUG || false;
const AUTHKEY = process.env.AUTHKEY || 'xy0cWP';

if (cluster.isMaster) {
    // let cpuCount = os.cpus().length;
    let threadCount = 1;

    for (let i = 0; i < threadCount; i += 1) {
        cluster.fork();
    }

    cluster.on('exit', (worker) => {
        console.log('Worker %d died', worker.id);
        cluster.fork();
    });

} else {
    // Main app
    const syncViaFtp = require('sync-via-ftp');
    const schedule = require('node-schedule');
    const bodyParser = require('body-parser');
    const request = require('superagent');
    const express = require('express');

    // global.apps = syncViaFtp('apps', { localPath: '/storage/' });
    const app = express();

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));

    // CORS Middleware for OPTIONS requests
    app.use(function (req, res, next) {
        if (req.method === 'OPTIONS') {
            var headers = {};
            headers["Access-Control-Allow-Origin"] = "*";
            headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
            headers["Access-Control-Allow-Credentials"] = true;
            headers["Access-Control-Max-Age"] = '86400'; // 24 hours
            headers["Access-Control-Allow-Headers"] = "Accept,Authorization,Cache-Control,Content-Type,DNT,If-Modified-Since,Keep-Alive,Origin,User-Agent,X-Requested-With,X-HTTP-Method-Override";
            res.writeHead(204, headers);
            res.end();
        } else {
            next();
        }
    });

    app.use(require('cors')({ credentials: true }));

    // Allow a lot (all) origins
    app.use(function (req, res, next) {
        var origin = req.headers.origin;

        // Allow a whitelisted set of origins
        // var allowedOrigins = ['http://127.0.0.1:8020', 'http://localhost:8020', 'http://127.0.0.1:9000', 'http://localhost:9000'];
        // if(allowedOrigins.indexOf(origin) > -1){
        //     res.setHeader('Access-Control-Allow-Origin', origin);
        // }

        // Allow all origins, basically
        if (origin) res.setHeader('Access-Control-Allow-Origin', origin);

        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.header('Access-Control-Allow-Credentials', true);
        next();
    });

    // Simple logger & API Monitor
    require('simple-logger-api-monitor')(app);

    // Verify a route authorization by a known key
    function verifyAuthorizationKey (auth, cb) {
        if (!auth) return cb(false);

        if (auth === AUTHKEY) return cb(true);

        return cb(false);
    }





    // Start Server
    const server = app.listen(PORT, function () {
        console.log(`App listening on port ${ PORT }!`);
        server.keepAliveTimeout = 0;
    });
}
