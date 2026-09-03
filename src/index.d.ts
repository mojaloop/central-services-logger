/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

 * ModusBox
 - Vijaya Kumar Guthi <vijaya.guthi@modusbox.com>
 --------------
 ******/
import { allLevels } from './lib/constants'

type LevelName = keyof typeof allLevels;

/** Accepts (message), (message, meta), a bare Error, a single object, or printf-style tokens with args. */
type MlLogMethod = (message?: unknown, meta?: unknown, ...args: unknown[]) => MlLogger;

interface TransportDescriptor {
  name: string;
  level?: LevelName | string;
  silent: boolean;
  log(line: string, rec: unknown): void;
  flushSync?(): void;
}

/** The default export: a pino-backed logger with the historical csl (winston-era) surface. */
interface MlLogger {
  error: MlLogMethod;
  warn: MlLogMethod;
  audit: MlLogMethod;
  trace: MlLogMethod;
  info: MlLogMethod;
  perf: MlLogMethod;
  verbose: MlLogMethod;
  debug: MlLogMethod;
  silly: MlLogMethod;

  isErrorEnabled: boolean;
  isWarnEnabled: boolean;
  isAuditEnabled: boolean;
  isTraceEnabled: boolean;
  isInfoEnabled: boolean;
  isPerfEnabled: boolean;
  isVerboseEnabled: boolean;
  isDebugEnabled: boolean;
  isSillyEnabled: boolean;

  log(level: LevelName | string, message?: unknown, meta?: unknown, ...args: unknown[]): MlLogger;
  child(bindings?: Record<string, unknown> | null): MlLogger;
  /** @deprecated alias of child(), kept for winston-era compatibility */
  push(bindings?: Record<string, unknown> | null): MlLogger;
  isLevelEnabled(level: LevelName | string): boolean;

  level: LevelName | string;
  silent: boolean;
  /** @deprecated compatibility shim — descriptors, not winston transport instances */
  readonly transports: TransportDescriptor[];
  readonly levels: typeof allLevels;
  readonly id: number;

  resync(): MlLogger;
  flush(): void;
}

declare const Logger: MlLogger;
export = Logger;
