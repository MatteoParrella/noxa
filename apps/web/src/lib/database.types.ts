
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
            "amicizie": {
                  Row: {
                    "accettata_il": string | null,"canale": Database["public"]['Enums']["canale_amicizia"],"creata_il": string,"destinatario_id": string,"id": string,"richiedente_id": string,"stato": Database["public"]['Enums']["stato_amicizia"]
                  }
                  ComputedFields: never
                  Insert: {
                    "accettata_il"?: string | null,"canale": Database["public"]['Enums']["canale_amicizia"],"creata_il"?: string,"destinatario_id": string,"id"?: string,"richiedente_id": string,"stato"?: Database["public"]['Enums']["stato_amicizia"]
                  }
                  Update: {
                    "accettata_il"?: string | null,"canale"?: Database["public"]['Enums']["canale_amicizia"],"creata_il"?: string,"destinatario_id"?: string,"id"?: string,"richiedente_id"?: string,"stato"?: Database["public"]['Enums']["stato_amicizia"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "amicizie_destinatario_id_fkey"
      columns: ["destinatario_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "amicizie_richiedente_id_fkey"
      columns: ["richiedente_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"azioni_moderazione": {
                  Row: {
                    "azione": Database["public"]['Enums']["azione_moderazione"],"conservazione_legale": boolean,"creata_il": string,"id": string,"moderatore_id": string | null,"motivazione": string | null,"oggetto_id": string,"segnalazione_id": string | null,"tipo_oggetto": Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  ComputedFields: never
                  Insert: {
                    "azione": Database["public"]['Enums']["azione_moderazione"],"conservazione_legale"?: boolean,"creata_il"?: string,"id"?: string,"moderatore_id"?: string | null,"motivazione"?: string | null,"oggetto_id": string,"segnalazione_id"?: string | null,"tipo_oggetto": Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  Update: {
                    "azione"?: Database["public"]['Enums']["azione_moderazione"],"conservazione_legale"?: boolean,"creata_il"?: string,"id"?: string,"moderatore_id"?: string | null,"motivazione"?: string | null,"oggetto_id"?: string,"segnalazione_id"?: string | null,"tipo_oggetto"?: Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "azioni_moderazione_moderatore_id_fkey"
      columns: ["moderatore_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "azioni_moderazione_segnalazione_id_fkey"
      columns: ["segnalazione_id"]
isOneToOne: false
      referencedRelation: "segnalazioni"
      referencedColumns: ["id"]
    }
                  ]
                },"blocchi": {
                  Row: {
                    "bloccante_id": string,"bloccato_id": string,"creato_il": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bloccante_id": string,"bloccato_id": string,"creato_il"?: string
                  }
                  Update: {
                    "bloccante_id"?: string,"bloccato_id"?: string,"creato_il"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocchi_bloccante_id_fkey"
      columns: ["bloccante_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocchi_bloccato_id_fkey"
      columns: ["bloccato_id"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"candidati_locali": {
                  Row: {
                    "comune": string | null,"creato_il": string,"deciso_da": string | null,"deciso_il": string | null,"google_place_id": string | null,"id": string,"indirizzo": string | null,"locale_id": string | null,"nome": string | null,"origine": string,"osm_id": string | null,"posizione": unknown,"possibile_doppione_id": string | null,"provincia": string | null,"sito_web": string | null,"stato": string
                  }
                  ComputedFields: never
                  Insert: {
                    "comune"?: string | null,"creato_il"?: string,"deciso_da"?: string | null,"deciso_il"?: string | null,"google_place_id"?: string | null,"id"?: string,"indirizzo"?: string | null,"locale_id"?: string | null,"nome"?: string | null,"origine": string,"osm_id"?: string | null,"posizione"?: unknown,"possibile_doppione_id"?: string | null,"provincia"?: string | null,"sito_web"?: string | null,"stato"?: string
                  }
                  Update: {
                    "comune"?: string | null,"creato_il"?: string,"deciso_da"?: string | null,"deciso_il"?: string | null,"google_place_id"?: string | null,"id"?: string,"indirizzo"?: string | null,"locale_id"?: string | null,"nome"?: string | null,"origine"?: string,"osm_id"?: string | null,"posizione"?: unknown,"possibile_doppione_id"?: string | null,"provincia"?: string | null,"sito_web"?: string | null,"stato"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "candidati_locali_deciso_da_fkey"
      columns: ["deciso_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "candidati_locali_locale_id_fkey"
      columns: ["locale_id"]
isOneToOne: false
      referencedRelation: "locali"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "candidati_locali_possibile_doppione_id_fkey"
      columns: ["possibile_doppione_id"]
isOneToOne: false
      referencedRelation: "locali"
      referencedColumns: ["id"]
    }
                  ]
                },"coda_job": {
                  Row: {
                    "bloccato_fino": string | null,"chiave_concorrenza": string | null,"chiave_idempotenza": string,"completato_il": string | null,"creato_il": string,"errore": string | null,"esegui_dopo": string,"id": number,"payload": NonNullable<Json>,"stato": Database["public"]['Enums']["stato_job"],"tentativi": number,"tipo": Database["public"]['Enums']["tipo_job"]
                  }
                  ComputedFields: never
                  Insert: {
                    "bloccato_fino"?: string | null,"chiave_concorrenza"?: string | null,"chiave_idempotenza": string,"completato_il"?: string | null,"creato_il"?: string,"errore"?: string | null,"esegui_dopo"?: string,"id"?: never,"payload"?: NonNullable<Json>,"stato"?: Database["public"]['Enums']["stato_job"],"tentativi"?: number,"tipo": Database["public"]['Enums']["tipo_job"]
                  }
                  Update: {
                    "bloccato_fino"?: string | null,"chiave_concorrenza"?: string | null,"chiave_idempotenza"?: string,"completato_il"?: string | null,"creato_il"?: string,"errore"?: string | null,"esegui_dopo"?: string,"id"?: never,"payload"?: NonNullable<Json>,"stato"?: Database["public"]['Enums']["stato_job"],"tentativi"?: number,"tipo"?: Database["public"]['Enums']["tipo_job"]
                  }
                  Relationships: [
                    
                  ]
                },"codici_invito": {
                  Row: {
                    "codice": string,"creato_da": string,"creato_il": string,"scade_il": string,"usato_da": string | null,"usato_il": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "codice": string,"creato_da": string,"creato_il"?: string,"scade_il"?: string,"usato_da"?: string | null,"usato_il"?: string | null
                  }
                  Update: {
                    "codice"?: string,"creato_da"?: string,"creato_il"?: string,"scade_il"?: string,"usato_da"?: string | null,"usato_il"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "codici_invito_creato_da_fkey"
      columns: ["creato_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "codici_invito_usato_da_fkey"
      columns: ["usato_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"consensi": {
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
                },"esecuzioni_fonte": {
                  Row: {
                    "codice_errore": string | null,"durata_ms": number,"eventi_in_revisione": number,"eventi_letti": number,"eventi_nuovi": number,"eventi_scartati": number,"eventi_uniti": number,"fonte_id": string,"id": number,"iniziata_il": string,"messaggio_errore": string | null,"pagine_lette": number,"prova": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "codice_errore"?: string | null,"durata_ms": number,"eventi_in_revisione"?: number,"eventi_letti"?: number,"eventi_nuovi"?: number,"eventi_scartati"?: number,"eventi_uniti"?: number,"fonte_id": string,"id"?: never,"iniziata_il": string,"messaggio_errore"?: string | null,"pagine_lette"?: number,"prova"?: boolean
                  }
                  Update: {
                    "codice_errore"?: string | null,"durata_ms"?: number,"eventi_in_revisione"?: number,"eventi_letti"?: number,"eventi_nuovi"?: number,"eventi_scartati"?: number,"eventi_uniti"?: number,"fonte_id"?: string,"id"?: never,"iniziata_il"?: string,"messaggio_errore"?: string | null,"pagine_lette"?: number,"prova"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "esecuzioni_fonte_fonte_id_fkey"
      columns: ["fonte_id"]
isOneToOne: false
      referencedRelation: "fonti"
      referencedColumns: ["id"]
    }
                  ]
                },"eventi": {
                  Row: {
                    "aggiornato_il": string,"artisti": (string)[],"creato_il": string,"data_serata": string,"descrizione": string | null,"eta_minima": number,"eta_minima_dichiarata": boolean,"fine": string | null,"id": string,"immagine_path": string | null,"inizio": string,"locale_id": string,"prezzo_min_centesimi": number | null,"riferimenti_alcol": boolean,"stato": Database["public"]['Enums']["stato_evento"],"titolo": string,"ultima_verifica_il": string,"url_biglietti": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aggiornato_il"?: string,"artisti"?: (string)[],"creato_il"?: string,"data_serata": string,"descrizione"?: string | null,"eta_minima"?: number,"eta_minima_dichiarata"?: boolean,"fine"?: string | null,"id"?: string,"immagine_path"?: string | null,"inizio": string,"locale_id": string,"prezzo_min_centesimi"?: number | null,"riferimenti_alcol"?: boolean,"stato"?: Database["public"]['Enums']["stato_evento"],"titolo": string,"ultima_verifica_il"?: string,"url_biglietti"?: string | null
                  }
                  Update: {
                    "aggiornato_il"?: string,"artisti"?: (string)[],"creato_il"?: string,"data_serata"?: string,"descrizione"?: string | null,"eta_minima"?: number,"eta_minima_dichiarata"?: boolean,"fine"?: string | null,"id"?: string,"immagine_path"?: string | null,"inizio"?: string,"locale_id"?: string,"prezzo_min_centesimi"?: number | null,"riferimenti_alcol"?: boolean,"stato"?: Database["public"]['Enums']["stato_evento"],"titolo"?: string,"ultima_verifica_il"?: string,"url_biglietti"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventi_locale_id_fkey"
      columns: ["locale_id"]
isOneToOne: false
      referencedRelation: "locali"
      referencedColumns: ["id"]
    }
                  ]
                },"eventi_fonti": {
                  Row: {
                    "assenze_consecutive": number,"caricamento_flyer_id": string | null,"evento_id": string,"fonte_id": string | null,"id": string,"id_esterno": string | null,"raccolto_il": string,"tipo_origine": string,"ultima_conferma_il": string,"url_originale": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assenze_consecutive"?: number,"caricamento_flyer_id"?: string | null,"evento_id": string,"fonte_id"?: string | null,"id"?: string,"id_esterno"?: string | null,"raccolto_il"?: string,"tipo_origine": string,"ultima_conferma_il"?: string,"url_originale"?: string | null
                  }
                  Update: {
                    "assenze_consecutive"?: number,"caricamento_flyer_id"?: string | null,"evento_id"?: string,"fonte_id"?: string | null,"id"?: string,"id_esterno"?: string | null,"raccolto_il"?: string,"tipo_origine"?: string,"ultima_conferma_il"?: string,"url_originale"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventi_fonti_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventi_fonti_fonte_id_fkey"
      columns: ["fonte_id"]
isOneToOne: false
      referencedRelation: "fonti"
      referencedColumns: ["id"]
    }
                  ]
                },"eventi_generi": {
                  Row: {
                    "evento_id": string,"genere_codice": string
                  }
                  ComputedFields: never
                  Insert: {
                    "evento_id": string,"genere_codice": string
                  }
                  Update: {
                    "evento_id"?: string,"genere_codice"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventi_generi_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventi_generi_genere_codice_fkey"
      columns: ["genere_codice"]
isOneToOne: false
      referencedRelation: "generi_musicali"
      referencedColumns: ["codice"]
    }
                  ]
                },"eventi_grezzi": {
                  Row: {
                    "caricamento_flyer_id": string | null,"creato_il": string,"decisione": string | null,"deciso_da": string | null,"deciso_il": string | null,"errore": string | null,"evento_candidato_id": string | null,"evento_id": string | null,"fonte_id": string | null,"hash_contenuto": string,"id": string,"nota_revisione": string | null,"payload": NonNullable<Json>,"punteggio_dedup": number | null,"stato": Database["public"]['Enums']["stato_grezzo"]
                  }
                  ComputedFields: never
                  Insert: {
                    "caricamento_flyer_id"?: string | null,"creato_il"?: string,"decisione"?: string | null,"deciso_da"?: string | null,"deciso_il"?: string | null,"errore"?: string | null,"evento_candidato_id"?: string | null,"evento_id"?: string | null,"fonte_id"?: string | null,"hash_contenuto": string,"id"?: string,"nota_revisione"?: string | null,"payload": NonNullable<Json>,"punteggio_dedup"?: number | null,"stato"?: Database["public"]['Enums']["stato_grezzo"]
                  }
                  Update: {
                    "caricamento_flyer_id"?: string | null,"creato_il"?: string,"decisione"?: string | null,"deciso_da"?: string | null,"deciso_il"?: string | null,"errore"?: string | null,"evento_candidato_id"?: string | null,"evento_id"?: string | null,"fonte_id"?: string | null,"hash_contenuto"?: string,"id"?: string,"nota_revisione"?: string | null,"payload"?: NonNullable<Json>,"punteggio_dedup"?: number | null,"stato"?: Database["public"]['Enums']["stato_grezzo"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "eventi_grezzi_deciso_da_fkey"
      columns: ["deciso_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventi_grezzi_evento_candidato_id_fkey"
      columns: ["evento_candidato_id"]
isOneToOne: false
      referencedRelation: "eventi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventi_grezzi_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "eventi_grezzi_fonte_id_fkey"
      columns: ["fonte_id"]
isOneToOne: false
      referencedRelation: "fonti"
      referencedColumns: ["id"]
    }
                  ]
                },"fonti": {
                  Row: {
                    "adattatore": string | null,"aggiornato_il": string,"attiva": boolean,"creato_il": string,"disattivata_automaticamente_il": string | null,"dominio": string | null,"errori_consecutivi": number,"esecuzioni_senza_eventi": number,"frequenza_minuti": number,"id": string,"locale_id": string,"note_conformita": string | null,"pagine_massime": number,"robots_esito": string | null,"stato_conformita": Database["public"]['Enums']["stato_conformita"],"termini_letti_il": string | null,"termini_url": string | null,"tipo": Database["public"]['Enums']["tipo_fonte"],"ultima_esecuzione_il": string | null,"ultimo_errore": string | null,"ultimo_esito": Json | null,"url": string,"verificata_da": string | null,"verificata_il": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "adattatore"?: string | null,"aggiornato_il"?: string,"attiva"?: boolean,"creato_il"?: string,"disattivata_automaticamente_il"?: string | null,"dominio"?: never,"errori_consecutivi"?: number,"esecuzioni_senza_eventi"?: number,"frequenza_minuti"?: number,"id"?: string,"locale_id": string,"note_conformita"?: string | null,"pagine_massime"?: number,"robots_esito"?: string | null,"stato_conformita"?: Database["public"]['Enums']["stato_conformita"],"termini_letti_il"?: string | null,"termini_url"?: string | null,"tipo": Database["public"]['Enums']["tipo_fonte"],"ultima_esecuzione_il"?: string | null,"ultimo_errore"?: string | null,"ultimo_esito"?: Json | null,"url": string,"verificata_da"?: string | null,"verificata_il"?: string | null
                  }
                  Update: {
                    "adattatore"?: string | null,"aggiornato_il"?: string,"attiva"?: boolean,"creato_il"?: string,"disattivata_automaticamente_il"?: string | null,"dominio"?: never,"errori_consecutivi"?: number,"esecuzioni_senza_eventi"?: number,"frequenza_minuti"?: number,"id"?: string,"locale_id"?: string,"note_conformita"?: string | null,"pagine_massime"?: number,"robots_esito"?: string | null,"stato_conformita"?: Database["public"]['Enums']["stato_conformita"],"termini_letti_il"?: string | null,"termini_url"?: string | null,"tipo"?: Database["public"]['Enums']["tipo_fonte"],"ultima_esecuzione_il"?: string | null,"ultimo_errore"?: string | null,"ultimo_esito"?: Json | null,"url"?: string,"verificata_da"?: string | null,"verificata_il"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fonti_locale_id_fkey"
      columns: ["locale_id"]
isOneToOne: false
      referencedRelation: "locali"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fonti_verificata_da_fkey"
      columns: ["verificata_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"generi_musicali": {
                  Row: {
                    "codice": string,"nome": string
                  }
                  ComputedFields: never
                  Insert: {
                    "codice": string,"nome": string
                  }
                  Update: {
                    "codice"?: string,"nome"?: string
                  }
                  Relationships: [
                    
                  ]
                },"locali": {
                  Row: {
                    "aggiornato_il": string,"attivo": boolean,"comune": string,"creato_il": string,"google_place_id": string | null,"id": string,"immagine_approvata_da": string | null,"immagine_approvata_il": string | null,"immagine_attribuzione": string | null,"immagine_fonte": Database["public"]['Enums']["fonte_immagine_locale"] | null,"immagine_path": string | null,"immagine_riferimento": string | null,"indirizzo": string,"instagram_username": string | null,"nome": string,"nome_normalizzato": string,"osm_id": string | null,"posizione": unknown,"provincia": string,"sito_web": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "aggiornato_il"?: string,"attivo"?: boolean,"comune": string,"creato_il"?: string,"google_place_id"?: string | null,"id"?: string,"immagine_approvata_da"?: string | null,"immagine_approvata_il"?: string | null,"immagine_attribuzione"?: string | null,"immagine_fonte"?: Database["public"]['Enums']["fonte_immagine_locale"] | null,"immagine_path"?: string | null,"immagine_riferimento"?: string | null,"indirizzo": string,"instagram_username"?: string | null,"nome": string,"nome_normalizzato"?: string,"osm_id"?: string | null,"posizione": unknown,"provincia": string,"sito_web"?: string | null
                  }
                  Update: {
                    "aggiornato_il"?: string,"attivo"?: boolean,"comune"?: string,"creato_il"?: string,"google_place_id"?: string | null,"id"?: string,"immagine_approvata_da"?: string | null,"immagine_approvata_il"?: string | null,"immagine_attribuzione"?: string | null,"immagine_fonte"?: Database["public"]['Enums']["fonte_immagine_locale"] | null,"immagine_path"?: string | null,"immagine_riferimento"?: string | null,"indirizzo"?: string,"instagram_username"?: string | null,"nome"?: string,"nome_normalizzato"?: string,"osm_id"?: string | null,"posizione"?: unknown,"provincia"?: string,"sito_web"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "locali_immagine_approvata_da_fkey"
      columns: ["immagine_approvata_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    }
                  ]
                },"partecipazioni_evento": {
                  Row: {
                    "aggiornato_il": string,"creato_il": string,"evento_id": string,"stato": Database["public"]['Enums']["stato_partecipazione_evento"],"utente_id": string,"visibile_agli_amici": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "aggiornato_il"?: string,"creato_il"?: string,"evento_id": string,"stato": Database["public"]['Enums']["stato_partecipazione_evento"],"utente_id": string,"visibile_agli_amici": boolean
                  }
                  Update: {
                    "aggiornato_il"?: string,"creato_il"?: string,"evento_id"?: string,"stato"?: Database["public"]['Enums']["stato_partecipazione_evento"],"utente_id"?: string,"visibile_agli_amici"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "partecipazioni_evento_evento_id_fkey"
      columns: ["evento_id"]
isOneToOne: false
      referencedRelation: "eventi"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "partecipazioni_evento_utente_id_fkey"
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
                },"segnalazioni": {
                  Row: {
                    "chiusa_il": string | null,"conservazione_legale": boolean,"creata_il": string,"dettagli": string | null,"gestita_da": string | null,"id": string,"motivo": Database["public"]['Enums']["motivo_segnalazione"],"oggetto_id": string,"priorita": number,"segnalante_id": string | null,"stato": Database["public"]['Enums']["stato_segnalazione"],"tipo_oggetto": Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  ComputedFields: never
                  Insert: {
                    "chiusa_il"?: string | null,"conservazione_legale"?: boolean,"creata_il"?: string,"dettagli"?: string | null,"gestita_da"?: string | null,"id"?: string,"motivo": Database["public"]['Enums']["motivo_segnalazione"],"oggetto_id": string,"priorita"?: number,"segnalante_id"?: string | null,"stato"?: Database["public"]['Enums']["stato_segnalazione"],"tipo_oggetto": Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  Update: {
                    "chiusa_il"?: string | null,"conservazione_legale"?: boolean,"creata_il"?: string,"dettagli"?: string | null,"gestita_da"?: string | null,"id"?: string,"motivo"?: Database["public"]['Enums']["motivo_segnalazione"],"oggetto_id"?: string,"priorita"?: number,"segnalante_id"?: string | null,"stato"?: Database["public"]['Enums']["stato_segnalazione"],"tipo_oggetto"?: Database["public"]['Enums']["tipo_oggetto_segnalabile"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "segnalazioni_gestita_da_fkey"
      columns: ["gestita_da"]
isOneToOne: false
      referencedRelation: "profili"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segnalazioni_segnalante_id_fkey"
      columns: ["segnalante_id"]
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
            "anteprima_codice_invito":
{ Args: { "codice": string }; Returns: {
              "avviso_fasce": boolean,"nome_visualizzato": string,"stato": string,"titolare_id": string,"username": string
            }[]
                           },
"avviso_richiesta":
{ Args: { "amicizia": string }; Returns: boolean
                           },
"cambia_stato_evento":
{ Args: { "evento": string,"motivazione": string,"stato": Database["public"]['Enums']["stato_evento"] }; Returns: undefined
                           },
"candidati_da_verificare":
{ Args: Record<PropertyKey, never>; Returns: {
              "comune": string,"doppione_id": string,"doppione_nome": string,"google_place_id": string,"id": string,"indirizzo": string,"lat": number,"lon": number,"nome": string,"origine": string,"osm_id": string,"provincia": string,"sito_web": string
            }[]
                           },
"cerca_eventi":
{ Args: { "al"?: string,"dal"?: string,"eta_minima_max"?: number,"generi"?: (string)[],"lat"?: number,"lon"?: number,"raggio_km"?: number,"solo_amici"?: boolean }; Returns: {
              "amici": Json,"amici_interessati": number,"amici_partecipano": number,"copertina_attribuzione": string,"copertina_path": string,"copertina_tipo": string,"data_serata": string,"distanza_m": number,"eta_minima": number,"eta_minima_dichiarata": boolean,"fine": string,"generi_evento": (string)[],"id": string,"inizio": string,"locale_comune": string,"locale_id": string,"locale_lat": number,"locale_lon": number,"locale_nome": string,"mia_partecipazione": Database["public"]['Enums']["stato_partecipazione_evento"],"prezzo_min_centesimi": number,"stato": Database["public"]['Enums']["stato_evento"],"titolo": string
            }[]
                           },
"cerca_utenti":
{ Args: { "testo": string }; Returns: {
              "id": string,"nome_visualizzato": string,"relazione": string,"username": string
            }[]
                           },
"coda_duplicati":
{ Args: Record<PropertyKey, never>; Returns: {
              "candidato": Json,"creato_il": string,"fonte_tipo": Database["public"]['Enums']["tipo_fonte"],"fonte_url": string,"grezzo_id": string,"nota_revisione": string,"payload": Json,"punteggio": number
            }[]
                           },
"contatori_moderazione":
{ Args: Record<PropertyKey, never>; Returns: {
              "candidati_locali": number,"duplicati": number,"possibili_annullamenti": number
            }[]
                           },
"correggi_eta_alcol_evento":
{ Args: { "eta_minima": number,"eta_minima_dichiarata": boolean,"evento": string,"motivazione": string,"riferimenti_alcol": boolean }; Returns: undefined
                           },
"crea_codice_invito":
{ Args: Record<PropertyKey, never>; Returns: {
              "codice": string,"scade_il": string
            }[]
                           },
"decidi_candidato_locale":
{ Args: { "candidato": string,"esito": string,"locale"?: string,"motivazione"?: string }; Returns: undefined
                           },
"decidi_duplicato":
{ Args: { "grezzo": string,"stesso_evento": boolean }; Returns: undefined
                           },
"decidi_possibile_annullamento":
{ Args: { "annullato": boolean,"evento": string,"motivazione"?: string }; Returns: undefined
                           },
"dettaglio_evento":
{ Args: { "evento": string }; Returns: {
              "amici": Json,"artisti": (string)[],"copertina_attribuzione": string,"copertina_path": string,"copertina_tipo": string,"data_serata": string,"descrizione": string,"eta_minima": number,"eta_minima_dichiarata": boolean,"fine": string,"fonte_tipo": string,"fonte_url": string,"generi_evento": (string)[],"id": string,"inizio": string,"locale_comune": string,"locale_id": string,"locale_indirizzo": string,"locale_lat": number,"locale_lon": number,"locale_nome": string,"mia_partecipazione": Database["public"]['Enums']["stato_partecipazione_evento"],"mia_visibilita": boolean,"prezzo_min_centesimi": number,"stato": Database["public"]['Enums']["stato_evento"],"titolo": string,"url_biglietti": string
            }[]
                           },
"esegui_fonte_ora":
{ Args: { "fonte": string }; Returns: number
                           },
"eventi_moderazione":
{ Args: { "al"?: string,"dal"?: string,"locale"?: string,"stati"?: (Database["public"]['Enums']["stato_evento"])[],"testo"?: string }; Returns: {
              "data_serata": string,"eta_minima": number,"eta_minima_dichiarata": boolean,"fonti": number,"id": string,"inizio": string,"locale_comune": string,"locale_id": string,"locale_nome": string,"riferimenti_alcol": boolean,"stato": Database["public"]['Enums']["stato_evento"],"titolo": string
            }[]
                           },
"locale_moderazione":
{ Args: { "locale": string }; Returns: {
              "aggiornato_il": string,"attivo": boolean,"comune": string,"google_place_id": string,"id": string,"immagine_approvata_da": string,"immagine_approvata_il": string,"immagine_attribuzione": string,"immagine_fonte": Database["public"]['Enums']["fonte_immagine_locale"],"immagine_path": string,"immagine_riferimento": string,"indirizzo": string,"instagram_username": string,"lat": number,"lon": number,"nome": string,"osm_id": string,"provincia": string,"sito_web": string
            }[]
                           },
"locali_moderazione":
{ Args: Record<PropertyKey, never>; Returns: {
              "aggiornato_il": string,"attivo": boolean,"comune": string,"da_verificare": boolean,"eventi_7_giorni": number,"fonti_attive": number,"fonti_totali": number,"id": string,"immagine_path": string,"nome": string,"provincia": string
            }[]
                           },
"mie_segnalazioni":
{ Args: Record<PropertyKey, never>; Returns: {
              "chiusa_il": string,"creata_il": string,"decisa_il": string,"decisione": string,"descrizione": string,"id": string,"motivo": Database["public"]['Enums']["motivo_segnalazione"],"stato": Database["public"]['Enums']["stato_segnalazione"],"tipo_oggetto": Database["public"]['Enums']["tipo_oggetto_segnalabile"]
            }[]
                           },
"miei_bloccati":
{ Args: Record<PropertyKey, never>; Returns: {
              "bloccato_il": string,"id": string,"nome_visualizzato": string,"username": string
            }[]
                           },
"mio_account":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"possibili_annullamenti":
{ Args: Record<PropertyKey, never>; Returns: {
              "data_serata": string,"evento_id": string,"fonte_url": string,"ha_partecipanti": boolean,"inizio": string,"locale_comune": string,"locale_nome": string,"titolo": string,"ultima_conferma_il": string
            }[]
                           },
"registro_moderazione":
{ Args: { "oggetto": string,"tipo": Database["public"]['Enums']["tipo_oggetto_segnalabile"] }; Returns: {
              "autore": string,"azione": string,"creata_il": string,"motivazione": string
            }[]
                           },
"rimuovi_foto_locale":
{ Args: { "locale": string,"motivazione": string }; Returns: string
                           },
"salva_foto_locale":
{ Args: { "attribuzione"?: string,"fonte": Database["public"]['Enums']["fonte_immagine_locale"],"locale": string,"percorso": string,"riferimento"?: string,"senza_alcol": boolean,"senza_persone": boolean }; Returns: string
                           },
"usa_codice_invito":
{ Args: { "codice": string }; Returns: string
                           }
          }
          Enums: {
            "azione_moderazione": "nessuna_violazione"|"rimuovi_contenuto"|"modifica_evento"|"approva_flyer"|"rifiuta_flyer"|"sospendi_account"|"riattiva_account"|"correggi_data_nascita"|"escalation_autorita"|"accesso_segnalazione"|"crea_locale"|"modifica_locale"|"approva_immagine_locale"|"rimuovi_immagine_locale"|"crea_fonte"|"modifica_fonte"|"esegui_fonte"|"unisci_duplicato"|"separa_duplicato"|"pubblica_evento"|"annulla_evento"|"rifiuta_evento"|"correggi_eta_alcol"|"conferma_in_programma"|"verifica_candidato_locale"|"unisci_candidato_locale"|"scarta_candidato_locale","canale_amicizia": "ricerca"|"codice_invito","fonte_immagine_locale": "autorizzazione_locale"|"noxa"|"licenza_libera","motivo_segnalazione": "contenuto_inappropriato"|"molestie"|"adescamento_o_rischio_minore"|"spam"|"evento_falso"|"eta_errata"|"alcol_a_minori"|"altro"|"dati_errati","ruolo_utente": "moderatore"|"amministratore","stato_account": "attivo"|"sospeso","stato_amicizia": "in_attesa"|"accettata","stato_conformita": "da_verificare"|"consentita"|"vietata","stato_evento": "in_revisione"|"pubblicato"|"rifiutato"|"annullato","stato_grezzo": "nuovo"|"normalizzato"|"unito"|"in_revisione_dedup"|"scartato"|"errore","stato_job": "in_coda"|"in_esecuzione"|"completato"|"fallito","stato_partecipazione_evento": "interessato"|"partecipo","stato_segnalazione": "aperta"|"in_lavorazione"|"chiusa","tipo_consenso": "termini"|"privacy","tipo_fonte": "sito_locale"|"instagram"|"resident_advisor"|"xceed"|"dice","tipo_job": "esegui_fonte"|"analizza_flyer"|"deduplica_grezzo"|"copia_immagine_flyer"|"pulizia_flyer","tipo_oggetto_segnalabile": "profilo"|"evento"|"caricamento_flyer"|"gruppo"|"serata_gruppo"|"immagine_locale"|"locale"|"fonte"|"candidato_locale"
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
            "azione_moderazione": ["nessuna_violazione", "rimuovi_contenuto", "modifica_evento", "approva_flyer", "rifiuta_flyer", "sospendi_account", "riattiva_account", "correggi_data_nascita", "escalation_autorita", "accesso_segnalazione", "crea_locale", "modifica_locale", "approva_immagine_locale", "rimuovi_immagine_locale", "crea_fonte", "modifica_fonte", "esegui_fonte", "unisci_duplicato", "separa_duplicato", "pubblica_evento", "annulla_evento", "rifiuta_evento", "correggi_eta_alcol", "conferma_in_programma", "verifica_candidato_locale", "unisci_candidato_locale", "scarta_candidato_locale"],"canale_amicizia": ["ricerca", "codice_invito"],"fonte_immagine_locale": ["autorizzazione_locale", "noxa", "licenza_libera"],"motivo_segnalazione": ["contenuto_inappropriato", "molestie", "adescamento_o_rischio_minore", "spam", "evento_falso", "eta_errata", "alcol_a_minori", "altro", "dati_errati"],"ruolo_utente": ["moderatore", "amministratore"],"stato_account": ["attivo", "sospeso"],"stato_amicizia": ["in_attesa", "accettata"],"stato_conformita": ["da_verificare", "consentita", "vietata"],"stato_evento": ["in_revisione", "pubblicato", "rifiutato", "annullato"],"stato_grezzo": ["nuovo", "normalizzato", "unito", "in_revisione_dedup", "scartato", "errore"],"stato_job": ["in_coda", "in_esecuzione", "completato", "fallito"],"stato_partecipazione_evento": ["interessato", "partecipo"],"stato_segnalazione": ["aperta", "in_lavorazione", "chiusa"],"tipo_consenso": ["termini", "privacy"],"tipo_fonte": ["sito_locale", "instagram", "resident_advisor", "xceed", "dice"],"tipo_job": ["esegui_fonte", "analizza_flyer", "deduplica_grezzo", "copia_immagine_flyer", "pulizia_flyer"],"tipo_oggetto_segnalabile": ["profilo", "evento", "caricamento_flyer", "gruppo", "serata_gruppo", "immagine_locale", "locale", "fonte", "candidato_locale"]
          }
        }
} as const
