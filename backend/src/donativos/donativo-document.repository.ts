import { TextCodec } from 'surrealdb'
import { DatabaseConnectionError, DatabaseQueryError } from '../database/errors.ts'
import { getSurreal } from '../database/surreal.ts'
import type {
  CreatedDonationDocument,
  DonationDocumentFile,
  DonationDocumentItem,
  DonationDocumentMetadata,
  DonationDocumentType,
} from './donativo-document.types.ts'

const DONATION_EXISTS_QUERY = `
  SELECT id FROM donativos WHERE id = $donativo_id LIMIT 1;
`

const DOCUMENT_EXISTS_QUERY = `
  SELECT id
  FROM donativo_documentos
  WHERE donativo_id = $donativo_id AND tipo_documento = $tipo_documento
  LIMIT 1;
`

const CREATE_DOCUMENT_QUERY = `
  CREATE donativo_documentos CONTENT {
    donativo_id: $donativo_id,
    tipo_documento: $tipo_documento,
    nombre_archivo: $nombre_archivo,
    nombre_almacenado: $nombre_almacenado,
    ruta_archivo: $ruta_archivo,
    mime_type: $mime_type,
    size_bytes: $size_bytes,
    estado: 'ACTIVO',
    created_by: $created_by,
    updated_by: NONE
  }
  RETURN id, tipo_documento, nombre_archivo, estado;
`

const LIST_ACTIVE_DOCUMENTS_QUERY = `
  SELECT id, tipo_documento, nombre_archivo, mime_type, size_bytes, estado, created_at
  FROM donativo_documentos
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVO'
  ORDER BY created_at DESC;
`

const FIND_ACTIVE_DOCUMENT_QUERY = `
  SELECT
    id,
    tipo_documento,
    nombre_archivo,
    mime_type,
    size_bytes,
    estado,
    created_at,
    ruta_archivo
  FROM donativo_documentos
  WHERE id = $documento_id AND donativo_id = $donativo_id AND estado = 'ACTIVO'
  LIMIT 1;
`

const DELETE_DOCUMENT_QUERY = `
  UPDATE $documento_id
  SET estado = 'ELIMINADO', updated_by = $updated_by
  WHERE donativo_id = $donativo_id AND estado = 'ACTIVO'
  RETURN id;
`

type DocumentRecord = {
  id: unknown
  tipo_documento: DonationDocumentType
  nombre_archivo: string
  estado: 'ACTIVO'
}

type DocumentItemRecord = {
  id: unknown
  tipo_documento: DonationDocumentType
  nombre_archivo: string
  mime_type: string
  size_bytes: number
  estado: 'ACTIVO'
  created_at: unknown
  ruta_archivo?: string
}

function donationRecordId(donativoId: string) {
  const recordId = TextCodec.parseRecordId(donativoId)
  if (recordId.table.name !== 'donativos') throw new DatabaseQueryError()
  return recordId
}

function documentRecordId(documentId: string) {
  const recordId = TextCodec.parseRecordId(documentId)
  if (recordId.table.name !== 'donativo_documentos') throw new DatabaseQueryError()
  return recordId
}

function mapDocument(record: DocumentItemRecord): DonationDocumentItem {
  return {
    id: String(record.id),
    tipo_documento: record.tipo_documento,
    nombre_archivo: record.nombre_archivo,
    mime_type: record.mime_type,
    size_bytes: Number(record.size_bytes),
    estado: 'ACTIVO',
    created_at: String(record.created_at),
  }
}

export interface DonationDocumentRepository {
  donationExists(donativoId: string): Promise<boolean>
  documentExists(donativoId: string, tipoDocumento: DonationDocumentType): Promise<boolean>
  create(metadata: DonationDocumentMetadata): Promise<CreatedDonationDocument>
  listActive(donativoId: string): Promise<DonationDocumentItem[]>
  findActiveFile(donativoId: string, documentId: string): Promise<DonationDocumentFile | null>
  logicalDelete(donativoId: string, documentId: string, updatedBy: string): Promise<boolean>
}

export class SurrealDonationDocumentRepository implements DonationDocumentRepository {
  async donationExists(donativoId: string): Promise<boolean> {
    return this.exists(DONATION_EXISTS_QUERY, { donativo_id: donationRecordId(donativoId) })
  }

  async documentExists(
    donativoId: string,
    tipoDocumento: DonationDocumentType,
  ): Promise<boolean> {
    return this.exists(DOCUMENT_EXISTS_QUERY, {
      donativo_id: donationRecordId(donativoId),
      tipo_documento: tipoDocumento,
    })
  }

  async create(metadata: DonationDocumentMetadata): Promise<CreatedDonationDocument> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[DocumentRecord[]]>(CREATE_DOCUMENT_QUERY, {
        donativo_id: donationRecordId(metadata.donativoId),
        tipo_documento: metadata.tipoDocumento,
        nombre_archivo: metadata.originalName,
        nombre_almacenado: metadata.storedName,
        ruta_archivo: metadata.relativePath,
        mime_type: metadata.mimeType,
        size_bytes: metadata.sizeBytes,
        created_by: metadata.createdBy,
      })
      const record = records[0]

      if (!record || record.estado !== 'ACTIVO') throw new DatabaseQueryError()

      return {
        id: String(record.id),
        tipo_documento: record.tipo_documento,
        nombre_archivo: record.nombre_archivo,
        estado: 'ACTIVO',
      }
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async listActive(donativoId: string): Promise<DonationDocumentItem[]> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[DocumentItemRecord[]]>(
        LIST_ACTIVE_DOCUMENTS_QUERY,
        { donativo_id: donationRecordId(donativoId) },
      )
      return records.map(mapDocument)
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async findActiveFile(
    donativoId: string,
    documentId: string,
  ): Promise<DonationDocumentFile | null> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[DocumentItemRecord[]]>(
        FIND_ACTIVE_DOCUMENT_QUERY,
        {
          donativo_id: donationRecordId(donativoId),
          documento_id: documentRecordId(documentId),
        },
      )
      const record = records[0]
      if (!record?.ruta_archivo) return null
      return { ...mapDocument(record), ruta_archivo: record.ruta_archivo }
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  async logicalDelete(
    donativoId: string,
    documentId: string,
    updatedBy: string,
  ): Promise<boolean> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[unknown[]]>(DELETE_DOCUMENT_QUERY, {
        donativo_id: donationRecordId(donativoId),
        documento_id: documentRecordId(documentId),
        updated_by: updatedBy,
      })
      return Array.isArray(records) && records.length > 0
    } catch (error) {
      if (error instanceof DatabaseConnectionError || error instanceof DatabaseQueryError) {
        throw error
      }
      throw new DatabaseQueryError()
    }
  }

  private async exists(query: string, bindings: Record<string, unknown>): Promise<boolean> {
    try {
      const database = await getSurreal()
      const [records] = await database.query<[unknown[]]>(query, bindings)
      return Array.isArray(records) && records.length > 0
    } catch (error) {
      if (error instanceof DatabaseConnectionError) throw error
      throw new DatabaseQueryError()
    }
  }
}
