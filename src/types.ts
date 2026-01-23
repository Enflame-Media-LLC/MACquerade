/**
 * Type definitions for spoof
 */

/**
 * Represents a network interface with hardware and current MAC address information.
 */
export interface NetworkInterface {
  /** The port/hardware name (e.g., "Wi-Fi", "Ethernet") */
  port: string
  /** The device identifier (e.g., "en0", "eth0") */
  device: string
  /** The hardware MAC address (from system), or null if not available */
  address: string | null
  /** The currently active MAC address, or null if not available */
  currentAddress: string | null
  /** Description of the adapter (Windows only) */
  description?: string
}

/**
 * Supported platform identifiers
 */
export type Platform = 'darwin' | 'linux' | 'win32'

/**
 * Function signature for random number generator
 */
export type RandomFunction = (min: number, max: number) => number

/**
 * Options for async operations
 */
export interface AsyncOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** AbortSignal for cancellation */
  signal?: AbortSignal
}
