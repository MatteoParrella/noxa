
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "consensi": {
                  Row: {
                    "accettato_il": string,"id": string,"tipo": Database["public"]['Enums']["tipo_consenso"],"utente_id": string,"versione": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accettato_il"?: string,"id"?: string,"tipo": Database["public"]['Enums']["tipo_consenso"],"utente_id": string,"versione": string
                  }
                  Update: {
                    "accettato_il"?: string,"id"?: string,"tipo"?: Database["public"]['Enums']["tipo_consenso"],"utente_id"?: string,"versione"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consensi_utente_id_fkey"
      columns: ["utente_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"profili": {
                  Row: {
                    "aggiornato_il": string,"avatar_path": string | null,"creato_il": string,"id": string,"nome_visualizzato": string,"stato_account": Database["public"]['Enums']["stato_account"],"username": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aggiornato_il"?: string,"avatar_path"?: string | null,"creato_il"?: string,"id": string,"nome_visualizzato": string,"stato_account"?: Database["public"]['Enums']["stato_account"],"username": string
                  }
                  Update: {
                    "aggiornato_il"?: string,"avatar_path"?: string | null,"creato_il"?: string,"id"?: string,"nome_visualizzato"?: string,"stato_account"?: Database["public"]['Enums']["stato_account"],"username"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profili_privati": {
                  Row: {
                    "aggiornato_il": string,"checkin_abilitato": boolean,"creato_il": string,"data_nascita": string,"notifiche_push_abilitate": boolean,"onboarding_completato_il": string | null,"partecipazioni_visibili": boolean,"utente_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "aggiornato_il"?: string,"checkin_abilitato"?: boolean,"creato_il"?: string,"data_nascita": string,"notifiche_push_abilitate"?: boolean,"onboarding_completato_il"?: string | null,"partecipazioni_visibili"?: boolean,"utente_id": string
                  }
                  Update: {
                    "aggiornato_il"?: string,"checkin_abilitato"?: boolean,"creato_il"?: string,"data_nascita"?: string,"notifiche_push_abilitate"?: boolean,"onboarding_completato_il"?: string | null,"partecipazioni_visibili"?: boolean,"utente_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profili_privati_utente_id_fkey"
      columns: ["utente_id"]
isOneToOne: true
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"ruoli_utente": {
                  Row: {
                    "assegnato_il": string,"ruolo": Database["public"]['Enums']["ruolo_utente"],"utente_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assegnato_il"?: string,"ruolo": Database["public"]['Enums']["ruolo_utente"],"utente_id": string
                  }
                  Update: {
                    "assegnato_il"?: string,"ruolo"?: Database["public"]['Enums']["ruolo_utente"],"utente_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ruoli_utente_utente_id_fkey"
      columns: ["utente_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "mio_account":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            "ruolo_utente": "moderatore"|"amministratore","stato_account": "attivo"|"sospeso","tipo_consenso": "termini"|"privacy"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "ruolo_utente": ["moderatore", "amministratore"],"stato_account": ["attivo", "sospeso"],"tipo_consenso": ["termini", "privacy"]
          }
        }
} as const
