import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { EcranChargement } from "@/components/AuthCadre";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/connexion", search: { redirect: location.href }, replace: true });
    }
    return { user: data.user };
  },
  pendingComponent: EcranChargement,
  pendingMs: 0,
  component: () => <Outlet />,
});
