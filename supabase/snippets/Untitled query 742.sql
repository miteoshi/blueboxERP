select
    id,
    full_name,
    role,
    is_active,
    created_at,
    org_id
from public.profiles
order by created_at;