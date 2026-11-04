// src/features/auth/crypto.ts
// Hiện thực hóa mã hóa mật khẩu bảo mật phía Frontend bằng Web Crypto API (PBKDF2-HMAC-SHA256)

/**
 * Chuyển đổi ArrayBuffer sang chuỗi Hex
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Chuyển đổi chuỗi Hex sang Uint8Array
 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Sinh chuỗi Salt ngẫu nhiên 16 bytes (32 ký tự hex)
 */
export function generateSalt(): string {
  const array = new Uint8Array(16);
  globalThis.crypto.getRandomValues(array);
  return bufferToHex(array.buffer);
}

/**
 * Băm mật khẩu bằng PBKDF2-HMAC-SHA256 với 100.000 vòng lặp
 */
export async function hashPassword(
  password: string,
  existingSalt?: string
): Promise<{ hash: string; salt: string }> {
  const salt = existingSalt || generateSalt();
  const enc = new TextEncoder();

  // Nhập mật khẩu dạng raw key
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Dẫn xuất khóa SHA-256 256 bits
  const derivedKey = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBuffer(salt) as unknown as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  const hash = bufferToHex(derivedKey);
  return { hash, salt };
}

/**
 * Đối soát mật khẩu người dùng nhập với hash và salt lưu trong IndexedDB
 */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string
): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  return hash === expectedHash;
}

/**
 * Kiểm tra độ mạnh của mật khẩu khi đăng ký
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  isValid: boolean;
  strength: 'YEU' | 'TRUNG_BINH' | 'MANH';
  message?: string;
} {
  if (password.length < 6) {
    return {
      valid: false,
      isValid: false,
      strength: 'YEU',
      message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự.',
    };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  if (!hasLetter || !hasNumber) {
    return {
      valid: false,
      isValid: false,
      strength: 'YEU',
      message: 'Mật khẩu phải chứa ít nhất 1 chữ cái và 1 chữ số.',
    };
  }

  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const isStrong = password.length >= 8 && hasSpecial;

  return {
    valid: true,
    isValid: true,
    strength: isStrong ? 'MANH' : 'TRUNG_BINH',
  };
}
