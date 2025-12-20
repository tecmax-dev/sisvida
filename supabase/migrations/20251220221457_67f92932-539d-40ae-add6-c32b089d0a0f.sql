-- Add 'arrived' status to appointment_status enum
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'arrived';