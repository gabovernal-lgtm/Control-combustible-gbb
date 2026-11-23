import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
const headers={'Access-Control-Allow-Origin':'https://gabovernal-lgtm.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json'};
const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
const uuid=(v:unknown)=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
function decode(text:string){if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error('QR_INVALID');return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({error:'Método no permitido'},405);
 try{
  const raw=await req.text();if(raw.length>32768)return response({error:'Solicitud demasiado extensa'},413);
  const body=JSON.parse(raw);
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='request_account'){
   if(raw.length>4096)return response({error:'Solicitud demasiado extensa'},413);
   if(typeof body.name!=='string'||body.name.trim().length<2||body.name.length>120||typeof body.email!=='string'||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email.trim())||typeof body.password!=='string'||body.password.length<6||body.password.length>128||!['receiver','driver'].includes(body.role))return response({error:'Completa nombre, correo, contraseña de 6 a 128 caracteres y perfil receptor o surtidor.'},400);
   const email=body.email.trim().toLowerCase();
   const hash=async(value:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const {data:allowed,error:limitError}=await db.rpc('allow_fuel_account_request',{p_email_key:await hash(email),p_client_key:await hash(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown')});
   if(limitError)throw limitError;if(allowed!==true)return response({error:'Hay demasiados intentos de registro. Espera antes de volver a solicitar acceso.'},429);
   const {data,error}=await db.auth.admin.createUser({email,password:body.password,email_confirm:true});
   if(error)return response({error:'No se pudo crear la solicitud. Si ya tienes cuenta o una solicitud pendiente, ingresa con tu correo o comunícate con el administrador.'},400);
   const {error:requestError}=await db.rpc('submit_fuel_account_request',{p_user_id:data.user.id,p_name:body.name.trim(),p_email:email,p_role:body.role});
   if(requestError){await db.auth.admin.deleteUser(data.user.id);throw requestError;}
   return response({ok:true,status:'pending',message:'Solicitud enviada. Tu cuenta está pendiente de aprobación del administrador. No puedes ingresar hasta que la apruebe.'});
  }

  const auth=req.headers.get('authorization')||'';
  if(!auth.startsWith('Bearer '))return response({error:'Inicia sesión con conexión para sincronizar.'},401);
  const {data:identity,error:authError}=await db.auth.getUser(auth.slice(7));
  if(authError||!identity.user)return response({error:'Tu sesión venció. Inicia sesión con conexión; tus cargas siguen guardadas.'},401);
  const uid=identity.user.id;
  const {data:profile}=await db.from('profiles').select('*').eq('id',uid).single();
  if(!profile?.active)return response({error:'Usuario inactivo'},403);
  if(body.action==='account_requests'||body.action==='review_account_request'){
   if(profile.role!=='admin')return response({error:'Solo administrador'},403);
   if(body.action==='account_requests'){
    const {data,error}=await db.from('fuel_account_requests').select('id,user_id,full_name,email,requested_role,status,created_at,review_note').neq('status','approved').order('status').order('created_at').limit(500);if(error)throw error;return response({requests:data});
   }
   if(!uuid(body.id)||typeof body.approve!=='boolean'||!['receiver','driver'].includes(body.role)||typeof body.note!=='string'||body.note.length>500)throw Error('Revisión inválida');
   const {data,error}=await db.rpc('review_fuel_account_request',{p_admin_id:uid,p_request_id:body.id,p_approve:body.approve,p_role:body.role,p_note:body.note});if(error)throw error;return response(data);
  }

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
    const {data,error}=await db.from('profiles').select('id,full_name,role,active').eq('access_status','approved').order('full_name');if(error)throw error;return response({users:data});
   }
   if(!['admin','driver','receiver'].includes(body.role)||typeof body.name!=='string'||body.name.trim().length<2||body.name.length>120)throw Error('Nombre y perfil inválidos');
   if(body.action==='create_user'){
    if(typeof body.email!=='string'||!/^\S+@\S+\.\S+$/.test(body.email)||typeof body.password!=='string'||body.password.length<6||body.password.length>128)throw Error('Ingresa correo válido y contraseña de 6 a 128 caracteres');
    const {data,error}=await db.auth.admin.createUser({email:body.email.trim().toLowerCase(),password:body.password,email_confirm:true});if(error)throw error;
    const {error:profileError}=await db.from('profiles').insert({id:data.user.id,full_name:body.name.trim(),role:body.role,active:true});
    if(profileError){await db.auth.admin.deleteUser(data.user.id);throw profileError;}
    return response({ok:true});
   }
   if(!uuid(body.id)||typeof body.active!=='boolean')throw Error('Usuario inválido');
   const {data:targetProfile}=await db.from('profiles').select('access_status').eq('id',body.id).single();if(targetProfile?.access_status&&targetProfile.access_status!=='approved')throw Error('Aprueba o rechaza esta cuenta en Solicitudes de acceso.');
   if(body.id===uid&&(body.role!=='admin'||!body.active))throw Error('No puedes quitarte tu propio acceso de administrador');
   const {error}=await db.from('profiles').update({full_name:body.name.trim(),role:body.role,active:body.active}).eq('id',body.id);if(error)throw error;return response({ok:true});
  }
  if(body.action==='record'){
   if(!['admin','driver'].includes(profile.role))return response({error:'Solo conductor o administrador'},403);
   const x=body.delivery;
   if(!x||!uuid(x.id)||!uuid(x.truck_id)||(x.equipment_id&&!uuid(x.equipment_id))||(!x.equipment_id&&!(typeof x.other_equipment==='string'&&x.other_equipment.trim()))||!Number.isFinite(Number(x.liters))||Number(x.liters)<=0||Number(x.liters)>30000||!['TA','TB'].includes(x.shift)||!Number.isFinite(Date.parse(x.delivered_at))||Date.parse(x.delivered_at)>Date.now()+300000)throw Error('Datos de carga inválidos. Comunícate con el administrador si necesitas corregir una carga guardada.');
   const row={id:x.id,driver_id:uid,truck_id:x.truck_id,equipment_id:x.equipment_id||null,other_equipment:x.other_equipment||null,liters:Number(x.liters),shift:x.shift,delivered_at:x.delivered_at,notes:String(x.notes||'').slice(0,2000),receiver_id:null,receipt_status:'not_requested'};
   const {data:existing,error:lookupError}=await db.from('fuel_deliveries').select('*').eq('id',row.id).maybeSingle();if(lookupError)throw lookupError;
   if(existing){const same=existing.driver_id===uid&&existing.qr_token_id==null&&existing.receiver_id==null&&existing.truck_id===row.truck_id&&existing.equipment_id===row.equipment_id&&existing.other_equipment===row.other_equipment&&Number(existing.liters)===row.liters&&existing.shift===row.shift&&Date.parse(existing.delivered_at)===Date.parse(row.delivered_at)&&existing.notes===row.notes;if(!same)throw Error('La carga ya existe con datos distintos. Comunícate con el administrador.');return response({ok:true,idempotent:true});}
   const {error}=await db.from('fuel_deliveries').insert(row);if(error)throw error;return response({ok:true});
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
