import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import { initialize } from './database/initiation';
import { RegisterRoutes } from './routes';
import * as swaggerUI from 'swagger-ui-express';

dotenv.config();

initializeApp({
  credential: applicationDefault(),
});

getAuth()
  .getUser('UzB93dpv7Gb5Wm6R1N2pbsPaQd02')
  .then((userRecord) => {
    // See the UserRecord reference doc for the contents of userRecord.
    console.log(`Successfully fetched user data: ${userRecord.email}`);
  })
  .catch((error) => {
    console.log('Error fetching user data:', error);
  });

const app: Express = express();
const port = process.env.PORT || 8000;

const corsOptions = {
  origin: '*',
};

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

initialize();
RegisterRoutes(app);

app.use('/docs', swaggerUI.serve, async (_req: Request, res: Response) => {
  return res.send(swaggerUI.generateHTML(await import('./swagger.json')));
});

app.get('/', (req: Request, res: Response) => {
  res.send('Express + TypeScript Server');
});

app.listen(port, () => {
  console.log(`⚡️[server]: Server is running at http://localhost:${port}`);
});
