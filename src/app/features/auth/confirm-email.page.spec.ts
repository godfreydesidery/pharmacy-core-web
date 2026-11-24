import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import ConfirmEmailPage from './confirm-email.page';

/** The new password's minimum on the email pages (stream 1's undo, stream 5's rule, STD-21). */
describe('ConfirmEmailPage password rule', () => {
  function form(token: string, path: string): FormGroup {
    TestBed.configureTestingModule({
      imports: [ConfirmEmailPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap({ token }), routeConfig: { path } },
          },
        },
      ],
    });
    const page = TestBed.createComponent(ConfirmEmailPage).componentInstance;
    return (page as unknown as { form: FormGroup }).form;
  }

  function accepts(group: FormGroup, password: string): boolean {
    const control = group.controls['newPassword'];
    control.setValue(password);
    return control.valid;
  }

  it('the undo of an email change needs 15 characters: it may leave the password alone', () => {
    const group = form('per_abc', 'revert-email');
    expect(accepts(group, 'Back#2026-home')).toBe(false);
    expect(accepts(group, 'Back#2026-home-strong')).toBe(true);
  });

  it('a recovery keeps the 8-character minimum; a plain confirmation asks for none', () => {
    expect(accepts(form('prc_abc', 'confirm-email'), 'Short#26')).toBe(true);
    TestBed.resetTestingModule();
    expect(accepts(form('pec_abc', 'confirm-email'), '')).toBe(true);
  });
});
