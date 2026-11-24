import API_REASONS from './api-reasons.json';
import { EN } from './en';
import { SW } from './sw';

/**
 * Every refusal the API sends (api-reasons.json, generated from its source by
 * `npm run i18n:reasons`) has its line in both languages, and a line names only the problem
 * members its reason carries. `npm run i18n:check` makes the same check in CI.
 */
describe('API refusal reasons', () => {
  const reasons: Record<string, string[]> = API_REASONS.reasons;
  const placeholders = (line: string) =>
    [...line.matchAll(/\{\{\s*(\w+)\s*}}/g)].map((match) => match[1]);

  it('lists the reasons the API sends, with their problem members', () => {
    expect(Object.keys(reasons).length).toBeGreaterThan(300);
    expect(reasons['insufficient_stock']).toEqual(
      expect.arrayContaining(['product', 'available', 'requested']),
    );
    expect(reasons['approval_required']).toEqual(['action', 'amount', 'selfApproval']);
    expect(reasons['batch_cost_differs']).toEqual(['batchUnitCost']);
  });

  it('has an English and a Swahili line for every one', () => {
    const missing = Object.keys(reasons).flatMap((reason) => [
      ...(EN[`errors.${reason}`] ? [] : [`en ${reason}`]),
      ...(SW[`errors.${reason}`] ? [] : [`sw ${reason}`]),
    ]);
    expect(missing).toEqual([]);
  });

  it('uses only the placeholders the problem carries', () => {
    const unknown = Object.entries(reasons).flatMap(([reason, members]) =>
      [EN, SW].flatMap((dictionary) =>
        placeholders(dictionary[`errors.${reason}`] ?? '')
          .filter((name) => !members.includes(name))
          .map((name) => `${reason} {{${name}}}`),
      ),
    );
    expect(unknown).toEqual([]);
    expect(placeholders(SW['errors.batch_cost_differs'])).toEqual(['batchUnitCost']);
  });
});
