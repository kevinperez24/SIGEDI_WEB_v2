import { createServer } from 'node:http'
import { AuthService } from './auth/auth.service.ts'
import { SurrealAuthRepository } from './auth/auth.repository.ts'
import { AuthSessionStore } from './auth/auth-session.ts'
import { ReceptionPlaceCatalogRepository } from './catalogos/lugar-recepcion.repository.ts'
import { CityCatalogRepository } from './catalogos/ciudad.repository.ts'
import { ConapinaReceptionManagerRepository } from './catalogos/encargado-conapina.repository.ts'
import { UpcRepresentativeCatalogRepository } from './catalogos/representante-upc.repository.ts'
import {
  destinationWarehouseCatalogRepository,
  distributionPlaceCatalogRepository,
  safekeepingWarehouseCatalogRepository,
} from './catalogos/seccion5.repository.ts'
import { getConfig } from './config.ts'
import { closeSurreal } from './database/surreal.ts'
import { closePersonalSurreal } from './database/personal-surreal.ts'
import { DonationService } from './donativos/donativo.service.ts'
import { SurrealDonationRepository } from './donativos/donativo.repository.ts'
import { DonationDocumentService } from './donativos/donativo-document.service.ts'
import { SurrealDonationDocumentRepository } from './donativos/donativo-document.repository.ts'
import { DonationActaService } from './donativos/donativo-acta.service.ts'
import { SurrealDonationActaRepository } from './donativos/donativo-acta.repository.ts'
import { DonationIncomeService } from './donativos/donativo-income.service.ts'
import { SurrealDonationIncomeRepository } from './donativos/donativo-income.repository.ts'
import { createRequestHandler } from './http/app.ts'

const config = getConfig()
const authService = new AuthService(new SurrealAuthRepository())
const authSessions = new AuthSessionStore()
const donationService = new DonationService(new SurrealDonationRepository())
const donationDocumentService = new DonationDocumentService(
  new SurrealDonationDocumentRepository(),
)
const donationActaService = new DonationActaService(
  new SurrealDonationActaRepository(),
  (donativoId) => donationService.findById(donativoId),
)
const donationIncomeService = new DonationIncomeService(
  new SurrealDonationIncomeRepository(),
)
const receptionPlaceCatalogRepository = new ReceptionPlaceCatalogRepository()
const upcRepresentativeCatalogRepository = new UpcRepresentativeCatalogRepository()
const cityCatalogRepository = new CityCatalogRepository()
const conapinaReceptionManagerRepository = new ConapinaReceptionManagerRepository()

const server = createServer(
  createRequestHandler({
    authenticate: (username, password) => authService.authenticate(username, password),
    allowedOrigin: config.frontendOrigin,
    createSession: (userId) => authSessions.create(userId),
    resolveSession: (token) => authSessions.resolve(token),
    createDonation: (createdBy, input) => donationService.create(createdBy, input),
    listDonations: () => donationService.list(),
    createDonationDocument: (donativoId, createdBy, upload) =>
      donationDocumentService.save(donativoId, createdBy, upload),
    getDonation: (donativoId) => donationService.findById(donativoId),
    updateDonation: (donativoId, updatedBy, input) =>
      donationService.update(donativoId, updatedBy, input),
    listDonationDocuments: (donativoId) => donationDocumentService.listActive(donativoId),
    downloadDonationDocument: (donativoId, documentId) =>
      donationDocumentService.download(donativoId, documentId),
    deleteDonationDocument: (donativoId, documentId, updatedBy) =>
      donationDocumentService.logicalDelete(donativoId, documentId, updatedBy),
    createDonationActa: (donativoId, createdBy) =>
      donationActaService.generate(donativoId, createdBy),
    getActiveDonationActa: (donativoId) => donationActaService.findActive(donativoId),
    downloadDonationActa: (donativoId) => donationActaService.download(donativoId),
    listReceptionPlaces: () => receptionPlaceCatalogRepository.listActive(),
    validateReceptionPlaces: (ids) => receptionPlaceCatalogRepository.validateActiveIds(ids),
    listUpcRepresentatives: () => upcRepresentativeCatalogRepository.listActive(),
    validateUpcRepresentative: (id) =>
      upcRepresentativeCatalogRepository.validateActiveId(id),
    listSafekeepingWarehouses: () => safekeepingWarehouseCatalogRepository.listActive(),
    validateSafekeepingWarehouse: (id) =>
      safekeepingWarehouseCatalogRepository.validateActiveId(id),
    listDistributionPlaces: () => distributionPlaceCatalogRepository.listActive(),
    validateDistributionPlaces: (ids) =>
      distributionPlaceCatalogRepository.validateActiveIds(ids),
    listDestinationWarehouses: () => destinationWarehouseCatalogRepository.listActive(),
    validateDestinationWarehouse: (id) =>
      destinationWarehouseCatalogRepository.validateActiveId(id),
    listCities: () => cityCatalogRepository.listActive(),
    validateCity: (id) => cityCatalogRepository.validateActiveId(id),
    listConapinaReceptionManagers: () => conapinaReceptionManagerRepository.list(),
    findConapinaReceptionManager: (id) => conapinaReceptionManagerRepository.findById(id),
    deleteDonation: (donativoId) => donationService.delete(donativoId),
    createDonationIncome: (donativoId, createdBy, input) =>
      donationIncomeService.create(donativoId, createdBy, input),
    listDonationIncomes: (donativoId) => donationIncomeService.list(donativoId),
    updateDonationIncome: (donativoId, incomeId, updatedBy, input) =>
      donationIncomeService.update(donativoId, incomeId, updatedBy, input),
    deleteDonationIncome: (donativoId, incomeId) =>
      donationIncomeService.delete(donativoId, incomeId),
  }),
)

server.listen(config.port, '127.0.0.1', () => {
  console.log(`SIGEDI backend disponible en http://localhost:${config.port}`)
})

async function shutdown(): Promise<void> {
  server.close()
  await Promise.all([closeSurreal(), closePersonalSurreal()])
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
