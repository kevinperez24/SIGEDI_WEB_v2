import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'
import { TextCodec } from 'surrealdb'
import type { DonationDetail } from './donativo.types.ts'
import type { DonationActaRepository } from './donativo-acta.repository.ts'
import type {
  DonationActaSummary,
  DownloadedDonationActa,
} from './donativo-acta.types.ts'

const backendDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const storageDirectory = resolve(backendDirectory, 'storage', 'donativos')
const storageRoot = resolve(backendDirectory, 'storage')

export class DonationActaValidationError extends Error {}
export class DonationActaNotFoundError extends Error {}

type GetDonation = (donativoId: string) => Promise<DonationDetail | null>

function getCurrentActaDate(): {
  fullDate: string
  year: string
} {
  const parts = new Intl.DateTimeFormat('es-SV', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/El_Salvador',
  }).formatToParts(new Date())
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    fullDate: `${value('weekday')} ${value('day')} de ${value('month')}`,
    year: value('year'),
  }
}

export class DonationActaService {
  constructor(
    private readonly repository: DonationActaRepository,
    private readonly getDonation: GetDonation,
    private readonly donationStorageRoot = storageDirectory,
    private readonly privateStorageRoot = storageRoot,
  ) {}

  async generate(donativoId: string, createdBy: string): Promise<DonationActaSummary> {
    const donationKey = this.parseDonationId(donativoId)
    const donation = await this.getDonation(donativoId)
    if (!donation) throw new DonationActaNotFoundError()

    const version = await this.repository.nextVersion(donativoId)
    const contents = await this.createPdf(donation)
    const storedName = `acta_donacion_v${version}_${randomUUID()}.pdf`
    const originalName = `acta_donacion_v${version}.pdf`
    const relativePath = `donativos/${donationKey}/actas/${storedName}`
    const physicalDirectory = resolve(this.donationStorageRoot, donationKey, 'actas')
    const physicalPath = resolve(physicalDirectory, storedName)
    this.assertContained(this.donationStorageRoot, physicalPath)

    await mkdir(physicalDirectory, { recursive: true })
    await writeFile(physicalPath, contents, { flag: 'wx' })
    try {
      return await this.repository.createVersion({
        donativoId,
        version,
        originalName,
        storedName,
        relativePath,
        sizeBytes: contents.byteLength,
        createdBy,
      })
    } catch (error) {
      await rm(physicalPath, { force: true }).catch(() => undefined)
      throw error
    }
  }

  async findActive(donativoId: string): Promise<DonationActaSummary | null> {
    this.parseDonationId(donativoId)
    return this.repository.findActive(donativoId)
  }

  async download(donativoId: string): Promise<DownloadedDonationActa> {
    this.parseDonationId(donativoId)
    const acta = await this.repository.findActiveFile(donativoId)
    if (!acta || acta.mime_type !== 'application/pdf') throw new DonationActaNotFoundError()

    const physicalPath = resolve(this.privateStorageRoot, acta.ruta_archivo)
    this.assertContained(this.privateStorageRoot, physicalPath)
    try {
      return {
        contents: await readFile(physicalPath),
        name: acta.nombre_archivo,
        mimeType: 'application/pdf',
      }
    } catch {
      throw new DonationActaNotFoundError()
    }
  }

  private createPdf(donation: DonationDetail): Promise<Buffer> {
    return new Promise((resolvePdf, reject) => {
      const document = new PDFDocument({
        size: 'LETTER',
        layout: 'portrait',
        margins: { top: 51, right: 48, bottom: 80, left: 48 },
        bufferPages: true,
      })
      const chunks: Buffer[] = []
      document.on('data', (chunk: Buffer) => chunks.push(chunk))
      document.on('error', reject)
      document.on('end', () => resolvePdf(Buffer.concat(chunks)))

      const tableX = document.page.margins.left
      const tableY = document.page.margins.top
      const tableWidth = document.page.width - document.page.margins.left - document.page.margins.right
      const firstColumnWidth = tableWidth * 0.37
      const secondColumnWidth = tableWidth * 0.33
      const thirdColumnWidth = tableWidth - firstColumnWidth - secondColumnWidth
      const firstRowHeight = 40
      const secondRowHeight = 22

      document
        .lineWidth(0.75)
        .strokeColor('#000000')
        .rect(tableX, tableY, tableWidth, firstRowHeight + secondRowHeight)
        .stroke()
      document
        .moveTo(tableX, tableY + firstRowHeight)
        .lineTo(tableX + tableWidth, tableY + firstRowHeight)
        .stroke()
      document
        .moveTo(tableX + firstColumnWidth, tableY)
        .lineTo(tableX + firstColumnWidth, tableY + firstRowHeight)
        .stroke()
      document
        .moveTo(tableX + firstColumnWidth + secondColumnWidth, tableY)
        .lineTo(tableX + firstColumnWidth + secondColumnWidth, tableY + firstRowHeight + secondRowHeight)
        .stroke()

      const drawCellText = (
        text: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize = 8,
        verticalOffset = 0,
      ) => {
        document.font('Helvetica').fontSize(fontSize).fillColor('#000000')
        const textWidth = width - 16
        const textHeight = document.heightOfString(text, { width: textWidth, lineGap: 0.2 })
        document.text(text, x + 8, y + Math.max(3, (height - textHeight) / 2) + verticalOffset, {
          width: textWidth,
          lineGap: 0.2,
        })
      }

      drawCellText(
        'CONSEJO NACIONAL DE LA PRIMERA\nINFANCIA NIÑEZ Y ADOLESCENCIA\n(CONAPINA)',
        tableX,
        tableY,
        firstColumnWidth,
        firstRowHeight,
        8,
      )
      drawCellText(
        'DOCUMENTO DE CALIDAD:\nFORMULARIO',
        tableX + firstColumnWidth,
        tableY,
        secondColumnWidth,
        firstRowHeight,
      )
      drawCellText(
        'Documento: FOR.UPC.001',
        tableX + firstColumnWidth + secondColumnWidth,
        tableY,
        thirdColumnWidth,
        firstRowHeight,
        8,
        -5,
      )
      drawCellText(
        'Título: Recibido de Recepción de Donaciones',
        tableX,
        tableY + firstRowHeight,
        firstColumnWidth + secondColumnWidth,
        secondRowHeight,
      )
      drawCellText(
        'Naturaleza de revision: Creación',
        tableX + firstColumnWidth + secondColumnWidth,
        tableY + firstRowHeight,
        thirdColumnWidth,
        secondRowHeight,
        7.8,
      )

      document
        .font('Helvetica-Bold')
        .fontSize(12.5)
        .fillColor('#000000')
        .text('ACTA DE RECEPCIÓN DE DONACIONES', tableX, tableY + firstRowHeight + secondRowHeight + 18, {
          align: 'center',
          width: tableWidth,
        })

      const dynamicValues = {
        marcoActa: donation.marco_acta?.trim() ?? '',
        nombreEntidad: donation.nombre_entidad?.trim() ?? '',
        objetivoActa: donation.objetivo_acta?.trim() ?? '',
        entregadosActa: donation.entregados_acta?.trim() ?? '',
        entregaActa: donation.entrega_acta?.trim() ?? '',
      }
      const paragraphY = document.y + 12
      const paragraphOptions = {
        width: tableWidth,
        align: 'left' as const,
        lineGap: 0.5,
        continued: true,
      }

      document
        .font('Helvetica')
        .fontSize(8.8)
        .text('En el marco del ', tableX, paragraphY, paragraphOptions)
      document.font('Helvetica-Bold').text(dynamicValues.marcoActa, { continued: true })
      document.font('Helvetica').text(' de parte de la entidad ', { continued: true })
      document.font('Helvetica-Bold').text(dynamicValues.nombreEntidad, { continued: true })
      document.font('Helvetica').text(' con el objetivo de ', { continued: true })
      document.font('Helvetica-Bold').text(dynamicValues.objetivoActa, { continued: true })
      document
        .font('Helvetica')
        .text(' se recibe donativo de los siguientes insumos, que serán entregados a ', {
          continued: true,
        })
      document.font('Helvetica-Bold').text(dynamicValues.entregadosActa, { continued: true })
      document
        .font('Helvetica')
        .text(' la distribución y entrega se realizará por ', { continued: true })
      document.font('Helvetica-Bold').text(dynamicValues.entregaActa, { continued: true })
      document.font('Helvetica').text('.', { continued: false })
      document.y += 5
      document.text(
        'A continuación se detalla la información respecto al donativo a recibir:',
        tableX,
        document.y,
        { width: tableWidth, align: 'left', lineGap: 0.5 },
      )

      const observations = donation.observaciones?.trim() || 'Sin observaciones registradas.'
      const city = donation.ciudad?.ciudad.trim() ?? ''
      const department = donation.ciudad?.departamento.trim() ?? ''
      const actaDate = getCurrentActaDate()
      const closingText =
        `Observaciones: ${observations}\n\n` +
        `En acuerdo firmados la presente acta, en la ciudad de ${city} departamento de ${department} ` +
        `el dia ${actaDate.fullDate} del año ${actaDate.year}.`
      document.font('Helvetica').fontSize(8.8)
      const closingHeight = document.heightOfString(closingText, {
        width: tableWidth,
        lineGap: 0.5,
      })
      if (document.y + 7 + closingHeight > document.page.height - document.page.margins.bottom) {
        document.addPage()
      } else {
        document.y += 5
      }

      document
        .font('Helvetica')
        .fontSize(8.8)
        .text(`Observaciones: ${observations}`, tableX, document.y, {
          width: tableWidth,
          align: 'left',
          lineGap: 0.5,
        })
      document.y += 5
      document.text('En acuerdo firmados la presente acta, en la ciudad de ', tableX, document.y, {
        width: tableWidth,
        align: 'left',
        lineGap: 0.5,
        continued: true,
      })
      document.font('Helvetica-Bold').text(city, { continued: true })
      document.font('Helvetica').text(' departamento de ', { continued: true })
      document.font('Helvetica-Bold').text(department, { continued: true })
      document.font('Helvetica').text(' el dia ', { continued: true })
      document.font('Helvetica-Bold').text(actaDate.fullDate, { continued: true })
      document.font('Helvetica').text(' del año ', { continued: true })
      document.font('Helvetica-Bold').text(actaDate.year, { continued: true })
      document.font('Helvetica').text('.', { continued: false })

      const signatureBlockHeight = 245
      const signatureBlockTop = document.y + 22
      if (
        signatureBlockTop + signatureBlockHeight >
        document.page.height - document.page.margins.bottom
      ) {
        document.addPage()
      } else {
        document.y = signatureBlockTop
      }

      const signatureTop = document.y
      const signatureGap = 24
      const signatureColumnWidth = (tableWidth - signatureGap) / 2
      const rightColumnX = tableX + signatureColumnWidth + signatureGap
      const centeredText = (
        text: string,
        x: number,
        y: number,
        width: number,
        bold = false,
        size = 8.5,
      ) => {
        document
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(size)
          .fillColor('#000000')
          .text(text, x, y, { width, align: 'center', lineGap: 0.3 })
      }
      const signatureLine = (x: number, y: number, width: number) => {
        document.font('Helvetica').fontSize(8.5).text('F.', x, y - 7, { lineBreak: false })
        document
          .moveTo(x + 14, y)
          .lineTo(x + width, y)
          .lineWidth(0.8)
          .strokeColor('#000000')
          .stroke()
      }
      const donorName = donation.nombre_donante?.trim() ?? ''
      const donorPosition = donation.cargo_donante?.trim() ?? ''
      const donorEntity = donation.nombre_entidad?.trim() ?? ''
      const donorDui = donation.dui_donante?.trim() ?? ''
      const receptionManager = donation.nombre_encargado?.trim() ?? ''
      const receptionManagerPosition = donation.cargo_encargado?.trim() ?? ''
      const upcRepresentative = donation.representante_upc?.nombre.trim() ?? ''

      centeredText('ENTREGA', tableX, signatureTop, signatureColumnWidth, true, 9.5)
      centeredText('RECIBE CONFORME', rightColumnX, signatureTop, signatureColumnWidth, true, 9.5)
      signatureLine(tableX + 12, signatureTop + 36, signatureColumnWidth - 24)
      signatureLine(rightColumnX + 12, signatureTop + 36, signatureColumnWidth - 24)

      centeredText('Donante o Representante:', tableX, signatureTop + 47, signatureColumnWidth)
      centeredText(donorName, tableX, signatureTop + 58, signatureColumnWidth, true, 8.8)
      centeredText('Cargo en la entidad cooperante:', tableX, signatureTop + 76, signatureColumnWidth)
      centeredText(donorPosition, tableX, signatureTop + 87, signatureColumnWidth, true, 8.8)
      centeredText('Nombre de la entidad cooperante:', tableX, signatureTop + 105, signatureColumnWidth)
      centeredText(donorEntity, tableX, signatureTop + 116, signatureColumnWidth, true, 8.8)
      centeredText(
        '(Si es persona natural adicionar\nel número de DUI)',
        tableX,
        signatureTop + 134,
        signatureColumnWidth,
      )
      centeredText(donorDui, tableX, signatureTop + 155, signatureColumnWidth, true, 8.8)

      centeredText(
        'Encargado de la recepción de la donación',
        rightColumnX,
        signatureTop + 47,
        signatureColumnWidth,
      )
      centeredText(receptionManager, rightColumnX, signatureTop + 58, signatureColumnWidth, true, 8.8)
      centeredText('Cargo dentro del CONAPINA', rightColumnX, signatureTop + 76, signatureColumnWidth)
      centeredText(
        receptionManagerPosition,
        rightColumnX,
        signatureTop + 87,
        signatureColumnWidth,
        true,
        8.8,
      )
      centeredText(
        'Consejo Nacional de la Primera Infancia,\nNiñez y Adolescencia (CONAPINA)',
        rightColumnX,
        signatureTop + 107,
        signatureColumnWidth,
      )

      const upcColumnWidth = tableWidth * 0.62
      const upcColumnX = tableX + (tableWidth - upcColumnWidth) / 2
      signatureLine(upcColumnX + 12, signatureTop + 178, upcColumnWidth - 24)
      centeredText(
        'Representante de la Unidad de Proyectos\ny Cooperación de CONAPINA',
        upcColumnX,
        signatureTop + 188,
        upcColumnWidth,
      )
      centeredText(upcRepresentative, upcColumnX, signatureTop + 210, upcColumnWidth, true, 8.8)
      centeredText(
        'Consejo Nacional de la Primera Infancia,\nNiñez y Adolescencia (CONAPINA)',
        upcColumnX,
        signatureTop + 224,
        upcColumnWidth,
      )

      const footerText =
        'El donante declara que la donación se realiza de manera voluntaria, sin expectativa de beneficio, trato preferencial o contraprestación alguna por parte del CONAPINA, como se establece en el Sistema de Gestión Antisoborno.'
      const pageRange = document.bufferedPageRange()
      for (let pageOffset = 0; pageOffset < pageRange.count; pageOffset += 1) {
        document.switchToPage(pageRange.start + pageOffset)
        const pageNumber = pageOffset + 1
        const totalPages = pageRange.count
        const originalBottomMargin = document.page.margins.bottom
        document.page.margins.bottom = 0
        document.font('Helvetica').fontSize(8).fillColor('#000000')
        if (pageOffset === 0) {
          document.text(
            `Página ${pageNumber} de ${totalPages}`,
            tableX + firstColumnWidth + secondColumnWidth + 8,
            tableY + 23,
            { width: thirdColumnWidth - 16, lineBreak: false },
          )
        } else {
          document.text(`Página ${pageNumber} de ${totalPages}`, tableX, 24, {
            width: tableWidth,
            align: 'right',
            lineBreak: false,
          })
        }
        document
          .font('Helvetica')
          .fontSize(6.7)
          .fillColor('#333333')
          .text(footerText, tableX, document.page.height - 53, {
            width: tableWidth,
            align: 'center',
            lineGap: 0.7,
          })
        document.page.margins.bottom = originalBottomMargin
      }
      document.end()
    })
  }

  private parseDonationId(donativoId: string): string {
    try {
      const recordId = TextCodec.parseRecordId(donativoId)
      const key = String(recordId.id)
      if (recordId.table.name !== 'donativos' || !/^[A-Za-z0-9_-]+$/.test(key)) {
        throw new DonationActaValidationError()
      }
      return key
    } catch {
      throw new DonationActaValidationError()
    }
  }

  private assertContained(root: string, filePath: string): void {
    const relativePath = relative(root, filePath)
    if (!relativePath || isAbsolute(relativePath) || relativePath.startsWith('..')) {
      throw new DonationActaValidationError()
    }
  }
}
