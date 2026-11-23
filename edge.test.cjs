const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('node:module');
const core=require('./qr-core.js');
const source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/fuel-qr-api.ts','utf8').replace(/^import .*\n/,''));
async function fixture(role='driver'){
 const receiver=crypto.randomUUID(),userId=crypto.randomUUID(),pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);const record={id:crypto.randomUUID(),privateKey:pair.privateKey};const qr=await core.generate(record,receiver);let rpcCount=0,audits=0,created=0;let duplicate=false;
 const db={auth:{getUser:async()=>({data:{user:{id:userId}}}),admin:{createUser:async()=>{created++;return {data:{user:{id:crypto.randomUUID()}}}},deleteUser:async()=>({})}},from(table){const q={select(){return q},eq(){return q},order(){return q},maybeSingle:async()=>({data:null}),single:async()=>({data:table==='profiles'?{id:userId,role,active:true}:{public_jwk:await crypto.subtle.exportKey('jwk',pair.publicKey),receiver_id:receiver,active:true}}),insert:async()=>({}),update(){return q},upsert:async()=>{audits++;return {}},then(ok,no){return Promise.resolve({data:[]}).then(ok,no)}};return q},rpc:async()=>{rpcCount++;return duplicate?{error:{code:'23505',message:'QR_ALREADY_USED'}}:{data:{accepted:true}}}};
 let handler;vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},Response,Request,crypto,TextEncoder,TextDecoder,Uint8Array,atob,Date,JSON,Error});
 const call=async(body,authenticated=true)=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)}));
 const delivery={id:crypto.randomUUID(),truck_id:crypto.randomUUID(),other_equipment:'test',liters:5,shift:'TA',delivered_at:new Date().toISOString(),notes:''};return {call,qr,delivery,uid:userId,duplicate:()=>duplicate=true,stats:()=>({rpcCount,audits,created})};
}
(async()=>{
 let t=await fixture();assert.equal((await t.call({action:'users'},false)).status,401);assert.equal((await t.call({action:'users'})).status,403);assert.equal((await t.call({action:'register_device'})).status,403);
 const missingQR=await t.call({action:'record',delivery:t.delivery});assert.equal(missingQR.status,400);assert.equal((await missingQR.json()).code,'QR_REQUIRED');
 let proof={qr:t.qr,scanned_at:new Date().toISOString()};assert.equal((await t.call({action:'claim',proof,delivery:t.delivery})).status,200);assert.equal(t.stats().rpcCount,1);
 t.duplicate();const duplicate=await t.call({action:'claim',proof,delivery:{...t.delivery,id:crypto.randomUUID()}});assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).code,'QR_ALREADY_USED');assert.equal(t.stats().audits,1);
 const p=t.qr.split('.');const obj=core.parse(t.qr).payload;obj.n=crypto.randomUUID();p[1]=Buffer.from(JSON.stringify(obj)).toString('base64url');assert.equal((await t.call({action:'claim',proof:{...proof,qr:p.join('.')},delivery:t.delivery})).status,400);assert.equal(t.stats().rpcCount,2);
 t=await fixture('receiver');assert.equal((await t.call({action:'claim',proof,delivery:t.delivery})).status,403);assert.equal((await t.call({action:'create_user'})).status,403);assert.equal((await t.call({action:'record',delivery:t.delivery})).status,400);
 t=await fixture('admin');assert.equal((await t.call({action:'create_user',name:'Test',email:'person@example.invalid',password:'weak',role:'driver'})).status,400);assert.equal(t.stats().created,0);
 assert.equal((await t.call({action:'update_user',id:t.uid,name:'Test',role:'receiver',active:true})).status,400);
 assert.equal((await t.call({action:'create_user',name:'Test',email:'person@example.invalid',password:'abc123',role:'receiver'})).status,200);assert.equal(t.stats().created,1);
 console.log('PASS: API authentication, role restrictions, signed claim, replay conflict audit, tamper rejection and administrator account safeguards');
})().catch(e=>{console.error(e);process.exitCode=1});
