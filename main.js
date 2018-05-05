/* 
 * (C) 2018, AII (Alexey Ilyin).
 */

const chromatic = require('.');
chromatic.server.log.addStream({
    level: chromatic.config.get('server.logfilelevel'),
    path:  chromatic.config.get('server.logfile')
});
chromatic.server.post('/test', chromatic.handle(function (request, response, next) {
    console.log('TEST', request.params, request.query);
    response.end('END OF TEST');
    return next();
}));
chromatic.start();

