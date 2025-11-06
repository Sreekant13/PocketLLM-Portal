import { FastifyInstance } from 'fastify'; import * as cache from '../services/cache';
export default async function (f: FastifyInstance) {
  f.get('/api/v1/cache/:key', (req)=> cache.get((req.params as any).key) ?? {miss:true});
  f.delete('/api/v1/cache/:key', (req)=> (cache.del((req.params as any).key), {ok:true}));
  f.post('/api/v1/cache/sweep', ()=> (cache.sweep(), {ok:true}));
}
