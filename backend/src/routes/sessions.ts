import { FastifyInstance } from 'fastify'; import { nanoid } from 'nanoid'; import db from '../services/db';
export default async function (f: FastifyInstance) {
  f.get('/api/v1/sessions', ()=> db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all());
  f.post('/api/v1/sessions', (req)=> {
    const id = nanoid(); const name = (req.body as any)?.name ?? 'New Session';
    db.prepare('INSERT INTO sessions(id,name,created_at) VALUES(?,?,?)').run(id,name,Date.now());
    return { id, name };
  });
  f.get('/api/v1/sessions/:id/messages', (req)=> {
    const { id } = req.params as any;
    return db.prepare('SELECT * FROM messages WHERE session_id=? ORDER BY ts').all(id);
  });
  f.post('/api/v1/sessions/:id/messages', (req)=> {
    const { id } = req.params as any; const { role, content } = (req.body as any);
    db.prepare('INSERT INTO messages(id,session_id,role,content,ts) VALUES(?,?,?,?,?)')
      .run(nanoid(), id, role, content, Date.now());
    return { ok:true };
  });
}
