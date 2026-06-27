/** Longitud mínima alineada con registro/login. */
export const PASSWORD_MIN_LENGTH = 8;

/** Al menos 8 caracteres, una letra y un dígito. */
export const PASSWORD_STRENGTH_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export function isStrongPassword(password: string): boolean {
  return PASSWORD_STRENGTH_REGEX.test(password);
}
