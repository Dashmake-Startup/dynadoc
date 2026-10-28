// Copyright (C) 2024 Dashmake Inc.
//
// This file is part of DDoc Office.
//
// DDoc Office is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// DDoc Office is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with DDoc Office.  If not, see <https://www.gnu.org/licenses/>.

import crypto from "crypto"
import fsNode from "fs"
import pathNode from "path"
import { nodeApi } from './shims/node'

// const nodeApi =
//   typeof window !== 'undefined' ? (window as any)?.api?.node || (window as any)?.node : null
// const fs = nodeApi?.fs || fsNode
// const fsPromises = nodeApi?.fsPromises || fsNode.promises
// const path = nodeApi?.path || pathNode


// import { pipeline as pipelineCb, Readable } from 'stream'

export default class SecurityHelpers {

  private static requireNodeFs() {
    if (!nodeApi.fs || !fsPromises || !nodeApi.path) {
      throw new Error('Node filesystem is not available in this environment.')
    }
  }

  public static encryptFileBuffer(buffer: Buffer, password: string): Buffer {
    const salt = crypto.randomBytes(16)
    const key = crypto.scryptSync(password, salt, 32)
    const iv = crypto.randomBytes(12)

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
    const tag = cipher.getAuthTag()

    return Buffer.concat([salt, iv, tag, encrypted])
  }

  public static decryptFileBuffer(encBuffer: Buffer, password: string): Buffer {
    const salt = encBuffer.subarray(0, 16)
    const iv = encBuffer.subarray(16, 28)
    const tag = encBuffer.subarray(28, 44)
    const encrypted = encBuffer.subarray(44)

    const key = crypto.scryptSync(password, salt, 32)
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(encrypted), decipher.final()])
  }

  public static encryptName(name: string, password: string): string {
    const data = Buffer.from(name, "utf-8")
    const enc = this.encryptFileBuffer(data, password)
    return enc.toString("base64url")    // safe filesystem name
  }

  public static decryptName(encName: string, password: string): string {
    const enc = Buffer.from(encName, "base64url")
    const dec = this.decryptFileBuffer(enc, password)
    return dec.toString("utf-8")
  }

  public static async encryptDirectoryRecursive(
    srcDir: string,
    dstDir: string,
    password: string
  ) {
    this.requireNodeFs()
    console.log("encryptDirectoryRecursive srcDir ", srcDir, dstDir)
    await nodeApi.fsPromises.mkdir(dstDir, { recursive: true })

    const items = await nodeApi.fsPromises.readdir(srcDir, { withFileTypes: true })

    for (const item of items) {
      const originalName = item.name
      const encryptedName = this.encryptName(originalName, password)
      const srcPath = nodeApi.path.join(srcDir, originalName)
      const dstPath = nodeApi.path.join(dstDir, encryptedName)

      if (item.isDirectory()) {
        // await this.encryptDirectoryRecursiveStream(pipelineStream, srcPath, dstPath, password)
        await this.encryptDirectoryRecursive(srcPath, dstPath, password)
      } else {
        // const isVideo = Object.values(Utils.VIDEO_EXTENSIONS).includes(item.name)

        // if (Utils.VIDEO_EXTENSIONS.in (originalName)) {

        // }else{
        console.log("encryptFileStream srcDir ", srcPath, dstPath, password)

        // await this.encryptFileStream(pipelineStream, srcPath, dstPath, password)

        const buffer = await nodeApi.fsPromises.readFile(srcPath)
        const encBuffer = this.encryptFileBuffer(buffer, password)

        await nodeApi.fsPromises.writeFile(dstPath + ".enc", encBuffer)
        // await nodeApi.fsPromises.writeFile(dstPath + ".enc", encBuffer)
      }
    }
  }

  public static async decryptDirectoryRecursive(
    srcDir: string,
    dstDir: string,
    password: string
  ) {
    this.requireNodeFs()
    await nodeApi.fsPromises.mkdir(dstDir, { recursive: true })

    const items = await nodeApi.fsPromises.readdir(srcDir, { withFileTypes: true })

    for (const item of items) {
      console.log("decryptDirectoryRecursive item ", item)

      const encName = item.name.replace(/\.enc$/, "")
      const originalName = this.decryptName(encName, password)
      const srcPath = nodeApi.path.join(srcDir, item.name)
      const dstPath = nodeApi.path.join(dstDir, originalName)

      // console.log("decryptDirectoryRecursive ", encName, originalName, srcPath, dstPath)

      if (item.isDirectory()) {
        await this.decryptDirectoryRecursive(srcPath, dstPath, password)
      } else {
        const encBuffer = await nodeApi.fsPromises.readFile(srcPath)
        const buffer = this.decryptFileBuffer(encBuffer, password)
        await nodeApi.fsPromises.writeFile(dstPath, buffer)
      }
    }
  }



  // streaming-encryption


  // constants
  static SALT_LEN = 16
  static IV_LEN = 12
  static TAG_LEN = 16
  static KEY_LEN = 32
  static SCRYPT_N = 16384 // cost parameter (tunable)
  static SCRYPT_R = 8
  static SCRYPT_P = 1
  static CHUNK_SIZE = 5 * 1024 * 1024; // 5MB per split

  public static async encryptFileChunked(
    srcPath: string,
    dstDir: string,
    password: string | Buffer
  ): Promise<void> {

    await nodeApi.fs.promises.mkdir(dstDir, { recursive: true });

    const salt = crypto.randomBytes(this.SALT_LEN);
    const key = this.deriveKey(password, salt);

    const readStream = nodeApi.fs.createReadStream(srcPath, { highWaterMark: this.CHUNK_SIZE });

    let partIndex = 0;

    for await (const chunk of readStream) {

      const iv = crypto.randomBytes(this.IV_LEN);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

      const encrypted = Buffer.concat([cipher.update(chunk), cipher.final()]);
      const tag = cipher.getAuthTag();

      const partName = `${nodeApi.path.basename(srcPath)}.enc.part${String(partIndex).padStart(4, "0")}`;
      const partPath = nodeApi.path.join(dstDir, partName);

      const payload = Buffer.concat([salt, iv, encrypted, tag]);
      await nodeApi.fs.promises.writeFile(partPath, payload);

      partIndex++;
    }
  }

  public static async decryptFileChunked(
    srcDir: string,
    dstPath: string,
    password: string | Buffer
  ): Promise<void> {

    const partFiles = (await nodeApi.fs.promises.readdir(srcDir))
      .filter(name => name.endsWith(".part"))
      .sort(); // ensure correct ordering

    const out = nodeApi.fs.createWriteStream(dstPath);

    for (const file of partFiles) {
      const full = nodeApi.path.join(srcDir, file);
      const buf = await nodeApi.fs.promises.readFile(full);

      const salt = buf.subarray(0, this.SALT_LEN);
      const iv = buf.subarray(this.SALT_LEN, this.SALT_LEN + this.IV_LEN);
      const tag = buf.subarray(this.SALT_LEN + this.IV_LEN, this.SALT_LEN + this.IV_LEN + this.TAG_LEN);
      const encrypted = buf.subarray(this.SALT_LEN + this.IV_LEN + this.TAG_LEN);

      const key = this.deriveKey(password, salt);

      const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      out.write(plaintext);
    }

    out.end();
  }





  /**
   * Derive key from password + salt
   */
  public static deriveKey(password: string | Buffer, salt: Buffer): Buffer {
    // Using scryptSync for simplicity; you can use async scrypt if you want non-blocking
    return crypto.scryptSync(password, salt, this.KEY_LEN, { N: this.SCRYPT_N, r: this.SCRYPT_R, p: this.SCRYPT_P })
  }

  /**
   * Encrypt a single file by streaming.
   * Output layout: [salt(16)][iv(12)][ciphertext ...][tag(16)]
   */
  public static async encryptFileStream(
    pipelineStream,
    srcPath: string,
    dstPath: string,
    password: string | Buffer
  ): Promise<void> {
    // ensure parent dir exists
    await nodeApi.fs.promises.mkdir(nodeApi.path.dirname(dstPath), { recursive: true })

    const salt = crypto.randomBytes(this.SALT_LEN)
    const key = this.deriveKey(password, salt)
    const iv = crypto.randomBytes(this.IV_LEN)

    // create cipher
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

    // create streams
    const readStream = nodeApi.fs.createReadStream(srcPath)
    // open write stream in appendable mode so we can write header first, then stream ciphertext,
    // then append tag.
    const writeStream = nodeApi.fs.createWriteStream(dstPath, { flags: 'w' })
    console.log("encryptFileStream srcDir inner ")

    // Write header: salt + iv
    await new Promise<void>((resolve, reject) => {
      writeStream.write(Buffer.concat([salt, iv]), (err) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Pipe plaintext -> cipher -> writeStream
    await pipelineStream(readStream, cipher, writeStream)

    // After piping completes, get auth tag and append it
    const tag = cipher.getAuthTag()
    console.log("encryptFileStream appendFile inner ", dstPath, tag)

    await nodeApi.fs.promises.appendFile(dstPath, tag)
  }

  /**
   * Decrypt a single file by streaming.
   * Assumes layout created by encryptFileStream.
   */
  public static async decryptFileStream(
    pipelineStream,
    encPath: string,
    outPath: string,
    password: string | Buffer
  ): Promise<void> {
    // read header (salt + iv)
    const fd = await nodeApi.fs.promises.open(encPath, 'r')
    try {
      const headerBuf = Buffer.alloc(this.SALT_LEN + this.IV_LEN)
      await fd.read(headerBuf, 0, headerBuf.length, 0)
      const salt = headerBuf.subarray(0, this.SALT_LEN)
      const iv = headerBuf.subarray(this.SALT_LEN, this.SALT_LEN + this.IV_LEN)
      const key = this.deriveKey(password, salt)

      // read tag from end of file
      const stats = await fd.stat()
      const fileSize = stats.size

      if (fileSize < this.SALT_LEN + this.IV_LEN + this.TAG_LEN) {
        throw new Error('File too small or corrupted')
      }

      const tagOffset = fileSize - this.TAG_LEN
      const tagBuf = Buffer.alloc(this.TAG_LEN)
      await fd.read(tagBuf, 0, this.TAG_LEN, tagOffset)

      // create decipher and set auth tag
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tagBuf)

      // create a read stream for ciphertext region (from header end to tagOffset)
      const cipherStart = this.SALT_LEN + this.IV_LEN
      const cipherEndExclusive = tagOffset // not inclusive
      const length = cipherEndExclusive - cipherStart

      // if length === 0 then it's an empty file; still pipeline with empty Readable
      let ciphertextStream: fs.ReadStream
      // let ciphertextStream: fs.ReadStream | Readable
      if (length <= 0) {
        // empty content — create empty readable
        // ciphertextStream = Readable.from([])
      } else {
        ciphertextStream = nodeApi.fs.createReadStream(encPath, {
          start: cipherStart,
          end: cipherEndExclusive - 1 // read streams are inclusive for 'end'
        })
      }

      // ensure output dir
      await nodeApi.fs.promises.mkdir(nodeApi.path.dirname(outPath), { recursive: true })
      const outStream = nodeApi.fs.createWriteStream(outPath, { flags: 'w' })

      // pipe ciphertext -> decipher -> out
      await pipelineStream(ciphertextStream, decipher, outStream)
    } finally {
      await fd.close()
    }
  }

  /**
   * Example: encrypt directory recursively using streaming for files.
   * Encrypts names and contents, writes each encrypted file as <encName>.enc
   */
  public static async encryptDirectoryRecursiveStream(
    pipelineStream,
    srcDir: string,
    dstDir: string,
    password: string | Buffer,
    encryptNames = true
  ) {
    await nodeApi.fs.promises.mkdir(dstDir, { recursive: true })
    const items = await nodeApi.fs.promises.readdir(srcDir, { withFileTypes: true })

    for (const item of items) {
      const originalName = item.name
      const encName = encryptNames ? this.encryptNameToSafe(originalName, password) : originalName

      const srcPath = nodeApi.path.join(srcDir, originalName)
      const dstPath = nodeApi.path.join(dstDir, encName)
      const stats = await nodeApi.fs.promises.stat(srcPath)

      if (item.isDirectory()) {
        await this.encryptDirectoryRecursiveStream(
          pipelineStream, srcPath, dstPath, password, encryptNames)
      } else {
        // write to dstPath + ".enc"
        // await this.encryptFileChunked(srcPath, dstPath + '.enc', password)

        if (stats.size <= this.CHUNK_SIZE) {
          // small file -> encrypt in one file
          // const dstPath = nodeApi.path.join(dstDir, nodeApi.path.basename(srcPath) + ".enc")
          await this.encryptFileStream(pipelineStream, srcPath, dstPath + '.enc', password)
          // await this.encryptFileStream(pipelineStream, srcPath, dstPath, password)
        } else {
          // large file -> chunked encryption
          await this.encryptFileChunked(srcPath, dstDir, password)
          // await this.encryptFileChunked(srcPath, dstDir, password)
        }

        // await this.encryptFileStream(pipelineStream, srcPath, dstPath + '.enc', password)
      }
    }
  }

  /**
   * Example: decrypt directory recursively using streaming decrypt for files.
   */
  public static async decryptDirectoryRecursiveStream(
    pipelineStream,
    srcDir: string,
    dstDir: string,
    password: string | Buffer,
    decryptNames = true
  ) {
    await nodeApi.fs.promises.mkdir(dstDir, { recursive: true })
    const items = await nodeApi.fs.promises.readdir(srcDir, { withFileTypes: true })

    for (const item of items) {
      const itemName = item.name
      if (item.isDirectory()) {
        // decrypt directory name if needed
        const decName = decryptNames ? this.decryptNameFromSafe(itemName, password) : itemName
        await this.decryptDirectoryRecursiveStream(
          pipelineStream, nodeApi.path.join(srcDir, itemName), nodeApi.path.join(dstDir, decName), password, decryptNames)
      } else {
        // expect file to end with .enc
        if (!itemName.endsWith('.enc')) {
          // skip or handle differently
          continue
        }
        const baseEncName = itemName.slice(0, -4)

        const decName = decryptNames ? this.decryptNameFromSafe(baseEncName, password) : baseEncName
        // await this.decryptFileChunked(nodeApi.path.join(srcDir, itemName), nodeApi.path.join(dstDir, decName), password)

        // await this.decryptFileStream(pipelineStream, nodeApi.path.join(srcDir, itemName), nodeApi.path.join(dstDir, decName), password)


        const stats = await nodeApi.fs.promises.stat(nodeApi.path.join(srcDir, itemName))

        if (stats.isFile()) {
          await this.decryptFileStream(pipelineStream, nodeApi.path.join(srcDir, itemName), nodeApi.path.join(dstDir, decName), password)
        } else {
          // assume directory of chunked parts
          await this.decryptFileChunked(nodeApi.path.join(srcDir, itemName), nodeApi.path.join(dstDir, decName), password)
        }
      }
    }
  }

  /**
   * Helper: encrypt small strings (file/folder names) to a filesystem-safe token (base64url)
   */
  public static encryptNameToSafe(name: string, password: string | Buffer): string {
    const buf = Buffer.from(name, 'utf-8')
    const enc = this.encryptSmallBuffer(buf, password)
    // base64url for filename safety (replace +/ with -_)
    return enc.toString('base64url')
  }

  /**
   * Helper: decrypt filesystem-safe token back to original name
   */
  public static decryptNameFromSafe(token: string, password: string | Buffer): string {
    const enc = Buffer.from(token, 'base64url')
    const buf = this.decryptSmallBuffer(enc, password)
    return buf.toString('utf-8')
  }

  /**
   * Small-buffer helpers — used for names. They reuse same format
   * [salt][iv][tag][encrypted]
   */
  public static encryptSmallBuffer(plain: Buffer, password: string | Buffer): Buffer {
    const salt = crypto.randomBytes(this.SALT_LEN)
    const key = this.deriveKey(password, salt)
    const iv = crypto.randomBytes(this.IV_LEN)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()])
    const tag = cipher.getAuthTag()
    return Buffer.concat([salt, iv, tag, encrypted])
  }

  public static decryptSmallBuffer(encBuf: Buffer, password: string | Buffer): Buffer {
    if (encBuf.length < this.SALT_LEN + this.IV_LEN + this.TAG_LEN) throw new Error('Invalid encrypted buffer')
    const salt = encBuf.subarray(0, this.SALT_LEN)
    const iv = encBuf.subarray(this.SALT_LEN, this.SALT_LEN + this.IV_LEN)
    const tag = encBuf.subarray(this.SALT_LEN + this.IV_LEN, this.SALT_LEN + this.IV_LEN + this.TAG_LEN)
    const encrypted = encBuf.subarray(this.SALT_LEN + this.IV_LEN + this.TAG_LEN)
    const key = this.deriveKey(password, salt)
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const out = Buffer.concat([decipher.update(encrypted), decipher.final()])
    return out
  }



  /**
   * Decrypt a single file entirely into memory.
   */
  public static async decryptFileToMemory(
    encPath: string,
    password: string | Buffer
  ): Promise<Buffer> {
    // const fd = await nodeApi.fsPromises.open(encPath, 'r')
    const fd = await nodeApi.fs.promises.open(encPath, 'r')
    try {
      const headerBuf = Buffer.alloc(this.SALT_LEN + this.IV_LEN)
      await fd.read(headerBuf, 0, headerBuf.length, 0)
      const salt = headerBuf.subarray(0, this.SALT_LEN)
      const iv = headerBuf.subarray(this.SALT_LEN, this.SALT_LEN + this.IV_LEN)
      const key = this.deriveKey(password, salt)

      const stats = await fd.stat()
      const fileSize = stats.size
      if (fileSize < this.SALT_LEN + this.IV_LEN + this.TAG_LEN) {
        throw new Error('File too small or corrupted')
      }

      const tagOffset = fileSize - this.TAG_LEN
      const tagBuf = Buffer.alloc(this.TAG_LEN)
      await fd.read(tagBuf, 0, this.TAG_LEN, tagOffset)

      // read encrypted content
      const cipherStart = this.SALT_LEN + this.IV_LEN
      const cipherEndExclusive = tagOffset
      const length = cipherEndExclusive - cipherStart

      const encrypted = Buffer.alloc(length)
      await fd.read(encrypted, 0, length, cipherStart)

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tagBuf)

      const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()])
      return plaintext
    } finally {
      await fd.close()
    }
  }



}
