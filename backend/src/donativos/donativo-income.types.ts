export type DonationIncomeProductInput = {
  id?: string
  brand_name: string
  name_product: string
  amount: number
  price: number
}

export type DonationIncomeInput = {
  nombre_almacen: string
  nombre_proveedor: string
  fecha_recepcion_donacion: string
  description: string
  productos: DonationIncomeProductInput[]
}

export type DonationIncomeProduct = Omit<DonationIncomeProductInput, 'id'> & {
  id: string
  income_id: string
  total_price: number
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
}

export type DonationIncome = Omit<DonationIncomeInput, 'productos'> & {
  id: string
  donativo_id: string
  created_by: string
  created_at: string
  updated_by: string | null
  updated_at: string
  productos: DonationIncomeProduct[]
}

function parseDecimal(value: number): { coefficient: bigint; scale: number } {
  if (!Number.isFinite(value)) return { coefficient: 0n, scale: 0 }
  const match = String(value).toLowerCase().match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/)
  if (!match) return { coefficient: 0n, scale: 0 }
  const fraction = match[3] ?? ''
  const exponent = Number(match[4] ?? 0)
  let coefficient = BigInt(`${match[1] === '-' ? '-' : ''}${match[2]}${fraction}`)
  let scale = fraction.length - exponent
  if (scale < 0) {
    coefficient *= 10n ** BigInt(-scale)
    scale = 0
  }
  return { coefficient, scale }
}

export function calculateIncomeProductTotal(amount: number, price: number): number {
  const parsedAmount = parseDecimal(amount)
  const parsedPrice = parseDecimal(price)
  const product = parsedAmount.coefficient * parsedPrice.coefficient
  const productScale = parsedAmount.scale + parsedPrice.scale
  let cents: bigint
  if (productScale <= 2) {
    cents = product * (10n ** BigInt(2 - productScale))
  } else {
    const divisor = 10n ** BigInt(productScale - 2)
    cents = product / divisor
    const remainder = product < 0n ? -(product % divisor) : product % divisor
    if (remainder * 2n >= divisor) cents += product < 0n ? -1n : 1n
  }
  return Number(cents) / 100
}
