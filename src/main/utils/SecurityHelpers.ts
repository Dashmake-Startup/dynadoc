import crypto from 'crypto'
import fs from 'fs/promises'

export default class SecurityHelpers {
  static SALT_LEN = 16
  static IV_LEN = 12
  static TAG_LEN = 16
  static KEY_LEN = 32
  static SCRYPT_N = 16384
  static SCRYPT_R = 8
  static SCRYPT_P = 1

  static deriveKey(password: string | Buffer, salt: Buffer) {
    return crypto.scryptSync(password, salt, this.KEY_LEN, {
      N: this.SCRYPT_N,
      r: this.SCRYPT_R,
      p: this.SCRYPT_P
    })
  }

  static async decryptFileToMemory(encPath: string, password: string | Buffer): Promise<Buffer> {
    const handle = await fs.open(encPath, 'r')
    try {
      const headerBuf = Buffer.alloc(this.SALT_LEN + this.IV_LEN)
      await handle.read(headerBuf, 0, headerBuf.length, 0)
      const salt = headerBuf.subarray(0, this.SALT_LEN)
      const iv = headerBuf.subarray(this.SALT_LEN, this.SALT_LEN + this.IV_LEN)
      const key = this.deriveKey(password, salt)

      const stats = await handle.stat()
      const fileSize = stats.size
      if (fileSize < this.SALT_LEN+this.IV_LEN+this.TAG_LEN) {
        throw new Error('File too small or corrupted')
      }

      const tagOffset = fileSize - this.TAG_LEN
      const tagBuf = Buffer.alloc(this.TAG_LEN)
      await handle.read(tagBuf, 0, this.TAG_LEN, tagOffset)

      const cipherStart = this.SALT_LEN + this.IV_LEN
      const cipherEndExclusive = tagOffset
      const length = cipherEndExclusive - cipherStart
      const encrypted = Buffer.alloc(length)
      await handle.read(encrypted, 0, length, cipherStart)

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tagBuf)
      return Buffer.concat([decipher.update(encrypted), decipher.final()])
    } finally {
      await handle.close()
    }
  }
}

