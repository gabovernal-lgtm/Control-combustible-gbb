const assert=require('node:assert/strict');const fs=require('fs');const vm=require('vm');let sharp;try{sharp=require('sharp')}catch{sharp=require(require('path').join(require('path').dirname(process.execPath),'../node_modules/sharp'))}
const core=require('./qr-core.js'),qrcode=require('./qrcode.js'),jsQR=require('./jsqr.js');
(async()=>{
 const receiver={id:crypto.randomUUID(),role:'receiver',active:true,full_name:'Receptor prueba'};
 const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 const record={id:crypto.randomUUID(),privateKey:pair.privateKey};
 const device={id:record.id,receiver_id:receiver.id,active:true,public_jwk:await crypto.subtle.exportKey('jwk',pair.publicKey)};
 const first=await core.generate(record,receiver.id),second=await core.generate(record,receiver.id);
 assert.notEqual(core.parse(first).payload.n,core.parse(second).payload.n);
 assert.equal((await core.verify(first,[device],[receiver])).receiver_id,receiver.id);
 await assert.rejects(()=>core.verify(first,[device],[receiver],Date.now()+86401000),/venció/);
 await assert.rejects(()=>core.verify(first,[],[receiver]),/Actualiza/);
 await assert.rejects(()=>core.verify(first,[device],[{...receiver,active:false}]),/Actualiza/);
 const parts=first.split('.');const payload=core.parse(first).payload;payload.n=crypto.randomUUID();parts[1]=Buffer.from(JSON.stringify(payload)).toString('base64url');
 await assert.rejects(()=>core.verify(parts.join('.'),[device],[receiver]),/firma/);
 const qr=qrcode(0,'M');qr.addData(first);qr.make();const svg=qr.createSvgTag({cellSize:6,margin:4});
 const {data,info}=await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const decoded=jsQR(new Uint8ClampedArray(data),info.width,info.height);assert.equal(decoded.data,first);
 console.log('PASS: signed offline QR, fresh IDs, expiry, inactive/unknown receiver, tampering and actual image QR encode/decode');
})();
