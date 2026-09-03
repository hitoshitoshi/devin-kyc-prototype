import "server-only";

/**
 * Full tax identifiers never leave the server as part of the application
 * payload; the client only receives `ssnLast4`. The complete value is
 * disclosed exclusively through the `revealSsn` server action.
 */
const SSN_BY_APPLICATION: Readonly<Record<string, string>> = {
  "APP-7F3A21": "512-44-4819",
  "APP-2C91BD": "601-22-7734",
  "APP-9E04F7": "462-19-3382",
  "APP-B31D6E": "089-56-2210",
  "APP-D5A8C0": "255-70-1195",
  "APP-1A7E93": "530-88-0021",
  "APP-6B2F58": "381-04-6620",
  "APP-E8C412": "004-38-9917",
  "APP-4D9F0B": "533-91-2048",
  "APP-A0E7C5": "592-63-7781",
  "APP-C77B1A": "147-58-3306",
  "APP-F19D3E": "543-27-1108",
};

export function lookupSsn(applicationId: string): string | undefined {
  return SSN_BY_APPLICATION[applicationId];
}
