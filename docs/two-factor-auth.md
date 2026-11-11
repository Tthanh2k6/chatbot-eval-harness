# Quillnote Two-Factor Authentication

Quillnote supports Two-Factor Authentication (2FA) across all subscription tiers, including the Free, Plus, and Team plans. Users can enable 2FA using TOTP authenticator apps (such as 1Password, Authy, or Google Authenticator) that generate 6-digit verification codes every 30 seconds, or FIDO2/WebAuthn hardware security keys. SMS two-factor authentication is not supported due to SIM-swapping security risks.

When you activate 2FA on your account, Quillnote generates 10 single-use 8-character alphanumeric recovery codes. You must download or print these recovery codes to finish setup, as each recovery code can be used once to sign in if you lose access to your authenticator app. Generating a fresh batch of recovery codes immediately invalidates all previous codes.

During sign-in, users can select "Trust this browser for 30 days" after verifying a 2FA code to skip verification prompts on that device for one month. Entering an invalid 2FA code 5 consecutive times locks the account for 15 minutes and sends an immediate security alert email to the account owner.
