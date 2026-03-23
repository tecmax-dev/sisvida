-- Remove duplicated ELIANE appointments (the ones created before the batch)
DELETE FROM appointments WHERE id IN ('e251ed8d-e501-4524-aaa1-75ab738070de', 'eff4a3d1-83ef-4573-bdd0-9bb5397caafc');