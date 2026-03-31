#!/bin/bash
set -e

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
cleanup() {
  # Restore cursor visibility
  printf '\033[?25h' 2>/dev/null || true
  # Restore terminal settings if saved
  [ -n "$SAVED_TTY" ] && stty "$SAVED_TTY" 2>/dev/null || true
  # Clean up temp directory
  [ -n "$SPOOF_DIR" ] && rm -rf "$SPOOF_DIR" 2>/dev/null || true
}
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

# ──────────────────────────────────────────────────────────────────────────────
# Discover network interfaces
# ──────────────────────────────────────────────────────────────────────────────

echo ""
echo "Scanning network interfaces..."

if ! interfaces_json=$(node dist/cli.js list --format=json); then
  echo ""
  echo "Error: Failed to scan network interfaces."
  echo "Please open an issue at:"
  echo "  https://github.com/TheJACKedViking/spoof/issues"
  exit 1
fi

# Parse interface data into parallel arrays using node
iface_count=0
eval "$(node -e "
  var data = JSON.parse(process.argv[1]);
  var ifaces = data.interfaces;
  ifaces.forEach(function(iface, i) {
    var port = (iface.port || 'Unknown').replace(/'/g, '');
    var device = (iface.device || '').replace(/'/g, '');
    var addr = (iface.currentAddress || iface.address || 'no address').replace(/'/g, '');
    console.log('IFACE_PORTS[' + i + ']=' + JSON.stringify(port));
    console.log('IFACE_DEVICES[' + i + ']=' + JSON.stringify(device));
    console.log('IFACE_ADDRS[' + i + ']=' + JSON.stringify(addr));
  });
  console.log('iface_count=' + ifaces.length);
" "$interfaces_json")"

if [ "$iface_count" -eq 0 ]; then
  echo "Error: No network interfaces found."
  exit 1
fi

# Build display labels
IFACE_LABELS=()
for ((i=0; i<iface_count; i++)); do
  IFACE_LABELS[$i]="${IFACE_PORTS[$i]} (${IFACE_DEVICES[$i]}) — ${IFACE_ADDRS[$i]}"
done

# ──────────────────────────────────────────────────────────────────────────────
# Interactive interface picker
# ──────────────────────────────────────────────────────────────────────────────

draw_picker() {
  local count=$1
  local cursor=$2
  local redraw=$3

  # Move cursor up to redraw (skip on first draw)
  if [ "$redraw" -eq 1 ]; then
    printf '\033[%dA' "$count"
  fi

  for ((i=0; i<count; i++)); do
    # Pointer
    if [ "$i" -eq "$cursor" ]; then
      printf '\033[1;36m ▸ \033[0m'  # Cyan bold pointer
    else
      printf '   '
    fi

    # Checkbox
    if [ "${IFACE_SELECTED[$i]}" -eq 1 ]; then
      printf '\033[1;32m[✓]\033[0m '  # Green checkmark
    else
      printf '[ ] '
    fi

    # Label (highlight current line)
    if [ "$i" -eq "$cursor" ]; then
      printf '\033[1m%s\033[0m' "${IFACE_LABELS[$i]}"
    else
      printf '%s' "${IFACE_LABELS[$i]}"
    fi

    printf '\033[K\n'  # Clear rest of line + newline
  done
}

# Initialize selection state
IFACE_SELECTED=()
for ((i=0; i<iface_count; i++)); do
  IFACE_SELECTED[$i]=0
done

cursor=0

echo ""
echo "Select interfaces to randomize:"
echo "  ↑/↓ navigate  ·  Space select  ·  Enter confirm  ·  Esc/q cancel"
echo ""

# Save terminal settings and switch to raw mode
SAVED_TTY=$(stty -g 2>/dev/null)
printf '\033[?25l'  # Hide cursor

# First draw
draw_picker "$iface_count" "$cursor" 0

# Input loop
while true; do
  # Read a single character in raw mode (|| handles EOF/set -e)
  IFS= read -rsn1 key < /dev/tty || { key=""; break; }

  case "$key" in
    $'\033')  # Escape sequence (arrow keys or standalone Escape)
      IFS= read -rsn2 -t 0.1 rest < /dev/tty || true
      if [ -z "$rest" ]; then
        # Standalone Escape — cancel
        printf '\033[?25h'
        echo ""
        echo "Cancelled."
        exit 0
      fi
      case "$rest" in
        '[A')  # Up arrow
          if [ "$cursor" -gt 0 ]; then
            cursor=$((cursor - 1))
          fi
          ;;
        '[B')  # Down arrow
          if [ "$cursor" -lt $((iface_count - 1)) ]; then
            cursor=$((cursor + 1))
          fi
          ;;
      esac
      ;;
    'q'|'Q')  # Quit
      printf '\033[?25h'
      echo ""
      echo "Cancelled."
      exit 0
      ;;
    ' ')  # Spacebar — toggle selection
      if [ "${IFACE_SELECTED[$cursor]}" -eq 0 ]; then
        IFACE_SELECTED[$cursor]=1
      else
        IFACE_SELECTED[$cursor]=0
      fi
      ;;
    '')  # Enter — confirm
      break
      ;;
  esac

  # Redraw
  draw_picker "$iface_count" "$cursor" 1
done

# Restore cursor visibility
printf '\033[?25h'

# Collect selected interfaces
SELECTED_DEVICES=()
SELECTED_PORTS=()
for ((i=0; i<iface_count; i++)); do
  if [ "${IFACE_SELECTED[$i]}" -eq 1 ]; then
    SELECTED_DEVICES+=("${IFACE_DEVICES[$i]}")
    SELECTED_PORTS+=("${IFACE_PORTS[$i]}")
  fi
done

if [ "${#SELECTED_DEVICES[@]}" -eq 0 ]; then
  echo ""
  echo "No interfaces selected. Aborted."
  exit 0
fi

# Show summary and confirm
echo ""
echo "Selected interfaces:"
for ((i=0; i<${#SELECTED_DEVICES[@]}; i++)); do
  echo "  • ${SELECTED_PORTS[$i]} (${SELECTED_DEVICES[$i]})"
done

# Check if any selected interface is Wi-Fi
has_wifi=0
for ((i=0; i<${#SELECTED_PORTS[@]}; i++)); do
  port_lower=$(echo "${SELECTED_PORTS[$i]}" | tr '[:upper:]' '[:lower:]')
  if [ "$port_lower" = "wi-fi" ]; then
    has_wifi=1
    break
  fi
done

if [ "$has_wifi" -eq 1 ]; then
  echo ""
  echo "NOTE: Wi-Fi will be disconnected before changing its MAC address."
  echo "You will need to reconnect afterward."
fi

echo ""
printf "Continue? [y/N] "
read -r confirm < /dev/tty
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Randomize MAC addresses
# ──────────────────────────────────────────────────────────────────────────────

echo "Your Mac login password is required to change network settings."
if [ "$has_wifi" -eq 1 ]; then
  echo "Wi-Fi will be disconnected automatically and re-enabled after the change."
fi
echo ""

for ((i=0; i<${#SELECTED_DEVICES[@]}; i++)); do
  echo "Randomizing ${SELECTED_PORTS[$i]} (${SELECTED_DEVICES[$i]})..."
  sudo node dist/cli.js randomize "${SELECTED_DEVICES[$i]}"
done

echo ""
echo "Done! MAC addresses have been randomized for the selected interfaces."
if [ "$has_wifi" -eq 1 ]; then
  echo "You may need to reconnect to your Wi-Fi network."
fi
