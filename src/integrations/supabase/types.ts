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
      achats_lignes: {
        Row: {
          chantier_texte: string
          client_id: string | null
          created_at: string
          date_achat: string
          designation: string
          facture_id: string | null
          fournisseur: string
          id: string
          lot_import: string | null
          metier: string
          num_facture: string
          owner_id: string
          prix_unitaire_ht_centimes: number
          quantite: number
          reference: string
          statut_affectation: string
          total_ht_centimes: number
          unite: string
        }
        Insert: {
          chantier_texte?: string
          client_id?: string | null
          created_at?: string
          date_achat: string
          designation?: string
          facture_id?: string | null
          fournisseur?: string
          id?: string
          lot_import?: string | null
          metier?: string
          num_facture?: string
          owner_id?: string
          prix_unitaire_ht_centimes?: number
          quantite?: number
          reference?: string
          statut_affectation?: string
          total_ht_centimes?: number
          unite?: string
        }
        Update: {
          chantier_texte?: string
          client_id?: string | null
          created_at?: string
          date_achat?: string
          designation?: string
          facture_id?: string | null
          fournisseur?: string
          id?: string
          lot_import?: string | null
          metier?: string
          num_facture?: string
          owner_id?: string
          prix_unitaire_ht_centimes?: number
          quantite?: number
          reference?: string
          statut_affectation?: string
          total_ht_centimes?: number
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "achats_lignes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_lignes_facture_id_fkey"
            columns: ["facture_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achats_lignes_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          archive: boolean
          code_source: string
          created_at: string
          description: string
          designation: string
          famille: string
          fournisseur: string
          id: string
          lot_import: string | null
          marque: string
          metier: string
          notes: string
          owner_id: string
          prix_achat_centimes: number | null
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
          code_source?: string
          created_at?: string
          description?: string
          designation: string
          famille?: string
          fournisseur?: string
          id?: string
          lot_import?: string | null
          marque?: string
          metier: string
          notes?: string
          owner_id?: string
          prix_achat_centimes?: number | null
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
          code_source?: string
          created_at?: string
          description?: string
          designation?: string
          famille?: string
          fournisseur?: string
          id?: string
          lot_import?: string | null
          marque?: string
          metier?: string
          notes?: string
          owner_id?: string
          prix_achat_centimes?: number | null
          prix_ht_centimes?: number
          reference?: string
          reference_fabricant?: string
          reference_normalisee?: string | null
          type?: string
          unite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "articles_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
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
          lot_import: string | null
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
          type_avoir: string
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
          lot_import?: string | null
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
          type_avoir?: string
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
          lot_import?: string | null
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
          type_avoir?: string
          updated_at?: string
          ventilation_tva?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "avoirs_facture_source_id_fkey"
            columns: ["facture_source_id"]
            isOneToOne: false
            referencedRelation: "factures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avoirs_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      bibliotheques_compte: {
        Row: {
          donnees: Json
          maj_le: string
          nom: string
          owner_id: string
          version: number
        }
        Insert: {
          donnees: Json
          maj_le?: string
          nom: string
          owner_id: string
          version: number
        }
        Update: {
          donnees?: Json
          maj_le?: string
          nom?: string
          owner_id?: string
          version?: number
        }
        Relationships: []
      }
      clients: {
        Row: {
          adresse: string
          code_postal: string
          code_source: string
          complement: string
          created_at: string
          email: string
          id: string
          lot_import: string | null
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
          code_source?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          lot_import?: string | null
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
          code_source?: string
          complement?: string
          created_at?: string
          email?: string
          id?: string
          lot_import?: string | null
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
        Relationships: [
          {
            foreignKeyName: "clients_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
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
      connaissances_metier: {
        Row: {
          categorie: string
          contenu: string
          created_at: string
          donnees: Json
          id: string
          lot_import: string | null
          metier: string
          owner_id: string
          source: string
          statut: string
          titre: string
          updated_at: string
        }
        Insert: {
          categorie: string
          contenu: string
          created_at?: string
          donnees?: Json
          id?: string
          lot_import?: string | null
          metier?: string
          owner_id: string
          source?: string
          statut?: string
          titre: string
          updated_at?: string
        }
        Update: {
          categorie?: string
          contenu?: string
          created_at?: string
          donnees?: Json
          id?: string
          lot_import?: string | null
          metier?: string
          owner_id?: string
          source?: string
          statut?: string
          titre?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connaissances_metier_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      devis: {
        Row: {
          client_copie: Json
          client_id: string
          commande_passee_le: string | null
          conditions_paiement: string
          created_at: string
          date_devis: string
          date_validite: string | null
          entreprise_copie: Json | null
          finalise_le: string | null
          finalise_par: string | null
          id: string
          lot_import: string | null
          notes: string
          objet: string
          owner_id: string
          reference: string
          reference_definitive: string | null
          remarques: string
          reponse_client: string
          reponse_le: string | null
          reponse_mode: string | null
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
          commande_passee_le?: string | null
          conditions_paiement?: string
          created_at?: string
          date_devis: string
          date_validite?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id: string
          lot_import?: string | null
          notes?: string
          objet: string
          owner_id?: string
          reference: string
          reference_definitive?: string | null
          remarques?: string
          reponse_client?: string
          reponse_le?: string | null
          reponse_mode?: string | null
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
          commande_passee_le?: string | null
          conditions_paiement?: string
          created_at?: string
          date_devis?: string
          date_validite?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          lot_import?: string | null
          notes?: string
          objet?: string
          owner_id?: string
          reference?: string
          reference_definitive?: string | null
          remarques?: string
          reponse_client?: string
          reponse_le?: string | null
          reponse_mode?: string | null
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
          {
            foreignKeyName: "devis_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      devis_lignes: {
        Row: {
          article_id: string | null
          coef_materiel_milliemes: number | null
          cout_horaire_centimes: number | null
          description: string
          designation: string
          devis_id: string
          ht_centimes: number
          id: string
          owner_id: string
          position: number
          prix_achat_centimes: number | null
          prix_calcule: boolean
          prix_ht_centimes: number
          quantite_milliemes: number
          reference: string
          taux_horaire_centimes: number | null
          taux_tva_milliemes: number
          temps_pose_minutes: number | null
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Insert: {
          article_id?: string | null
          coef_materiel_milliemes?: number | null
          cout_horaire_centimes?: number | null
          description?: string
          designation: string
          devis_id: string
          ht_centimes: number
          id: string
          owner_id?: string
          position: number
          prix_achat_centimes?: number | null
          prix_calcule?: boolean
          prix_ht_centimes: number
          quantite_milliemes: number
          reference?: string
          taux_horaire_centimes?: number | null
          taux_tva_milliemes: number
          temps_pose_minutes?: number | null
          ttc_centimes: number
          tva_centimes: number
          type: string
          unite: string
        }
        Update: {
          article_id?: string | null
          coef_materiel_milliemes?: number | null
          cout_horaire_centimes?: number | null
          description?: string
          designation?: string
          devis_id?: string
          ht_centimes?: number
          id?: string
          owner_id?: string
          position?: number
          prix_achat_centimes?: number | null
          prix_calcule?: boolean
          prix_ht_centimes?: number
          quantite_milliemes?: number
          reference?: string
          taux_horaire_centimes?: number | null
          taux_tva_milliemes?: number
          temps_pose_minutes?: number | null
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
      documents_importes: {
        Row: {
          client_copie: Json
          client_id: string | null
          client_nom: string
          cree_le: string
          date_document: string
          date_echeance: string | null
          deja_regle_centimes: number | null
          id: string
          lignes: Json
          lot_import: string
          objet: string
          owner_id: string
          reference: string
          reference_liee: string
          source: Json
          statut_source: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          type: string
          ventilation_tva: Json
        }
        Insert: {
          client_copie?: Json
          client_id?: string | null
          client_nom?: string
          cree_le?: string
          date_document: string
          date_echeance?: string | null
          deja_regle_centimes?: number | null
          id?: string
          lignes?: Json
          lot_import: string
          objet?: string
          owner_id: string
          reference: string
          reference_liee?: string
          source?: Json
          statut_source?: string
          total_ht_centimes: number
          total_ttc_centimes: number
          total_tva_centimes: number
          type: string
          ventilation_tva?: Json
        }
        Update: {
          client_copie?: Json
          client_id?: string | null
          client_nom?: string
          cree_le?: string
          date_document?: string
          date_echeance?: string | null
          deja_regle_centimes?: number | null
          id?: string
          lignes?: Json
          lot_import?: string
          objet?: string
          owner_id?: string
          reference?: string
          reference_liee?: string
          source?: Json
          statut_source?: string
          total_ht_centimes?: number
          total_ttc_centimes?: number
          total_tva_centimes?: number
          type?: string
          ventilation_tva?: Json
        }
        Relationships: [
          {
            foreignKeyName: "documents_importes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_importes_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      entreprises: {
        Row: {
          activite: string
          adresse: string
          assureur: string
          bandeau: string
          bic: string
          capital: number | null
          cgv: string
          code_naf: string
          code_postal: string
          complement: string
          contrat_assurance: string
          created_at: string
          email: string
          forme_juridique: string
          iban: string
          id: string
          immatriculation: string
          logo: string
          nom_commercial: string
          owner_id: string
          pays: string
          raison_sociale: string
          regime_tva: string
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
          assureur?: string
          bandeau?: string
          bic?: string
          capital?: number | null
          cgv?: string
          code_naf?: string
          code_postal?: string
          complement?: string
          contrat_assurance?: string
          created_at?: string
          email?: string
          forme_juridique?: string
          iban?: string
          id?: string
          immatriculation?: string
          logo?: string
          nom_commercial?: string
          owner_id?: string
          pays?: string
          raison_sociale: string
          regime_tva?: string
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
          assureur?: string
          bandeau?: string
          bic?: string
          capital?: number | null
          cgv?: string
          code_naf?: string
          code_postal?: string
          complement?: string
          contrat_assurance?: string
          created_at?: string
          email?: string
          forme_juridique?: string
          iban?: string
          id?: string
          immatriculation?: string
          logo?: string
          nom_commercial?: string
          owner_id?: string
          pays?: string
          raison_sociale?: string
          regime_tva?: string
          siret?: string
          site?: string
          telephone?: string
          tva?: string
          updated_at?: string
          ville?: string
        }
        Relationships: []
      }
      envois_devis: {
        Row: {
          avec_lien: boolean
          avec_pdf: boolean
          canal: string
          destinataire: string
          devis_id: string
          id: string
          le: string
          nature: string
          owner_id: string
          sujet: string
        }
        Insert: {
          avec_lien?: boolean
          avec_pdf?: boolean
          canal: string
          destinataire?: string
          devis_id: string
          id: string
          le?: string
          nature: string
          owner_id?: string
          sujet?: string
        }
        Update: {
          avec_lien?: boolean
          avec_pdf?: boolean
          canal?: string
          destinataire?: string
          devis_id?: string
          id?: string
          le?: string
          nature?: string
          owner_id?: string
          sujet?: string
        }
        Relationships: [
          {
            foreignKeyName: "envois_devis_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      factures: {
        Row: {
          acompte_deduit_id: string | null
          client_copie: Json
          client_id: string
          conditions_paiement: string
          created_at: string
          date_echeance: string | null
          date_facture: string
          deduction: Json | null
          devis_source_id: string | null
          devis_source_reference: string | null
          entreprise_copie: Json | null
          finalise_le: string | null
          finalise_par: string | null
          id: string
          lot_import: string | null
          nature: string
          notes: string
          objet: string
          owner_id: string
          pourcentage: number | null
          prestation_debut: string | null
          prestation_fin: string | null
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
          conditions_paiement?: string
          created_at?: string
          date_echeance?: string | null
          date_facture: string
          deduction?: Json | null
          devis_source_id?: string | null
          devis_source_reference?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          lot_import?: string | null
          nature?: string
          notes?: string
          objet: string
          owner_id?: string
          pourcentage?: number | null
          prestation_debut?: string | null
          prestation_fin?: string | null
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
          conditions_paiement?: string
          created_at?: string
          date_echeance?: string | null
          date_facture?: string
          deduction?: Json | null
          devis_source_id?: string | null
          devis_source_reference?: string | null
          entreprise_copie?: Json | null
          finalise_le?: string | null
          finalise_par?: string | null
          id?: string
          lot_import?: string | null
          nature?: string
          notes?: string
          objet?: string
          owner_id?: string
          pourcentage?: number | null
          prestation_debut?: string | null
          prestation_fin?: string | null
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
          {
            foreignKeyName: "factures_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
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
      habitudes_documents: {
        Row: {
          coef_materiel_milliemes: number
          cout_horaire_centimes: number
          echeance_facture_jours: number
          owner_id: string
          remarques_devis: string
          remarques_facture: string
          taux_horaire_centimes: number
          updated_at: string
          validite_devis_jours: number
        }
        Insert: {
          coef_materiel_milliemes?: number
          cout_horaire_centimes?: number
          echeance_facture_jours?: number
          owner_id?: string
          remarques_devis?: string
          remarques_facture?: string
          taux_horaire_centimes?: number
          updated_at?: string
          validite_devis_jours?: number
        }
        Update: {
          coef_materiel_milliemes?: number
          cout_horaire_centimes?: number
          echeance_facture_jours?: number
          owner_id?: string
          remarques_devis?: string
          remarques_facture?: string
          taux_horaire_centimes?: number
          updated_at?: string
          validite_devis_jours?: number
        }
        Relationships: []
      }
      historiques_khosmos: {
        Row: {
          contenu: Json
          created_at: string
          owner_id: string
        }
        Insert: {
          contenu: Json
          created_at?: string
          owner_id: string
        }
        Update: {
          contenu?: Json
          created_at?: string
          owner_id?: string
        }
        Relationships: []
      }
      lots_import: {
        Row: {
          cree_le: string
          description: string
          id: string
          nature: string
          owner_id: string
          source: string
        }
        Insert: {
          cree_le?: string
          description?: string
          id?: string
          nature: string
          owner_id: string
          source?: string
        }
        Update: {
          cree_le?: string
          description?: string
          id?: string
          nature?: string
          owner_id?: string
          source?: string
        }
        Relationships: []
      }
      messages_modeles: {
        Row: {
          modeles: Json
          owner_id: string
          updated_at: string
          version: number
        }
        Insert: {
          modeles: Json
          owner_id?: string
          updated_at?: string
          version?: number
        }
        Update: {
          modeles?: Json
          owner_id?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      modeles_devis: {
        Row: {
          archive: boolean
          conditions_paiement: string
          created_at: string
          id: string
          lignes: Json
          lot_import: string | null
          metier: string
          nom: string
          notes_usage: string
          objet: string
          owner_id: string
          remarques: string
          type_travaux: string
          updated_at: string
        }
        Insert: {
          archive?: boolean
          conditions_paiement?: string
          created_at?: string
          id?: string
          lignes?: Json
          lot_import?: string | null
          metier?: string
          nom: string
          notes_usage?: string
          objet?: string
          owner_id: string
          remarques?: string
          type_travaux?: string
          updated_at?: string
        }
        Update: {
          archive?: boolean
          conditions_paiement?: string
          created_at?: string
          id?: string
          lignes?: Json
          lot_import?: string | null
          metier?: string
          nom?: string
          notes_usage?: string
          objet?: string
          owner_id?: string
          remarques?: string
          type_travaux?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modeles_devis_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvrages: {
        Row: {
          archive: boolean
          code_source: string
          created_at: string
          description: string
          designation: string
          famille: string
          id: string
          lot_import: string | null
          metier: string
          owner_id: string
          prix_ht_centimes: number | null
          reference: string
          unite: string
          updated_at: string
        }
        Insert: {
          archive?: boolean
          code_source?: string
          created_at?: string
          description?: string
          designation: string
          famille?: string
          id?: string
          lot_import?: string | null
          metier?: string
          owner_id: string
          prix_ht_centimes?: number | null
          reference: string
          unite?: string
          updated_at?: string
        }
        Update: {
          archive?: boolean
          code_source?: string
          created_at?: string
          description?: string
          designation?: string
          famille?: string
          id?: string
          lot_import?: string | null
          metier?: string
          owner_id?: string
          prix_ht_centimes?: number | null
          reference?: string
          unite?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvrages_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvrages_composants: {
        Row: {
          article_id: string | null
          designation: string
          id: string
          ouvrage_id: string
          owner_id: string
          position: number
          prix_achat_centimes: number | null
          prix_ht_centimes: number
          quantite_milliemes: number
          reference: string
          type: string
          unite: string
        }
        Insert: {
          article_id?: string | null
          designation: string
          id?: string
          ouvrage_id: string
          owner_id: string
          position: number
          prix_achat_centimes?: number | null
          prix_ht_centimes: number
          quantite_milliemes: number
          reference?: string
          type: string
          unite: string
        }
        Update: {
          article_id?: string | null
          designation?: string
          id?: string
          ouvrage_id?: string
          owner_id?: string
          position?: number
          prix_achat_centimes?: number | null
          prix_ht_centimes?: number
          quantite_milliemes?: number
          reference?: string
          type?: string
          unite?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvrages_composants_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvrages_composants_ouvrage_id_fkey"
            columns: ["ouvrage_id"]
            isOneToOne: false
            referencedRelation: "ouvrages"
            referencedColumns: ["id"]
          },
        ]
      }
      rapports_intervention: {
        Row: {
          donnees: Json
          id: string
          maj_le: string
          numero: string
          owner_id: string
          signe: boolean
        }
        Insert: {
          donnees: Json
          id: string
          maj_le?: string
          numero: string
          owner_id: string
          signe?: boolean
        }
        Update: {
          donnees?: Json
          id?: string
          maj_le?: string
          numero?: string
          owner_id?: string
          signe?: boolean
        }
        Relationships: []
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
          lot_import: string | null
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
          lot_import?: string | null
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
          lot_import?: string | null
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
          {
            foreignKeyName: "reglements_lot_import_fkey"
            columns: ["lot_import"]
            isOneToOne: false
            referencedRelation: "lots_import"
            referencedColumns: ["id"]
          },
        ]
      }
      signatures_devis: {
        Row: {
          agent_utilisateur: string | null
          cree_le: string
          devis_id: string
          empreinte_document: string | null
          expire_le: string
          id: string
          jeton_hash: string
          owner_id: string
          revoque_le: string | null
          signataire_nom: string | null
          signature_image: string | null
          signe_le: string | null
        }
        Insert: {
          agent_utilisateur?: string | null
          cree_le?: string
          devis_id: string
          empreinte_document?: string | null
          expire_le: string
          id?: string
          jeton_hash: string
          owner_id: string
          revoque_le?: string | null
          signataire_nom?: string | null
          signature_image?: string | null
          signe_le?: string | null
        }
        Update: {
          agent_utilisateur?: string | null
          cree_le?: string
          devis_id?: string
          empreinte_document?: string | null
          expire_le?: string
          id?: string
          jeton_hash?: string
          owner_id?: string
          revoque_le?: string | null
          signataire_nom?: string | null
          signature_image?: string | null
          signe_le?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signatures_devis_devis_id_fkey"
            columns: ["devis_id"]
            isOneToOne: false
            referencedRelation: "devis"
            referencedColumns: ["id"]
          },
        ]
      }
      tresorerie_bibliotheques: {
        Row: {
          donnees: Json
          maj_le: string
          owner_id: string
          version: number
        }
        Insert: {
          donnees: Json
          maj_le?: string
          owner_id: string
          version: number
        }
        Update: {
          donnees?: Json
          maj_le?: string
          owner_id?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      marge_mensuelle: {
        Row: {
          achats_ht_centimes: number | null
          ca_ht_centimes: number | null
          marge_centimes: number | null
          mois: string | null
          owner_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abandonner_avoir: {
        Args: { p_id: string; p_version: number }
        Returns: Json
      }
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
      arrondi_millieme: { Args: { n: number }; Returns: number }
      avoir_calculer_lignes: {
        Args: { p_facture_id: string; p_lignes: Json }
        Returns: Json
      }
      caler_compteurs_historique: { Args: { p_owner: string }; Returns: Json }
      cgv_empreinte:
        | {
            Args: { a: Database["public"]["Tables"]["avoirs"]["Row"] }
            Returns: string
          }
        | {
            Args: { d: Database["public"]["Tables"]["devis"]["Row"] }
            Returns: string
          }
        | {
            Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
            Returns: string
          }
      creer_lien_signature: {
        Args: { p_devis_id: string; p_jeton: string; p_validite_jours?: number }
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
      enregistrer_facture_directe: {
        Args: { p: Json; p_id: string }
        Returns: Json
      }
      enregistrer_historique_khosmos: {
        Args: { p_analyse: Json }
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
      entreprise_legere:
        | {
            Args: { a: Database["public"]["Tables"]["avoirs"]["Row"] }
            Returns: Json
          }
        | {
            Args: { d: Database["public"]["Tables"]["devis"]["Row"] }
            Returns: Json
          }
        | {
            Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
            Returns: Json
          }
      facture_a_regler: {
        Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
        Returns: number
      }
      facture_annulee: { Args: { p_id: string }; Returns: boolean }
      facture_credite: { Args: { p_facture_id: string }; Returns: number }
      facture_directe_disponible: { Args: never; Returns: boolean }
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
      lire_bibliotheque: { Args: { p_nom: string }; Returns: Json }
      lire_devis: { Args: { p_id: string }; Returns: Json }
      lire_devis_pour_signature: { Args: { p_jeton: string }; Returns: Json }
      lire_facture: { Args: { p_id: string }; Returns: Json }
      lire_historique_khosmos: { Args: never; Returns: Json }
      lire_rapports: { Args: never; Returns: Json }
      lire_tresorerie: { Args: never; Returns: Json }
      logo_empreinte:
        | {
            Args: { a: Database["public"]["Tables"]["avoirs"]["Row"] }
            Returns: string
          }
        | {
            Args: { d: Database["public"]["Tables"]["devis"]["Row"] }
            Returns: string
          }
        | {
            Args: { f: Database["public"]["Tables"]["factures"]["Row"] }
            Returns: string
          }
      modifier_bibliotheque: {
        Args: { p_donnees: Json; p_nom: string; p_version: number }
        Returns: Json
      }
      modifier_messages: {
        Args: { p_modeles: Json; p_version: number }
        Returns: Json
      }
      modifier_rapports: {
        Args: {
          p_ecrits: Json
          p_prochain: number
          p_supprimes: string[]
          p_version: number
        }
        Returns: Json
      }
      modifier_tresorerie: {
        Args: { p_donnees: Json; p_version: number }
        Returns: Json
      }
      noter_commande_devis: {
        Args: { p_date: string; p_id: string }
        Returns: Json
      }
      noter_envoi_devis: {
        Args: {
          p_avec_lien: boolean
          p_avec_pdf: boolean
          p_canal: string
          p_destinataire: string
          p_devis_id: string
          p_id: string
          p_nature: string
          p_sujet: string
        }
        Returns: Json
      }
      noter_reponse_devis: {
        Args: { p_date?: string; p_id: string; p_reponse: string }
        Returns: Json
      }
      pieces_entreprise_documents: {
        Args: never
        Returns: {
          empreinte: string
          valeur: string
        }[]
      }
      preparer_acompte: {
        Args: { p_devis_id: string; p_pourcentage: number }
        Returns: Json
      }
      preparer_avoir: {
        Args: { p_facture_id: string; p_motif: string }
        Returns: Json
      }
      preparer_avoir_partiel: {
        Args: { p_facture_id: string; p_lignes: Json; p_motif: string }
        Returns: Json
      }
      preparer_facture: { Args: { p_devis_id: string }; Returns: Json }
      reference_document: {
        Args: { p_annee: number; p_numero: number; p_prefixe: string }
        Returns: string
      }
      revoquer_lien_signature: { Args: { p_id: string }; Returns: undefined }
      serie_document: { Args: { p_type: string }; Returns: string }
      signature_empreinte: { Args: { p: Json }; Returns: string }
      signature_projection: { Args: { p_devis_id: string }; Returns: Json }
      signer_devis_distant: {
        Args: {
          p_accord: boolean
          p_agent?: string
          p_image: string
          p_jeton: string
          p_nom: string
        }
        Returns: Json
      }
      supprimer_devis: { Args: { p_id: string }; Returns: undefined }
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
