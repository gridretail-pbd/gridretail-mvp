const bcrypt = require('bcryptjs');

const password = 'admin123';

const hash = bcrypt.hashSync(password, 10);
console.log('Password:', password);
console.log('Hash generado:', hash);

// Verificar que funciona
const isValid = bcrypt.compareSync(password, hash);
console.log('Verificación:', isValid ? '✅ CORRECTO' : '❌ FALLO');

console.log('\n=== SQL para Supabase ===');
console.log(`UPDATE usuarios SET password_hash = '${hash}', activo = true WHERE codigo_asesor = 'ADMIN';`);
