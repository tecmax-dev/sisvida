// Types for WhatsApp Multi-attendance Module

export type WhatsAppOperatorStatus = 'online' | 'offline' | 'paused';
export type WhatsAppOperatorRole = 'admin' | 'supervisor' | 'attendant';
export type WhatsAppTicketStatus = 'pending' | 'open' | 'waiting' | 'closed';
export type MessageSenderType = 'contact' | 'operator' | 'bot' | 'system';
export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'sticker';

export interface WhatsAppSector {
  id: string;
  clinic_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppOperator {
  id: string;
  clinic_id: string;
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  role: WhatsAppOperatorRole;
  status: WhatsAppOperatorStatus;
  max_simultaneous_tickets: number;
  current_ticket_count: number;
  last_activity_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sectors?: WhatsAppSector[];
}

export interface WhatsAppOperatorSector {
  id: string;
  operator_id: string;
  sector_id: string;
  created_at: string;
}

export interface WhatsAppContact {
  id: string;
  clinic_id: string;
  phone: string;
  name: string | null;
  profile_picture_url: string | null;
  patient_id: string | null;
  notes: string | null;
  tags: string[] | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  patient?: {
    id: string;
    name: string;
    cpf: string | null;
  };
}

export interface WhatsAppTicket {
  id: string;
  clinic_id: string;
  contact_id: string;
  sector_id: string | null;
  assigned_operator_id: string | null;
  status: WhatsAppTicketStatus;
  protocol: string;
  subject: string | null;
  priority: number;
  is_bot_active: boolean;
  last_message_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contact?: WhatsAppContact;
  sector?: WhatsAppSector;
  assigned_operator?: WhatsAppOperator;
  unread_count?: number;
  last_message?: string;
}

export interface WhatsAppTicketMessage {
  id: string;
  ticket_id: string;
  sender_type: MessageSenderType;
  sender_id: string | null;
  sender_name: string | null;
  message: string | null;
  message_type: MessageType;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  is_from_me: boolean;
  is_read: boolean;
  read_at: string | null;
  external_id: string | null;
  created_at: string;
}

export interface WhatsAppTicketTransfer {
  id: string;
  ticket_id: string;
  from_operator_id: string | null;
  to_operator_id: string | null;
  from_sector_id: string | null;
  to_sector_id: string | null;
  reason: string | null;
  transferred_by: string | null;
  created_at: string;
  from_operator?: WhatsAppOperator;
  to_operator?: WhatsAppOperator;
  from_sector?: WhatsAppSector;
  to_sector?: WhatsAppSector;
}

export interface WhatsAppQuickReply {
  id: string;
  clinic_id: string;
  sector_id: string | null;
  title: string;
  content: string;
  shortcut: string | null;
  category: string | null;
  media_url: string | null;
  media_type: string | null;
  is_active: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sector?: WhatsAppSector;
}

export interface WhatsAppModuleSettings {
  id: string;
  clinic_id: string;
  is_enabled: boolean;
  working_hours_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  working_days: number[];
  offline_message: string;
  welcome_message: string;
  transfer_message: string;
  close_message: string;
  auto_close_hours: number;
  bot_overrides_human: boolean;
  show_operator_name: boolean;
  show_operator_avatar: boolean;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppWorkingHours {
  id: string;
  clinic_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface WhatsAppKanbanColumn {
  id: string;
  clinic_id: string;
  name: string;
  color: string;
  status: WhatsAppTicketStatus;
  order_index: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
  tickets?: WhatsAppTicket[];
}

export interface WhatsAppAuditLog {
  id: string;
  clinic_id: string;
  ticket_id: string | null;
  operator_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// Utility types
export const TICKET_STATUS_LABELS: Record<WhatsAppTicketStatus, string> = {
  pending: 'Pendente',
  open: 'Em Atendimento',
  waiting: 'Aguardando Cliente',
  closed: 'Finalizado',
};

export const TICKET_STATUS_COLORS: Record<WhatsAppTicketStatus, string> = {
  pending: '#EF4444',
  open: '#3B82F6',
  waiting: '#F59E0B',
  closed: '#6B7280',
};

export const OPERATOR_STATUS_LABELS: Record<WhatsAppOperatorStatus, string> = {
  online: 'Online',
  offline: 'Offline',
  paused: 'Em Pausa',
};

export const OPERATOR_STATUS_COLORS: Record<WhatsAppOperatorStatus, string> = {
  online: '#10B981',
  offline: '#6B7280',
  paused: '#F59E0B',
};

export const OPERATOR_ROLE_LABELS: Record<WhatsAppOperatorRole, string> = {
  admin: 'Administrador',
  supervisor: 'Supervisor',
  attendant: 'Atendente',
};
