import { isCliodotFail, isCliodotOk, type CliodotMethodResult } from "../http/cliodot-result";

export function assertOk<T extends object>(
  result: CliodotMethodResult<T>
): asserts result is Extract<CliodotMethodResult<T>, { ok: true }> {
  expect(isCliodotOk(result)).toBe(true);
  if (isCliodotFail(result)) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
}
