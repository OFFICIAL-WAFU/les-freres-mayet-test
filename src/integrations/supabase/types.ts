export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      articles: {
        Row: {
          archive: boolean
          created_at: string
          description: string
          designation: string
          id: string
          marque: string
          metier: string
          notes: string
          owner_id: string
          prix_ht_centimes: number
          reference: string
          reference_fabricant: string
          reference_normalisee: string | null
          type: string
          unite: string
          updated_at: string
        }
        Insert: {
          archive?: boolean
          created_at?: string
          description?: string
          designation: string
          id?: string
          marque?: string
          metier: string
          notes?: string
          owner_id?: string
          prix_ht_centimes: number
          reference: string
          reference_fabricant?: string
          reference_normalisee?: string | null
          type: string
          unite: string
          updated_at?: string
        }
        Update: {
          archive?: boolean
          created_at?: string
          description?: string
          designation?: string
          id?: string
          marque?: string
          metier?: string
          notes?: string
          owner_id?: string
          prix_ht_centimes?: number
          reference?: string
          reference_fabricant?: string
          reference_normalisee?: string | null
          type?: string
          unite?: string
          updated_at?: string
        }
        Relationships: []
      }
      avoirs: {
        Row: {
          client_copie: Json
          client_id: string
          created_at: string
          date_avoir: string
          entreprise_copie: Json | null
          facture_source_id: string
          facture_source_reference: string
          finalise_le: string | null
          finalise_par: string | null
          id: string
          lignes: Json
          motif: string
          objet: string
          owner_id: string
          reference: string
          reference_definitive: string | null
          remarques: string
          statut: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          updated_at: string
          ventilation_tva: Json
          version: number
        }
        Insert: {
          client_copie: Json
          client_id: string
          created_at?: string
          date_avoir: string
          entreprise_copie?: Json | null
          facture_source_id: string
          facture_source_reference: string
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          lignes: Json
          motif: string
          objet: string
          owner_id: string
          reference: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          updated_at?: string
          ventilation_tva: Json
          version?: number
        }
        Update: {
          client_copie?: Json
          client_id?: string
          created_at?: string
          date_avoir?: string
          entreprise_copie?: Json | null
          facture_source_id?: string
          facture_source_reference?: string
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          lignes?: Json
          motif?: string
          objet?: string
          owner_id?: string
          reference?: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "avoirs_facture_source_id_fkey"
            columns: ["facture_source_id"]
            isOneToOne: true
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          adresse: string
          code_postal: string
          complement: string
          created_at: string
          email: string
          id: string
          nom: string
          nom_contact: string
          notes: string
          owner_id: string
          pays: string
          prenom: string
          raison_sociale: string
          siret: string
          telephone: string
          tva: string
          type: string
          updated_at: string
          ville: string
        }
        Insert: {
          adresse?: string
          code_postal?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          nom?: string
          nom_contact?: string
          notes?: string
          owner_id?: string
          pays?: string
          prenom?: string
          raison_sociale?: string
          siret?: string
          telephone?: string
          tva?: string
          type: string
          updated_at?: string
          ville?: string
        }
        Update: {
          adresse?: string
          code_postal?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          nom?: string
          nom_contact?: string
          notes?: string
          owner_id?: string
          pays?: string
          prenom?: string
          raison_sociale?: string
          siret?: string
          telephone?: string
          tva?: string
          type?: string
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      compteurs_devis: {
        Row: {
          dernier: number
          owner_id: string
        }
        Insert: {
          dernier?: number
          owner_id?: string
        }
        Update: {
          dernier?: number
          owner_id?: string
        }
        Relationships: []
      }
      compteurs_factures_brouillon: {
        Row: {
          dernier: number
          dernier_acompte: number
          dernier_avoir: number
          owner_id: string
        }
        Insert: {
          dernier?: number
          dernier_acompte?: number
          dernier_avoir?: number
          owner_id?: string
        }
        Update: {
          dernier?: number
          dernier_acompte?: number
          dernier_avoir?: number
          owner_id?: string
        }
        Relationships: []
      }
      compteurs_references: {
        Row: {
          annee: number
          dernier: number
          owner_id: string
          type_document: string
        }
        Insert: {
          annee: number
          dernier?: number
          owner_id?: string
          type_document: string
        }
        Update: {
          annee?: number
          dernier?: number
          owner_id?: string
          type_document?: string
        }
        Relationships: []
      }
      devis: {
        Row: {
          client_copie: Json
          client_id: string
          created_at: string
          date_devis: string
          date_validite: string | null
          entreprise_copie: Json | null
          finalise_le: string | null
          finalise_par: string | null
          id: string
          notes: string
          objet: string
          owner_id: string
          reference: string
          reference_definitive: string | null
          remarques: string
          statut: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          updated_at: string
          ventilation_tva: Json
          version: number
        }
        Insert: {
          client_copie: Json
          client_id: string
          created_at?: string
          date_devis: string
          date_validite?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id: string
          notes?: string
          objet: string
          owner_id?: string
          reference: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Update: {
          client_copie?: Json
          client_id?: string
          created_at?: string
          date_devis?: string
          date_validite?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          notes?: string
          objet?: string
          owner_id?: string
          reference?: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "devis_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lignes: {
        Row: {
          article_id: string | null
          description: string
          designation: string
          devis_id: string
          ht_centimes: number
          id: string
          owner_id: string
          position: number
          prix_ht_centimes: number
          quantite_milliemes: number
          reference: string
          taux_tva_milliemes: number
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Insert: {
          article_id?: string | null
          description?: string
          designation: string
          devis_id: string
          ht_centimes: number
          id: string
          owner_id?: string
          position: number
          prix_ht_centimes: number
          quantite_milliemes: number
          reference?: string
          taux_tva_milliemes: number
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Update: {
          article_id?: string | null
          description?: string
          designation?: string
          devis_id?: string
          ht_centimes?: number
          id?: string
          owner_id?: string
          position?: number
          prix_ht_centimes?: number
          quantite_milliemes?: number
          reference?: string
          taux_tva_milliemes?: number
          ttc_centimes?: number
          tva_centimes?: number
          type?: string
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "devis_lignes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "devis_lignes_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      entreprises: {
        Row: {
          activite: string
          adresse: string
          capital: number | null
          code_postal: string
          complement: string
          created_at: string
          email: string
          forme_juridique: string
          id: string
          immatriculation: string
          nom_commercial: string
          owner_id: string
          pays: string
          raison_sociale: string
          siret: string
          site: string
          telephone: string
          tva: string
          updated_at: string
          ville: string
        }
        Insert: {
          activite?: string
          adresse?: string
          capital?: number | null
          code_postal?: string
          complement?: string
          created_at?: string
          email?: string
          forme_juridique?: string
          id?: string
          immatriculation?: string
          nom_commercial?: string
          owner_id?: string
          pays?: string
          raison_sociale: string
          siret?: string
          site?: string
          telephone?: string
          tva?: string
          updated_at?: string
          ville?: string
        }
        Update: {
          activite?: string
          adresse?: string
          capital?: number | null
          code_postal?: string
          complement?: string
          created_at?: string
          email?: string
          forme_juridique?: string
          id?: string
          immatriculation?: string
          nom_commercial?: string
          owner_id?: string
          pays?: string
          raison_sociale?: string
          siret?: string
          site?: string
          telephone?: string
          tva?: string
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      factures: {
        Row: {
          acompte_deduit_id: string | null
          client_copie: Json
          client_id: string
          created_at: string
          date_echeance: string | null
          date_facture: string
          deduction: Json | null
          devis_source_id: string
          devis_source_reference: string
          entreprise_copie: Json | null
          finalise_le: string | null
          finalise_par: string | null
          id: string
          nature: string
          notes: string
          objet: string
          owner_id: string
          pourcentage: number | null
          reference: string
          reference_definitive: string | null
          remarques: string
          statut: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          updated_at: string
          ventilation_tva: Json
          version: number
        }
        Insert: {
          acompte_deduit_id?: string | null
          client_copie: Json
          client_id: string
          created_at?: string
          date_echeance?: string | null
          date_facture: string
          deduction?: Json | null
          devis_source_id: string
          devis_source_reference: string
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          nature?: string
          notes?: string
          objet: string
          owner_id?: string
          pourcentage?: number | null
          reference: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Update: {
          acompte_deduit_id?: string | null
          client_copie?: Json
          client_id?: string
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          deduction?: Json | null
          devis_source_id?: string
          devis_source_reference?: string
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          nature?: string
          notes?: string
          objet?: string
          owner_id?: string
          pourcentage?: number | null
          reference?: string
          reference_definitive?: string | null
          remarques?: string
          statut?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "factures_acompte_deduit_id_fkey"
            columns: ["acompte_deduit_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_devis_source_id_fkey"
            columns: ["devis_source_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      factures_lignes: {
        Row: {
          article_id: string | null
          description: string
          designation: string
          facture_id: string
          ht_centimes: number
          id: string
          owner_id: string
          position: number
          prix_ht_centimes: number
          quantite_milliemes: number
          reference: string
          taux_tva_milliemes: number
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Insert: {
          article_id?: string | null
          description?: string
          designation: string
          facture_id: string
          ht_centimes: number
          id: string
          owner_id?: string
          position: number
          prix_ht_centimes: number
          quantite_milliemes: number
          reference?: string
          taux_tva_milliemes: number
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Update: {
          article_id?: string | null
          description?: string
          designation?: string
          facture_id?: string
          ht_centimes?: number
          id?: string
          owner_id?: string
          position?: number
          prix_ht_centimes?: number
          quantite_milliemes?: number
          reference?: string
          taux_tva_milliemes?: number
          ttc_centimes?: number
          tva_centimes?: number
          type?: string
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "factures_lignes_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "factures_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
      reglements: {
        Row: {
          annule_le: string | null
          annule_par: string | null
          commentaire: string
          created_at: string
          cree_par: string
          date_reglement: string
          facture_id: string
          id: string
          mode: string
          montant_centimes: number
          motif_annulation: string | null
          owner_id: string
        }
        Insert: {
          annule_le?: string | null
          annule_par?: string | null
          commentaire?: string
          created_at?: string
          cree_par: string
          date_reglement: string
          facture_id: string
          id: string
          mode: string
          montant_centimes: number
          motif_annulation?: string | null
          owner_id: string
        }
        Update: {
          annule_le?: string | null
          annule_par?: string | null
          commentaire?: string
          created_at?: string
          cree_par?: string
          date_reglement?: string
          facture_id?: string
          id?: string
          mode?: string
          montant_centimes?: number
          motif_annulation?: string | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reglements_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acompte_calcul: {
        Args: { p_devis_id: string; p_pourcentage: number }
        Returns: Json
      }
      acompte_ecrire_lignes: {
        Args: {
          p_calcul: Json
          p_devis_ref: string
          p_facture_id: string
          p_pourcentage: number
        }
        Returns: undefined
      }
      annuler_reglement: {
        Args: { p_id: string; p_motif: string }
        Returns: Json
      }
      deduction_live: {
        Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
        Returns: Json
      }
      enregistrer_acompte: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: Json
      }
      enregistrer_avoir: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: Json
      }
      enregistrer_brouillon: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: Json
      }
      enregistrer_facture: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: Json
      }
      enregistrer_reglement: {
        Args: {
          p_commentaire: string
          p_date: string
          p_facture_id: string
          p_id: string
          p_mode: string
          p_montant: number
        }
        Returns: Json
      }
      facture_a_regler: {
        Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
        Returns: number
      }
      facture_credite: { Args: { p_facture_id: string }; Returns: number }
      facture_recalculer: { Args: { p_id: string }; Returns: undefined }
      finaliser_avoir: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      finaliser_devis: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      finaliser_facture: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      lire_devis: { Args: { p_id: string }; Returns: Json }
      lire_facture: { Args: { p_id: string }; Returns: Json }
      preparer_acompte: {
        Args: { p_devis_id: string; p_pourcentage: number }
        Returns: Json
      }
      preparer_avoir: {
        Args: { p_facture_id: string; p_motif: string }
        Returns: Json
      }
      preparer_facture: { Args: { p_devis_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
