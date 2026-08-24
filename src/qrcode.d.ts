declare module 'qrcode' {
  export function toString(text: string, options?: { type?: string; margin?: number }): Promise<string>
  export function toDataURL(text: string, options?: any): Promise<string>
}
