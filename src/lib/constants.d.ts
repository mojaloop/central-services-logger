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
declare const SENSITIVE_KEY_EXCLUSIONS: ReadonlyArray<string>;
declare const SENSITIVE_SUBSTRINGS: ReadonlyArray<string>;
declare const SENSITIVE_VALUE_PATTERNS: ReadonlyArray<RegExp>;

export { allLevels, SENSITIVE_KEY_EXCLUSIONS, SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS };
