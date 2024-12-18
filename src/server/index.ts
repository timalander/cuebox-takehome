import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { processFiles } from './processor';

const app = express();
const port = 3001;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post(
  '/api/upload',
  upload.fields([
    { name: 'constituents', maxCount: 1 },
    { name: 'donations', maxCount: 1 },
    { name: 'emails', maxCount: 1 },
  ]),
  async (req: express.Request, res: express.Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const includeDebug = req.body.debug === 'true';

      if (!files.constituents?.[0] || !files.donations?.[0] || !files.emails?.[0]) {
        res.status(400).json({ error: 'Missing required files' });
        return;
      }

      const result = await processFiles(
        files.constituents[0].buffer,
        files.donations[0].buffer,
        files.emails[0].buffer,
        includeDebug,
      );

      res.status(200).json({
        message: 'Files processed successfully',
        data: result,
      });
    } catch (error) {
      console.error('Error processing files:', error);
      res.status(500).json({ error: 'Error processing files' });
    }
  },
);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
