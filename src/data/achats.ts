import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Achat, MoisMarge } from "@/lib/achats-marge";

export const margeQueryOptions = (ownerId: string) => queryOptions({
  queryKey: ["marge-mensuelle", ownerId],
  queryFn: async (): Promise<MoisMarge[]> => {
    const { data, error } = await supabase.from("marge_mensuelle").select("mois,ca_ht_centimes,achats_ht_centimes,marge_centimes").eq("owner_id", ownerId).order("mois");
    if (error) throw new Error("La marge n’a pas pu être chargée.");
    return (data ?? []).map(l => ({ mois: l.mois ?? "", ca: BigInt(l.ca_ht_centimes ?? 0), achats: BigInt(l.achats_ht_centimes ?? 0), marge: BigInt(l.marge_centimes ?? 0) }));
  },
});

export const achatsQueryOptions = (ownerId: string) => queryOptions({
  queryKey: ["achats-lignes", ownerId],
  queryFn: async (): Promise<Achat[]> => {
    const lignes: Achat[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("achats_lignes").select("id,date_achat,fournisseur,num_facture,chantier_texte,reference,designation,metier,quantite,unite,prix_unitaire_ht_centimes,total_ht_centimes").eq("owner_id", ownerId).order("date_achat", { ascending: false }).order("id").range(offset, offset + 999);
      if (error) throw new Error("Les achats n’ont pas pu être chargés.");
      lignes.push(...(data ?? []));
      if (!data || data.length < 1000) return lignes;
    }
  },
});