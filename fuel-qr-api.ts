import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const headers={'Access-Control-Allow-Origin':'https://gabovernal-lgtm.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function decode(text:string){if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error('QR_INVALID');return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({error:'Método no permitido'},405);
 try{
  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return response({error:'Inicia sesión con conexión para sincronizar.'},401);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await db.auth.getUser(auth.slice(7));
  if(authError||!identity.user)return response({error:'Tu sesión venció. Inicia sesión con conexión; tus cargas siguen guardadas.'},401);
  const uid=identity.user.id;
  const {data:profile}=await db.from('profiles').select('*').eq('id',uid).single();
  if(!profile?.active)return response({error:'Usuario inactivo'},403);
  const body=await req.json();
  if(body.action==='register_device'){
   if(profile.role!=='receiver')return response({error:'Solo receptor'},403);
   const {id,jwk}=body;
   if(!uuid(id)||jwk?.kty!=='EC'||jwk?.crv!=='P-256'||jwk?.d||!jwk.x||!jwk.y)throw Error('Clave de dispositivo inválida');
   await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
   const {data:existing}=await db.from('receiver_devices').select('*').eq('id',id).maybeSingle();
   if(existing){if(existing.receiver_id!==uid||existing.public_jwk.x!==jwk.x||existing.public_jwk.y!==jwk.y||!existing.active)throw Error('Dispositivo no disponible');return response({ok:true});}
   const {error}=await db.from('receiver_devices').insert({id,receiver_id:uid,public_jwk:{kty:'EC',crv:'P-256',x:jwk.x,y:jwk.y,ext:true}});if(error)throw error;
   return response({ok:true});
  }
  if(body.action==='users'||body.action==='create_user'||body.action==='update_user'){
   if(profile.role!=='admin')return response({error:'Solo administrador'},403);
   if(body.action==='users'){
    const {data,error}=await db.from('profiles').select('id,full_name,role,active').order('full_name');if(error)throw error;return response({users:data});
   }
   if(!['admin','driver','receiver'].includes(body.role)||typeof body.name!=='string'||body.name.trim().length<2||body.name.length>120)throw Error('Nombre y perfil inválidos');
   if(body.action==='create_user'){
    if(typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.password!=='string'||body.password.length<10||body.password.length>128)throw Error('Ingresa correo válido y contraseña de 10 a 128 caracteres');
    const {data,error}=await db.auth.admin.createUser({email:body.email.trim().toLowerCase(),password:body.password,email_confirm:true});if(error)throw error;
    const {error:profileError}=await db.from('profiles').insert({id:data.user.id,full_name:body.name.trim(),role:body.role,active:true});
    if(profileError){await db.auth.admin.deleteUser(data.user.id);throw profileError;}
    return response({ok:true});
   }
   if(!uuid(body.id)||typeof body.active!=='boolean')throw Error('Usuario inválido');
   if(body.id===uid&&(body.role!=='admin'||!body.active))throw Error('No puedes quitarte tu propio acceso de administrador');
   const {error}=await db.from('profiles').update({full_name:body.name.trim(),role:body.role,active:body.active}).eq('id',body.id);if(error)throw error;return response({ok:true});
  }
  if(body.action!=='claim'||!['admin','driver'].includes(profile.role))return response({error:'Acción no autorizada'},403);
  const {proof,delivery}=body;
  if(typeof proof?.qr!=='string'||proof.qr.length>2500||!delivery||!uuid(delivery.id))throw Error('QR_INVALID');
  const parts=proof.qr.split('.');if(parts.length!==3||parts[0]!=='GBBR1')throw Error('QR_INVALID');
  const payload=JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if(payload.v!==1||!uuid(payload.n)||!uuid(payload.r)||!uuid(payload.d)||!Number.isSafeInteger(payload.t))throw Error('QR_INVALID');
  const {data:device}=await db.from('receiver_devices').select('public_jwk,receiver_id,active').eq('id',payload.d).single();
  if(!device?.active||device.receiver_id!==payload.r)throw Error('Receptor o dispositivo inactivo');
  const key=await crypto.subtle.importKey('jwk',device.public_jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(parts[2]),new TextEncoder().encode(parts[1])))throw Error('QR_INVALID_SIGNATURE');
  const scanned=Date.parse(proof.scanned_at);if(!Number.isFinite(scanned)||scanned<payload.t-300000||scanned>payload.t+86400000||scanned>Date.now()+300000)throw Error('QR_EXPIRED');
  const clean={id:delivery.id,truck_id:delivery.truck_id,equipment_id:delivery.equipment_id||null,other_equipment:delivery.other_equipment||null,liters:Number(delivery.liters),shift:delivery.shift,delivered_at:delivery.delivered_at,notes:delivery.notes||''};
  const {data,error}=await db.rpc('claim_receiver_qr',{p_driver_id:uid,p_device_id:payload.d,p_receiver_id:payload.r,p_token_id:payload.n,p_issued_at:new Date(payload.t).toISOString(),p_scanned_at:proof.scanned_at,p_delivery:clean});
  if(error){if(error.code==='23505'||error.message.includes('QR_ALREADY_USED')){const {error:auditError}=await db.from('receiver_qr_conflicts').upsert({token_id:payload.n,attempted_delivery_id:delivery.id,driver_id:uid,attempted_delivery:clean,reason:'QR_ALREADY_USED'},{onConflict:'token_id,attempted_delivery_id',ignoreDuplicates:true});if(auditError)throw auditError;return response({error:'Este QR ya fue utilizado en otra carga. Revisión del administrador requerida.',code:'QR_ALREADY_USED'},409);}throw error;}
  return response({ok:true,result:data});
 }catch(e){return response({error:e instanceof Error?e.message:String((e as any)?.message||'No se pudo completar la operación')},400);}
});
