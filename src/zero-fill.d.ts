declare module 'zero-fill' {
  /**
   * Zero-fill a string to a specified length.
   * @param width - The desired width of the output string
   * @param value - The value to zero-fill
   * @returns The zero-filled string
   */
  function zeroFill(width: number, value: string | number): string
  export = zeroFill
}
