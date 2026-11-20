import { rm, rmdir, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TextCodec } from 'surrealdb'
import type { DonationRepository } from './donativo.repository.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDetail,
  DonationListItem,
  DeletedDonation,
} from './donativo.types.ts'

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const backendStorageDirectory = resolve(backendDirectory, 'storage')

export class DonationDeletionValidationError extends Error {}
export class DonationDeletionNotFoundError extends Error {}
export class DonationDeletionError extends Error {}

export class DonationService {
  constructor(
    private readonly repository: DonationRepository,
    private readonly storageRoot = backendStorageDirectory,
  ) {}

  create(createdBy: string, input: DonationCreateInput): Promise<CreatedDonation> {
    return this.repository.create(createdBy, input)
  }

  list(): Promise<DonationListItem[]> {
    return this.repository.list()
  }

  findById(donativoId: string): Promise<DonationDetail | null> {
    return this.repository.findById(donativoId)
  }

  update(
    donativoId: string,
    updatedBy: string,
    input: DonationCreateInput,
  ): Promise<DonationDetail | null> {
    return this.repository.update(donativoId, updatedBy, input)
  }

  async delete(donativoId: string): Promise<DeletedDonation> {
    const donationKey = this.parseDonationId(donativoId)

    try {
      const plan = await this.repository.prepareDeletion(donativoId)
      if (!plan) throw new DonationDeletionNotFoundError()

      const donationDirectory = resolve(this.storageRoot, 'donativos', donationKey)
      const physicalPaths = [...new Set(plan.documentPaths)].map((storedPath) => {
        const physicalPath = resolve(this.storageRoot, storedPath)
        const relativeToStorage = relative(this.storageRoot, physicalPath)
        const relativeToDonation = relative(donationDirectory, physicalPath)
        if (
          !relativeToStorage ||
          isAbsolute(relativeToStorage) ||
          relativeToStorage.startsWith('..') ||
          !relativeToDonation ||
          isAbsolute(relativeToDonation) ||
          relativeToDonation.startsWith('..')
        ) {
          throw new DonationDeletionError()
        }
        return physicalPath
      })

      let existingFileCount = 0
      for (const physicalPath of physicalPaths) {
        try {
          const metadata = await stat(physicalPath)
          if (!metadata.isFile()) throw new DonationDeletionError()
          existingFileCount += 1
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }

      await this.repository.deleteCascade(donativoId)

      for (const physicalPath of physicalPaths) {
        await rm(physicalPath, { force: true })
      }
      await rmdir(donationDirectory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTEMPTY') throw error
      })

      return {
        documentCount: plan.documentCount,
        deletedFileCount: existingFileCount,
      }
    } catch (error) {
      if (
        error instanceof DonationDeletionNotFoundError ||
        error instanceof DonationDeletionValidationError
      ) {
        throw error
      }
      throw new DonationDeletionError()
    }
  }

  private parseDonationId(donativoId: string): string {
    try {
      const recordId = TextCodec.parseRecordId(donativoId)
      const key = String(recordId.id)
      if (recordId.table.name !== 'donativos' || !/^[A-Za-z0-9_-]+$/.test(key)) {
        throw new DonationDeletionValidationError()
      }
      return key
    } catch {
      throw new DonationDeletionValidationError()
    }
  }
}
