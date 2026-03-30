#!/bin/bash
set -e

INTERFACE="${1:-en0}"

echo "=== Spoof MAC Randomizer for macOS ==="
echo ""

# Ensure we're on macOS
if [ "$(uname)" != "Darwin" ]; then
  echo "Error: This script is designed for macOS only."
  echo "On Linux, install spoof via npm and run: sudo npx spoof randomize <interface>"
  exit 1
fi

# Ensure cleanup on exit
SPOOF_DIR=""
cleanup() { [ -n "$SPOOF_DIR" ] && rm -rf "$SPOOF_DIR" 2>/dev/null || true; }
trap cleanup EXIT

# Check internet connectivity
echo "Checking internet connection..."
if ! curl -fsS --max-time 5 https://github.com > /dev/null 2>&1; then
  echo "Error: No internet connection detected."
  echo "This script requires internet access to download dependencies."
  exit 1
fi

# Install Xcode Command Line Tools if git is missing
if ! command -v git &> /dev/null; then
  echo "Installing Xcode Command Line Tools (this may take a few minutes)..."
  xcode-select --install 2>/dev/null || true
  echo ""
  echo "A dialog box should have appeared on your screen."
  echo "Please click 'Install' and wait for it to finish."
  echo "Waiting for installation to complete..."
  until xcode-select -p &>/dev/null; do
    sleep 5
  done
  echo "Xcode Command Line Tools installed successfully."
  echo ""
fi

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
  echo "Installing Homebrew (the macOS package manager)..."
  echo "You may be asked for your Mac login password."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  if [ "$(uname -m)" = "arm64" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  else
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  echo ""
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  brew install node
  echo ""
fi

# Check Node.js version
NODE_MAJOR=$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node.js 18 or newer is required (you have v$(node -v))."
  echo "Please update Node.js by running: brew upgrade node"
  exit 1
fi

# Enable corepack for Yarn support
if ! command -v yarn &> /dev/null; then
  echo "Setting up Yarn..."
  if ! corepack enable 2>/dev/null; then
    if ! sudo corepack enable; then
      echo ""
      echo "Error: Failed to enable Yarn."
      echo "Please try running 'sudo corepack enable' manually, then re-run this script."
      exit 1
    fi
  fi
fi

# Clone and build spoof
SPOOF_DIR="${TMPDIR:-/tmp}"
SPOOF_DIR="${SPOOF_DIR%/}/spoof-$$"
echo "Downloading spoof..."
if ! git clone --depth 1 https://github.com/TheJACKedViking/spoof.git "$SPOOF_DIR"; then
  echo ""
  echo "Error: Failed to download spoof. Please check your internet connection."
  exit 1
fi
cd "$SPOOF_DIR"

echo "Installing dependencies..."
if ! yarn install; then
  echo ""
  echo "Error: Failed to install dependencies."
  echo "Please check your internet connection and try again."
  echo "If this keeps happening, open an issue at:"
  echo "  https://github.com/TheJACKedViking/spoof/issues"
  exit 1
fi

echo "Building..."
if ! yarn build; then
  echo ""
  echo "Error: Build failed. Please open an issue at:"
  echo "  https://github.com/TheJACKedViking/spoof/issues"
  exit 1
fi

# Warn about Wi-Fi disconnection and confirm
echo ""
echo "WARNING: Changing your MAC address on $INTERFACE will temporarily"
echo "disconnect your Wi-Fi. You will need to reconnect afterward."
echo ""
printf "Continue? [y/N] "
read -r confirm < /dev/tty
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

# Randomize MAC address
echo ""
echo "Your Mac login password is required to change network settings."
sudo node dist/cli.js randomize "$INTERFACE"

echo ""
echo "Done! Your MAC address on $INTERFACE has been randomized."
echo "Please reconnect to your Wi-Fi network."
