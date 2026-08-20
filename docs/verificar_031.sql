-- ============================================================================
-- VERIFICACIÓN MIGRACIÓN 031 — una sola consulta, un solo resultado
-- Todas las filas deben salir con ok = '✅'
-- ============================================================================
WITH c AS (
  SELECT 1 AS n, 'tablas nuevas creadas' AS chequeo,
    (SELECT count(*)::text FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('marcaciones_raw','usuarios_whatsapp','wa_conversaciones_dm')) AS resultado,
    '3' AS esperado
  UNION ALL SELECT 2, 'FK usuarios_whatsapp.usuario_id',
    COALESCE((SELECT con.confrelid::regclass::text FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.conrelid = to_regclass('public.usuarios_whatsapp')
        AND con.contype = 'f' AND a.attname = 'usuario_id'), '(falta)'),
    'usuarios_rrhh'
  UNION ALL SELECT 3, 'FK marcaciones_raw.usuario_id_resuelto',
    COALESCE((SELECT con.confrelid::regclass::text FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
      WHERE con.conrelid = to_regclass('public.marcaciones_raw')
        AND con.contype = 'f' AND a.attname = 'usuario_id_resuelto'), '(falta)'),
    'usuarios_rrhh'
  UNION ALL SELECT 4, 'asistencia.tipo ampliado',
    COALESCE((SELECT character_maximum_length::text FROM information_schema.columns
      WHERE table_name = 'asistencia' AND column_name = 'tipo'), '(falta)'),
    '20'
  UNION ALL SELECT 5, 'asistencia: 11 columnas nuevas',
    (SELECT count(*)::text FROM information_schema.columns
      WHERE table_name = 'asistencia' AND column_name IN (
        'origen','marcacion_raw_id','wa_message_id','wa_remitente_jid','caption_original',
        'app_detectada','ai_extraccion','ai_confianza','motivos_observacion',
        'notificado_at','reenvio_de_id')),
    '11'
  UNION ALL SELECT 6, 'CHECK asistencia.tipo con REFRIGERIO',
    (SELECT (count(*) > 0)::text FROM pg_constraint
      WHERE conname = 'asistencia_tipo_check'
        AND pg_get_constraintdef(oid) LIKE '%REFRIGERIO_INICIO%'
        AND pg_get_constraintdef(oid) LIKE '%REFRIGERIO_FIN%'),
    'true'
  UNION ALL SELECT 7, 'CHECK alertas_rrhh.tipo con 6 tipos nuevos',
    (SELECT (count(*) > 0)::text FROM pg_constraint
      WHERE conname = 'alertas_rrhh_tipo_check'
        AND pg_get_constraintdef(oid) LIKE '%TIENDA_SIN_APERTURA%'
        AND pg_get_constraintdef(oid) LIKE '%WHATSAPP_DESCONECTADO%'),
    'true'
  UNION ALL SELECT 8, 'system_config categoria asistencia',
    (SELECT count(*)::text FROM system_config WHERE category = 'asistencia'), '11'
  UNION ALL SELECT 9, 'modo sombra activo (dm_habilitado)',
    COALESCE((SELECT value FROM system_config WHERE key = 'asistencia.dm_habilitado'), '(falta)'),
    'false'
  UNION ALL SELECT 10, 'bucket asistencia privado',
    COALESCE((SELECT (public = false)::text FROM storage.buckets WHERE id = 'asistencia'), '(falta)'),
    'true'
  UNION ALL SELECT 11, 'RLS deshabilitado en las 3 tablas',
    (SELECT count(*)::text FROM pg_class
      WHERE relname IN ('marcaciones_raw','usuarios_whatsapp','wa_conversaciones_dm')
        AND relnamespace = 'public'::regnamespace AND relrowsecurity = false),
    '3'
  UNION ALL SELECT 12, 'indices creados',
    (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND indexname IN (
      'idx_marcaciones_raw_wa_message','idx_marcaciones_raw_estado','idx_marcaciones_raw_remitente',
      'idx_marcaciones_raw_media_hash','idx_marcaciones_raw_grupo_fecha','idx_marcaciones_raw_usuario',
      'idx_usuarios_whatsapp_jid','idx_usuarios_whatsapp_lid','idx_usuarios_whatsapp_telefono',
      'idx_usuarios_whatsapp_usuario','idx_usuarios_whatsapp_activo',
      'idx_wa_conversaciones_dm_jid','idx_wa_conversaciones_dm_estado',
      'idx_asistencia_wa_message','idx_asistencia_origen_fecha','idx_asistencia_marcacion_raw',
      'idx_asistencia_observadas')),
    '17'
  UNION ALL SELECT 13, 'triggers updated_at',
    (SELECT count(*)::text FROM pg_trigger
      WHERE tgname = 'set_updated_at' AND NOT tgisinternal
        AND tgrelid IN (to_regclass('public.usuarios_whatsapp'), to_regclass('public.wa_conversaciones_dm'))),
    '2'
)
SELECT n AS "#", chequeo, resultado, esperado,
       CASE WHEN resultado = esperado THEN '✅' ELSE '❌ REVISAR' END AS ok
FROM c ORDER BY n;
