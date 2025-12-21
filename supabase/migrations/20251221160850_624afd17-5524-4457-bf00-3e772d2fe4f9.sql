-- Add telemedicine_enabled column to professionals table
ALTER TABLE professionals 
ADD COLUMN IF NOT EXISTS telemedicine_enabled BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN professionals.telemedicine_enabled IS 
  'Indicates if the professional offers telemedicine consultations';