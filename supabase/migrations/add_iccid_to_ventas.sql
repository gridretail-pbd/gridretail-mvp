-- Add iccid column to ventas table
ALTER TABLE ventas
ADD COLUMN IF NOT EXISTS iccid VARCHAR(20);

-- Add comment to the column
COMMENT ON COLUMN ventas.iccid IS 'ICCID del chip (19-20 dígitos)';
