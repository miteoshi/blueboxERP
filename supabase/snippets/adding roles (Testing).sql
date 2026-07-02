update public.profiles
set full_name = 'Admin User',
    role = 'admin'
where id = '5dfaea0e-eb17-4e92-a7f1-faaab30e5abf';


update public.profiles
set full_name = 'Sales User', role = 'sales' where id = '401ecf29-855e-4d0d-bdc8-ab76baae82fa';

update public.profiles
set full_name = 'Store User',
    role = 'store'
where id = '2d358a5b-43ca-4cb0-bcc6-32053f8e4a37';

update public.profiles
set full_name = 'Suresh',
    role = 'production'
where id = '3e97c10c-c28e-436b-8408-9af02411c10a';

update public.profiles
set full_name = 'Viewer User',
    role = 'viewer'
where id = '4da53222-de19-471a-a8b5-3c59e1e31868';


select * from public.profiles