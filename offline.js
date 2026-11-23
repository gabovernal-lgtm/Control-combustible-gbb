/* Persistent offline queue: IndexedDB primary, localStorage migration backup. */
window.GBBOffline=(()=>{
 const DB='gbb-fuel-offline', STORE='state', KEY='pending', LEGACY='gbb-fuel-pending-v1';
 let handle=null;
 function open(){if(handle)return handle;handle=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return handle}
 async function read(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 async function write(items){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite'),store=tx.objectStore(STORE);let failure=null;const r=store.get('qr-used');r.onsuccess=()=>{const used=r.result||{};for(const item of items){const token=item._receiptProof?.token_id;if(token&&used[token]&&used[token]!==item.id){failure=Error('Este QR ya se utilizó en otra carga en este celular.');tx.abort();return}if(token)used[token]=item.id}store.put(used,'qr-used');store.put(items,KEY)};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(failure||tx.error);tx.onabort=()=>reject(failure||tx.error)})}
 async function getState(key){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
 async function setState(key,value){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
 async function load(){const stored=await read();let legacy=[];try{legacy=JSON.parse(localStorage.getItem(LEGACY)||'[]')}catch{}const map=new Map();for(const item of [...stored,...legacy])if(item?.id)map.set(item.id,item);const merged=[...map.values()];if(merged.length!==stored.length)await write(merged);return merged}
 return {load,write,getState,setState};
})();
