REVOKE ALL ON public.clients FROM anon;
REVOKE DELETE, TRUNCATE ON public.clients FROM authenticated;