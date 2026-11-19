import { createServer } from 'node:http'
import { AuthService } from './auth/auth.service.ts'
import { SurrealAuthRepository } from './auth/auth.repository.ts'
import { AuthSessionStore } from './auth/auth-session.ts'
import { getConfig } from './config.ts'
import { closeSurreal } from './database/surreal.ts'
import { DonationService } from './donativos/donativo.service.ts'
import { SurrealDonationRepository } from './donativos/donativo.repository.ts'
import { DonationDocumentService } from './donativos/donativo-document.service.ts'
import { SurrealDonationDocumentRepository } from './donativos/donativo-document.repository.ts'
import { createRequestHandler } from './http/app.ts'

const config = getConfig()
const authService = new AuthService(new SurrealAuthRepository())
const authSessions = new AuthSessionStore()
const donationService = new DonationService(new SurrealDonationRepository())
const donationDocumentService = new DonationDocumentService(
  new SurrealDonationDocumentRepository(),
)

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
  }),
)

server.listen(config.port, '127.0.0.1', () => {
  console.log(`SIGEDI backend disponible en http://localhost:${config.port}`)
})

async function shutdown(): Promise<void> {
  server.close()
  await closeSurreal()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
