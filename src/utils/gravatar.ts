// MD5 hash function for Gravatar
const md5 = (str: string): string => {
  const rotateLeft = (value: number, amount: number): number => {
    return (value << amount) | (value >>> (32 - amount))
  }
  
  const addUnsigned = (x: number, y: number): number => {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xFFFF)
  }
  
  const md5cmn = (q: number, a: number, b: number, x: number, s: number, t: number): number => {
    a = addUnsigned(a, addUnsigned(addUnsigned((b & q) | ((~b) & x), t), s))
    return addUnsigned(rotateLeft(a, s), b)
  }
  
  const md5ff = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn((b & c) | ((~b) & d), a, b, x, s, t)
  }
  
  const md5gg = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn((b & d) | (c & (~d)), a, b, x, s, t)
  }
  
  const md5hh = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn(b ^ c ^ d, a, b, x, s, t)
  }
  
  const md5ii = (a: number, b: number, c: number, d: number, x: number, s: number, t: number): number => {
    return md5cmn(c ^ (b | (~d)), a, b, x, s, t)
  }
  
  const utf8Encode = (str: string): string => {
    str = str.replace(/\r\n/g, '\n')
    let utftext = ''
    
    for (let n = 0; n < str.length; n++) {
      const c = str.charCodeAt(n)
      
      if (c < 128) {
        utftext += String.fromCharCode(c)
      } else if ((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192)
        utftext += String.fromCharCode((c & 63) | 128)
      } else {
        utftext += String.fromCharCode((c >> 12) | 224)
        utftext += String.fromCharCode(((c >> 6) & 63) | 128)
        utftext += String.fromCharCode((c & 63) | 128)
      }
    }
    
    return utftext
  }
  
  const convertToWordArray = (str: string): number[] => {
    let wordCount: number
    const messageLength = str.length
    const numberOfWords_temp1 = messageLength + 8
    const numberOfWords_temp2 = (numberOfWords_temp1 - (numberOfWords_temp1 % 64)) / 64
    const numberOfWords = (numberOfWords_temp2 + 1) * 16
    const wordArray: number[] = Array(numberOfWords - 1)
    let bytePosition = 0
    let byteCount = 0
    
    while (byteCount < messageLength) {
      wordCount = (byteCount - (byteCount % 4)) / 4
      bytePosition = (byteCount % 4) * 8
      wordArray[wordCount] = (wordArray[wordCount] || 0) | (str.charCodeAt(byteCount) << bytePosition)
      byteCount++
    }
    
    wordCount = (byteCount - (byteCount % 4)) / 4
    bytePosition = (byteCount % 4) * 8
    wordArray[wordCount] = (wordArray[wordCount] || 0) | (0x80 << bytePosition)
    wordArray[numberOfWords - 2] = messageLength << 3
    wordArray[numberOfWords - 1] = messageLength >>> 29
    
    return wordArray
  }
  
  const wordToHex = (lValue: number): string => {
    let wordToHexValue = '', wordToHexValue_temp = '', lByte, lCount
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255
      wordToHexValue_temp = '0' + lByte.toString(16)
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2)
    }
    return wordToHexValue
  }
  
  const calcMD5 = (str: string): string => {
    let k, AA, BB, CC, DD, a, b, c, d
    const S11 = 7, S12 = 12, S13 = 17, S14 = 22
    const S21 = 5, S22 = 9, S23 = 14, S24 = 20
    const S31 = 4, S32 = 11, S33 = 16, S34 = 23
    const S41 = 6, S42 = 10, S43 = 15, S44 = 21
    
    str = utf8Encode(str)
    const x = convertToWordArray(str)
    a = 0x67452301
    b = 0xEFCDAB89
    c = 0x98BADCFE
    d = 0x10325476
    
    for (k = 0; k < x.length; k += 16) {
      AA = a
      BB = b
      CC = c
      DD = d
      a = md5ff(a, b, c, d, x[k + 0] || 0, S11, 0xD76AA478)
      d = md5ff(d, a, b, c, x[k + 1] || 0, S12, 0xE8C7B756)
      c = md5ff(c, d, a, b, x[k + 2] || 0, S13, 0x242070DB)
      b = md5ff(b, c, d, a, x[k + 3] || 0, S14, 0xC1BDCEEE)
      a = md5ff(a, b, c, d, x[k + 4] || 0, S11, 0xF57C0FAF)
      d = md5ff(d, a, b, c, x[k + 5] || 0, S12, 0x4787C62A)
      c = md5ff(c, d, a, b, x[k + 6] || 0, S13, 0xA8304613)
      b = md5ff(b, c, d, a, x[k + 7] || 0, S14, 0xFD469501)
      a = md5ff(a, b, c, d, x[k + 8] || 0, S11, 0x698098D8)
      d = md5ff(d, a, b, c, x[k + 9] || 0, S12, 0x8B44F7AF)
      c = md5ff(c, d, a, b, x[k + 10] || 0, S13, 0xFFFF5BB1)
      b = md5ff(b, c, d, a, x[k + 11] || 0, S14, 0x895CD7BE)
      a = md5ff(a, b, c, d, x[k + 12] || 0, S11, 0x6B901122)
      d = md5ff(d, a, b, c, x[k + 13] || 0, S12, 0xFD987193)
      c = md5ff(c, d, a, b, x[k + 14] || 0, S13, 0xA679438E)
      b = md5ff(b, c, d, a, x[k + 15] || 0, S14, 0x49B40821)
      a = md5gg(a, b, c, d, x[k + 1] || 0, S21, 0xF61E2562)
      d = md5gg(d, a, b, c, x[k + 6] || 0, S22, 0xC040B340)
      c = md5gg(c, d, a, b, x[k + 11] || 0, S23, 0x265E5A51)
      b = md5gg(b, c, d, a, x[k + 0] || 0, S24, 0xE9B6C7AA)
      a = md5gg(a, b, c, d, x[k + 5] || 0, S21, 0xD62F105D)
      d = md5gg(d, a, b, c, x[k + 10] || 0, S22, 0x2441453)
      c = md5gg(c, d, a, b, x[k + 15] || 0, S23, 0xD8A1E681)
      b = md5gg(b, c, d, a, x[k + 4] || 0, S24, 0xE7D3FBC8)
      a = md5gg(a, b, c, d, x[k + 9] || 0, S21, 0x21E1CDE6)
      d = md5gg(d, a, b, c, x[k + 14] || 0, S22, 0xC33707D6)
      c = md5gg(c, d, a, b, x[k + 3] || 0, S23, 0xF4D50D87)
      b = md5gg(b, c, d, a, x[k + 8] || 0, S24, 0x455A14ED)
      a = md5gg(a, b, c, d, x[k + 13] || 0, S21, 0xA9E3E905)
      d = md5gg(d, a, b, c, x[k + 2] || 0, S22, 0xFCEFA3F8)
      c = md5gg(c, d, a, b, x[k + 7] || 0, S23, 0x676F02D9)
      b = md5gg(b, c, d, a, x[k + 12] || 0, S24, 0x8D2A4C8A)
      a = md5hh(a, b, c, d, x[k + 5] || 0, S31, 0xFFFA3942)
      d = md5hh(d, a, b, c, x[k + 8] || 0, S32, 0x8771F681)
      c = md5hh(c, d, a, b, x[k + 11] || 0, S33, 0x6D9D6122)
      b = md5hh(b, c, d, a, x[k + 14] || 0, S34, 0xFDE5380C)
      a = md5hh(a, b, c, d, x[k + 1] || 0, S31, 0xA4BEEA44)
      d = md5hh(d, a, b, c, x[k + 4] || 0, S32, 0x4BDECFA9)
      c = md5hh(c, d, a, b, x[k + 7] || 0, S33, 0xF6BB4B60)
      b = md5hh(b, c, d, a, x[k + 10] || 0, S34, 0xBEBFBC70)
      a = md5hh(a, b, c, d, x[k + 13] || 0, S31, 0x289B7EC6)
      d = md5hh(d, a, b, c, x[k + 0] || 0, S32, 0xEAA127FA)
      c = md5hh(c, d, a, b, x[k + 3] || 0, S33, 0xD4EF3085)
      b = md5hh(b, c, d, a, x[k + 6] || 0, S34, 0x4881D05)
      a = md5hh(a, b, c, d, x[k + 9] || 0, S31, 0xD9D4D039)
      d = md5hh(d, a, b, c, x[k + 12] || 0, S32, 0xE6DB99E5)
      c = md5hh(c, d, a, b, x[k + 15] || 0, S33, 0x1FA27CF8)
      b = md5hh(b, c, d, a, x[k + 2] || 0, S34, 0xC4AC5665)
      a = md5ii(a, b, c, d, x[k + 0] || 0, S41, 0xF4292244)
      d = md5ii(d, a, b, c, x[k + 7] || 0, S42, 0x432AFF97)
      c = md5ii(c, d, a, b, x[k + 14] || 0, S43, 0xAB9423A7)
      b = md5ii(b, c, d, a, x[k + 5] || 0, S44, 0xFC93A039)
      a = md5ii(a, b, c, d, x[k + 12] || 0, S41, 0x655B59C3)
      d = md5ii(d, a, b, c, x[k + 3] || 0, S42, 0x8F0CCC92)
      c = md5ii(c, d, a, b, x[k + 10] || 0, S43, 0xFFEFF47D)
      b = md5ii(b, c, d, a, x[k + 1] || 0, S44, 0x85845DD1)
      a = md5ii(a, b, c, d, x[k + 8] || 0, S41, 0x6FA87E4F)
      d = md5ii(d, a, b, c, x[k + 15] || 0, S42, 0xFE2CE6E0)
      c = md5ii(c, d, a, b, x[k + 6] || 0, S43, 0xA3014314)
      b = md5ii(b, c, d, a, x[k + 13] || 0, S44, 0x4E0811A1)
      a = md5ii(a, b, c, d, x[k + 4] || 0, S41, 0xF7537E82)
      d = md5ii(d, a, b, c, x[k + 11] || 0, S42, 0xBD3AF235)
      c = md5ii(c, d, a, b, x[k + 2] || 0, S43, 0x2AD7D2BB)
      b = md5ii(b, c, d, a, x[k + 9] || 0, S44, 0xEB86D391)
      a = addUnsigned(a, AA)
      b = addUnsigned(b, BB)
      c = addUnsigned(c, CC)
      d = addUnsigned(d, DD)
    }
    
    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase()
  }
  
  return calcMD5(str)
}

/**
 * Generate Gravatar URL from email address
 * @param email - Email address (can be null or undefined)
 * @param size - Avatar size in pixels (default: 40)
 * @returns Gravatar URL or null if email is not provided
 */
export const getGravatarUrl = (email: string | null | undefined, size: number = 40): string | null => {
  if (!email) return null
  
  // Normalize email (lowercase and trim) - Gravatar requires lowercase
  const normalizedEmail = email.trim().toLowerCase()
  const hash = md5(normalizedEmail)
  
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp&r=pg`
}

