/** The centred card the public account pages share (forgot and reset password, invitations). */
export const AUTH_CARD_STYLES = `
  .auth-card-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(900px 500px at 10% -10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent),
      radial-gradient(700px 400px at 110% 110%, color-mix(in srgb, #0ea5e9 14%, transparent), transparent),
      var(--bg);
  }
  .auth-card {
    width: 100%;
    max-width: 420px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 24px 60px rgba(15, 23, 42, 0.12);
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .auth-card h1 {
    font-size: 24px;
    letter-spacing: -0.02em;
  }
  .auth-card .input.lg {
    height: 44px;
  }
  .auth-card .back {
    font-size: 13px;
    color: var(--primary);
    align-self: center;
  }
  .auth-card .badge-icon {
    width: 52px;
    height: 52px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
  }
`;
