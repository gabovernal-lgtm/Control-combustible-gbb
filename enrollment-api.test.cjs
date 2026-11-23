const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{stripTypeScriptTypes}=require('node:module');
const source=stripTypeScriptTypes(fs.readFileSync(__dirname+'/fuel-qr-api.ts','utf8').replace(/^import .*\n/,''));
function setup({role='admin',active=true,allowed=true,submitError=false}={}){let handler,created=0,deleted=0;const calls=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'a2bd2357-c3a5-43ce-b319-d214756e2a99'}}}),admin:{createUser:async()=>{created++;return {data:{user:{id:crypto.randomUUID()}}}},deleteUser:async()=>{deleted++;return {}}}},from(){const q={select(){return q},eq(){return q},neq(){return q},order(){return q},limit(){return q},single:async()=>({data:{role,active}}),then(ok,no){return Promise.resolve({data:[]}).then(ok,no)}};return q},rpc:async(name,args)=>{calls.push({name,args});if(name==='allow_fuel_account_request')return {data:allowed};if(name==='submit_fuel_account_request')return submitError?{error:Error('test failure')}:{data:crypto.randomUUID()};return {data:{ok:true}}}};
 vm.runInNewContext(source,{createClient:()=>db,Deno:{env:{get:()=>''},serve:fn=>handler=fn},Request,Response,crypto,TextEncoder,TextDecoder,Uint8Array,atob,Date,JSON,Error});
 return {call:async(body,auth=false)=>handler(new Request('https://example.invalid',{method:'POST',headers:{'Content-Type':'application/json',...(auth?{authorization:'Bearer test'}:{})},body:JSON.stringify(body)})),stats:()=>({created,deleted,calls})};
}
(async()=>{const request={action:'request_account',name:'Prueba Registro',email:'test@example.invalid',password:'sample-test-password',role:'receiver'};
 let t=setup();let res=await t.call(request);assert.equal(res.status,200);assert.equal((await res.json()).status,'pending');assert.equal(t.stats().created,1);assert.equal(t.stats().calls[1].name,'submit_fuel_account_request');assert.equal(JSON.stringify(t.stats().calls).includes(request.password),false,'password is never saved in application tables');
 t=setup();assert.equal((await t.call({...request,role:'admin'})).status,400);assert.equal(t.stats().created,0);
 t=setup();assert.equal((await t.call({...request,password:'short'})).status,400);assert.equal(t.stats().created,0);
 t=setup({allowed:false});assert.equal((await t.call(request)).status,429);assert.equal(t.stats().created,0);
 t=setup({submitError:true});assert.equal((await t.call(request)).status,400);assert.equal(t.stats().deleted,1);
 t=setup();assert.equal((await t.call({action:'account_requests'})).status,401);
 t=setup({role:'driver'});assert.equal((await t.call({action:'account_requests'},true)).status,403);assert.equal((await t.call({action:'review_account_request',id:crypto.randomUUID(),approve:true,role:'receiver',note:''},true)).status,403);
 t=setup({active:false});assert.equal((await t.call({action:'record'},true)).status,403);
 t=setup();assert.equal((await t.call({action:'account_requests'},true)).status,200);assert.equal((await t.call({action:'review_account_request',id:crypto.randomUUID(),approve:true,role:'receiver',note:''},true)).status,200);assert.equal(t.stats().calls.at(-1).name,'review_fuel_account_request');assert.equal((await t.call({action:'review_account_request',id:crypto.randomUUID(),approve:true,role:'admin',note:''},true)).status,400);
 console.log('PASS: public pending registration, role restrictions, rate limit, account rollback, admin approval/rejection authorization and no password persistence');
})().catch(e=>{console.error(e);process.exitCode=1});
