-- Actualiza los patrones de rotación al ciclo correcto:
-- 5M → 4T → 5D → 5T → 4M → 5D (28 días por trabajador)
-- Cada trabajador usa el mismo ciclo base con distinto desfase.

UPDATE workers
SET rotation_pattern = '["M","M","M","M","M","T","T","T","T","D","D","D","D","D","T","T","T","T","T","M","M","M","M","D","D","D","D","D"]'
WHERE name = 'ALB';

UPDATE workers
SET rotation_pattern = '["T","T","T","T","D","D","D","D","D","T","T","T","T","T","M","M","M","M","D","D","D","D","D","M","M","M","M","M"]'
WHERE name = 'PEPI';

UPDATE workers
SET rotation_pattern = '["D","D","D","D","D","T","T","T","T","T","M","M","M","M","D","D","D","D","D","M","M","M","M","M","T","T","T","T"]'
WHERE name = 'DIE';

UPDATE workers
SET rotation_pattern = '["T","T","T","T","T","M","M","M","M","D","D","D","D","D","M","M","M","M","M","T","T","T","T","D","D","D","D","D"]'
WHERE name = 'IGN';

UPDATE workers
SET rotation_pattern = '["M","M","M","M","D","D","D","D","D","M","M","M","M","M","T","T","T","T","D","D","D","D","D","T","T","T","T","T"]'
WHERE name = 'ALE.M.';
