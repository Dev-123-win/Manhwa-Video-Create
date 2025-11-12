
// Decodes a base64 string into a Uint8Array.
export function decode(base64: string): Uint8Array {
  // Fix: Cast window to 'any' to access atob, resolving TS error when 'dom' lib is not included.
  const binaryString = (window as any).atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Decodes raw PCM audio data into an AudioBuffer.
export async function decodeAudioData(
  data: Uint8Array,
  // Fix: Use 'any' for AudioContext type as it's not available without 'dom' lib.
  ctx: any,
  sampleRate: number,
  numChannels: number,
  // Fix: Use 'any' for AudioBuffer type as it's not available without 'dom' lib.
): Promise<any> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


// Converts an AudioBuffer to a WAV file (Blob).
// Fix: Use 'any' for AudioBuffer type as it's not available without 'dom' lib.
export function audioBufferToWav(buffer: any): Blob {
    const numOfChan = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numSamples = buffer.length;
    const dataLength = numSamples * numOfChan * 2; // 16-bit samples
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    let offset = 0;

    // RIFF header (big-endian)
    view.setUint32(offset, 0x52494646, false); offset += 4; // "RIFF"
    // File size (little-endian)
    view.setUint32(offset, 36 + dataLength, true); offset += 4;
    // WAVE header (big-endian)
    view.setUint32(offset, 0x57415645, false); offset += 4; // "WAVE"

    // fmt sub-chunk (big-endian)
    view.setUint32(offset, 0x666d7420, false); offset += 4; // "fmt "
    // Sub-chunk size (little-endian)
    view.setUint32(offset, 16, true); offset += 4; 
    // PCM format (little-endian)
    view.setUint16(offset, 1, true); offset += 2; 
    // Number of channels (little-endian)
    view.setUint16(offset, numOfChan, true); offset += 2;
    // Sample rate (little-endian)
    view.setUint32(offset, sampleRate, true); offset += 4;
    // Byte rate (little-endian)
    view.setUint32(offset, sampleRate * numOfChan * 2, true); offset += 4;
    // Block align (little-endian)
    view.setUint16(offset, numOfChan * 2, true); offset += 2;
    // Bits per sample (little-endian)
    view.setUint16(offset, 16, true); offset += 2;

    // data sub-chunk (big-endian)
    view.setUint32(offset, 0x64617461, false); offset += 4; // "data"
    // Data length (little-endian)
    view.setUint32(offset, dataLength, true); offset += 4;

    // Write the PCM data
    const channels: Float32Array[] = [];
    for (let i = 0; i < numOfChan; i++) {
        channels.push(buffer.getChannelData(i));
    }

    // Interleave channels
    for (let i = 0; i < numSamples; i++) {
        for (let j = 0; j < numOfChan; j++) {
            let sample = channels[j][i];
            // Clamp sample to [-1, 1]
            sample = Math.max(-1, Math.min(1, sample));
            // Convert to 16-bit integer
            const intSample = sample < 0 ? sample * 32768 : sample * 32767;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }
    }

    // Fix: Cast window to 'any' to access Blob, resolving TS error when 'dom' lib is not included.
    return new (window as any).Blob([view], { type: "audio/wav" });
}