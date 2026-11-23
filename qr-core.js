(function(root){
 'use strict';
 const enc=new TextEncoder();
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 function base64(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
 function bytes(text){if(!/^[A-Za-z0-9_-]+$/.test(text))throw Error('QR inválido');return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0))}
 function parse(qr){if(typeof qr!=='string'||qr.length>2500)throw Error('QR inválido');const parts=qr.trim().split('.');if(parts.length!==3||parts[0]!=='GBBR1')throw Error('Este QR no es de un receptor de combustible');let payload;try{payload=JSON.parse(new TextDecoder().decode(bytes(parts[1])))}catch{throw Error('QR inválido')}if(payload.v!==1||!uuid(payload.n)||!uuid(payload.r)||!uuid(payload.d)||!Number.isSafeInteger(payload.t))throw Error('QR inválido');return {payload,body:parts[1],signature:bytes(parts[2])}}
 async function generate(record,receiverId,now=Date.now()){
  const body=base64(enc.encode(JSON.stringify({v:1,r:receiverId,d:record.id,n:crypto.randomUUID(),t:now})));
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},record.privateKey,enc.encode(body));
  return 'GBBR1.'+body+'.'+base64(signature);
 }
 async function verify(qr,devices,receivers,now=Date.now()){
  const {payload,body,signature}=parse(qr);
  if(payload.t>now+300000||now-payload.t>86400000)throw Error('El QR venció. Pide al receptor generar uno nuevo.');
  const receiver=receivers.find(x=>x.id===payload.r&&x.active&&x.role==='receiver');
  const device=devices.find(x=>x.id===payload.d&&x.receiver_id===payload.r&&x.active);
  if(!receiver||!device)throw Error('Receptor no disponible en este celular. Actualiza receptores con internet después de que active su QR.');
  const publicKey=await crypto.subtle.importKey('jwk',device.public_jwk,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
  if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,signature,enc.encode(body)))throw Error('QR alterado o firma inválida.');
  return {qr:qr.trim(),token_id:payload.n,receiver_id:payload.r,receiver_name:receiver.full_name,scanned_at:new Date(now).toISOString()};
 }
 const api={generate,verify,parse};root.GBBQRCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
