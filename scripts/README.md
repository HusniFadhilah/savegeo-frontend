# SaveGeo i18n audit

Run `npm run i18n:audit` locally or `npm run i18n:check` in CI.

The audit scans source files under `src/` and `../backend/app`, compares the
ID and EN catalogs, checks placeholders, finds raw `t("...")` keys, and
reports likely hardcoded JSX UI text. Encoding, catalog parity, placeholder,
and missing-key findings fail the command. Hardcoded text is reported as a
warning so the migration can be completed incrementally without hiding fatal
i18n regressions.

Terms that are intentionally unchanged across locales and detector exceptions
are listed in `i18n-allowlist.json`. Add only product names, official dataset
names, standards, or genuine non-UI values; do not use the allowlist to hide
copy that should be translated.
