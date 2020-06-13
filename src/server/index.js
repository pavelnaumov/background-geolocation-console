/* eslint-disable no-console */

import bodyParser from 'body-parser';
import 'colors';
import compress from 'compression';
import express from 'express';
import morgan from 'morgan';
import opn from 'opn';
import { extname, resolve } from 'path';

import {
  dyno,
  firebaseURL,
  isProduction,
  parserLimit,
  port,
} from './config';
import initializeDatabase from './database/initializeDatabase';
import { AccessDeniedError } from './libs/utils';
import api from './routes/api-v2';
import firebase from './routes/firebase-api';
import siteApi from './routes/site-api';
import tests from './routes/tests';


const app = express();
const buildPath = resolve(__dirname, '..', '..', 'build');
const parserLimits = { limit: parserLimit, extended: true };

process.on('uncaughtException', err => {
  // eslint-disable-next-line no-console
  console.error('<!> Exception %s: ', err.message, err.stack);
});

process.on('message', msg => {
  // eslint-disable-next-line no-console
  console.log('Server %s process.on( message = %s )', JSON.stringify(msg));
});

app.disable('etag');
app.use(morgan(isProduction ? 'short' : 'dev'));
app.use(compress());
app.use(bodyParser.json(parserLimits));
app.use(bodyParser.raw(parserLimits));

((async () => {
  await initializeDatabase();

  app.use(siteApi);
  app.use('/api/site', siteApi);
  app.use('/api/firebase', firebase);
  app.use('/api/jwt', api);
  app.use('/api', firebaseURL ? firebase : api);
  app.use('/api', tests);

  if (isProduction) {
    app.use(express.static(buildPath));
  }

  app.use((req, res, next) => {
    const ext = extname(req.url);
    console.log('req.url', req.url, ext);
    if ((!ext || ext === '.html') && req.url !== '/') {
      res.sendFile(resolve(__dirname, buildPath, 'index.html'));
    } else {
      next();
    }
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err.message, err.stack);

    if (err instanceof AccessDeniedError) {
      return res.status(403)
        .send({ error: err.message });
    }

    return res.status(500)
      .send({ message: err.message || 'Something broke!' });
  });

  app.listen(port, () => {
    console.log('╔═══════════════════════════════════════════════════════════'.green.bold);
    console.log('║ Background Geolocation Server | port: %s, dyno: %s'.green.bold, port, dyno);
    console.log('╚═══════════════════════════════════════════════════════════'.green.bold);

    // Spawning dedicated process on opened port..
    // only if not deployed on heroku
    if (!dyno) {
      opn(`http://localhost:${port}`)
        .catch(error => console.error('Optional site open failed:', error));
    }
  });
})());

module.exports = app;
