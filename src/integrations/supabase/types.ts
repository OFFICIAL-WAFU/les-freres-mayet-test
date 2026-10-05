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
    PostgrestVersion: "14.5"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      enregistrer_brouillon: {
        Args: { p: Json; p_id: string; p_version: number }
        Returns: Json
      }
      finaliser_devis: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
      lire_devis: { Args: { p_id: string }; Returns: Json }
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
