
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
            "appointments": {
                  Row: {
                    "artist_id": string,"blocked_period": unknown,"buffer_minutes": number,"client_id": string,"created_at": string,"id": string,"period": unknown,"request_id": string | null,"source": string,"status": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"blocked_period"?: unknown,"buffer_minutes"?: number,"client_id": string,"created_at"?: string,"id"?: string,"period": unknown,"request_id"?: string | null,"source"?: string,"status"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "artist_id"?: string,"blocked_period"?: unknown,"buffer_minutes"?: number,"client_id"?: string,"created_at"?: string,"id"?: string,"period"?: unknown,"request_id"?: string | null,"source"?: string,"status"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appointments_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artist_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "tattoo_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "appointments_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"artist_profiles": {
                  Row: {
                    "bio": string | null,"created_at": string,"deleted_at": string | null,"display_name": string,"full_name": string | null,"id": string,"is_public": boolean,"styles": (string)[],"updated_at": string,"user_id": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name": string,"full_name"?: string | null,"id"?: string,"is_public"?: boolean,"styles"?: (string)[],"updated_at"?: string,"user_id"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "bio"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"display_name"?: string,"full_name"?: string | null,"id"?: string,"is_public"?: boolean,"styles"?: (string)[],"updated_at"?: string,"user_id"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "artist_profiles_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"availability_blocks": {
                  Row: {
                    "artist_id": string,"created_at": string,"id": string,"period": unknown,"reason": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"created_at"?: string,"id"?: string,"period": unknown,"reason"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "artist_id"?: string,"created_at"?: string,"id"?: string,"period"?: unknown,"reason"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_blocks_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artist_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_blocks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"availability_rules": {
                  Row: {
                    "artist_id": string,"buffer_minutes": number,"created_at": string,"end_time": string,"id": string,"slot_minutes": number,"start_time": string,"updated_at": string,"weekday": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "artist_id": string,"buffer_minutes"?: number,"created_at"?: string,"end_time": string,"id"?: string,"slot_minutes"?: number,"start_time": string,"updated_at"?: string,"weekday": number,"workspace_id": string
                  }
                  Update: {
                    "artist_id"?: string,"buffer_minutes"?: number,"created_at"?: string,"end_time"?: string,"id"?: string,"slot_minutes"?: number,"start_time"?: string,"updated_at"?: string,"weekday"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_rules_artist_id_fkey"
      columns: ["artist_id"]
isOneToOne: false
      referencedRelation: "artist_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_rules_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"email": string | null,"id": string,"instagram_handle": string | null,"name": string,"phone": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"instagram_handle"?: string | null,"name": string,"phone"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"email"?: string | null,"id"?: string,"instagram_handle"?: string | null,"name"?: string,"phone"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "clients_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"conversation_messages": {
                  Row: {
                    "content": string,"conversation_id": string,"created_at": string,"id": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "content": string,"conversation_id": string,"created_at"?: string,"id"?: string,"role": string
                  }
                  Update: {
                    "content"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"role"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "brief": NonNullable<Json>,"created_at": string,"expires_at": string,"id": string,"input_tokens": number,"message_count": number,"output_tokens": number,"status": string,"submitter_hash": string | null,"token_hash": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "brief"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string,"id"?: string,"input_tokens"?: number,"message_count"?: number,"output_tokens"?: number,"status"?: string,"submitter_hash"?: string | null,"token_hash": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "brief"?: NonNullable<Json>,"created_at"?: string,"expires_at"?: string,"id"?: string,"input_tokens"?: number,"message_count"?: number,"output_tokens"?: number,"status"?: string,"submitter_hash"?: string | null,"token_hash"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"portfolio_items": {
                  Row: {
                    "alt_text": string,"body_zone": string | null,"category": string,"created_at": string,"deleted_at": string | null,"description": string | null,"id": string,"image_height": number,"image_path": string,"image_width": number,"position": number,"status": string,"title": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "alt_text": string,"body_zone"?: string | null,"category": string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"image_height": number,"image_path": string,"image_width": number,"position"?: number,"status"?: string,"title": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "alt_text"?: string,"body_zone"?: string | null,"category"?: string,"created_at"?: string,"deleted_at"?: string | null,"description"?: string | null,"id"?: string,"image_height"?: number,"image_path"?: string,"image_width"?: number,"position"?: number,"status"?: string,"title"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "portfolio_items_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"quotes": {
                  Row: {
                    "amount": number,"created_at": string,"created_by": string | null,"currency": string,"deposit": number | null,"estimated_sessions": number | null,"id": string,"message": string | null,"request_id": string,"responded_at": string | null,"sent_at": string | null,"status": string,"updated_at": string,"valid_until": string | null,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"created_by"?: string | null,"currency": string,"deposit"?: number | null,"estimated_sessions"?: number | null,"id"?: string,"message"?: string | null,"request_id": string,"responded_at"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"valid_until"?: string | null,"workspace_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"created_by"?: string | null,"currency"?: string,"deposit"?: number | null,"estimated_sessions"?: number | null,"id"?: string,"message"?: string | null,"request_id"?: string,"responded_at"?: string | null,"sent_at"?: string | null,"status"?: string,"updated_at"?: string,"valid_until"?: string | null,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "quotes_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "tattoo_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "quotes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"request_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"deleted_at": string | null,"id": string,"request_id": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"request_id": string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"request_id"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_notes_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "tattoo_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_notes_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"request_status_history": {
                  Row: {
                    "changed_by": string | null,"created_at": string,"from_status": string,"id": string,"request_id": string,"to_status": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status": string,"id"?: string,"request_id": string,"to_status": string,"workspace_id": string
                  }
                  Update: {
                    "changed_by"?: string | null,"created_at"?: string,"from_status"?: string,"id"?: string,"request_id"?: string,"to_status"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_status_history_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "tattoo_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_status_history_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"tattoo_requests": {
                  Row: {
                    "body_zone": string | null,"client_id": string,"color_mode": string | null,"conversation_id": string | null,"created_at": string,"deleted_at": string | null,"details": string | null,"id": string,"idea": string,"is_cover_up": boolean | null,"size_label": string | null,"source": string,"status": string,"style": string | null,"submitter_hash": string | null,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_zone"?: string | null,"client_id": string,"color_mode"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"details"?: string | null,"id"?: string,"idea": string,"is_cover_up"?: boolean | null,"size_label"?: string | null,"source"?: string,"status"?: string,"style"?: string | null,"submitter_hash"?: string | null,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "body_zone"?: string | null,"client_id"?: string,"color_mode"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"deleted_at"?: string | null,"details"?: string | null,"id"?: string,"idea"?: string,"is_cover_up"?: boolean | null,"size_label"?: string | null,"source"?: string,"status"?: string,"style"?: string | null,"submitter_hash"?: string | null,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tattoo_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tattoo_requests_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: true
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tattoo_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "created_at": string,"role": string,"updated_at": string,"user_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"role": string,"updated_at"?: string,"user_id": string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"role"?: string,"updated_at"?: string,"user_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_settings": {
                  Row: {
                    "created_at": string,"currency": string,"faq": NonNullable<Json>,"instagram_handle": string | null,"locale": string,"location_label": string | null,"process": NonNullable<Json>,"timezone": string,"updated_at": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"currency"?: string,"faq"?: NonNullable<Json>,"instagram_handle"?: string | null,"locale"?: string,"location_label"?: string | null,"process"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"workspace_id": string
                  }
                  Update: {
                    "created_at"?: string,"currency"?: string,"faq"?: NonNullable<Json>,"instagram_handle"?: string | null,"locale"?: string,"location_label"?: string | null,"process"?: NonNullable<Json>,"timezone"?: string,"updated_at"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_settings_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: true
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"id": string,"name": string,"slug": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name": string,"slug": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"id"?: string,"name"?: string,"slug"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_availability_block":
{ Args: { "end_date": string,"end_time"?: string,"reason"?: string,"start_date": string,"start_time"?: string,"target_artist": string }; Returns: string
                           },
"merge_clients":
{ Args: { "source": string,"target": string }; Returns: undefined
                           },
"purge_expired_conversations":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"record_conversation_turn":
{ Args: { "p_assistant_message"?: string,"p_brief"?: Json,"p_conversation": string,"p_input_tokens": number,"p_max_messages": number,"p_output_tokens": number,"p_user_message"?: string }; Returns: boolean
                           },
"set_weekly_availability":
{ Args: { "rules": Json,"target_artist": string }; Returns: undefined
                           },
"workspace_ai_tokens_since":
{ Args: { "p_since": string,"p_workspace": string }; Returns: number
                           },
"workspace_ai_usage":
{ Args: { "p_since": string,"p_workspace": string }; Returns: {
              "conversations": number,"requests": number,"tokens": number
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
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
            
          }
        }
} as const
