-- Run after 001_initial.sql. Buckets are PRIVATE; URLs must be signed.
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('cards','cards',false,2097152,array['image/png','image/webp']),
      ('avatars','avatars',false,1048576,array['image/png','image/webp','image/jpeg'])
on conflict(id) do nothing;
create policy fitcard_media_read on storage.objects for select to authenticated
using(bucket_id in ('cards','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy fitcard_media_insert on storage.objects for insert to authenticated
with check(bucket_id in ('cards','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy fitcard_media_delete on storage.objects for delete to authenticated
using(bucket_id in ('cards','avatars') and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
