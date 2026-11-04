/* Persistent offline queue: IndexedDB primary, localStorage migration backup. */
window.GBBOffline=(()=>{
 const DB='gbb-fuel-offline', STORE='state', KEY='pending', LEGACY='gbb-fuel-pending-v1';
 let handle=null;
 function open(){if(handle)return handle;handle=new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return handle}
 async function read(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(KEY);r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
 async function write(items){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(items,KEY);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
 async function load(){const stored=await read();let legacy=[];try{legacy=JSON.parse(localStorage.getItem(LEGACY)||'[]')}catch{}const map=new Map();for(const item of [...stored,...legacy])if(item?.id)map.set(item.id,item);const merged=[...map.values()];if(merged.length!==stored.length)await write(merged);return merged}
 return {load,write};
})();