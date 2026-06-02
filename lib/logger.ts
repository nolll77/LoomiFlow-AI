import pino from "pino"
import { AsyncLocalStorage } from "async_hooks"

// Storage pour le traceId de corrélation
export interface LogContextStore {
  traceId?: string
}

export const logContext = new AsyncLocalStorage<LogContextStore>()

// Configuration de Pino : sortie standard JSON structurée
// En environnement de développement, on peut aussi l'enlever ou la rendre plus lisible, mais le JSON brut est requis pour la production.
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: {
    env: process.env.NODE_ENV || "development",
    service: "loomiflow-ops",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

// Exécuter une fonction sous un traceId spécifique
export function runWithTrace<T>(traceId: string, fn: () => T): T {
  return logContext.run({ traceId }, fn)
}

// Récupérer le traceId actif
export function getActiveTraceId(): string | undefined {
  return logContext.getStore()?.traceId
}

// Helpers de logs enveloppant pino pour inclure automatiquement le traceId si dispo
export function info(msg: string, details?: Record<string, any>) {
  const traceId = getActiveTraceId()
  logger.info({ ...details, traceId }, msg)
}

export function warn(msg: string, details?: Record<string, any>) {
  const traceId = getActiveTraceId()
  logger.warn({ ...details, traceId }, msg)
}

export function error(msg: string, err?: Error | unknown, details?: Record<string, any>) {
  const traceId = getActiveTraceId()
  const errorObj = err instanceof Error ? { message: err.message, stack: err.stack } : err
  logger.error({ ...details, traceId, error: errorObj }, msg)
}

export function debug(msg: string, details?: Record<string, any>) {
  const traceId = getActiveTraceId()
  logger.debug({ ...details, traceId }, msg)
}
