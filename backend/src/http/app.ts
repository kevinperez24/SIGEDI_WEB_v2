import type { IncomingMessage, ServerResponse } from 'node:http'
import { DatabaseConnectionError } from '../database/errors.ts'
import type { AuthResult } from '../auth/auth.types.ts'
import type { ReceptionPlace } from '../catalogos/lugar-recepcion.repository.ts'
import type { UpcRepresentative } from '../catalogos/representante-upc.repository.ts'
import type { Section5CatalogItem } from '../catalogos/seccion5.repository.ts'
import type { CityCatalogItem } from '../catalogos/ciudad.repository.ts'
import type { ConapinaReceptionManager } from '../catalogos/encargado-conapina.repository.ts'
import {
  DonationDocumentNotFoundError,
  DonationDocumentValidationError,
  DonationNotFoundError,
} from '../donativos/donativo-document.service.ts'
import type { DownloadedDonationDocument } from '../donativos/donativo-document.service.ts'
import {
  DonationActaNotFoundError,
  DonationActaValidationError,
} from '../donativos/donativo-acta.service.ts'
import type {
  DonationActaSummary,
  DownloadedDonationActa,
} from '../donativos/donativo-acta.types.ts'
import type {
  CreatedDonationDocument,
  DonationDocumentItem,
  DonationDocumentType,
  DonationDocumentUpload,
} from '../donativos/donativo-document.types.ts'
import {
  DonationDeletionError,
  DonationDeletionNotFoundError,
  DonationDeletionValidationError,
} from '../donativos/donativo.service.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDetail,
  DonationListItem,
} from '../donativos/donativo.types.ts'

const MAX_BODY_BYTES = 16 * 1024
const MAX_MULTIPART_BYTES = 11 * 1024 * 1024
const MAX_USERNAME_LENGTH = 128
const MAX_PASSWORD_LENGTH = 1024

type Authenticate = (username: string, password: string) => Promise<AuthResult>
type CreateDonation = (
  createdBy: string,
  input: DonationCreateInput,
) => Promise<CreatedDonation>
type ListDonations = () => Promise<DonationListItem[]>
type CreateDonationDocument = (
  donativoId: string,
  createdBy: string,
  upload: DonationDocumentUpload,
) => Promise<CreatedDonationDocument>
type GetDonation = (donativoId: string) => Promise<DonationDetail | null>
type UpdateDonation = (
  donativoId: string,
  updatedBy: string,
  input: DonationCreateInput,
) => Promise<DonationDetail | null>
type ListDonationDocuments = (donativoId: string) => Promise<DonationDocumentItem[]>
type DownloadDonationDocument = (
  donativoId: string,
  documentId: string,
) => Promise<DownloadedDonationDocument>
type DeleteDonationDocument = (
  donativoId: string,
  documentId: string,
  updatedBy: string,
) => Promise<void>
type CreateDonationActa = (
  donativoId: string,
  createdBy: string,
) => Promise<DonationActaSummary>
type GetActiveDonationActa = (donativoId: string) => Promise<DonationActaSummary | null>
type DownloadDonationActa = (donativoId: string) => Promise<DownloadedDonationActa>
type ListReceptionPlaces = () => Promise<ReceptionPlace[]>
type ValidateReceptionPlaces = (ids: string[]) => Promise<boolean>
type ListUpcRepresentatives = () => Promise<UpcRepresentative[]>
type ValidateUpcRepresentative = (id: string) => Promise<boolean>
type ListSection5Catalog = () => Promise<Section5CatalogItem[]>
type ValidateSection5CatalogId = (id: string) => Promise<boolean>
type ValidateSection5CatalogIds = (ids: string[]) => Promise<boolean>
type ListCities = () => Promise<CityCatalogItem[]>
type ValidateCity = (id: string) => Promise<boolean>
type ListConapinaReceptionManagers = () => Promise<ConapinaReceptionManager[]>
type FindConapinaReceptionManager = (id: string) => Promise<ConapinaReceptionManager | null>
type DeleteDonation = (donativoId: string) => Promise<unknown>

type AppDependencies = {
  authenticate: Authenticate
  allowedOrigin: string | readonly string[]
  createSession: (userId: string) => string
  resolveSession: (token: string) => string | null
  createDonation: CreateDonation
  listDonations: ListDonations
  createDonationDocument: CreateDonationDocument
  getDonation: GetDonation
  updateDonation: UpdateDonation
  listDonationDocuments: ListDonationDocuments
  downloadDonationDocument: DownloadDonationDocument
  deleteDonationDocument: DeleteDonationDocument
  createDonationActa: CreateDonationActa
  getActiveDonationActa: GetActiveDonationActa
  downloadDonationActa: DownloadDonationActa
  listReceptionPlaces: ListReceptionPlaces
  validateReceptionPlaces: ValidateReceptionPlaces
  listUpcRepresentatives: ListUpcRepresentatives
  validateUpcRepresentative: ValidateUpcRepresentative
  listSafekeepingWarehouses: ListSection5Catalog
  validateSafekeepingWarehouse: ValidateSection5CatalogId
  listDistributionPlaces: ListSection5Catalog
  validateDistributionPlaces: ValidateSection5CatalogIds
  listDestinationWarehouses: ListSection5Catalog
  validateDestinationWarehouse: ValidateSection5CatalogId
  listCities: ListCities
  validateCity: ValidateCity
  listConapinaReceptionManagers: ListConapinaReceptionManagers
  findConapinaReceptionManager: FindConapinaReceptionManager
  deleteDonation: DeleteDonation
}

type LoginBody = {
  usuario: string
  password: string
}

const DONATION_FIELDS = new Set([
  'tipo_registro',
  'nombre_proyecto',
  'tipo_gestion',
  'dpto_seccion',
  'fecha_recepcion',
  'lugar_recepcion',
  'observaciones',
  'representante_upc',
  'n_comprobante',
  'fecha_comprobante',
  'almacen_resguardo',
  'lugar_distribucion',
  'fechareport_financiero',
  'almacen_destino',
  'marco_acta',
  'objetivo_acta',
  'entregados_acta',
  'entrega_acta',
  'ciudad',
  'nombre_donante',
  'cargo_donante',
  'nombre_entidad',
  'dui_donante',
  'encargado_personal_id',
])

class RequestBodyError extends Error {
  constructor(readonly statusCode: number) {
    super('Cuerpo de solicitud inválido.')
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

function sendDocument(response: ServerResponse, document: DownloadedDonationDocument): void {
  const disposition =
    document.mimeType === 'application/pdf' || document.mimeType.startsWith('image/')
      ? 'inline'
      : 'attachment'
  const encodedName = encodeURIComponent(document.name)
  response.writeHead(200, {
    'Content-Type': document.mimeType,
    'Content-Length': document.contents.byteLength,
    'Content-Disposition': `${disposition}; filename="documento"; filename*=UTF-8''${encodedName}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(document.contents)
}

function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigin: string | readonly string[],
): boolean {
  const origin = request.headers.origin
  const allowedOrigins = typeof allowedOrigin === 'string' ? [allowedOrigin] : allowedOrigin

  if (!origin) return true
  if (!allowedOrigins.includes(origin)) return false

  response.setHeader('Access-Control-Allow-Origin', origin)
  response.setHeader('Vary', 'Origin')
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  return true
}

async function readBody(request: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let totalBytes = 0

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    totalBytes += buffer.byteLength

    if (totalBytes > maxBytes) {
      throw new RequestBodyError(413)
    }

    chunks.push(buffer)
  }

  return Buffer.concat(chunks)
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'] ?? ''

  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new RequestBodyError(415)
  }

  const body = await readBody(request, MAX_BODY_BYTES)

  try {
    return JSON.parse(body.toString('utf8'))
  } catch {
    throw new RequestBodyError(400)
  }
}

async function readDonationDocument(request: IncomingMessage): Promise<DonationDocumentUpload> {
  const contentType = request.headers['content-type'] ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new RequestBodyError(415)
  }

  const body = await readBody(request, MAX_MULTIPART_BYTES)
  let formData: FormData

  try {
    const multipartRequest = new Request('http://localhost/upload', {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body,
    })
    formData = await multipartRequest.formData()
  } catch {
    throw new RequestBodyError(400)
  }

  const tipoDocumento = formData.get('tipo_documento')
  const file = formData.get('archivo')
  const hasUnexpectedField = [...formData.keys()].some(
    (field) => field !== 'tipo_documento' && field !== 'archivo',
  )

  if (
    hasUnexpectedField ||
    formData.getAll('tipo_documento').length !== 1 ||
    formData.getAll('archivo').length !== 1 ||
    (tipoDocumento !== 'MEMO_INICIAL' &&
      tipoDocumento !== 'MEMO_DE' &&
      tipoDocumento !== 'ACTA_CONAPINA' &&
      tipoDocumento !== 'ACUERDO_DONACION' &&
      tipoDocumento !== 'COMPROBANTE_GF' &&
      tipoDocumento !== 'REGISTRO_FOTO_1' &&
      tipoDocumento !== 'REGISTRO_FOTO_2') ||
    !(file instanceof File)
  ) {
    throw new RequestBodyError(400)
  }

  return {
    tipoDocumento: tipoDocumento as DonationDocumentType,
    originalName: file.name,
    mimeType: file.type,
    contents: Buffer.from(await file.arrayBuffer()),
  }
}

function validateLoginBody(body: unknown): LoginBody | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const candidate = body as Record<string, unknown>
  if (typeof candidate.usuario !== 'string' || typeof candidate.password !== 'string') {
    return null
  }

  const usuario = candidate.usuario.trim()
  const password = candidate.password

  if (
    !usuario ||
    !password ||
    usuario.length > MAX_USERNAME_LENGTH ||
    password.length > MAX_PASSWORD_LENGTH
  ) {
    return null
  }

  return { usuario, password }
}

function readRequiredString(
  candidate: Record<string, unknown>,
  field: keyof DonationCreateInput,
  maxLength: number,
): string | null {
  const value = candidate[field]
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized && normalized.length <= maxLength ? normalized : null
}

function readOptionalString(
  candidate: Record<string, unknown>,
  field:
    | 'dpto_seccion'
    | 'observaciones'
    | 'representante_upc'
    | 'n_comprobante'
    | 'fecha_comprobante'
    | 'almacen_resguardo'
    | 'fechareport_financiero'
    | 'almacen_destino'
    | 'marco_acta'
    | 'objetivo_acta'
    | 'entregados_acta'
    | 'entrega_acta'
    | 'ciudad'
    | 'nombre_donante'
    | 'cargo_donante'
    | 'nombre_entidad'
    | 'dui_donante'
    | 'encargado_personal_id',
  maxLength: number,
): string | null {
  const value = candidate[field]
  if (value === undefined) return ''
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized.length <= maxLength ? normalized : null
}

function readReceptionPlaces(candidate: Record<string, unknown>): string[] | null {
  const value = candidate.lugar_recepcion
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) return null

  const normalized = value.map((item) => (typeof item === 'string' ? item.trim() : ''))
  if (normalized.some((item) => !item || item.length > 200)) return null
  if (new Set(normalized).size !== normalized.length) return null
  return normalized
}

function readOptionalRecordIds(
  candidate: Record<string, unknown>,
  field: 'lugar_distribucion',
): string[] | null {
  const value = candidate[field]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 100) return null
  const normalized = value.map((item) => (typeof item === 'string' ? item.trim() : ''))
  if (normalized.some((item) => !item || item.length > 200)) return null
  if (new Set(normalized).size !== normalized.length) return null
  return normalized
}

function validateDonationBody(body: unknown): DonationCreateInput | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const candidate = body as Record<string, unknown>
  if (Object.keys(candidate).some((field) => !DONATION_FIELDS.has(field))) return null

  const tipo_registro = readRequiredString(candidate, 'tipo_registro', 200)
  const nombre_proyecto = readRequiredString(candidate, 'nombre_proyecto', 500)
  const tipo_gestion = readRequiredString(candidate, 'tipo_gestion', 200)
  const fecha_recepcion = readRequiredString(candidate, 'fecha_recepcion', 10)
  const lugar_recepcion = readReceptionPlaces(candidate)
  const dpto_seccion = readOptionalString(candidate, 'dpto_seccion', 300)
  const observaciones = readOptionalString(candidate, 'observaciones', 2_000)
  const representante_upc = readOptionalString(candidate, 'representante_upc', 300)
  const n_comprobante = readOptionalString(candidate, 'n_comprobante', 200)
  const fecha_comprobante = readOptionalString(candidate, 'fecha_comprobante', 10)
  const almacen_resguardo = readOptionalString(candidate, 'almacen_resguardo', 300)
  const lugar_distribucion = readOptionalRecordIds(candidate, 'lugar_distribucion')
  const fechareport_financiero = readOptionalString(candidate, 'fechareport_financiero', 10)
  const almacen_destino = readOptionalString(candidate, 'almacen_destino', 300)
  const marco_acta = readOptionalString(candidate, 'marco_acta', 5_000)
  const objetivo_acta = readOptionalString(candidate, 'objetivo_acta', 5_000)
  const entregados_acta = readOptionalString(candidate, 'entregados_acta', 5_000)
  const entrega_acta = readOptionalString(candidate, 'entrega_acta', 5_000)
  const ciudad = readOptionalString(candidate, 'ciudad', 200)
  const nombre_donante = readOptionalString(candidate, 'nombre_donante', 300)
  const cargo_donante = readOptionalString(candidate, 'cargo_donante', 300)
  const nombre_entidad = readOptionalString(candidate, 'nombre_entidad', 500)
  const dui_donante = readOptionalString(candidate, 'dui_donante', 10)
  const encargado_personal_id = readOptionalString(candidate, 'encargado_personal_id', 300)

  if (
    !tipo_registro ||
    !nombre_proyecto ||
    !tipo_gestion ||
    !fecha_recepcion ||
    !lugar_recepcion ||
    dpto_seccion === null ||
    observaciones === null ||
    representante_upc === null ||
    n_comprobante === null ||
    fecha_comprobante === null ||
    almacen_resguardo === null ||
    lugar_distribucion === null ||
    fechareport_financiero === null ||
    almacen_destino === null ||
    marco_acta === null ||
    objetivo_acta === null ||
    entregados_acta === null ||
    entrega_acta === null ||
    ciudad === null ||
    nombre_donante === null ||
    cargo_donante === null ||
    nombre_entidad === null ||
    dui_donante === null ||
    encargado_personal_id === null
  ) {
    return null
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_recepcion)) return null
  const parsedDate = new Date(`${fecha_recepcion}T00:00:00.000Z`)
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== fecha_recepcion
  ) {
    return null
  }

  if (fecha_comprobante) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_comprobante)) return null
    const parsedReceiptDate = new Date(`${fecha_comprobante}T00:00:00.000Z`)
    if (
      Number.isNaN(parsedReceiptDate.getTime()) ||
      parsedReceiptDate.toISOString().slice(0, 10) !== fecha_comprobante
    ) {
      return null
    }
  }

  if (fechareport_financiero) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechareport_financiero)) return null
    const parsedFinancialReportDate = new Date(`${fechareport_financiero}T00:00:00.000Z`)
    if (
      Number.isNaN(parsedFinancialReportDate.getTime()) ||
      parsedFinancialReportDate.toISOString().slice(0, 10) !== fechareport_financiero
    ) {
      return null
    }
  }

  if (dui_donante && !/^\d{8}-\d$/.test(dui_donante)) return null

  return {
    tipo_registro,
    nombre_proyecto,
    tipo_gestion,
    dpto_seccion,
    fecha_recepcion,
    lugar_recepcion,
    observaciones,
    representante_upc,
    n_comprobante,
    fecha_comprobante,
    almacen_resguardo,
    lugar_distribucion,
    fechareport_financiero,
    almacen_destino,
    marco_acta,
    objetivo_acta,
    entregados_acta,
    entrega_acta,
    ciudad,
    nombre_donante,
    cargo_donante,
    nombre_entidad,
    dui_donante,
    encargado_personal_id,
    nombre_encargado: '',
    cargo_encargado: '',
  }
}

function readBearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length).trim()
  return token || null
}

async function resolveReceptionManager(
  input: DonationCreateInput,
  findManager: FindConapinaReceptionManager,
): Promise<DonationCreateInput | null> {
  if (!input.encargado_personal_id) {
    return { ...input, nombre_encargado: '', cargo_encargado: '' }
  }
  const manager = await findManager(input.encargado_personal_id)
  if (!manager) return null
  return {
    ...input,
    encargado_personal_id: manager.id,
    nombre_encargado: manager.nombre.trim(),
    cargo_encargado: manager.cargo.trim(),
  }
}

export function createRequestHandler({
  authenticate,
  allowedOrigin,
  createSession,
  resolveSession,
  createDonation,
  listDonations,
  createDonationDocument,
  getDonation,
  updateDonation,
  listDonationDocuments,
  downloadDonationDocument,
  deleteDonationDocument,
  createDonationActa,
  getActiveDonationActa,
  downloadDonationActa,
  listReceptionPlaces,
  validateReceptionPlaces,
  listUpcRepresentatives,
  validateUpcRepresentative,
  listSafekeepingWarehouses,
  validateSafekeepingWarehouse,
  listDistributionPlaces,
  validateDistributionPlaces,
  listDestinationWarehouses,
  validateDestinationWarehouse,
  listCities,
  validateCity,
  listConapinaReceptionManagers,
  findConapinaReceptionManager,
  deleteDonation,
}: AppDependencies) {
  return async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    if (!applyCors(request, response, allowedOrigin)) {
      sendJson(response, 403, { ok: false, message: 'Origen no permitido.' })
      return
    }

    const url = new URL(request.url ?? '/', 'http://localhost')

    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const isLoginRoute = url.pathname === '/api/auth/login'
    const isReceptionPlacesRoute = url.pathname === '/api/catalogos/lugares-recepcion'
    const isUpcRepresentativesRoute = url.pathname === '/api/catalogos/representantes-upc'
    const isSafekeepingWarehousesRoute = url.pathname === '/api/catalogos/almacenes-resguardo'
    const isDistributionPlacesRoute = url.pathname === '/api/catalogos/lugares-distribucion'
    const isDestinationWarehousesRoute = url.pathname === '/api/catalogos/almacenes-destino'
    const isCitiesRoute = url.pathname === '/api/catalogos/ciudades'
    const isConapinaReceptionManagersRoute = url.pathname === '/api/catalogos/encargados-conapina'
    const isSection5CatalogRoute =
      isSafekeepingWarehousesRoute ||
      isDistributionPlacesRoute ||
      isDestinationWarehousesRoute
    const isDonationRoute = url.pathname === '/api/donativos'
    const donationDocumentMatch = url.pathname.match(/^\/api\/donativos\/([^/]+)\/documentos$/)
    const isDonationDocumentRoute = donationDocumentMatch !== null
    const donationDocumentItemMatch = url.pathname.match(
      /^\/api\/donativos\/([^/]+)\/documentos\/([^/]+)$/,
    )
    const isDonationDocumentItemRoute = donationDocumentItemMatch !== null
    const donationActaMatch = url.pathname.match(/^\/api\/donativos\/([^/]+)\/acta$/)
    const isDonationActaRoute = donationActaMatch !== null
    const donationDetailMatch = url.pathname.match(/^\/api\/donativos\/([^/]+)$/)
    const isDonationDetailRoute = donationDetailMatch !== null

    if (
      !isLoginRoute &&
      !isReceptionPlacesRoute &&
      !isUpcRepresentativesRoute &&
      !isSection5CatalogRoute &&
      !isCitiesRoute &&
      !isConapinaReceptionManagersRoute &&
      !isDonationRoute &&
      !isDonationDocumentRoute &&
      !isDonationDocumentItemRoute &&
      !isDonationActaRoute &&
      !isDonationDetailRoute
    ) {
      sendJson(response, 404, { ok: false, message: 'Recurso no encontrado.' })
      return
    }

    const methodIsAllowed = isReceptionPlacesRoute || isUpcRepresentativesRoute || isSection5CatalogRoute || isCitiesRoute || isConapinaReceptionManagersRoute
      ? request.method === 'GET'
      : isDonationRoute
      ? request.method === 'GET' || request.method === 'POST'
      : isDonationDetailRoute
        ? request.method === 'GET' || request.method === 'PATCH' || request.method === 'DELETE'
        : isDonationActaRoute
          ? request.method === 'GET' || request.method === 'POST'
        : isDonationDocumentItemRoute
          ? request.method === 'GET' || request.method === 'DELETE'
          : request.method === 'POST'

    if (!methodIsAllowed) {
      response.setHeader(
        'Allow',
        isDonationRoute
          ? 'GET, POST, OPTIONS'
          : isReceptionPlacesRoute || isUpcRepresentativesRoute || isSection5CatalogRoute || isCitiesRoute || isConapinaReceptionManagersRoute
            ? 'GET, OPTIONS'
          : isDonationDetailRoute
            ? 'GET, PATCH, DELETE, OPTIONS'
            : isDonationActaRoute
              ? 'GET, POST, OPTIONS'
            : isDonationDocumentItemRoute
              ? 'GET, DELETE, OPTIONS'
              : 'POST, OPTIONS',
      )
      sendJson(response, 405, { ok: false, message: 'Método no permitido.' })
      return
    }

    try {
      if (isReceptionPlacesRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null

        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        const lugares = await listReceptionPlaces()
        sendJson(response, 200, { ok: true, lugares })
        return
      }

      if (isUpcRepresentativesRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null

        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        const representantes = await listUpcRepresentatives()
        sendJson(response, 200, { ok: true, representantes })
        return
      }

      if (isSection5CatalogRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null

        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        if (isSafekeepingWarehousesRoute) {
          sendJson(response, 200, {
            ok: true,
            almacenes: await listSafekeepingWarehouses(),
          })
        } else if (isDistributionPlacesRoute) {
          sendJson(response, 200, {
            ok: true,
            lugares: await listDistributionPlaces(),
          })
        } else {
          sendJson(response, 200, {
            ok: true,
            almacenes: await listDestinationWarehouses(),
          })
        }
        return
      }

      if (isCitiesRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null
        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }
        sendJson(response, 200, { ok: true, ciudades: await listCities() })
        return
      }

      if (isConapinaReceptionManagersRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null
        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }
        sendJson(response, 200, {
          ok: true,
          encargados: await listConapinaReceptionManagers(),
        })
        return
      }

      if (isDonationDocumentItemRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null

        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        const donativoId = decodeURIComponent(donationDocumentItemMatch[1] ?? '')
        const documentId = decodeURIComponent(donationDocumentItemMatch[2] ?? '')

        if (request.method === 'GET') {
          sendDocument(response, await downloadDonationDocument(donativoId, documentId))
          return
        }

        await deleteDonationDocument(donativoId, documentId, currentUser)
        sendJson(response, 200, { ok: true })
        return
      }

      if (isDonationActaRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null
        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        const donativoId = decodeURIComponent(donationActaMatch[1] ?? '')
        if (request.method === 'GET') {
          sendDocument(response, await downloadDonationActa(donativoId))
          return
        }

        const acta = await createDonationActa(donativoId, currentUser)
        sendJson(response, 201, { ok: true, acta })
        return
      }

      if (isDonationDetailRoute) {
        const token = readBearerToken(request)
        const currentUser = token ? resolveSession(token) : null

        if (!currentUser) {
          sendJson(response, 401, { ok: false, message: 'Debe iniciar sesión nuevamente.' })
          return
        }

        const donativoId = decodeURIComponent(donationDetailMatch[1] ?? '')

        if (request.method === 'DELETE') {
          await deleteDonation(donativoId)
          sendJson(response, 200, {
            ok: true,
            message: 'Donación eliminada correctamente.',
          })
          return
        }

        if (request.method === 'GET') {
          const donativo = await getDonation(donativoId)
          if (!donativo) {
            sendJson(response, 404, { ok: false, message: 'El donativo no existe.' })
            return
          }
          const documentos = await listDonationDocuments(donativoId)
          const acta = await getActiveDonationActa(donativoId)
          sendJson(response, 200, { ok: true, donativo, documentos, acta })
          return
        }

        const donationBody = validateDonationBody(await readJsonBody(request))
        if (!donationBody) {
          sendJson(response, 400, {
            ok: false,
            message: 'Los datos del donativo son inválidos.',
          })
          return
        }

        if (!(await validateReceptionPlaces(donationBody.lugar_recepcion))) {
          sendJson(response, 400, {
            ok: false,
            message: 'Seleccione lugares de recepción activos y válidos.',
          })
          return
        }
        if (
          donationBody.representante_upc &&
          !(await validateUpcRepresentative(donationBody.representante_upc))
        ) {
          sendJson(response, 400, {
            ok: false,
            message: 'Seleccione un representante UPC activo y válido.',
          })
          return
        }
        if (
          donationBody.almacen_resguardo &&
          !(await validateSafekeepingWarehouse(donationBody.almacen_resguardo))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un almacén de resguardo activo y válido.' })
          return
        }
        if (
          donationBody.lugar_distribucion.length > 0 &&
          !(await validateDistributionPlaces(donationBody.lugar_distribucion))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione lugares de distribución activos y válidos.' })
          return
        }
        if (
          donationBody.almacen_destino &&
          !(await validateDestinationWarehouse(donationBody.almacen_destino))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un almacén destino activo y válido.' })
          return
        }
        if (donationBody.ciudad && !(await validateCity(donationBody.ciudad))) {
          sendJson(response, 400, { ok: false, message: 'Seleccione una ciudad activa y válida.' })
          return
        }

        const resolvedDonationBody = await resolveReceptionManager(
          donationBody,
          findConapinaReceptionManager,
        )
        if (!resolvedDonationBody) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un encargado CONAPINA válido.' })
          return
        }

        const donativo = await updateDonation(donativoId, currentUser, resolvedDonationBody)
        if (!donativo) {
          sendJson(response, 404, { ok: false, message: 'El donativo no existe.' })
          return
        }
        sendJson(response, 200, { ok: true, donativo })
        return
      }

      if (isDonationDocumentRoute) {
        const token = readBearerToken(request)
        const createdBy = token ? resolveSession(token) : null

        if (!createdBy) {
          sendJson(response, 401, {
            ok: false,
            message: 'Debe iniciar sesión nuevamente.',
          })
          return
        }

        const donativoId = decodeURIComponent(donationDocumentMatch[1] ?? '')
        const upload = await readDonationDocument(request)
        const documento = await createDonationDocument(donativoId, createdBy, upload)
        sendJson(response, 201, { ok: true, documento })
        return
      }

      if (isDonationRoute) {
        const token = readBearerToken(request)
        const createdBy = token ? resolveSession(token) : null

        if (!createdBy) {
          sendJson(response, 401, {
            ok: false,
            message: 'Debe iniciar sesión nuevamente.',
          })
          return
        }

        if (request.method === 'GET') {
          const donativos = await listDonations()
          sendJson(response, 200, { ok: true, donativos })
          return
        }

        const rawBody = await readJsonBody(request)

        const donationBody = validateDonationBody(rawBody)

        if (!donationBody) {
          sendJson(response, 400, {
            ok: false,
            message: 'Los datos del donativo son inválidos.',
          })
          return
        }

        if (!(await validateReceptionPlaces(donationBody.lugar_recepcion))) {
          sendJson(response, 400, {
            ok: false,
            message: 'Seleccione lugares de recepción activos y válidos.',
          })
          return
        }
        if (
          donationBody.representante_upc &&
          !(await validateUpcRepresentative(donationBody.representante_upc))
        ) {
          sendJson(response, 400, {
            ok: false,
            message: 'Seleccione un representante UPC activo y válido.',
          })
          return
        }
        if (
          donationBody.almacen_resguardo &&
          !(await validateSafekeepingWarehouse(donationBody.almacen_resguardo))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un almacén de resguardo activo y válido.' })
          return
        }
        if (
          donationBody.lugar_distribucion.length > 0 &&
          !(await validateDistributionPlaces(donationBody.lugar_distribucion))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione lugares de distribución activos y válidos.' })
          return
        }
        if (
          donationBody.almacen_destino &&
          !(await validateDestinationWarehouse(donationBody.almacen_destino))
        ) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un almacén destino activo y válido.' })
          return
        }
        if (donationBody.ciudad && !(await validateCity(donationBody.ciudad))) {
          sendJson(response, 400, { ok: false, message: 'Seleccione una ciudad activa y válida.' })
          return
        }

        const resolvedDonationBody = await resolveReceptionManager(
          donationBody,
          findConapinaReceptionManager,
        )
        if (!resolvedDonationBody) {
          sendJson(response, 400, { ok: false, message: 'Seleccione un encargado CONAPINA válido.' })
          return
        }

        const donativo = await createDonation(createdBy, resolvedDonationBody)
        sendJson(response, 201, { ok: true, donativo })
        return
      }

      const rawBody = await readJsonBody(request)

      const body = validateLoginBody(rawBody)

      if (!body) {
        sendJson(response, 400, { ok: false, message: 'Datos de acceso inválidos.' })
        return
      }

      const result = await authenticate(body.usuario, body.password)

      if (!result.ok) {
        sendJson(response, 401, {
          ok: false,
          message: 'Usuario o contraseña incorrectos.',
        })
        return
      }

      const authToken = createSession(result.user.id)
      sendJson(response, 200, { ok: true, usuario: result.user, authToken })
    } catch (error) {
      if (error instanceof RequestBodyError) {
        sendJson(response, error.statusCode, {
          ok: false,
          message: isDonationDocumentRoute
            ? 'El documento enviado no es válido.'
            : isDonationRoute || isDonationDetailRoute
            ? 'Los datos del donativo son inválidos.'
            : 'Datos de acceso inválidos.',
        })
        return
      }

      if (error instanceof DonationDocumentValidationError) {
        sendJson(response, 400, { ok: false, message: 'El documento enviado no es válido.' })
        return
      }

      if (error instanceof DonationNotFoundError) {
        sendJson(response, 404, { ok: false, message: 'El donativo no existe.' })
        return
      }

      if (error instanceof DonationDocumentNotFoundError) {
        sendJson(response, 404, { ok: false, message: 'El documento no existe.' })
        return
      }

      if (error instanceof DonationActaValidationError) {
        sendJson(response, 400, { ok: false, message: 'El identificador del donativo no es válido.' })
        return
      }

      if (error instanceof DonationActaNotFoundError) {
        sendJson(response, 404, {
          ok: false,
          message: isDonationActaRoute && request.method === 'GET'
            ? 'El acta activa no existe.'
            : 'El donativo no existe.',
        })
        return
      }

      if (error instanceof DonationDeletionValidationError) {
        sendJson(response, 400, { ok: false, message: 'El identificador del donativo no es válido.' })
        return
      }

      if (error instanceof DonationDeletionNotFoundError) {
        sendJson(response, 404, { ok: false, message: 'El donativo no existe.' })
        return
      }

      if (error instanceof DonationDeletionError) {
        console.error('[donativos] donation_deletion_failed')
        sendJson(response, 500, {
          ok: false,
          message: 'No fue posible eliminar la donación en este momento.',
        })
        return
      }

      const category =
        error instanceof DatabaseConnectionError
          ? 'database_connection_failed'
          : 'database_query_failed'
      const area =
        isReceptionPlacesRoute || isUpcRepresentativesRoute || isSection5CatalogRoute || isCitiesRoute || isConapinaReceptionManagersRoute
          ? 'catalogos'
          : isDonationDocumentRoute || isDonationDocumentItemRoute
          ? 'donativo_documentos'
          : isDonationActaRoute
            ? 'donativo_actas'
          : isDonationRoute || isDonationDetailRoute
            ? 'donativos'
            : 'auth'
      console.error(`[${area}] ${category}`)

      sendJson(response, 503, {
        ok: false,
        message: isReceptionPlacesRoute || isUpcRepresentativesRoute || isSection5CatalogRoute || isCitiesRoute || isConapinaReceptionManagersRoute
          ? 'No fue posible cargar el catálogo solicitado.'
          : isDonationDocumentRoute || isDonationDocumentItemRoute
          ? 'No fue posible guardar el documento en este momento.'
          : isDonationActaRoute
            ? request.method === 'GET'
              ? 'No fue posible abrir el acta en este momento.'
              : 'No fue posible generar el acta en este momento.'
          : isDonationRoute || isDonationDetailRoute
          ? request.method === 'GET'
            ? 'No fue posible cargar las donaciones.'
            : 'No fue posible guardar los cambios en este momento.'
          : 'No fue posible iniciar sesión en este momento.',
      })
    }
  }
}
