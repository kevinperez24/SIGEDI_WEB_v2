import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { afterEach, describe, test } from 'node:test'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AuthRepository } from '../auth/auth.repository.ts'
import { AuthService } from '../auth/auth.service.ts'
import type { AuthResult, DatabaseUser } from '../auth/auth.types.ts'
import { DatabaseConnectionError } from '../database/errors.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDetail,
  DonationListItem,
} from '../donativos/donativo.types.ts'
import type {
  CreatedDonationDocument,
  DonationDocumentItem,
  DonationDocumentUpload,
} from '../donativos/donativo-document.types.ts'
import type { DonationDocumentRepository } from '../donativos/donativo-document.repository.ts'
import { DonationDocumentService } from '../donativos/donativo-document.service.ts'
import type { DownloadedDonationDocument } from '../donativos/donativo-document.service.ts'
import { createRequestHandler } from '../http/app.ts'

const servers: ReturnType<typeof createServer>[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
        }),
    ),
  )
})

function makeUser(overrides: Partial<DatabaseUser> = {}): DatabaseUser {
  return {
    id: 'usuarios:test',
    usuario: 'usuario.prueba',
    nombres: 'Usuario',
    apellidos: 'Prueba',
    correo: 'usuario.prueba@example.invalid',
    roles: ['CONSULTA'],
    estado: 'ACTIVO',
    intentos_fallidos: 0,
    ultimo_login: null,
    bloqueo_hasta: null,
    cambio_password_requerido: false,
    password_correcta: true,
    ...overrides,
  }
}

class FakeRepository implements AuthRepository {
  failedAttempts = 0
  successfulLogins = 0

  constructor(private readonly user: DatabaseUser | null) {}

  async findUserAndVerifyPassword(): Promise<DatabaseUser | null> {
    return this.user
  }

  async recordFailedAttempt(): Promise<void> {
    this.failedAttempts += 1
  }

  async recordSuccessfulLogin(): Promise<void> {
    this.successfulLogins += 1
  }
}

type TestServerOverrides = {
  resolveSession?: (token: string) => string | null
  createDonation?: (
    createdBy: string,
    input: DonationCreateInput,
  ) => Promise<CreatedDonation>
  listDonations?: () => Promise<DonationListItem[]>
  createDonationDocument?: (
    donativoId: string,
    createdBy: string,
    upload: DonationDocumentUpload,
  ) => Promise<CreatedDonationDocument>
  getDonation?: (donativoId: string) => Promise<DonationDetail | null>
  updateDonation?: (
    donativoId: string,
    updatedBy: string,
    input: DonationCreateInput,
  ) => Promise<DonationDetail | null>
  listDonationDocuments?: (donativoId: string) => Promise<DonationDocumentItem[]>
  downloadDonationDocument?: (
    donativoId: string,
    documentId: string,
  ) => Promise<DownloadedDonationDocument>
  deleteDonationDocument?: (
    donativoId: string,
    documentId: string,
    updatedBy: string,
  ) => Promise<void>
}

async function startTestServer(
  authenticate: (user: string, password: string) => Promise<AuthResult>,
  overrides: TestServerOverrides = {},
) {
  const server = createServer(
    createRequestHandler({
      authenticate,
      allowedOrigin: 'http://localhost:5173',
      createSession: (userId) => `session-for-${userId}`,
      resolveSession: overrides.resolveSession ?? (() => null),
      createDonation:
        overrides.createDonation ??
        (async () => {
          throw new Error('No debe ejecutarse')
        }),
      listDonations: overrides.listDonations ?? (async () => []),
      createDonationDocument:
        overrides.createDonationDocument ??
        (async () => {
          throw new Error('No debe ejecutarse')
        }),
      getDonation: overrides.getDonation ?? (async () => null),
      updateDonation: overrides.updateDonation ?? (async () => null),
      listDonationDocuments: overrides.listDonationDocuments ?? (async () => []),
      downloadDonationDocument: overrides.downloadDonationDocument ?? (async () => {
        throw new Error('No debe ejecutarse')
      }),
      deleteDonationDocument: overrides.deleteDonationDocument ?? (async () => {
        throw new Error('No debe ejecutarse')
      }),
    }),
  )
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}`
}

describe('AuthService', () => {
  test('incrementa intentos fallidos y no registra éxito con contraseña incorrecta', async () => {
    const repository = new FakeRepository(makeUser({ password_correcta: false }))
    const service = new AuthService(repository)

    const result = await service.authenticate('usuario.prueba', 'incorrecta')

    assert.deepEqual(result, { ok: false, reason: 'WRONG_PASSWORD' })
    assert.equal(repository.failedAttempts, 1)
    assert.equal(repository.successfulLogins, 0)
  })

  test('restablece intentos y registra el login correcto sin datos sensibles', async () => {
    const repository = new FakeRepository(makeUser())
    const service = new AuthService(repository)

    const result = await service.authenticate('usuario.prueba', 'correcta')

    assert.equal(result.ok, true)
    assert.equal(repository.failedAttempts, 0)
    assert.equal(repository.successfulLogins, 1)
    assert.equal('password_hash' in result, false)
  })

  test('distingue usuario inexistente, inactivo y bloqueado', async () => {
    const missing = await new AuthService(new FakeRepository(null)).authenticate('x', 'x')
    const inactive = await new AuthService(
      new FakeRepository(makeUser({ estado: 'INACTIVO' })),
    ).authenticate('x', 'x')
    const blocked = await new AuthService(
      new FakeRepository(makeUser({ bloqueo_hasta: '2999-01-01T00:00:00Z' })),
    ).authenticate('x', 'x')

    assert.deepEqual(missing, { ok: false, reason: 'USER_NOT_FOUND' })
    assert.deepEqual(inactive, { ok: false, reason: 'USER_INACTIVE' })
    assert.deepEqual(blocked, { ok: false, reason: 'USER_BLOCKED' })
  })
})

describe('POST /api/donativos', () => {
  const validDonation = {
    tipo_registro: 'Donación',
    nombre_proyecto: 'Donativo de prueba',
    tipo_gestion: 'Ofrecimiento',
    dpto_seccion: '',
    fecha_recepcion: '2026-11-19',
    lugar_recepcion: 'Sede central',
    observaciones: '',
  }

  test('requiere una identidad autenticada', async () => {
    const baseUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))

    const response = await fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validDonation),
    })

    assert.equal(response.status, 401)
  })

  test('rechaza created_by enviado por el navegador', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      { resolveSession: () => 'usuarios:servidor' },
    )

    const response = await fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify({ ...validDonation, created_by: 'usuarios:navegador' }),
    })

    assert.equal(response.status, 400)
  })

  test('crea el borrador con la identidad resuelta por el backend', async () => {
    let receivedCreatedBy = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: (token) => (token === 'token-valido' ? 'usuarios:servidor' : null),
        createDonation: async (createdBy) => {
          receivedCreatedBy = createdBy
          return {
            id: 'donativos:prueba',
            estado: 'BORRADOR',
            correlativo_acta: null,
          }
        },
      },
    )

    const response = await fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify(validDonation),
    })

    assert.equal(response.status, 201)
    assert.equal(receivedCreatedBy, 'usuarios:servidor')
    assert.deepEqual(await response.json(), {
      ok: true,
      donativo: {
        id: 'donativos:prueba',
        estado: 'BORRADOR',
        correlativo_acta: null,
      },
    })
  })
})

describe('GET /api/donativos', () => {
  test('requiere una identidad autenticada', async () => {
    const baseUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))

    const response = await fetch(`${baseUrl}/api/donativos`)

    assert.equal(response.status, 401)
  })

  test('devuelve exclusivamente el listado seguro', async () => {
    const donation: DonationListItem = {
      id: 'donativos:prueba',
      correlativo_acta: null,
      nombre_proyecto: 'Donativo de prueba',
      tipo_gestion: 'Ofrecimiento',
      dpto_seccion: null,
      fecha_recepcion: '2026-11-19T00:00:00.000Z',
      lugar_recepcion: 'Sede central',
      estado: 'BORRADOR',
      created_at: '2026-11-19T15:00:00.000Z',
    }
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listDonations: async () => [donation],
      },
    )

    const response = await fetch(`${baseUrl}/api/donativos`, {
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, donativos: [donation] })
  })
})

describe('consulta y edición de donativos', () => {
  const detail: DonationDetail = {
    id: 'donativos:prueba',
    correlativo_acta: null,
    estado: 'BORRADOR',
    tipo_registro: 'Donación',
    nombre_proyecto: 'Donativo de prueba',
    tipo_gestion: 'Ofrecimiento',
    dpto_seccion: null,
    fecha_recepcion: '2026-11-19T00:00:00.000Z',
    lugar_recepcion: 'Sede central',
    observaciones: null,
    created_by: 'usuarios:creador',
    created_by_name: 'Usuario Creador',
    created_at: '2026-11-19T10:00:00.000Z',
    updated_by: null,
    updated_at: '2026-11-19T10:00:00.000Z',
  }

  test('GET devuelve el detalle y documentos activos', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        getDonation: async () => detail,
        listDonationDocuments: async () => [],
      },
    )

    const response = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba`, {
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, donativo: detail, documentos: [] })
  })

  test('PATCH usa updated_by de la sesión y rechaza campos protegidos', async () => {
    let receivedUpdatedBy = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        updateDonation: async (_id, updatedBy) => {
          receivedUpdatedBy = updatedBy
          return { ...detail, updated_by: updatedBy }
        },
      },
    )
    const validBody = {
      tipo_registro: detail.tipo_registro,
      nombre_proyecto: detail.nombre_proyecto,
      tipo_gestion: detail.tipo_gestion,
      dpto_seccion: '',
      fecha_recepcion: '2026-11-19',
      lugar_recepcion: detail.lugar_recepcion,
      observaciones: '',
    }
    const updated = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify(validBody),
    })
    const rejected = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify({ ...validBody, updated_by: 'usuarios:navegador' }),
    })

    assert.equal(updated.status, 200)
    assert.equal(receivedUpdatedBy, 'usuarios:servidor')
    assert.equal(rejected.status, 400)
  })
})

describe('POST /api/donativos/:id/documentos', () => {
  function validDocumentForm(): FormData {
    const formData = new FormData()
    formData.set('tipo_documento', 'MEMO_INICIAL')
    formData.set(
      'archivo',
      new File([Buffer.from('%PDF-1.7 prueba')], 'memorandum.pdf', {
        type: 'application/pdf',
      }),
    )
    return formData
  }

  test('requiere una identidad autenticada', async () => {
    const baseUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))

    const response = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba/documentos`, {
      method: 'POST',
      body: validDocumentForm(),
    })

    assert.equal(response.status, 401)
  })

  test('usa la identidad del backend y devuelve 201', async () => {
    let receivedCreatedBy = ''
    let receivedDonationId = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        createDonationDocument: async (donativoId, createdBy) => {
          receivedCreatedBy = createdBy
          receivedDonationId = donativoId
          return {
            id: 'donativo_documentos:prueba',
            tipo_documento: 'MEMO_INICIAL',
            nombre_archivo: 'memorandum.pdf',
            estado: 'ACTIVO',
          }
        },
      },
    )

    const fullRecordId = `donativos:${String.fromCodePoint(0x27e8)}4cn2d8afb6mnmtsmhd01${String.fromCodePoint(0x27e9)}`
    const response = await fetch(
      `${baseUrl}/api/donativos/${encodeURIComponent(fullRecordId)}/documentos`,
      {
      method: 'POST',
      headers: { Authorization: 'Bearer token-valido' },
      body: validDocumentForm(),
      },
    )

    assert.equal(response.status, 201)
    assert.equal(receivedCreatedBy, 'usuarios:servidor')
    assert.equal(receivedDonationId, fullRecordId)
  })

  test('rechaza created_by enviado por el navegador', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      { resolveSession: () => 'usuarios:servidor' },
    )
    const formData = validDocumentForm()
    formData.set('created_by', 'usuarios:navegador')

    const response = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba/documentos`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-valido' },
      body: formData,
    })

    assert.equal(response.status, 400)
  })
})

describe('consulta y eliminación documental', () => {
  test('descarga autenticada y elimina con identidad del backend', async () => {
    let deletedBy = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        downloadDonationDocument: async () => ({
          contents: Buffer.from('%PDF-1.7 prueba'),
          name: 'memorandum.pdf',
          mimeType: 'application/pdf',
        }),
        deleteDonationDocument: async (_donativoId, _documentId, updatedBy) => {
          deletedBy = updatedBy
        },
      },
    )
    const url = `${baseUrl}/api/donativos/donativos%3Aprueba/documentos/donativo_documentos%3Aprueba`
    const downloaded = await fetch(url, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    const deleted = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(downloaded.status, 200)
    assert.equal(downloaded.headers.get('content-type'), 'application/pdf')
    assert.equal(deleted.status, 200)
    assert.equal(deletedBy, 'usuarios:servidor')
  })
})

describe('DonationDocumentService', () => {
  test('guarda el archivo con nombre único, ruta relativa y metadatos seguros', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-document-'))
    let storedMetadata: Parameters<DonationDocumentRepository['create']>[0] | undefined
    const repository: DonationDocumentRepository = {
      donationExists: async () => true,
      documentExists: async () => false,
      create: async (metadata) => {
        storedMetadata = metadata
        return {
          id: 'donativo_documentos:prueba',
          tipo_documento: metadata.tipoDocumento,
          nombre_archivo: metadata.originalName,
          estado: 'ACTIVO',
        }
      },
      listActive: async () => [],
      findActiveFile: async () => null,
      logicalDelete: async () => false,
    }
    const contents = Buffer.from('%PDF-1.7 documento de prueba')

    try {
      const result = await new DonationDocumentService(repository, temporaryStorage).save(
        `donativos:${String.fromCodePoint(0x27e8)}4cn2d8afb6mnmtsmhd01${String.fromCodePoint(0x27e9)}`,
        'usuarios:servidor',
        {
          tipoDocumento: 'MEMO_INICIAL',
          originalName: 'memorandum.pdf',
          mimeType: 'application/pdf',
          contents,
        },
      )

      assert.equal(result.estado, 'ACTIVO')
      assert.equal(storedMetadata?.createdBy, 'usuarios:servidor')
      assert.match(storedMetadata?.storedName ?? '', /^memo_inicial_[\w-]+\.pdf$/)
      assert.match(
        storedMetadata?.relativePath ?? '',
        /^donativos\/4cn2d8afb6mnmtsmhd01\/memo_inicial_[\w-]+\.pdf$/,
      )
      assert.deepEqual(
        await readFile(
          join(temporaryStorage, '4cn2d8afb6mnmtsmhd01', storedMetadata?.storedName ?? ''),
        ),
        contents,
      )
    } finally {
      await rm(temporaryStorage, { recursive: true, force: true })
    }
  })
})

describe('POST /api/auth/login', () => {
  test('devuelve 400 para datos faltantes', async () => {
    const baseUrl = await startTestServer(async () => {
      throw new Error('No debe ejecutarse')
    })

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: '' }),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { ok: false, message: 'Datos de acceso inválidos.' })
  })

  test('devuelve el mismo 401 para cualquier rechazo de credenciales', async () => {
    const baseUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: ' inexistente ', password: 'incorrecta' }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      ok: false,
      message: 'Usuario o contraseña incorrectos.',
    })
  })

  test('devuelve 503 sin detalles internos cuando la base no está disponible', async () => {
    const baseUrl = await startTestServer(async () => {
      throw new DatabaseConnectionError()
    })

    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: 'usuario.prueba', password: 'secreto-de-prueba' }),
    })

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      ok: false,
      message: 'No fue posible iniciar sesión en este momento.',
    })
  })

  test('limita CORS al frontend local configurado', async () => {
    const baseUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))

    const allowed = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:5173' },
    })
    const denied = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://example.invalid' },
    })

    assert.equal(allowed.status, 204)
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://localhost:5173')
    assert.equal(denied.status, 403)
  })
})
