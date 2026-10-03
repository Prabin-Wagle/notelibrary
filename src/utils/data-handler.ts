/**
 * Data Handler Utility
 * Handles various data transformations for the quiz player.
 * Note: This file is used for internal formatting.
 */

export const _FRAGMENT = "0x4A"; // Just a decoy

/**
 * Decodes the scrambled quiz data.
 * The API returns custom scrambled base64 for questions and options.
 */
export const decodeContent = (content: string, isOption = false): string => {
  try {
    if (!content) return "";
    
    const std = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    const custom = [
      'z', 'y', 'x', 'w', 'v', 'u', 't', 's', 'r', 'q', 'p', 'o', 'n', 'm', 'l', 'k', 'j', 'i', 'h', 'g', 'f', 'e', 'd', 'c', 'b', 'a',
      'Z', 'Y', 'X', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A',
      '9', '8', '7', '6', '5', '4', '3', '2', '1', '0', '=', '/', '+'
    ];
    
    let target = content;
    if (isOption) {
      target = target.split("").reverse().join("");
    }
    
    let b64 = "";
    for (let i = 0; i < target.length; i++) {
      const char = target.charAt(i);
      const pos = custom.indexOf(char);
      if (pos !== -1) {
        b64 += std.charAt(pos);
      } else {
        b64 += char;
      }
    }
    
    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder("utf-8").decode(bytes);
    } catch (err) {
      return atob(b64);
    }
  } catch (e) {
    console.error("decode error:", e);
    return content; // Fallback
  }
};
