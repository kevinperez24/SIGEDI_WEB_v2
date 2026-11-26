import { TextCodec } from 'surrealdb'
import type { DonationIncomeRepository } from './donativo-income.repository.ts'
import type { DonationIncome, DonationIncomeInput } from './donativo-income.types.ts'

export class DonationIncomeValidationError extends Error {}
export class DonationIncomeNotFoundError extends Error {}

function validateRecordId(value: string, table: 'donativos' | 'incomes' | 'detincomes'): void {
  try {
    const recordId = TextCodec.parseRecordId(value)
    if (recordId.table.name !== table) throw new DonationIncomeValidationError()
  } catch {
    throw new DonationIncomeValidationError()
  }
}

export class DonationIncomeService {
  constructor(private readonly repository: DonationIncomeRepository) {}

  async create(donativoId: string, createdBy: string, input: DonationIncomeInput): Promise<DonationIncome> {
    validateRecordId(donativoId, 'donativos')
    const existing = await this.repository.list(donativoId)
    if (!existing) throw new DonationIncomeNotFoundError()
    if (existing.some((income) => income.tipo_recepcion === 'FINAL')) {
      throw new DonationIncomeValidationError()
    }
    const numeroEntrega = existing.reduce(
      (maximum, income) => Math.max(maximum, income.numero_entrega),
      0,
    ) + 1
    const income = await this.repository.create(donativoId, createdBy, input, numeroEntrega)
    if (!income) throw new DonationIncomeNotFoundError()
    return income
  }

  async list(donativoId: string): Promise<DonationIncome[]> {
    validateRecordId(donativoId, 'donativos')
    const incomes = await this.repository.list(donativoId)
    if (!incomes) throw new DonationIncomeNotFoundError()
    return incomes
  }

  async update(
    donativoId: string,
    incomeId: string,
    updatedBy: string,
    input: DonationIncomeInput,
  ): Promise<DonationIncome> {
    validateRecordId(donativoId, 'donativos')
    validateRecordId(incomeId, 'incomes')
    for (const product of input.productos) {
      if (product.id) validateRecordId(product.id, 'detincomes')
    }
    const incomes = await this.repository.list(donativoId)
    if (!incomes) throw new DonationIncomeNotFoundError()
    const existing = incomes.find((income) => income.id === incomeId)
    if (!existing) throw new DonationIncomeNotFoundError()
    if (existing.estado_recepcion !== 'PENDIENTE_ACTA'
      && existing.tipo_recepcion !== input.tipo_recepcion) {
      throw new DonationIncomeValidationError()
    }
    if (input.tipo_recepcion === 'FINAL' && incomes.some(
      (income) => income.id !== incomeId && income.tipo_recepcion === 'FINAL',
    )) throw new DonationIncomeValidationError()
    const maximumDeliveryNumber = incomes.reduce(
      (maximum, income) => Math.max(maximum, income.numero_entrega),
      0,
    )
    if (input.tipo_recepcion === 'FINAL' && existing.numero_entrega !== maximumDeliveryNumber) {
      throw new DonationIncomeValidationError()
    }
    const income = await this.repository.update(donativoId, incomeId, updatedBy, input)
    if (!income) throw new DonationIncomeNotFoundError()
    return income
  }

  async delete(donativoId: string, incomeId: string): Promise<void> {
    validateRecordId(donativoId, 'donativos')
    validateRecordId(incomeId, 'incomes')
    const incomes = await this.repository.list(donativoId)
    if (!incomes) throw new DonationIncomeNotFoundError()
    const existing = incomes.find((income) => income.id === incomeId)
    const lastDelivery = incomes.at(-1)
    if (!existing) throw new DonationIncomeNotFoundError()
    if (existing.estado_recepcion !== 'PENDIENTE_ACTA' || lastDelivery?.id !== incomeId) {
      throw new DonationIncomeValidationError()
    }
    if (!(await this.repository.delete(donativoId, incomeId))) {
      throw new DonationIncomeNotFoundError()
    }
  }
}
