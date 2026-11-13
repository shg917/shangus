import {copyFile,mkdir} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
await mkdir(new URL('public/vendor/',root),{recursive:true});
await copyFile(new URL('node_modules/@supabase/supabase-js/dist/umd/supabase.js',root),new URL('public/vendor/supabase.js',root));
await copyFile(new URL('node_modules/@supabase/supabase-js/LICENSE',root),new URL('public/vendor/SUPABASE-LICENSE',root));
console.log('Vendored @supabase/supabase-js 2.119.0 (MIT).');
