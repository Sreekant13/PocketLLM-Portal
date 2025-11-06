import db from './db';
export const get = (key:string)=> db.prepare('SELECT value, created_at, ttl_ms FROM cache_entries WHERE key=?').get(key);
export const put = (key:string, value:string, ttlMs:number=5*60_000)=>{
  db.prepare('INSERT OR REPLACE INTO cache_entries(key,value,created_at,ttl_ms) VALUES(?,?,?,?)')
    .run(key, value, Date.now(), ttlMs);
};
export const del = (key:string)=> db.prepare('DELETE FROM cache_entries WHERE key=?').run(key);
export const sweep = ()=>{
  db.prepare('DELETE FROM cache_entries WHERE (? - created_at) > ttl_ms').run(Date.now());
};
