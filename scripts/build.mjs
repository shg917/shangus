import { cp,mkdir } from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist',root),{recursive:true});
await cp(new URL('public/',root),new URL('dist/',root),{recursive:true});
console.log('Static site built in dist/. Cloudflare Pages output directory: dist');
