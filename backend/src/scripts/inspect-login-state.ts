import { closeSurreal, getSurreal } from '../database/surreal.ts'

const username = process.argv[2]?.trim()

if (!username) {
  console.error('Debe indicar el usuario que se validará.')
  process.exitCode = 1
} else {
  try {
    const database = await getSurreal()
    const [rows] = await database.query<[Array<Record<string, unknown>>]>(
      `
        SELECT
          estado,
          intentos_fallidos,
          ultimo_login,
          bloqueo_hasta,
          cambio_password_requerido
        FROM usuarios
        WHERE usuario = $usuario
        LIMIT 1;
      `,
      { usuario: username },
    )

    const row = rows[0]
    console.log(
      JSON.stringify(
        row
          ? {
              found: true,
              estado: row.estado,
              intentos_fallidos: row.intentos_fallidos,
              ultimo_login: row.ultimo_login,
              bloqueo_configurado: row.bloqueo_hasta !== null && row.bloqueo_hasta !== undefined,
              cambio_password_requerido: row.cambio_password_requerido,
            }
          : { found: false },
      ),
    )
  } catch {
    console.error('No fue posible validar el estado del login.')
    process.exitCode = 1
  } finally {
    await closeSurreal()
  }
}
