import type { DonationRepository } from './donativo.repository.ts'
import type {
  CreatedDonation,
  DonationCreateInput,
  DonationDetail,
  DonationListItem,
} from './donativo.types.ts'

export class DonationService {
  constructor(private readonly repository: DonationRepository) {}

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
}
