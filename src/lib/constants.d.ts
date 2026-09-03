declare const allLevels: Readonly<{
    error: 0;
    warn: 1;
    audit: 2;
    trace: 3;
    info: 4;
    perf: 5;
    verbose: 6;
    debug: 7;
    silly: 8;
  }>;
declare const LEVEL_VALUES: Readonly<{
    silly: 10;
    debug: 20;
    verbose: 25;
    perf: 28;
    info: 30;
    trace: 32;
    audit: 35;
    warn: 40;
    error: 50;
  }>;
declare const LEVEL_LABELS: Readonly<Record<number, keyof typeof allLevels>>;
declare const LEVEL_NAMES: ReadonlyArray<keyof typeof allLevels>;
declare const SENSITIVE_KEY_EXCLUSIONS: ReadonlyArray<string>;
declare const SENSITIVE_SUBSTRINGS: ReadonlyArray<string>;
declare const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<RegExp>;

export { allLevels, LEVEL_VALUES, LEVEL_LABELS, LEVEL_NAMES, SENSITIVE_KEY_EXCLUSIONS, SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS };
