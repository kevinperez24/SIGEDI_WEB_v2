import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
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
import type { DonationRepository } from '../donativos/donativo.repository.ts'
import {
  DonationDeletionError,
  DonationDeletionNotFoundError,
  DonationDeletionValidationError,
  DonationService,
} from '../donativos/donativo.service.ts'
import type {
  CreatedDonationDocument,
  DonationDocumentItem,
  DonationDocumentType,
  DonationDocumentUpload,
} from '../donativos/donativo-document.types.ts'
import type { DonationDocumentRepository } from '../donativos/donativo-document.repository.ts'
import {
  DonationDocumentService,
  DonationDocumentValidationError,
} from '../donativos/donativo-document.service.ts'
import type { DownloadedDonationDocument } from '../donativos/donativo-document.service.ts'
import type { DonationActaRepository } from '../donativos/donativo-acta.repository.ts'
import { DonationActaService, DonationActaValidationError } from '../donativos/donativo-acta.service.ts'
import type { DonationActaSummary, DownloadedDonationActa } from '../donativos/donativo-acta.types.ts'
import type { ReceptionPlace } from '../catalogos/lugar-recepcion.repository.ts'
import type { UpcRepresentative } from '../catalogos/representante-upc.repository.ts'
import type { Section5CatalogItem } from '../catalogos/seccion5.repository.ts'
import type { CityCatalogItem } from '../catalogos/ciudad.repository.ts'
import type { ConapinaReceptionManager } from '../catalogos/encargado-conapina.repository.ts'
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
  createDonationActa?: (
    donativoId: string,
    createdBy: string,
  ) => Promise<DonationActaSummary>
  getActiveDonationActa?: (donativoId: string) => Promise<DonationActaSummary | null>
  downloadDonationActa?: (donativoId: string) => Promise<DownloadedDonationActa>
  listReceptionPlaces?: () => Promise<ReceptionPlace[]>
  validateReceptionPlaces?: (ids: string[]) => Promise<boolean>
  listUpcRepresentatives?: () => Promise<UpcRepresentative[]>
  validateUpcRepresentative?: (id: string) => Promise<boolean>
  listSafekeepingWarehouses?: () => Promise<Section5CatalogItem[]>
  validateSafekeepingWarehouse?: (id: string) => Promise<boolean>
  listDistributionPlaces?: () => Promise<Section5CatalogItem[]>
  validateDistributionPlaces?: (ids: string[]) => Promise<boolean>
  listDestinationWarehouses?: () => Promise<Section5CatalogItem[]>
  validateDestinationWarehouse?: (id: string) => Promise<boolean>
  listCities?: () => Promise<CityCatalogItem[]>
  validateCity?: (id: string) => Promise<boolean>
  listConapinaReceptionManagers?: () => Promise<ConapinaReceptionManager[]>
  findConapinaReceptionManager?: (id: string) => Promise<ConapinaReceptionManager | null>
  deleteDonation?: (donativoId: string) => Promise<unknown>
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
      createDonationActa: overrides.createDonationActa ?? (async () => {
        throw new Error('No debe ejecutarse')
      }),
      getActiveDonationActa: overrides.getActiveDonationActa ?? (async () => null),
      downloadDonationActa: overrides.downloadDonationActa ?? (async () => {
        throw new Error('No debe ejecutarse')
      }),
      listReceptionPlaces: overrides.listReceptionPlaces ?? (async () => []),
      validateReceptionPlaces: overrides.validateReceptionPlaces ?? (async () => true),
      listUpcRepresentatives: overrides.listUpcRepresentatives ?? (async () => []),
      validateUpcRepresentative: overrides.validateUpcRepresentative ?? (async () => true),
      listSafekeepingWarehouses: overrides.listSafekeepingWarehouses ?? (async () => []),
      validateSafekeepingWarehouse: overrides.validateSafekeepingWarehouse ?? (async () => true),
      listDistributionPlaces: overrides.listDistributionPlaces ?? (async () => []),
      validateDistributionPlaces: overrides.validateDistributionPlaces ?? (async () => true),
      listDestinationWarehouses: overrides.listDestinationWarehouses ?? (async () => []),
      validateDestinationWarehouse: overrides.validateDestinationWarehouse ?? (async () => true),
      listCities: overrides.listCities ?? (async () => []),
      validateCity: overrides.validateCity ?? (async () => true),
      listConapinaReceptionManagers: overrides.listConapinaReceptionManagers ?? (async () => []),
      findConapinaReceptionManager:
        overrides.findConapinaReceptionManager ??
        (async (id) => ({
          id,
          nombre: 'María Encargada',
          cargo: 'Técnica de recepción',
        })),
      deleteDonation: overrides.deleteDonation ?? (async () => {
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
    lugar_recepcion: ['catalogo_lugares_recepcion:21'],
    observaciones: '',
    representante_upc: 'catalogo_representantes_upc:4',
    n_comprobante: 'GF-2026-001',
    fecha_comprobante: '2026-11-20',
    almacen_resguardo: 'catalogo_almacenes_resguardo:1',
    lugar_distribucion: [
      'catalogo_lugares_distribucion:35',
      'catalogo_lugares_distribucion:73',
    ],
    fechareport_financiero: '2026-11-22',
    almacen_destino: 'catalogo_almacenes_destino:50',
    marco_acta: 'Marco institucional',
    objetivo_acta: 'Documentar la entrega',
    entregados_acta: 'Bienes detallados',
    entrega_acta: 'Entrega a la institución',
    ciudad: 'catalogo_ciudades_departamentos:126',
    nombre_donante: 'Ana Pérez',
    cargo_donante: 'Representante',
    nombre_entidad: 'Entidad donante',
    dui_donante: '00000000-0',
    encargado_personal_id: 'Personal:126',
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
    let receivedRepresentative = ''
    let receivedReceptionPlaces: string[] = []
    let receivedReceiptNumber = ''
    let receivedReceiptDate = ''
    let receivedSafekeepingWarehouse = ''
    let receivedDistributionPlaces: string[] = []
    let receivedFinancialReportDate = ''
    let receivedDestinationWarehouse = ''
    let receivedRecordFramework = ''
    let receivedRecordObjective = ''
    let receivedRecordDelivered = ''
    let receivedRecordDelivery = ''
    let receivedCity = ''
    let receivedDonorName = ''
    let receivedDonorPosition = ''
    let receivedDonorEntity = ''
    let receivedDonorDui = ''
    let receivedReceptionManagerName = ''
    let receivedReceptionManagerPosition = ''
    let receivedReceptionManagerId = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: (token) => (token === 'token-valido' ? 'usuarios:servidor' : null),
        createDonation: async (createdBy, input) => {
          receivedCreatedBy = createdBy
          receivedRepresentative = input.representante_upc
          receivedReceptionPlaces = input.lugar_recepcion
          receivedReceiptNumber = input.n_comprobante
          receivedReceiptDate = input.fecha_comprobante
          receivedSafekeepingWarehouse = input.almacen_resguardo
          receivedDistributionPlaces = input.lugar_distribucion
          receivedFinancialReportDate = input.fechareport_financiero
          receivedDestinationWarehouse = input.almacen_destino
          receivedRecordFramework = input.marco_acta
          receivedRecordObjective = input.objetivo_acta
          receivedRecordDelivered = input.entregados_acta
          receivedRecordDelivery = input.entrega_acta
          receivedCity = input.ciudad
          receivedDonorName = input.nombre_donante
          receivedDonorPosition = input.cargo_donante
          receivedDonorEntity = input.nombre_entidad
          receivedDonorDui = input.dui_donante
          receivedReceptionManagerName = input.nombre_encargado
          receivedReceptionManagerPosition = input.cargo_encargado
          receivedReceptionManagerId = input.encargado_personal_id
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
    assert.equal(receivedRepresentative, 'catalogo_representantes_upc:4')
    assert.deepEqual(receivedReceptionPlaces, ['catalogo_lugares_recepcion:21'])
    assert.equal(receivedReceiptNumber, 'GF-2026-001')
    assert.equal(receivedReceiptDate, '2026-11-20')
    assert.equal(receivedSafekeepingWarehouse, 'catalogo_almacenes_resguardo:1')
    assert.deepEqual(receivedDistributionPlaces, [
      'catalogo_lugares_distribucion:35',
      'catalogo_lugares_distribucion:73',
    ])
    assert.equal(receivedFinancialReportDate, '2026-11-22')
    assert.equal(receivedDestinationWarehouse, 'catalogo_almacenes_destino:50')
    assert.equal(receivedRecordFramework, 'Marco institucional')
    assert.equal(receivedRecordObjective, 'Documentar la entrega')
    assert.equal(receivedRecordDelivered, 'Bienes detallados')
    assert.equal(receivedRecordDelivery, 'Entrega a la institución')
    assert.equal(receivedCity, 'catalogo_ciudades_departamentos:126')
    assert.equal(receivedDonorName, 'Ana Pérez')
    assert.equal(receivedDonorPosition, 'Representante')
    assert.equal(receivedDonorEntity, 'Entidad donante')
    assert.equal(receivedDonorDui, '00000000-0')
    assert.equal(receivedReceptionManagerName, 'María Encargada')
    assert.equal(receivedReceptionManagerPosition, 'Técnica de recepción')
    assert.equal(receivedReceptionManagerId, 'Personal:126')
    assert.deepEqual(await response.json(), {
      ok: true,
      donativo: {
        id: 'donativos:prueba',
        estado: 'BORRADOR',
        correlativo_acta: null,
      },
    })
  })

  test('rechaza acta_conapina dentro del JSON del donativo', async () => {
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
      body: JSON.stringify({ ...validDonation, acta_conapina: 'archivo.pdf' }),
    })

    assert.equal(response.status, 400)
  })

  test('rechaza una fecha de reporte financiero inválida', async () => {
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
      body: JSON.stringify({ ...validDonation, fechareport_financiero: '2026-02-30' }),
    })

    assert.equal(response.status, 400)
  })

  test('rechaza lugar_recepcion string, arreglos vacíos y catálogos inactivos', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        validateReceptionPlaces: async () => false,
      },
    )
    const request = (lugar_recepcion: unknown) =>
      fetch(`${baseUrl}/api/donativos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido',
        },
        body: JSON.stringify({ ...validDonation, lugar_recepcion }),
      })

    assert.equal((await request('Sede central')).status, 400)
    assert.equal((await request([])).status, 400)
    assert.equal(
      (await request(['catalogo_lugares_recepcion:inactivo'])).status,
      400,
    )
  })

  test('rechaza representantes UPC inexistentes, inactivos o de otra tabla', async () => {
    const receivedIds: string[] = []
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        validateUpcRepresentative: async (id) => {
          receivedIds.push(id)
          return false
        },
      },
    )

    for (const representante_upc of [
      'catalogo_representantes_upc:inactivo',
      'usuarios:4',
    ]) {
      const response = await fetch(`${baseUrl}/api/donativos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido',
        },
        body: JSON.stringify({ ...validDonation, representante_upc }),
      })
      assert.equal(response.status, 400)
    }
    assert.deepEqual(receivedIds, [
      'catalogo_representantes_upc:inactivo',
      'usuarios:4',
    ])
  })

  test('rechaza catálogos inválidos de la Sección 5', async () => {
    const requests: [Partial<typeof validDonation>, TestServerOverrides][] = [
      [
        { almacen_resguardo: 'catalogo_almacenes_resguardo:inactivo' },
        { validateSafekeepingWarehouse: async () => false },
      ],
      [
        { lugar_distribucion: ['catalogo_lugares_distribucion:inactivo'] },
        { validateDistributionPlaces: async () => false },
      ],
      [
        { almacen_destino: 'catalogo_almacenes_destino:inactivo' },
        { validateDestinationWarehouse: async () => false },
      ],
    ]

    for (const [values, validators] of requests) {
      const baseUrl = await startTestServer(
        async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
        { resolveSession: () => 'usuarios:servidor', ...validators },
      )
      const response = await fetch(`${baseUrl}/api/donativos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-valido',
        },
        body: JSON.stringify({ ...validDonation, ...values }),
      })
      assert.equal(response.status, 400)
    }
  })

  test('rechaza ciudad inactiva y departamento enviado por el navegador', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        validateCity: async () => false,
      },
    )
    const request = (body: unknown) => fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify(body),
    })

    assert.equal((await request(validDonation)).status, 400)
    assert.equal(
      (await request({ ...validDonation, departamento: 'San Salvador' })).status,
      400,
    )
  })

  test('acepta Sección 8 vacía y rechaza DUI con formato inválido', async () => {
    let emptySectionReceived = false
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        createDonation: async (_createdBy, input) => {
          emptySectionReceived =
            input.nombre_donante === '' &&
            input.cargo_donante === '' &&
            input.nombre_entidad === '' &&
            input.dui_donante === ''
          return { id: 'donativos:vacio', estado: 'BORRADOR', correlativo_acta: null }
        },
      },
    )
    const request = (section8: Record<string, string>) => fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-valido',
      },
      body: JSON.stringify({ ...validDonation, ...section8 }),
    })

    const emptyResponse = await request({
      nombre_donante: '', cargo_donante: '', nombre_entidad: '', dui_donante: '',
    })
    const invalidResponse = await request({ dui_donante: '1234567-8' })

    assert.equal(emptyResponse.status, 201)
    assert.equal(emptySectionReceived, true)
    assert.equal(invalidResponse.status, 400)
  })

  test('acepta Sección 9 vacía y rechaza nombre o cargo enviados por el navegador', async () => {
    let receivedName = 'sin recibir'
    let receivedPosition = 'sin recibir'
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        createDonation: async (_createdBy, input) => {
          receivedName = input.nombre_encargado
          receivedPosition = input.cargo_encargado
          return { id: 'donativos:seccion9', estado: 'BORRADOR', correlativo_acta: null }
        },
      },
    )

    const emptyResponse = await fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-valido' },
      body: JSON.stringify({ ...validDonation, encargado_personal_id: '' }),
    })
    const untrustedResponse = await fetch(`${baseUrl}/api/donativos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token-valido' },
      body: JSON.stringify({ ...validDonation, nombre_encargado: 'Nombre falso' }),
    })

    assert.equal(emptyResponse.status, 201)
    assert.equal(receivedName, '')
    assert.equal(receivedPosition, '')
    assert.equal(untrustedResponse.status, 400)
  })
})

describe('GET /api/catalogos/lugares-recepcion', () => {
  const places: ReceptionPlace[] = [
    { id: 'catalogo_lugares_recepcion:21', codigo: '021', nombre: 'Sede central' },
    { id: 'catalogo_lugares_recepcion:26', codigo: '026', nombre: 'Sede regional' },
  ]

  test('requiere sesión y devuelve el catálogo activo', async () => {
    const unauthenticatedUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))
    const unauthorized = await fetch(
      `${unauthenticatedUrl}/api/catalogos/lugares-recepcion`,
    )
    assert.equal(unauthorized.status, 401)

    const authenticatedUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listReceptionPlaces: async () => places,
      },
    )
    const response = await fetch(`${authenticatedUrl}/api/catalogos/lugares-recepcion`, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, lugares: places })
  })
})

describe('GET /api/catalogos/representantes-upc', () => {
  const representatives: UpcRepresentative[] = [
    { id: 'catalogo_representantes_upc:4', codigo: '004', nombre: 'Representante A' },
    { id: 'catalogo_representantes_upc:5', codigo: '005', nombre: 'Representante B' },
  ]

  test('requiere sesión y devuelve el catálogo activo', async () => {
    const unauthenticatedUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))
    const unauthorized = await fetch(
      `${unauthenticatedUrl}/api/catalogos/representantes-upc`,
    )
    assert.equal(unauthorized.status, 401)

    const authenticatedUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listUpcRepresentatives: async () => representatives,
      },
    )
    const response = await fetch(`${authenticatedUrl}/api/catalogos/representantes-upc`, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, representantes: representatives })
  })
})

describe('catálogos de la Sección 5', () => {
  const items: Section5CatalogItem[] = [
    { id: 'catalogo_prueba:1', codigo: '001', nombre: 'Opción uno' },
    { id: 'catalogo_prueba:2', codigo: '002', nombre: 'Opción dos' },
  ]

  test('devuelve los tres catálogos autenticados', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listSafekeepingWarehouses: async () => items,
        listDistributionPlaces: async () => items,
        listDestinationWarehouses: async () => items,
      },
    )

    const headers = { Authorization: 'Bearer token-valido' }
    const safekeeping = await fetch(`${baseUrl}/api/catalogos/almacenes-resguardo`, { headers })
    const distribution = await fetch(`${baseUrl}/api/catalogos/lugares-distribucion`, { headers })
    const destination = await fetch(`${baseUrl}/api/catalogos/almacenes-destino`, { headers })

    assert.deepEqual(await safekeeping.json(), { ok: true, almacenes: items })
    assert.deepEqual(await distribution.json(), { ok: true, lugares: items })
    assert.deepEqual(await destination.json(), { ok: true, almacenes: items })
  })
})

describe('GET /api/catalogos/ciudades', () => {
  test('requiere sesión y devuelve ciudades activas', async () => {
    const ciudades: CityCatalogItem[] = [
      {
        id: 'catalogo_ciudades_departamentos:126',
        codigo: '126',
        ciudad: 'Apopa',
        departamento: 'San Salvador',
      },
    ]
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listCities: async () => ciudades,
      },
    )

    const response = await fetch(`${baseUrl}/api/catalogos/ciudades`, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, ciudades })
  })
})

describe('GET /api/catalogos/encargados-conapina', () => {
  test('requiere sesión y devuelve únicamente id, nombre y cargo', async () => {
    const encargados: ConapinaReceptionManager[] = [
      { id: 'Personal:126', nombre: 'María Encargada', cargo: 'Técnica de recepción' },
    ]
    const unauthenticatedUrl = await startTestServer(async () => ({
      ok: false,
      reason: 'USER_NOT_FOUND',
    }))
    assert.equal(
      (await fetch(`${unauthenticatedUrl}/api/catalogos/encargados-conapina`)).status,
      401,
    )

    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listConapinaReceptionManagers: async () => encargados,
      },
    )
    const response = await fetch(`${baseUrl}/api/catalogos/encargados-conapina`, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true, encargados })
  })

  test('devuelve un error controlado si DBPersonal no está disponible', async () => {
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        listConapinaReceptionManagers: async () => {
          throw new DatabaseConnectionError()
        },
      },
    )
    const response = await fetch(`${baseUrl}/api/catalogos/encargados-conapina`, {
      headers: { Authorization: 'Bearer token-valido' },
    })
    const body = await response.json()
    assert.equal(response.status, 503)
    assert.deepEqual(body, {
      ok: false,
      message: 'No fue posible cargar el catálogo solicitado.',
    })
    assert.equal(JSON.stringify(body).includes('stack'), false)
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
      lugar_recepcion: [
        {
          id: 'catalogo_lugares_recepcion:21',
          codigo: '021',
          nombre: 'Sede central',
        },
      ],
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
    lugar_recepcion: [
      {
        id: 'catalogo_lugares_recepcion:21',
        codigo: '021',
        nombre: 'Sede central',
      },
    ],
    observaciones: null,
    representante_upc: {
      id: 'catalogo_representantes_upc:4',
      codigo: '004',
      nombre: 'Representante UPC',
    },
    n_comprobante: 'GF-2026-001',
    fecha_comprobante: '2026-11-20T00:00:00.000Z',
    almacen_resguardo: {
      id: 'catalogo_almacenes_resguardo:1',
      codigo: '001',
      nombre: 'Almacén central',
    },
    lugar_distribucion: [
      {
        id: 'catalogo_lugares_distribucion:35',
        codigo: '035',
        nombre: 'San Salvador',
      },
    ],
    fechareport_financiero: '2026-11-22T00:00:00.000Z',
    almacen_destino: {
      id: 'catalogo_almacenes_destino:50',
      codigo: '050',
      nombre: 'Almacén regional',
    },
    marco_acta: 'Marco institucional',
    objetivo_acta: 'Documentar la entrega',
    entregados_acta: 'Bienes detallados',
    entrega_acta: 'Entrega a la institución',
    ciudad: {
      id: 'catalogo_ciudades_departamentos:126',
      codigo: '126',
      ciudad: 'Apopa',
      departamento: 'San Salvador',
    },
    nombre_donante: 'Ana Pérez',
    cargo_donante: 'Representante',
    nombre_entidad: 'Entidad donante',
    dui_donante: '00000000-0',
    encargado_personal_id: 'Personal:126',
    nombre_encargado: 'María Encargada',
    cargo_encargado: 'Técnica de recepción',
    created_by: 'usuarios:creador',
    created_by_name: 'Usuario Creador',
    created_at: '2026-11-19T10:00:00.000Z',
    updated_by: null,
    updated_at: '2026-11-19T10:00:00.000Z',
  }

  test('GET devuelve el detalle y documentos activos', async () => {
    const acta: DonationDocumentItem = {
      id: 'donativo_documentos:acta',
      tipo_documento: 'ACTA_CONAPINA',
      nombre_archivo: 'acta-conapina.pdf',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      estado: 'ACTIVO',
      created_at: '2026-11-19T10:00:00.000Z',
    }
    const agreement: DonationDocumentItem = {
      ...acta,
      id: 'donativo_documentos:acuerdo',
      tipo_documento: 'ACUERDO_DONACION',
      nombre_archivo: 'acuerdo-donacion.pdf',
    }
    const receipt: DonationDocumentItem = {
      ...acta,
      id: 'donativo_documentos:comprobante',
      tipo_documento: 'COMPROBANTE_GF',
      nombre_archivo: 'comprobante-gf.pdf',
    }
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        getDonation: async () => detail,
        listDonationDocuments: async () => [acta, agreement, receipt],
      },
    )

    const response = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba`, {
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      donativo: detail,
      documentos: [acta, agreement, receipt],
      acta: null,
    })
  })

  test('genera un PDF privado y conserva versiones del acta', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-acta-'))
    const records: Array<DonationActaSummary & { ruta: string }> = []
    const repository: DonationActaRepository = {
      nextVersion: async () => records.length + 1,
      createVersion: async (metadata) => {
        for (const record of records) {
          if (record.estado === 'ACTIVA') {
            Object.assign(record, { estado: 'REEMPLAZADA' })
          }
        }
        const created: DonationActaSummary & { ruta: string } = {
          id: `donativo_actas:${metadata.version}`,
          version: metadata.version,
          estado: 'ACTIVA',
          nombre_archivo: metadata.originalName,
          ruta: metadata.relativePath,
        }
        records.push(created)
        return created
      },
      findActive: async () => records.find((record) => record.estado === 'ACTIVA') ?? null,
      findActiveFile: async () => {
        const record = records.find((item) => item.estado === 'ACTIVA')
        return record
          ? {
              nombre_archivo: record.nombre_archivo,
              ruta_archivo: record.ruta,
              mime_type: 'application/pdf',
            }
          : null
      },
    }
    const service = new DonationActaService(
      repository,
      async () => detail,
      join(temporaryStorage, 'donativos'),
      temporaryStorage,
    )

    try {
      const first = await service.generate('donativos:prueba', 'usuarios:creador')
      const second = await service.generate('donativos:prueba', 'usuarios:creador')
      const downloaded = await service.download('donativos:prueba')

      assert.equal(first.version, 1)
      assert.equal(second.version, 2)
      assert.equal(records[0]?.estado, 'REEMPLAZADA')
      assert.equal(records[1]?.estado, 'ACTIVA')
      assert.match(records[1]?.ruta ?? '', /^donativos\/prueba\/actas\/acta_donacion_v2_[\w-]+\.pdf$/)
      assert.equal(downloaded.mimeType, 'application/pdf')
      assert.equal(downloaded.contents.subarray(0, 5).toString(), '%PDF-')
      assert.ok((await stat(join(temporaryStorage, records[0]?.ruta ?? ''))).isFile())
      assert.ok((await stat(join(temporaryStorage, records[1]?.ruta ?? ''))).isFile())
      await assert.rejects(
        service.generate('usuarios:prueba', 'usuarios:creador'),
        DonationActaValidationError,
      )
    } finally {
      await rm(temporaryStorage, { recursive: true, force: true })
    }
  })

  test('POST crea el acta con la identidad autenticada y GET la entrega inline', async () => {
    const calls: string[] = []
    const acta: DonationActaSummary = {
      id: 'donativo_actas:1',
      version: 1,
      estado: 'ACTIVA',
      nombre_archivo: 'acta_donacion_v1.pdf',
    }
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:creador',
        createDonationActa: async (donativoId, createdBy) => {
          calls.push(donativoId, createdBy)
          return acta
        },
        downloadDonationActa: async (donativoId) => {
          calls.push(donativoId)
          return {
            contents: Buffer.from('%PDF-1.7 acta'),
            name: acta.nombre_archivo,
            mimeType: 'application/pdf',
          }
        },
      },
    )

    const postResponse = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba/acta`, {
      method: 'POST',
      headers: { Authorization: 'Bearer token-valido' },
    })
    const getResponse = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba/acta`, {
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(postResponse.status, 201)
    assert.deepEqual(await postResponse.json(), { ok: true, acta })
    assert.equal(getResponse.status, 200)
    assert.equal(getResponse.headers.get('content-type'), 'application/pdf')
    assert.match(getResponse.headers.get('content-disposition') ?? '', /^inline;/)
    assert.equal(Buffer.from(await getResponse.arrayBuffer()).subarray(0, 5).toString(), '%PDF-')
    assert.deepEqual(calls, [
      'donativos:prueba',
      'usuarios:creador',
      'donativos:prueba',
    ])
  })

  test('PATCH usa updated_by de la sesión y rechaza campos protegidos', async () => {
    let receivedUpdatedBy = ''
    let receivedRepresentative = ''
    let receivedReceptionPlaces: string[] = []
    let receivedReceiptNumber = ''
    let receivedReceiptDate = ''
    let receivedSafekeepingWarehouse = ''
    let receivedDistributionPlaces: string[] = []
    let receivedFinancialReportDate = ''
    let receivedDestinationWarehouse = ''
    let receivedRecordFramework = ''
    let receivedRecordObjective = ''
    let receivedRecordDelivered = ''
    let receivedRecordDelivery = ''
    let receivedCity = ''
    let receivedDonorName = ''
    let receivedDonorPosition = ''
    let receivedDonorEntity = ''
    let receivedDonorDui = ''
    let receivedReceptionManagerName = ''
    let receivedReceptionManagerPosition = ''
    let receivedReceptionManagerId = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        findConapinaReceptionManager: async (id) => ({
          id,
          nombre: 'José Encargado',
          cargo: 'Coordinador de recepción',
        }),
        updateDonation: async (_id, updatedBy, input) => {
          receivedUpdatedBy = updatedBy
          receivedRepresentative = input.representante_upc
          receivedReceptionPlaces = input.lugar_recepcion
          receivedReceiptNumber = input.n_comprobante
          receivedReceiptDate = input.fecha_comprobante
          receivedSafekeepingWarehouse = input.almacen_resguardo
          receivedDistributionPlaces = input.lugar_distribucion
          receivedFinancialReportDate = input.fechareport_financiero
          receivedDestinationWarehouse = input.almacen_destino
          receivedRecordFramework = input.marco_acta
          receivedRecordObjective = input.objetivo_acta
          receivedRecordDelivered = input.entregados_acta
          receivedRecordDelivery = input.entrega_acta
          receivedCity = input.ciudad
          receivedDonorName = input.nombre_donante
          receivedDonorPosition = input.cargo_donante
          receivedDonorEntity = input.nombre_entidad
          receivedDonorDui = input.dui_donante
          receivedReceptionManagerName = input.nombre_encargado
          receivedReceptionManagerPosition = input.cargo_encargado
          receivedReceptionManagerId = input.encargado_personal_id
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
      lugar_recepcion: detail.lugar_recepcion.map((place) => place.id),
      observaciones: '',
      representante_upc: 'catalogo_representantes_upc:5',
      n_comprobante: 'GF-2026-002',
      fecha_comprobante: '2026-11-21',
      almacen_resguardo: 'catalogo_almacenes_resguardo:2',
      lugar_distribucion: ['catalogo_lugares_distribucion:74'],
      fechareport_financiero: '2026-11-23',
      almacen_destino: 'catalogo_almacenes_destino:51',
      marco_acta: 'Marco actualizado',
      objetivo_acta: 'Objetivo actualizado',
      entregados_acta: 'Entregados actualizados',
      entrega_acta: 'Entrega actualizada',
      ciudad: 'catalogo_ciudades_departamentos:127',
      nombre_donante: 'Carlos López',
      cargo_donante: 'Director',
      nombre_entidad: 'Entidad actualizada',
      dui_donante: '01234567-8',
      encargado_personal_id: 'Personal:127',
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
    assert.equal(receivedRepresentative, 'catalogo_representantes_upc:5')
    assert.deepEqual(receivedReceptionPlaces, ['catalogo_lugares_recepcion:21'])
    assert.equal(receivedReceiptNumber, 'GF-2026-002')
    assert.equal(receivedReceiptDate, '2026-11-21')
    assert.equal(receivedSafekeepingWarehouse, 'catalogo_almacenes_resguardo:2')
    assert.deepEqual(receivedDistributionPlaces, ['catalogo_lugares_distribucion:74'])
    assert.equal(receivedFinancialReportDate, '2026-11-23')
    assert.equal(receivedDestinationWarehouse, 'catalogo_almacenes_destino:51')
    assert.equal(receivedRecordFramework, 'Marco actualizado')
    assert.equal(receivedRecordObjective, 'Objetivo actualizado')
    assert.equal(receivedRecordDelivered, 'Entregados actualizados')
    assert.equal(receivedRecordDelivery, 'Entrega actualizada')
    assert.equal(receivedCity, 'catalogo_ciudades_departamentos:127')
    assert.equal(receivedDonorName, 'Carlos López')
    assert.equal(receivedDonorPosition, 'Director')
    assert.equal(receivedDonorEntity, 'Entidad actualizada')
    assert.equal(receivedDonorDui, '01234567-8')
    assert.equal(receivedReceptionManagerName, 'José Encargado')
    assert.equal(receivedReceptionManagerPosition, 'Coordinador de recepción')
    assert.equal(receivedReceptionManagerId, 'Personal:127')
    assert.equal(rejected.status, 400)
  })
})

describe('POST /api/donativos/:id/documentos', () => {
  function validDocumentForm(type: DonationDocumentType = 'MEMO_INICIAL'): FormData {
    const formData = new FormData()
    formData.set('tipo_documento', type)
    formData.set(
      'archivo',
      new File([Buffer.from('%PDF-1.7 prueba')], 'memorandum.pdf', {
        type: 'application/pdf',
      }),
    )
    return formData
  }

  function validImageForm(type: 'REGISTRO_FOTO_1' | 'REGISTRO_FOTO_2'): FormData {
    const formData = new FormData()
    formData.set('tipo_documento', type)
    formData.set(
      'archivo',
      new File(
        [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
        'fotografia.png',
        { type: 'image/png' },
      ),
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

  test('acepta los tipos de secciones 2, 3 y 4 mediante el contrato documental existente', async () => {
    const receivedTypes: DonationDocumentType[] = []
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        createDonationDocument: async (_donativoId, _createdBy, upload) => {
          receivedTypes.push(upload.tipoDocumento)
          return {
            id: 'donativo_documentos:acta',
            tipo_documento: upload.tipoDocumento,
            nombre_archivo: upload.originalName,
            estado: 'ACTIVO',
          }
        },
      },
    )

    for (const type of ['ACTA_CONAPINA', 'ACUERDO_DONACION', 'COMPROBANTE_GF'] as const) {
      const response = await fetch(
        `${baseUrl}/api/donativos/donativos%3Aprueba/documentos`,
        {
        method: 'POST',
        headers: { Authorization: 'Bearer token-valido' },
          body: validDocumentForm(type),
        },
      )

      assert.equal(response.status, 201)
    }
    assert.deepEqual(receivedTypes, ['ACTA_CONAPINA', 'ACUERDO_DONACION', 'COMPROBANTE_GF'])
  })

  test('acepta los dos tipos documentales de registro fotográfico', async () => {
    const receivedTypes: DonationDocumentType[] = []
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: () => 'usuarios:servidor',
        createDonationDocument: async (_donativoId, _createdBy, upload) => {
          receivedTypes.push(upload.tipoDocumento)
          return {
            id: `donativo_documentos:${receivedTypes.length}`,
            tipo_documento: upload.tipoDocumento,
            nombre_archivo: upload.originalName,
            estado: 'ACTIVO',
          }
        },
      },
    )

    for (const type of ['REGISTRO_FOTO_1', 'REGISTRO_FOTO_2'] as const) {
      const response = await fetch(`${baseUrl}/api/donativos/donativos%3Aprueba/documentos`, {
        method: 'POST',
        headers: { Authorization: 'Bearer token-valido' },
        body: validImageForm(type),
      })
      assert.equal(response.status, 201)
    }
    assert.deepEqual(receivedTypes, ['REGISTRO_FOTO_1', 'REGISTRO_FOTO_2'])
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

describe('DELETE /api/donativos/:id', () => {
  test('requiere sesión y conserva el Record ID completo', async () => {
    let receivedId = ''
    const baseUrl = await startTestServer(
      async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
      {
        resolveSession: (token) => (token === 'token-valido' ? 'usuarios:servidor' : null),
        deleteDonation: async (donativoId) => {
          receivedId = donativoId
        },
      },
    )
    const url = `${baseUrl}/api/donativos/donativos%3Aprueba`

    assert.equal((await fetch(url, { method: 'DELETE' })).status, 401)
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token-valido' },
    })

    assert.equal(response.status, 200)
    assert.equal(receivedId, 'donativos:prueba')
    assert.deepEqual(await response.json(), {
      ok: true,
      message: 'Donación eliminada correctamente.',
    })
  })

  test('devuelve 404, 400 y 500 seguros según el fallo', async () => {
    const requestWith = async (error: Error) => {
      const baseUrl = await startTestServer(
        async () => ({ ok: false, reason: 'USER_NOT_FOUND' }),
        {
          resolveSession: () => 'usuarios:servidor',
          deleteDonation: async () => {
            throw error
          },
        },
      )
      return fetch(`${baseUrl}/api/donativos/donativos%3Aprueba`, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer token-valido' },
      })
    }

    assert.equal((await requestWith(new DonationDeletionNotFoundError())).status, 404)
    assert.equal((await requestWith(new DonationDeletionValidationError())).status, 400)
    const internal = await requestWith(new DonationDeletionError())
    assert.equal(internal.status, 500)
    assert.deepEqual(await internal.json(), {
      ok: false,
      message: 'No fue posible eliminar la donación en este momento.',
    })
  })
})

describe('DonationService.delete', () => {
  test('elimina documentos, donativo, archivos y el directorio vacío', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-delete-'))
    const donationDirectory = join(temporaryStorage, 'donativos', 'prueba')
    const firstFile = join(donationDirectory, 'memo.pdf')
    const secondFile = join(donationDirectory, 'acta.pdf')
    const calls: string[] = []
    await mkdir(donationDirectory, { recursive: true })
    await writeFile(firstFile, Buffer.from('%PDF-1.7 memo'))
    await writeFile(secondFile, Buffer.from('%PDF-1.7 acta'))

    const repository = {
      prepareDeletion: async () => ({
        documentPaths: [
          'donativos/prueba/memo.pdf',
          'donativos/prueba/acta.pdf',
        ],
        documentCount: 2,
      }),
      deleteCascade: async () => {
        calls.push('database')
      },
    } as unknown as DonationRepository

    try {
      const result = await new DonationService(repository, temporaryStorage).delete(
        'donativos:prueba',
      )
      assert.deepEqual(result, { documentCount: 2, deletedFileCount: 2 })
      assert.deepEqual(calls, ['database'])
      await assert.rejects(stat(firstFile))
      await assert.rejects(stat(secondFile))
      await assert.rejects(stat(donationDirectory))
    } finally {
      await rm(temporaryStorage, { recursive: true, force: true })
    }
  })

  test('rechaza otra tabla y path traversal antes de borrar la base', async () => {
    let cascadeCalled = false
    const repository = {
      prepareDeletion: async () => ({
        documentPaths: ['../fuera.pdf'],
        documentCount: 1,
      }),
      deleteCascade: async () => {
        cascadeCalled = true
      },
    } as unknown as DonationRepository
    const service = new DonationService(repository)

    await assert.rejects(
      service.delete('usuarios:prueba'),
      DonationDeletionValidationError,
    )
    await assert.rejects(service.delete('donativos:prueba'), DonationDeletionError)
    assert.equal(cascadeCalled, false)
  })
})

describe('DonationDocumentService', () => {
  test('guarda el archivo con nombre único, ruta relativa y metadatos seguros', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-document-'))
    let storedMetadata: Parameters<DonationDocumentRepository['create']>[0] | undefined
    const repository: DonationDocumentRepository = {
      donationExists: async () => true,
      findByType: async () => null,
      create: async (metadata) => {
        storedMetadata = metadata
        return {
          id: 'donativo_documentos:prueba',
          tipo_documento: metadata.tipoDocumento,
          nombre_archivo: metadata.originalName,
          estado: 'ACTIVO',
        }
      },
      replace: async () => {
        throw new Error('No debe ejecutarse')
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

      await new DonationDocumentService(repository, temporaryStorage).save(
        `donativos:${String.fromCodePoint(0x27e8)}4cn2d8afb6mnmtsmhd01${String.fromCodePoint(0x27e9)}`,
        'usuarios:servidor',
        {
          tipoDocumento: 'ACUERDO_DONACION',
          originalName: 'acuerdo-donacion.pdf',
          mimeType: 'application/pdf',
          contents,
        },
      )
      assert.match(storedMetadata?.storedName ?? '', /^acuerdo_donacion_[\w-]+\.pdf$/)

      await new DonationDocumentService(repository, temporaryStorage).save(
        `donativos:${String.fromCodePoint(0x27e8)}4cn2d8afb6mnmtsmhd01${String.fromCodePoint(0x27e9)}`,
        'usuarios:servidor',
        {
          tipoDocumento: 'COMPROBANTE_GF',
          originalName: 'comprobante-gf.pdf',
          mimeType: 'application/pdf',
          contents,
        },
      )
      assert.match(storedMetadata?.storedName ?? '', /^comprobante_gf_[\w-]+\.pdf$/)
    } finally {
      await rm(temporaryStorage, { recursive: true, force: true })
    }
  })

  test('reemplaza COMPROBANTE_GF en el registro activo con updated_by autenticado', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-document-replace-'))
    const donationKey = '4cn2d8afb6mnmtsmhd01'
    const donationId = `donativos:${String.fromCodePoint(0x27e8)}${donationKey}${String.fromCodePoint(0x27e9)}`
    const previousName = 'comprobante_gf_anterior.pdf'
    const previousPath = join(temporaryStorage, donationKey, previousName)
    let replacedMetadata: Parameters<DonationDocumentRepository['replace']>[1] | undefined
    let replacedDocumentId = ''
    await mkdir(join(temporaryStorage, donationKey), { recursive: true })
    await writeFile(previousPath, Buffer.from('%PDF-1.7 anterior'))

    const repository: DonationDocumentRepository = {
      donationExists: async () => true,
      findByType: async () => ({
        id: 'donativo_documentos:acta',
        ruta_archivo: `donativos/${donationKey}/${previousName}`,
      }),
      create: async () => {
        throw new Error('No debe ejecutarse')
      },
      replace: async (documentId, metadata) => {
        replacedDocumentId = documentId
        replacedMetadata = metadata
        return {
          id: documentId,
          tipo_documento: metadata.tipoDocumento,
          nombre_archivo: metadata.originalName,
          estado: 'ACTIVO',
        }
      },
      listActive: async () => [],
      findActiveFile: async () => null,
      logicalDelete: async () => false,
    }

    try {
      const result = await new DonationDocumentService(repository, temporaryStorage).save(
        donationId,
        'usuarios:servidor',
        {
          tipoDocumento: 'COMPROBANTE_GF',
          originalName: 'comprobante-actualizado.pdf',
          mimeType: 'application/pdf',
          contents: Buffer.from('%PDF-1.7 actualizada'),
        },
      )

      assert.equal(result.id, 'donativo_documentos:acta')
      assert.equal(replacedDocumentId, 'donativo_documentos:acta')
      assert.equal(replacedMetadata?.createdBy, 'usuarios:servidor')
      assert.match(replacedMetadata?.storedName ?? '', /^comprobante_gf_[\w-]+\.pdf$/)
      await assert.rejects(readFile(previousPath))
      assert.deepEqual(
        await readFile(
          join(temporaryStorage, donationKey, replacedMetadata?.storedName ?? ''),
        ),
        Buffer.from('%PDF-1.7 actualizada'),
      )
    } finally {
      await rm(temporaryStorage, { recursive: true, force: true })
    }
  })

  test('valida firmas de imágenes, acepta JPG/JPEG/PNG/WebP y rechaza SVG o contenido falso', async () => {
    const temporaryStorage = await mkdtemp(join(tmpdir(), 'sigedi-photo-'))
    const storedNames: string[] = []
    const repository: DonationDocumentRepository = {
      donationExists: async () => true,
      findByType: async () => null,
      create: async (metadata) => {
        storedNames.push(metadata.storedName)
        return {
          id: `donativo_documentos:${storedNames.length}`,
          tipo_documento: metadata.tipoDocumento,
          nombre_archivo: metadata.originalName,
          estado: 'ACTIVO',
        }
      },
      replace: async () => { throw new Error('No debe ejecutarse') },
      listActive: async () => [],
      findActiveFile: async () => null,
      logicalDelete: async () => false,
    }
    const service = new DonationDocumentService(repository, temporaryStorage)
    const donationId = 'donativos:foto_prueba'
    const samples = [
      { name: 'foto.jpg', mime: 'image/jpeg', contents: Buffer.from([0xff, 0xd8, 0xff, 0x00]) },
      { name: 'foto.jpeg', mime: 'image/jpeg', contents: Buffer.from([0xff, 0xd8, 0xff, 0x01]) },
      { name: 'foto.png', mime: 'image/png', contents: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
      { name: 'foto.webp', mime: 'image/webp', contents: Buffer.from('RIFF0000WEBP') },
    ]

    try {
      for (const [index, sample] of samples.entries()) {
        await service.save(donationId, 'usuarios:servidor', {
          tipoDocumento: index % 2 === 0 ? 'REGISTRO_FOTO_1' : 'REGISTRO_FOTO_2',
          originalName: sample.name,
          mimeType: sample.mime,
          contents: sample.contents,
        })
      }
      assert.match(storedNames[0] ?? '', /^registro_foto_1_[\w-]+\.jpg$/)
      assert.match(storedNames[1] ?? '', /^registro_foto_2_[\w-]+\.jpeg$/)
      assert.match(storedNames[2] ?? '', /^registro_foto_1_[\w-]+\.png$/)
      assert.match(storedNames[3] ?? '', /^registro_foto_2_[\w-]+\.webp$/)

      await assert.rejects(
        service.save(donationId, 'usuarios:servidor', {
          tipoDocumento: 'REGISTRO_FOTO_1',
          originalName: 'foto.svg',
          mimeType: 'image/svg+xml',
          contents: Buffer.from('<svg></svg>'),
        }),
        DonationDocumentValidationError,
      )
      await assert.rejects(
        service.save(donationId, 'usuarios:servidor', {
          tipoDocumento: 'REGISTRO_FOTO_2',
          originalName: 'foto.png',
          mimeType: 'image/png',
          contents: Buffer.from('<svg></svg>'),
        }),
        DonationDocumentValidationError,
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
