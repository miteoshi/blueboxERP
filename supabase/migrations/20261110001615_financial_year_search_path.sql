-- Security advisor: pin the search_path of financial_year() like every
-- other function in the schema.
alter function public.financial_year(date) set search_path to 'public';
