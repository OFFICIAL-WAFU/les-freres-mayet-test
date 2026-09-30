REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.articles FROM authenticated;
REVOKE ALL ON public.articles FROM anon;