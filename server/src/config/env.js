import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Look for .env in root or server dir
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const schema=z.object({PORT:z.coerce.number().default(4000),MONGODB_URI:z.string().min(1,'MONGODB_URI is required'),GEMINI_API_KEY:z.string().optional(),GEMINI_MODEL:z.string().default('gemini-2.5-flash'),CLIENT_ORIGIN:z.string().url().default('http://localhost:5173'),INGEST_CRON:z.string().default('*/30 * * * *'),NODE_ENV:z.enum(['development','test','production']).default('development')});
export const env=schema.parse(process.env);
