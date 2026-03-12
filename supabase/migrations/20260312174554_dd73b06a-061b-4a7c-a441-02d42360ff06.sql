-- Update API key in all evolution_configs
UPDATE evolution_configs 
SET api_key = '2b7dbe72ab69c51e4d37e55329e10aeb',
    updated_at = now()
WHERE api_url = 'https://evo.tecmax.net';

-- Update connection status: eclini is connected
UPDATE evolution_configs 
SET is_connected = true, connected_at = now()
WHERE instance_name = 'eclini';

-- secmi is disconnected
UPDATE evolution_configs 
SET is_connected = false, connected_at = NULL
WHERE instance_name = 'secmi';

-- Update global_config with new API key
UPDATE global_config 
SET evolution_api_key = '2b7dbe72ab69c51e4d37e55329e10aeb',
    updated_at = now()
WHERE evolution_api_url = 'https://evo.tecmax.net';