/*****
 License
 --------------
 Copyright © 2020-2025 Mojaloop Foundation
 The Mojaloop files are made available by the Mojaloop Foundation under the Apache License, Version 2.0 (the "License") and you may not use these files except in compliance with the License. You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, the Mojaloop files are distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

 Contributors
 --------------
 This is the official list of the Mojaloop project contributors for this file.
 Names of the original copyright holders (individuals or organizations)
 should be listed with a '*' in the first column. People who have
 contributed from an organization can be listed under the organization
 that actually holds the copyright for their contributions (see the
 Mojaloop Foundation for an example). Those individuals should have
 their names indented and be marked with a '-'. Email address can be added
 optionally within square brackets <email>.

 * Mojaloop Foundation
 - Name Surname <name.surname@mojaloop.io>

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
type LogMethods = Prettify<{
  [key in AllLevels]: LogMethod;
} & {
  [isKey in `is${Capitalize<AllLevels>}Enabled`]: boolean;
}>;

interface ILogger extends LogMethods {
  child(context?: LogContext): ILogger;
  setLevel(level: AllLevels): void;
  isLevelEnabled(level: AllLevels): boolean;
}

/** Makes the T hover overlay more readable in IDE */
type Prettify<T> = {
  [K in keyof T]: T[K];
} & unknown;

type ContextLoggerOptions = {
  mlLogger?: ILogger; // underlying ML Logger (winston)
  jsonOutput?: boolean;
}

declare class ContextLogger implements ILogger {
  constructor(context?: LogContext, options?: ContextLoggerOptions);

  error: LogMethod;
  warn: LogMethod;
  info: LogMethod;
  verbose: LogMethod;
  debug: LogMethod;
  silly: LogMethod;
  audit: LogMethod;
  trace: LogMethod;
  perf: LogMethod;
  child(context?: LogContext): ContextLogger;
  setLevel(level: AllLevels): void;

  isLevelEnabled(level: AllLevels): boolean;
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

declare function loggerFactory(context?: LogContext): ContextLogger; // or better ILogger?

declare const asyncStorage: AsyncLocalStorage<Json>;

export {
  loggerFactory,
  asyncStorage,
  ContextLogger, // think, if we need to export it
  allLevels,
  ILogger,
};
