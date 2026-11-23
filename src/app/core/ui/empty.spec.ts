import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../api/api-error';
import { LoadState } from '../data/data';
import { EmptyComponent } from './widgets';

/** A list as the empty widget sees it: loading, its last failure, and reload. */
function fakeList() {
  const loading = signal(false);
  const error = signal<ApiError | null>(null);
  const list: LoadState & { reloads: number } = {
    loading,
    error,
    reloads: 0,
    reload: async () => {
      list.reloads++;
      error.set(null);
    },
  };
  return { list, loading, error };
}

let fake = fakeList();

@Component({
  imports: [EmptyComponent],
  template: `<app-empty [for]="list" icon="box" title="No products" />`,
})
class Host {
  readonly list = fake.list;
}
describe('EmptyComponent', () => {
  beforeEach(() => {
    fake = fakeList();
  });

  async function render() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('is the empty state of a list that loaded nothing', async () => {
    const { element } = await render();
    expect(element.textContent).toContain('No products');
    expect(element.querySelector('[data-testid="list-retry"]')).toBeNull();
  });

  it('shows a failed load with its reason and Retry, not an empty list', async () => {
    const { fixture, element } = await render();
    fake.error.set(new ApiError(0, 'network_error', 'The server could not be reached.'));
    await fixture.whenStable();
    expect(element.textContent).not.toContain('No products');
    expect(element.textContent).toContain('This could not be loaded');
    expect(element.textContent).toContain('The server could not be reached.');
    expect(element.querySelector('[role="alert"]')).toBeTruthy();

    element.querySelector<HTMLButtonElement>('[data-testid="list-retry"]')!.click();
    await fixture.whenStable();
    expect(fake.list.reloads).toBe(1);
    expect(element.textContent).toContain('No products');
  });

  it('shows the list loading', async () => {
    const { fixture, element } = await render();
    fake.loading.set(true);
    await fixture.whenStable();
    expect(element.querySelector('.skeleton')).toBeTruthy();
  });
});
