import { pino } from "pino";

export type Logger = pino.Logger;

export function createLogger(level: pino.LevelWithSilent): Logger {
  return pino({ level, base: { app: "openc" } });
}
