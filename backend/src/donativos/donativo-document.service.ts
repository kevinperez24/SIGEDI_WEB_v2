import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextCodec } from 'surrealdb'
import type { DonationDocumentRepository } from './donativo-document.repository.ts'
import type {
  CreatedDonationDocument,
  DonationDocumentFile,
  DonationDocumentItem,
  DonationDocumentType,
  DonationDocumentUpload,
} from './donativo-document.types.ts'

const MAX_FILE_BYTES = 10 * 1024 * 1024
const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const storageDirectory = resolve(backendDirectory, 'storage', 'donativos')
const backendStorageDirectory = resolve(backendDirectory, 'storage')

const allowedFiles = {
  'application/pdf': { extension: '.pdf', signature: Buffer.from('%PDF-') },
  'application/msword': {
    extension: '.doc',
    signature: Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extension: '.docx',
    signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  },
} as const

export class DonationDocumentValidationError extends Error {}
export class DonationNotFoundError extends Error {}
export class DonationDocumentConflictError extends Error {}
export class DonationDocumentNotFoundError extends Error {}

export type DownloadedDonationDocument = {
  contents: Buffer
  name: string
  mimeType: string
}

export class DonationDocumentService {
  constructor(
    private readonly repository: DonationDocumentRepository,
    private readonly storageRoot = storageDirectory,
  ) {}

  async save(
    donativoId: string,
    createdBy: string,
    upload: DonationDocumentUpload,
  ): Promise<CreatedDonationDocument> {
    const donativoKey = this.validate(donativoId, upload)

    if (!(await this.repository.donationExists(donativoId))) {
      throw new DonationNotFoundError()
    }

    if (await this.repository.documentExists(donativoId, upload.tipoDocumento)) {
      throw new DonationDocumentConflictError()
    }

    const fileRule = allowedFiles[upload.mimeType as keyof typeof allowedFiles]
    const prefix = upload.tipoDocumento === 'MEMO_INICIAL' ? 'memo_inicial' : 'memo_de'
    const storedName = `${prefix}_${randomUUID()}${fileRule.extension}`
    const relativePath = `donativos/${donativoKey}/${storedName}`
    const physicalDirectory = resolve(this.storageRoot, donativoKey)
    const physicalPath = resolve(physicalDirectory, storedName)

    await mkdir(physicalDirectory, { recursive: true })
    await writeFile(physicalPath, upload.contents, { flag: 'wx' })

    try {
      return await this.repository.create({
        donativoId,
        tipoDocumento: upload.tipoDocumento,
        originalName: upload.originalName,
        storedName,
        relativePath,
        mimeType: upload.mimeType,
        sizeBytes: upload.contents.byteLength,
        createdBy,
      })
    } catch (error) {
      await rm(physicalPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  listActive(donativoId: string): Promise<DonationDocumentItem[]> {
    this.parseDonationId(donativoId)
    return this.repository.listActive(donativoId)
  }

  async download(
    donativoId: string,
    documentId: string,
  ): Promise<DownloadedDonationDocument> {
    this.parseDonationId(donativoId)
    this.parseDocumentId(documentId)
    const document = await this.repository.findActiveFile(donativoId, documentId)
    if (!document) throw new DonationDocumentNotFoundError()

    const physicalPath = resolve(backendStorageDirectory, document.ruta_archivo)
    const storagePrefix = `${backendStorageDirectory}\\`
    if (!physicalPath.startsWith(storagePrefix)) throw new DonationDocumentNotFoundError()

    try {
      return {
        contents: await readFile(physicalPath),
        name: document.nombre_archivo,
        mimeType: document.mime_type,
      }
    } catch {
      throw new DonationDocumentNotFoundError()
    }
  }

  async logicalDelete(
    donativoId: string,
    documentId: string,
    updatedBy: string,
  ): Promise<void> {
    this.parseDonationId(donativoId)
    this.parseDocumentId(documentId)
    const deleted = await this.repository.logicalDelete(donativoId, documentId, updatedBy)
    if (!deleted) throw new DonationDocumentNotFoundError()
  }

  private validate(donativoId: string, upload: DonationDocumentUpload): string {
    const donativoKey = this.parseDonationId(donativoId)

    if (upload.tipoDocumento !== 'MEMO_INICIAL' && upload.tipoDocumento !== 'MEMO_DE') {
      throw new DonationDocumentValidationError()
    }

    const fileRule = allowedFiles[upload.mimeType as keyof typeof allowedFiles]
    if (!fileRule || extname(upload.originalName).toLowerCase() !== fileRule.extension) {
      throw new DonationDocumentValidationError()
    }

    if (
      upload.contents.byteLength === 0 ||
      upload.contents.byteLength > MAX_FILE_BYTES ||
      !upload.contents.subarray(0, fileRule.signature.length).equals(fileRule.signature)
    ) {
      throw new DonationDocumentValidationError()
    }

    return donativoKey
  }

  private parseDonationId(donativoId: string): string {
    try {
      const recordId = TextCodec.parseRecordId(donativoId)
      const key = String(recordId.id)
      if (recordId.table.name !== 'donativos' || !/^[A-Za-z0-9_-]+$/.test(key)) {
        throw new DonationDocumentValidationError()
      }
      return key
    } catch {
      throw new DonationDocumentValidationError()
    }
  }

  private parseDocumentId(documentId: string): void {
    try {
      const recordId = TextCodec.parseRecordId(documentId)
      if (recordId.table.name !== 'donativo_documentos') {
        throw new DonationDocumentValidationError()
      }
    } catch {
      throw new DonationDocumentValidationError()
    }
  }
}
