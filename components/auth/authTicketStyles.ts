// Sign-in and register additions on top of the landing stylesheet. Scoped under `.tk-auth`.
export const authTicketCss = `
.tk-auth { display: flex; flex-direction: column; }
.tk-auth-main { flex: 1 0 auto; display: grid; align-content: center; justify-items: center; gap: 26px; padding-block: clamp(28px, 6vw, 64px); }
.tk-auth-ticket { --cut: 64%; width: min(100%, 860px); grid-template-columns: minmax(0, 64fr) minmax(0, 36fr); }
.tk-auth h1 { font-size: clamp(50px, 7vw, 86px); }
.tk-auth .tk-t-main > p { font-size: 16px; }
.tk-fields { display: grid; gap: 14px; }
.tk-field { display: grid; gap: 6px; }
.tk-field > span { font: 800 10.5px var(--mono); letter-spacing: 0.14em; text-transform: uppercase; color: #8a7b62; }
.tk-field input { width: 100%; min-height: 48px; padding: 0 14px; border-radius: 10px; border: 1px solid #cdbfa4; background: #fbf6ea; color: var(--ink); font: 500 16px var(--sans); outline: none; transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.tk-field input::placeholder { color: #a8977a; }
.tk-field input:focus { border-color: var(--stamp); box-shadow: 0 0 0 3px rgba(179, 38, 30, 0.14); }
.tk-field input:-webkit-autofill { -webkit-box-shadow: 0 0 0 40px #fbf6ea inset; -webkit-text-fill-color: var(--ink); }
.tk-field input:disabled { opacity: 0.7; }
.tk-pw { position: relative; }
.tk-pw input { padding-right: 74px; }
.tk-reveal { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); height: 36px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: #6b5e4a; font: 800 11px var(--mono); letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
.tk-reveal:hover { background: rgba(27, 20, 17, 0.06); color: var(--ink); }
.tk-msg { padding: 10px 12px; border-radius: 10px; font-size: 14px; }
.tk-msg-err { color: var(--stamp); background: rgba(179, 38, 30, 0.08); border: 1px solid rgba(179, 38, 30, 0.3); }
.tk-msg-ok { color: #2f6b3f; background: rgba(47, 107, 63, 0.08); border: 1px solid rgba(47, 107, 63, 0.3); }
.tk-auth-actions { display: grid; gap: 10px; }
.tk-auth-actions .tk-btn { width: 100%; }
.tk-auth button.tk-btn-ink { border: 0; }
.tk-auth .tk-btn:disabled { opacity: 0.6; cursor: default; transform: none; }
.tk-auth .tk-t-stub small { line-height: 1.5; }

@media (max-width: 820px) {
  .tk-auth-main { align-content: start; }
  .tk-auth-ticket { grid-template-columns: minmax(0, 1fr); }
  .tk-auth .tk-t-stub { flex-direction: row; flex-wrap: wrap; align-items: center; padding: 20px 24px; gap: 12px 18px; }
  .tk-auth .tk-admit { font-size: 34px; }
  .tk-auth .tk-barcode { flex: 1 1 120px; width: auto; height: 34px; }
  .tk-auth .tk-no { display: none; }
  .tk-auth .tk-t-stub small { flex-basis: 100%; }
}
`;
