import * as OTPAuth from "otpauth";

export function generateTOTP(secret: string) {
    const cleanSecret = secret.replace(/\s+/g, '').toUpperCase();
    const totp = new OTPAuth.TOTP({
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(cleanSecret)
    });
    return totp.generate();
}
