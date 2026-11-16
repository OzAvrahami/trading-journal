// Synthetic-only local integration harness; never loads .env or a configurable DB URL.
import express from 'express';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import pool from '../src/db/client.js';
import { localCapturePool, migrateLocalCaptureDatabase } from '../test/helpers/localCaptureDb.js';
import { fixture } from '../test/helpers/captureFixture.js';
import imports, { getSession } from '../src/routes/importRoutes.js';
import accounts from '../src/routes/accounts.js';
import trades from '../src/routes/trades.js';
import analytics from '../src/routes/analytics.js';
import strategies from '../src/routes/strategies.js';
import { requireAuth } from '../src/middleware/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';

const db=localCapturePool(); await migrateLocalCaptureDatabase(db);
pool.query=(...args)=>db.query(...args); pool.connect=()=>db.connect();
const owner=randomUUID(),target=randomUUID();
await db.query("INSERT INTO users(id,email,password_hash,display_name,timezone) VALUES ($1,$2,'synthetic','Synthetic capture verification','Asia/Jerusalem')",[owner,`${owner}@example.invalid`]);
await db.query("INSERT INTO trading_accounts(id,user_id,company,account_number,account_name) VALUES ($1,$2,'Local synthetic','SYNTHETIC','Disposable capture test')",[target,owner]);
const directory=fileURLToPath(new URL('../../test-results/capture/',import.meta.url)); await mkdir(directory,{recursive:true});
await writeFile(directory+'/synthetic.capture.json',JSON.stringify(fixture(),null,2));
await writeFile(directory+'/sandbox.json',JSON.stringify({owner,target,url:'http://127.0.0.1:4179/import'}));
const preferences={locale:'en',theme:'light',timezone:'Asia/Jerusalem',tradeFormMode:'simple'};
process.env.JWT_SECRET=randomBytes(32).toString('hex');
const app=express();app.use(express.json());app.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
app.post('/api/auth/refresh',(_req,res)=>res.json({accessToken:jwt.sign({sub:owner},process.env.JWT_SECRET,{expiresIn:'1h'})}));
app.get('/api/me',requireAuth,(_req,res)=>res.json({id:owner,email:'synthetic@example.invalid',displayName:'Synthetic test only',timezone:'Asia/Jerusalem'}));
app.get('/api/preferences',requireAuth,(_req,res)=>res.json(preferences));
app.patch('/api/preferences',requireAuth,(req,res)=>{if(['en','he'].includes(req.body.locale))preferences.locale=req.body.locale;res.json(preferences);});
// Even an accidental private upload cannot be committed through this harness.
app.post('/api/imports/commit',requireAuth,(req,res,next)=>{
  const s=getSession(req.user.id,req.body.sessionId)?.capture?.source;
  if(s?.account.id!=='100'||s?.account.name!=='SYNTHETIC')return res.status(409).json({error:{code:'SYNTHETIC_ONLY',message:'Only synthetic fixture captures can be committed here.'}});
  next();
});
app.use('/api/imports',imports);app.use('/api/accounts',accounts);app.use('/api/trades',trades);app.use('/api/analytics',analytics);app.use('/api/strategies',strategies);
app.get('/api/setups',requireAuth,(_req,res)=>res.json({setups:[]}));
app.use('/api',(_req,res)=>res.status(404).json({error:{code:'SANDBOX_ROUTE_DISABLED',message:'Route unavailable in synthetic sandbox.'}}));
const dist=fileURLToPath(new URL('../../client/dist/',import.meta.url));app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(dist+'/index.html'));app.use(errorHandler);
const server=app.listen(4179,'127.0.0.1',()=>console.log('Synthetic persistence sandbox: http://127.0.0.1:4179/import — fixture in test-results/capture/synthetic.capture.json'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.end();process.exit(0);}));
