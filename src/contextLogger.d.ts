/*****
 License
 --------------
 Copyright © 2017 Bill & Melinda Gates Foundation
 The Mojaloop files are made available by the Bill & Melinda Gates Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at
 http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Gates Foundation organization for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.
 * Gates Foundation
 - Name Surname <name.surname@gatesfoundation.com>

 * Eugen Klymniuk <eugen.klymniuk@infitx.com>
 --------------
 **********/

import { AsyncLocalStorage } from 'async_hooks';
import { allLevels } from './lib/constants';

type AllLevels = keyof typeof allLevels;

type Json =
  | string
  | number
  | boolean
  | { [x: string]: Json }
  | Array<Json>;

type LogContext = Json | null;
type LogMeta = unknown; //  Json | Error | null;
type LogMethod = (message: string | Error, meta?: LogMeta) => void;

interface ContextLoggerConstructor {
  new (context?: LogContext): ContextLogger;
}

declare class ContextLogger {
  constructor(context?: LogContext);

  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  verbose: LogMethod;
  debug: LogMethod;
  silly: LogMethod;
  audit: LogMethod;
  trace: LogMethod;
  perf: LogMethod;
  child(context: Record<string, any>): ContextLogger;
  setLevel(level: AllLevels): void;

  isErrorEnabled: boolean;
  isWarnEnabled: boolean;
  isAuditEnabled: boolean;
  isTraceEnabled: boolean;
  isInfoEnabled: boolean;
  isPerfEnabled: boolean;
  isVerboseEnabled: boolean;
  isDebugEnabled: boolean;
  isSillyEnabled: boolean;
}

declare function loggerFactory(context?: LogContext): ContextLogger;

declare const asyncStorage: AsyncLocalStorage<Json>;

export {
  loggerFactory,
  asyncStorage,
  ContextLogger
};
