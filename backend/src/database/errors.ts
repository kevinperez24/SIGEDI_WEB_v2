export class DatabaseConnectionError extends Error {
  constructor() {
    super('No fue posible establecer la conexión con la base de datos.')
    this.name = 'DatabaseConnectionError'
  }
}

export class DatabaseQueryError extends Error {
  constructor() {
    super('No fue posible ejecutar la operación de base de datos.')
    this.name = 'DatabaseQueryError'
  }
}
