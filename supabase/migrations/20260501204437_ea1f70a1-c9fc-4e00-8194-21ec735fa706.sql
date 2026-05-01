-- Remove a restrição de que cada clínica só pode ter uma configuração
ALTER TABLE zapster_configs DROP CONSTRAINT IF EXISTS zapster_configs_clinic_id_key;

-- Adiciona uma restrição de unicidade para o par clinic_id + instance_id para evitar duplicatas exatas
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapster_configs_clinic_instance ON zapster_configs (clinic_id, instance_id);
