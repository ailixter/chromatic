/* 
 * (C) 2018, AII (Alexey Ilyin).
 */

const restify = require('restify');
const errors = require('restify-errors');
const config = require('config');
const storage = require('tmp');
const bunyan = require('bunyan');

restify.bunyan.serializers.err = function (err) {
    if (!err || !err.stack) {
        return err;
    }
    return {
        message: err.message,
        name: err.name,
        code: err.code,
        signal: err.signal
    };
};
config.server.restify.log = bunyan.createLogger({
  name: 'main',
  level: config.server.loglevel,
  serializers: restify.bunyan.serializers,
  streams: [/*SIC*/]
});

const server = restify.createServer(config.server.restify);
server.log.addStream({
    level:  config.server.loglevel,
    stream: process.stderr
});
server.use(restify.plugins.requestLogger());
server.use(restify.plugins.queryParser({
    mapParams: true
}));
server.use(restify.plugins.bodyParser({
    mapParams: true,
    mapFiles: true
}));

server.pre(function (request, response, next) {
    request.log.info({/*client_*/req: request}, 'START');
    return next();
});

//TODO server.on('after', restify.plugins.auditLogger({}))

server.on('restifyError', function (request, response, err, cb) {
    request.log.error(err, 'restifyError');
    return cb(err);
});

server.log.on('error', function (err) {
    console.error('LOGGER', err);
});

if (config.has('server.route')) {
    server.post(config.get('server.route'), handle());
}

process.on('uncaughtException', function (err) {
    server.log.fatal(err, 'uncaughtException');
});

module.exports = {
    server: server,
    config: config,
    errors: errors,
    handle: handle,
    start:  function (cb) {
        server.listen(config.server.port, cb || function () {
            console.log('%s listening at %s', server.name, server.url);
            console.log('with', config);
        });
        return this;
    }
};

function handle (fn = respond) {
    return function (request, response, next) {
        //DEBUG:throw new errors.NotImplementedError('bad break');
        try {
            return fn(request, response, next);
        }
        catch (e) {
            return next(e);
        }
    };
}

var browser;

async function printPDF (params, pdfoptions) {
    if (!browser) {
        const puppeteer = require('puppeteer');
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
        console.log(await browser.version(), 'created');
        console.log(puppeteer.executablePath());
        console.log(puppeteer.defaultArgs());
    }
    const page = await browser.newPage();
    switch (params.datatype) {
        case 'html':
            await page.setContent(params.data.toString());
            break;
        case 'url':
            await page.goto(params.data, {waitUntil: 'networkidle0'});
            break;
    }
    if (params.waitForSelector) { // '.mjx-chtml'
        await page.waitForSelector(params.waitForSelector, {
            timeout: params.waitForSelectorTimeout || 6000
        });
    }
    const pdf = await page.pdf(pdfoptions);
    console.log(await page.metrics());
    page.close();
    return pdf;
}

var needle;

/**
 * 
 * @param string outputurl 
 * @param any data 
 * @param Object options 
 */
function notify (outputurl, data, options = {}) {
    if (!needle) {
        needle = require('needle');
    }
    //DEBUG:throw new errors.NotImplementedError('break before notification');
    needle('post', outputurl, data, options)
        .then(response => {
            server.log[response.statusCode === 200 ? 'info' : 'error']({client_res: response}, 'callback response');
        })
        .catch(e => {
            server.log.error(e, 'notification failed');
            // TODO
        });
}

function respond (request, response, next) {
    //DEBUG:throw new errors.NotImplementedError('break response');
    var params = request.params;
    console.log(params);
    if (!['html', 'url'].includes(params.datatype)) {
        return next(new errors.InvalidArgumentError(params.datatype || 'no datatype'));
    }
    const pdfoptions = { // TODO defaults
        format: params.pageformat || config.get('pageformat')
    };
    switch (params.output) {
        case 'url':
            pdfoptions.path = storage.tmpNameSync({
                prefix: 'TODO',
                postfix: '.pdf',
                dir: config.storageroot
            });
            printPDF(params, pdfoptions)
                .then(() => {
                    console.log('output file is ready');
                    notify(params.outputurl, {filename: pdfoptions.path});
                })
                .catch(e => {
                    request.log.error(e, 'output failed');
                });
            response.send({success: 'outfilename', outfilename: pdfoptions.path});
            return next();

        case 'url-upload':
            printPDF(params, pdfoptions)
                .then(data => {
                    console.log('output data is ready');
                    notify(params.outputurl, {filedata: data}, {multipart: true});
                })
                .catch(e => {
                    request.log.error(e, 'upload failed');
                });
            response.send({success: true});
            return next();

        case 'return':
            printPDF(params, pdfoptions)
                .then(data => {
                    response.writeHead(200, {
                        'Connection': 'close',
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': 'attachment; filename="output.pdf"'
                    });
                    response.end(data);
                    return next();
                })
                .catch(e => {
                    return next(e);
                });
            break;

        default:
            return next(new errors.InvalidArgumentError(params.output || 'no output specified'));
    }
}

