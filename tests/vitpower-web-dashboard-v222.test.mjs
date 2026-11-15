import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWebDashboardReaderV222, hasExplicitWebDashboardBearerV222, productionWebDashboardReaderV222 } from '../src/services/vitPowerWebDashboardV222Service.js';
const id='a'.repeat(64), other='b'.repeat(64), now=Date.now();
async function fixture(run){const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vp-dashboard-'));try{await run(directory)}finally{await fs.rm(directory,{recursive:true,force:true})}}
const record=(extra={})=>({version:220,createdAt:now-1000,expiresAt:now+999999,history:[{role:'user',content:'¿Cuánto cuesta?',at:new Date(now-500).toISOString()},{role:'assistant',content:'Consulta del catálogo oficial.',at:new Date(now).toISOString()}],draft:{name:'Maria',city:'Quito',quantity:3},requests:{secret:{digest:'PRIVATE',response:{token:'SECRET'}}},...extra});
const write=(dir,key,data)=>fs.writeFile(path.join(dir,key+'.json'),JSON.stringify(data));
test('reader returns an allowlisted summary and detail without changing stored bytes or mtime',()=>fixture(async directory=>{
 await write(directory,id,record());const file=path.join(directory,id+'.json'),before=await fs.readFile(file),stat=await fs.stat(file),reader=createWebDashboardReaderV222({directory,now:()=>now});
 const rows=await reader.list();assert.equal(rows.length,1);assert.equal(rows[0].name,'Maria');assert.equal(rows[0].quantity,3);assert.equal(rows[0].messageCount,2);assert(!('history'in rows[0]));
 assert.equal((await reader.read(id)).history.length,2);assert(!JSON.stringify(await reader.read(id)).match(/PRIVATE|SECRET|digest|requests|token/));assert.deepEqual(await fs.readFile(file),before);assert.equal((await fs.stat(file)).mtimeMs,stat.mtimeMs);
}));
test('expired, empty and unsupported records are invisible without deleting files',()=>fixture(async directory=>{
 await write(directory,id,record({expiresAt:now}));await write(directory,other,record({history:[]}));await write(directory,'c'.repeat(64),record({version:221}));
 const reader=createWebDashboardReaderV222({directory,now:()=>now});assert.deepEqual(await reader.list(),[]);assert.equal(await reader.read(id),null);assert.equal((await fs.readdir(directory)).length,3);
}));
test('corrupt files, unrelated private files and directories are ignored',()=>fixture(async directory=>{
 await fs.writeFile(path.join(directory,id+'.json'),'{broken');await fs.writeFile(path.join(directory,'private.json'),'SECRET');await fs.mkdir(path.join(directory,other+'.json'));
 assert.deepEqual(await createWebDashboardReaderV222({directory}).list(),[]);
}));
test('traversal and malformed IDs cannot select files',()=>fixture(async directory=>{
 const reader=createWebDashboardReaderV222({directory});for(const value of['../private','A'.repeat(64),id+'.json','',id+'/x',undefined])assert.equal(await reader.read(value),null);
}));
test('symlinks cannot expose another file', {skip:process.platform==='win32'},()=>fixture(async directory=>{
 await fs.writeFile(path.join(directory,'private.json'),JSON.stringify(record()));await fs.symlink(path.join(directory,'private.json'),path.join(directory,id+'.json'));
 const reader=createWebDashboardReaderV222({directory});assert.deepEqual(await reader.list(),[]);assert.equal(await reader.read(id),null);
}));
test('oversized payloads are refused',()=>fixture(async directory=>{await fs.writeFile(path.join(directory,id+'.json'),' '.repeat(131073));assert.equal(await createWebDashboardReaderV222({directory}).read(id),null)}));
test('only user and assistant text are returned; html stays inert text and fields are bounded',()=>fixture(async directory=>{
 await write(directory,id,record({draft:{},history:[{role:'system',content:'SECRET'},{role:'user',content:'<img src=x onerror=alert(1)>\u0000',at:'bad'},{role:'assistant',content:'x'.repeat(4000),at:new Date(now).toISOString()}]}));
 const row=await createWebDashboardReaderV222({directory}).read(id);assert.equal(row.name,null);assert.equal(row.history.length,2);assert.equal(row.history[0].content,'<img src=x onerror=alert(1)>');assert.equal(row.history[0].at,null);assert.equal(row.history[1].content.length,2200);
}));
test('latest forty messages and at most one hundred records are returned',()=>fixture(async directory=>{
 for(let n=0;n<102;n++)await write(directory,n.toString(16).padStart(64,'0'),record({history:Array.from({length:44},(_,i)=>({role:'user',content:String(i),at:new Date(now).toISOString()}))}));
 const reader=createWebDashboardReaderV222({directory});assert.equal((await reader.list()).length,100);assert.equal((await reader.read('0'.repeat(64))).history[0].content,'4');
}));
test('missing storage fails without creating any directory',async()=>{const directory=path.join(os.tmpdir(),'missing-vp-'+Date.now());await assert.rejects(createWebDashboardReaderV222({directory}).list(),/UNAVAILABLE/);await assert.rejects(fs.stat(directory),{code:'ENOENT'})});
test('explicit bearer header is mandatory even on loopback or auth-disabled profiles',()=>{
 for(const value of[undefined,'','Basic abc','Bearer ','Bearer x y','Bearer x\n'])assert.equal(hasExplicitWebDashboardBearerV222({headers:{authorization:value},ip:'127.0.0.1'}),false);
 assert.equal(hasExplicitWebDashboardBearerV222({headers:{authorization:'Bearer signed.jwt.value'}}),true);
});
test('production reader refuses a disabled public chat profile even with a preload capability',()=>{const previous=process.env.VITALISMEN_EC_WEB_CHAT_V220;try{process.env.VITALISMEN_EC_WEB_CHAT_V220='false';assert.throws(()=>productionWebDashboardReaderV222(),/UNAVAILABLE/)}finally{if(previous===undefined)delete process.env.VITALISMEN_EC_WEB_CHAT_V220;else process.env.VITALISMEN_EC_WEB_CHAT_V220=previous}assert.throws(()=>createWebDashboardReaderV222({directory:'relative'}),/UNAVAILABLE/)});
