const os = require('os');
require('dotenv').config();
const cluster = require('cluster');

global.running = {};
const PORT = process.env.PORT || 5000;
const debug = process.env.DEBUG || false;
const AUTHKEY = process.env.AUTHKEY || 'xy0cWP';

function rando() {
    return (Math.random().toString(36).replace(/[^a-z]+/g, ''));
}

function validURL(str) {
    var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
        '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
    return !!pattern.test(str);
}

// Verify a route authorization by a known key
function verifyAuthorizationKey (auth, cb) {
    if (!auth) return false;
    if (auth === AUTHKEY) return true;
    return false;
}

function authorized (req, res, next) {
    let { auth } = Object.assign(req.query, req.body);
    if (!auth) return res.send('Unauthorized');

    if (auth === AUTHKEY) return next();
    return res.send('Unauthorized');
}

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
    const { isValidCron } = require('cron-validator');
    const syncViaFtp = require('sync-via-ftp');
    const schedule = require('node-schedule');
    const bodyParser = require('body-parser');
    const request = require('superagent');
    const express = require('express');
    const md5 = require('md5');
    const fs = require('fs');
    const app = express();

    global.crontab = syncViaFtp('crontab', (fs.existsSync('/storage/') ? { localPath: '/storage/' } : {}), () => { startJobs() });
    global.running = {};

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

    function doRequest (key) {
        let { url } = crontab[key];

        console.log(`Request ${ key } for ${ url }`);

        request.get(url).then(() => {
            crontab[key].executed = + new Date();
            console.log(`Fetched URL: ${ url }`);
        });
    }

    function startJobs () {
        for (let key in crontab) {
            if (running[key]) continue;

            let { cron } = crontab[key];

            running[key] = schedule.scheduleJob(cron, function () { doRequest(key) });
        }
    }

    startJobs();

    // Create a new job. Requires a cron expression and URL as { cron, url }
    app.use('/new', authorized, (req, res) => {
        let params = Object.assign(req.query, req.body);
        let key = rando() + rando();
        let { url, cron } = params;

        if (!isValidCron(cron)) return res.status(400).send('Invalid input (invalid cron schedule format)');
        if (!validURL(url)) return res.status(400).send('Invalid input (invalid URL format)');

        crontab[key] = {
            url: url,
            cron: cron,
            created: + new Date(),
            executed: 0
        }

        running[key] = schedule.scheduleJob(cron, function () { doRequest(key) });

        res.send(key);
    });

    // Delete a job by key
    app.use('/del', authorized, (req, res) => {
        let params = Object.assign(req.query, req.body);
        let { key } = params;

        if (!crontab[key]) return res.status(400).send('Could not cancel job, it doesn\'t exist. Check your key and try again.');

        try { running[key].cancel() } catch(e){}
        delete crontab[key];
        delete running[key];

        res.send('Job deleted');
    });

    app.get('/jobs', authorized, (req, res) => {
        let out = JSON.parse(JSON.stringify(crontab));

        for (let key in out) {
            if (running[key]) out[key].running = true;
        }

        res.json(out);
    });


    // Start Server
    const server = app.listen(PORT, function () {
        console.log(`App listening on port ${ PORT }!`);
        server.keepAliveTimeout = 0;
    });
}
