const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const code=fs.readFileSync(__dirname+'/app.js','utf8');
async function setup(role,online=true){
 const elements={},storage=new Map();let signouts=0,sessionReads=0,initialized=0;
 const profile={id:'test-user',full_name:'Test',role,active:true};if(!online)storage.set('gbb-profile',JSON.stringify(profile));
 const el=id=>elements[id]??=({value:'',textContent:'',innerHTML:'',classList:{hidden:new Set(),add(x){this.hidden.add(x)},remove(x){this.hidden.delete(x)},toggle(x,flag){flag?this.hidden.add(x):this.hidden.delete(x)},contains(x){return this.hidden.has(x)}},focus(){},querySelectorAll(){return []}});
 const query=table=>{const q={select(){return q},eq(){return q},is(){return q},order(){return q},limit(){return q},single:async()=>({data:profile}),then(ok,no){return Promise.resolve({data:[]}).then(ok,no)}};return q};
 const auth={onAuthStateChange(){},async getSession(){sessionReads++;if(!online)throw Error('Offline auth request');return {data:{session:{user:{id:profile.id,email:'test@example.invalid'}}}}},async signOut(){signouts++;return {}},async signInWithPassword(){return {}}};
 const ctx={document:{getElementById:el,addEventListener(){}},window:{FUEL_CONFIG:{url:'test',publishableKey:'test'},supabase:{createClient:()=>({auth,from:query})},GBBOffline:{load:async()=>[],write:async()=>{}},GBBReceiverUI:{init:async()=>{initialized++},getProof:()=>null,loadUsers(){}},addEventListener(){}},navigator:{onLine:online},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},location:{hash:'',origin:'https://example.invalid',pathname:'/',reload(){}},history:{replaceState(){}},setInterval(){},URLSearchParams,console};
 vm.runInNewContext(code,ctx);await new Promise(r=>setImmediate(r));return {el,stats:()=>({signouts,sessionReads,initialized})};
}
(async()=>{
 let t=await setup('receiver');assert.equal(t.stats().sessionReads,0);assert.equal(t.el('entryChoice').classList.contains('hidden'),false);await t.el('chooseSupplier').onclick();assert.equal(t.stats().signouts,1);assert.match(t.el('entryChoiceStatus').textContent,/no tiene el perfil/);assert.equal(t.stats().initialized,0);
 t=await setup('driver');await t.el('chooseReceiver').onclick();assert.equal(t.stats().signouts,1);
 for(const role of ['driver','admin','receiver']){t=await setup(role);await t.el(role==='receiver'?'chooseReceiver':'chooseSupplier').onclick();assert.equal(t.stats().initialized,1,role);assert.equal(t.el('app').classList.contains('hidden'),false);assert.equal(t.el('showAdmin').classList.contains('hidden'),role!=='admin');assert.equal(t.el('showHistory').classList.contains('hidden'),role!=='admin');}
 t=await setup('receiver',false);await t.el('chooseReceiver').onclick();assert.equal(t.stats().sessionReads,0);assert.equal(t.stats().initialized,1);
 console.log('PASS: entry selection, wrong-role sign-out, driver/admin/receiver routing and offline receiver boot without auth requests');
})().catch(e=>{console.error(e);process.exitCode=1});
