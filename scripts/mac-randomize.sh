#!/bin/bash
set -e

# Reconnect stdin to the terminal when run via pipe (e.g., curl | bash).
# Bash has already buffered the full script from the pipe by this point.
if [ ! -t 0 ]; then
  exec < /dev/tty
fi

echo "=== Spoof MAC Randomizer ==="
echo ""

MIN_NODE_MAJOR=24
OS_UNAME=$(uname -s 2>/dev/null || echo unknown)
case "$OS_UNAME" in
  Darwin*)
    # macOS and Mac OS X both report Darwin here.
    OS_FAMILY="darwin"
    PLATFORM_LABEL="macOS"
    ;;
  Linux*)
    OS_FAMILY="linux"
    PLATFORM_LABEL="Linux"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    OS_FAMILY="windows"
    PLATFORM_LABEL="Windows"
    ;;
  *)
    echo "Error: Unsupported operating system: $OS_UNAME"
    echo "Supported platforms are macOS, Linux, and Windows."
    exit 1
    ;;
esac

echo "Detected $PLATFORM_LABEL."
echo ""

# Ensure cleanup on exit
SPOOF_DIR=""
INTERFACES_JSON_PATH=""
cleanup() {
  # Restore cursor visibility
  printf '\033[?25h' 2>/dev/null || true
  # Restore terminal settings if saved
  [ -n "$SAVED_TTY" ] && stty "$SAVED_TTY" 2>/dev/null || true
  # Clean up temp directory
  [ -n "$SPOOF_DIR" ] && rm -rf "$SPOOF_DIR" 2>/dev/null || true
  # Clean up temporary interface data
  [ -n "$INTERFACES_JSON_PATH" ] && rm -f "$INTERFACES_JSON_PATH" 2>/dev/null || true
}
trap cleanup EXIT

refresh_homebrew_shellenv() {
  local brew_bin=""

  if command -v brew > /dev/null 2>&1; then
    brew_bin=$(command -v brew)
  elif [ -x /opt/homebrew/bin/brew ]; then
    brew_bin="/opt/homebrew/bin/brew"
  elif [ -x /usr/local/bin/brew ]; then
    brew_bin="/usr/local/bin/brew"
  elif [ -x /home/linuxbrew/.linuxbrew/bin/brew ]; then
    brew_bin="/home/linuxbrew/.linuxbrew/bin/brew"
  elif [ -x "$HOME/.linuxbrew/bin/brew" ]; then
    brew_bin="$HOME/.linuxbrew/bin/brew"
  fi

  if [ -n "$brew_bin" ]; then
    eval "$("$brew_bin" shellenv)"
  fi

  for path_dir in \
    /opt/homebrew/bin \
    /opt/homebrew/opt/node/bin \
    /usr/local/bin \
    /usr/local/opt/node/bin \
    /home/linuxbrew/.linuxbrew/bin \
    /home/linuxbrew/.linuxbrew/opt/node/bin \
    "$HOME/.linuxbrew/bin" \
    "$HOME/.linuxbrew/opt/node/bin"; do
    if [ -d "$path_dir" ] && [[ ":$PATH:" != *":$path_dir:"* ]]; then
      PATH="$path_dir:$PATH"
    fi
  done

  export PATH
  hash -r 2>/dev/null || true
}

refresh_chocolatey_path() {
  for path_dir in \
    /c/ProgramData/chocolatey/bin \
    /c/Program\ Files/nodejs \
    /c/Program\ Files/Git/cmd; do
    if [ -d "$path_dir" ] && [[ ":$PATH:" != *":$path_dir:"* ]]; then
      PATH="$path_dir:$PATH"
    fi
  done

  export PATH
  hash -r 2>/dev/null || true
}

refresh_platform_path() {
  case "$OS_FAMILY" in
    darwin|linux)
      refresh_homebrew_shellenv
      ;;
    windows)
      refresh_chocolatey_path
      ;;
  esac
}

run_powershell() {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$1"
}

run_powershell_elevated() {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Wait -Verb RunAs -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-Command', \"$1\")"
}

choco_available() {
  refresh_chocolatey_path
  command -v choco > /dev/null 2>&1 || command -v choco.exe > /dev/null 2>&1 || [ -x /c/ProgramData/chocolatey/bin/choco.exe ]
}

run_choco() {
  refresh_chocolatey_path

  if command -v choco > /dev/null 2>&1; then
    choco "$@"
  elif command -v choco.exe > /dev/null 2>&1; then
    choco.exe "$@"
  elif [ -x /c/ProgramData/chocolatey/bin/choco.exe ]; then
    /c/ProgramData/chocolatey/bin/choco.exe "$@"
  else
    return 127
  fi
}

run_choco_elevated() {
  run_powershell_elevated "choco $*"
  refresh_chocolatey_path
}

draw_option_picker() {
  local cursor=$1
  local redraw=$2
  local first_label=$3
  local second_label=$4
  local labels=("$first_label" "$second_label")

  if [ "$redraw" -eq 1 ]; then
    printf '\033[2A'
  fi

  for ((i=0; i<2; i++)); do
    if [ "$i" -eq "$cursor" ]; then
      printf '\033[1;36m ▸ \033[0m\033[1m%s\033[0m\033[K\n' "${labels[$i]}"
    else
      printf '   %s\033[K\n' "${labels[$i]}"
    fi
  done
}

choose_option() {
  local prompt=$1
  local first_label=$2
  local second_label=$3
  local cursor=0
  local choice=1
  local key=""
  local rest=""

  echo ""
  echo "$prompt"
  echo "  ↑/↓ navigate  ·  Enter confirm  ·  Esc/q cancel"
  echo ""

  SAVED_TTY=$(stty -g 2>/dev/null) || SAVED_TTY=""
  printf '\033[?25l'
  draw_option_picker "$cursor" 0 "$first_label" "$second_label"

  while true; do
    IFS= read -rsn1 key < /dev/tty || { choice=1; break; }

    case "$key" in
      $'\033')
        IFS= read -rsn2 -t 1 rest < /dev/tty || true
        case "$rest" in
          '[A'|'[D')
            cursor=0
            ;;
          '[B'|'[C')
            cursor=1
            ;;
          *)
            choice=1
            break
            ;;
        esac
        ;;
      'q'|'Q')
        choice=1
        break
        ;;
      '')
        choice=$cursor
        break
        ;;
    esac

    draw_option_picker "$cursor" 1 "$first_label" "$second_label"
  done

  printf '\033[?25h'
  [ -n "$SAVED_TTY" ] && stty "$SAVED_TTY" 2>/dev/null || true
  SAVED_TTY=""

  return "$choice"
}

check_internet_once() {
  curl -fsS --connect-timeout 5 --max-time 10 https://github.com > /dev/null 2>&1
}

wait_for_internet() {
  while true; do
    echo "Checking internet connection..."

    for attempt in 1 2 3 4; do
      if check_internet_once; then
        return 0
      fi

      if [ "$attempt" -lt 4 ]; then
        echo "Internet check failed. Retrying in 1 second..."
        sleep 1
      fi
    done

    echo ""
    echo "No internet connection detected after multiple attempts."
    echo "This script requires internet access to download dependencies."

    if choose_option "Try the internet check again?" "Retry" "Quit"; then
      echo ""
      continue
    fi

    echo "Aborted."
    exit 1
  done
}

node_major() {
  if ! command -v node > /dev/null 2>&1; then
    printf '0'
    return 0
  fi

  node -e "process.stdout.write(String(process.versions.node.split('.')[0] || 0))" 2>/dev/null || printf '0'
}

node_meets_minimum() {
  local major
  major=$(node_major)
  [ "$major" -ge "$MIN_NODE_MAJOR" ] 2>/dev/null
}

require_node_minimum() {
  refresh_platform_path

  if node_meets_minimum; then
    return 0
  fi

  echo ""
  if command -v node > /dev/null 2>&1; then
    echo "Error: Node.js $MIN_NODE_MAJOR or newer is required (you have v$(node -v))."
  else
    echo "Error: Node.js $MIN_NODE_MAJOR or newer is required, but Node.js was not found."
  fi
  exit 1
}

install_or_update_homebrew() {
  refresh_homebrew_shellenv

  if command -v brew > /dev/null 2>&1; then
    echo "Updating Homebrew..."
    brew update
    return 0
  fi

  echo "Installing Homebrew (the package manager)..."
  echo "You may be asked for your login password."
  echo ""
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  refresh_homebrew_shellenv

  if ! command -v brew > /dev/null 2>&1; then
    echo ""
    echo "Error: Homebrew was installed, but this terminal session cannot find it."
    echo "Please re-run this script after checking your Homebrew installation."
    exit 1
  fi
}

install_or_update_chocolatey() {
  refresh_chocolatey_path

  if choco_available; then
    echo "Updating Chocolatey..."
    run_choco_elevated upgrade chocolatey -y
    return 0
  fi

  echo "Installing Chocolatey (the Windows package manager)..."
  echo "You may be asked for administrator approval."
  echo ""
  run_powershell_elevated "Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))"
  refresh_chocolatey_path

  if ! choco_available; then
    echo ""
    echo "Error: Chocolatey was installed, but this terminal session cannot find it."
    echo "Please re-run this script after checking your Chocolatey installation."
    exit 1
  fi
}

ensure_git_available() {
  if command -v git > /dev/null 2>&1; then
    return 0
  fi

  case "$OS_FAMILY" in
    darwin)
      echo "Installing Xcode Command Line Tools (this may take a few minutes)..."
      xcode-select --install 2>/dev/null || true
      echo ""
      echo "A dialog box should have appeared on your screen."
      echo "Please click 'Install' and wait for it to finish."
      echo "Waiting for installation to complete..."
      until xcode-select -p &>/dev/null; do
        sleep 5
      done
      ;;
    linux)
      install_or_update_homebrew
      brew install git
      ;;
    windows)
      install_or_update_chocolatey
      run_choco_elevated install git -y
      ;;
  esac

  if ! command -v git > /dev/null 2>&1; then
    echo ""
    echo "Error: Git is required, but this terminal session cannot find it."
    echo "Please re-run this script after checking your Git installation."
    exit 1
  fi
}

ensure_homebrew_node() {
  refresh_homebrew_shellenv

  if command -v brew > /dev/null 2>&1; then
    install_or_update_homebrew
  fi

  if ! node_meets_minimum; then
    install_or_update_homebrew

    if command -v node > /dev/null 2>&1; then
      echo "Upgrading Node.js with Homebrew..."
      brew upgrade node || brew install node
    else
      echo "Installing Node.js with Homebrew..."
      brew install node
    fi

    refresh_homebrew_shellenv
  fi

  require_node_minimum
}

ensure_chocolatey_node() {
  refresh_chocolatey_path

  if choco_available; then
    install_or_update_chocolatey
  fi

  if ! node_meets_minimum; then
    install_or_update_chocolatey

    if command -v node > /dev/null 2>&1; then
      echo "Upgrading Node.js with Chocolatey..."
      run_choco_elevated upgrade nodejs-lts -y
    else
      echo "Installing Node.js with Chocolatey..."
      run_choco_elevated install nodejs-lts -y
    fi

    refresh_chocolatey_path
  fi

  require_node_minimum
}

prepare_platform_dependencies() {
  case "$OS_FAMILY" in
    darwin|linux)
      ensure_homebrew_node
      ;;
    windows)
      ensure_chocolatey_node
      ;;
  esac

  ensure_git_available
}

enable_corepack() {
  refresh_platform_path

  if ! command -v corepack > /dev/null 2>&1; then
    echo ""
    echo "Error: Node.js is installed, but Corepack was not found."
    echo "Please reinstall Node.js and re-run this script."
    exit 1
  fi

  echo "Setting up Yarn..."
  if corepack enable > /dev/null 2>&1; then
    refresh_platform_path
    return 0
  fi

  case "$OS_FAMILY" in
    windows)
      if run_powershell "Start-Process -Wait -Verb RunAs -FilePath 'corepack' -ArgumentList 'enable'"; then
        refresh_platform_path
        return 0
      fi
      ;;
    *)
      if sudo corepack enable > /dev/null; then
        refresh_platform_path
        return 0
      fi
      ;;
  esac

  echo ""
  echo "Error: Failed to enable Corepack for Yarn."
  echo "Please re-run this script after checking your Node.js installation."
  exit 1
}

run_spoof_command() {
  local device=$1

  case "$OS_FAMILY" in
    windows)
      local ps_device=${device//\'/\'\'}
      local ps_cwd=${PWD//\'/\'\'}
      powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -Wait -Verb RunAs -FilePath 'node' -WorkingDirectory '$ps_cwd' -ArgumentList @('dist/cli.js','randomize','$ps_device')"
      ;;
    *)
      sudo node dist/cli.js randomize "$device"
      ;;
  esac
}

# Check internet connectivity
wait_for_internet

# Install or update platform dependencies
prepare_platform_dependencies

# Enable corepack for Yarn support
enable_corepack

# Clone and build spoof
TEMP_PARENT="${TMPDIR:-/tmp}"
if ! SPOOF_DIR=$(mktemp -d "${TEMP_PARENT%/}/spoof.XXXXXX"); then
  echo ""
  echo "Error: Failed to create a secure temporary directory."
  exit 1
fi
chmod 700 "$SPOOF_DIR"
echo "Downloading spoof..."
if ! git clone --depth 1 https://github.com/TheJACKedViking/spoof.git "$SPOOF_DIR"; then
  echo ""
  echo "Error: Failed to download spoof. Please check your internet connection."
  exit 1
fi
cd "$SPOOF_DIR"

echo "Installing dependencies..."
if ! corepack yarn install; then
  echo ""
  echo "Error: Failed to install dependencies."
  echo "Please check your internet connection and try again."
  echo "If this keeps happening, open an issue at:"
  echo "  https://github.com/TheJACKedViking/spoof/issues"
  exit 1
fi

echo "Building..."
if ! corepack yarn build; then
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
IFACE_PORTS=()
IFACE_DEVICES=()
IFACE_ADDRS=()

INTERFACES_JSON_PATH=$(mktemp "${TMPDIR:-/tmp}/spoof-interfaces.XXXXXX")
printf '%s' "$interfaces_json" > "$INTERFACES_JSON_PATH"

while IFS=$'\t' read -r port device addr; do
  IFACE_PORTS[$iface_count]="$port"
  IFACE_DEVICES[$iface_count]="$device"
  IFACE_ADDRS[$iface_count]="$addr"
  iface_count=$((iface_count + 1))
done < <(node - "$INTERFACES_JSON_PATH" <<'NODE'
const fs = require('fs')

const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const ifaces = Array.isArray(data.interfaces) ? data.interfaces : []

function clean(value, fallback) {
  return String(value || fallback).replace(/[\t\r\n]/g, ' ')
}

for (const iface of ifaces) {
  const port = clean(iface.port, 'Unknown')
  const device = clean(iface.device, '')
  const addr = clean(iface.currentAddress || iface.address, 'no address')
  console.log(`${port}\t${device}\t${addr}`)
}
NODE
)

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
SAVED_TTY=$(stty -g 2>/dev/null) || SAVED_TTY=""
printf '\033[?25l'  # Hide cursor

# First draw
draw_picker "$iface_count" "$cursor" 0

# Input loop
while true; do
  # Read a single character in raw mode (|| handles EOF/set -e)
  IFS= read -rsn1 key < /dev/tty || { key=""; break; }

  case "$key" in
    $'\033')  # Escape sequence (arrow keys or standalone Escape)
      IFS= read -rsn2 -t 1 rest < /dev/tty || true
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
if ! choose_option "Continue with these network changes?" "Yes" "No"; then
  echo "Aborted."
  exit 0
fi

echo ""

# ──────────────────────────────────────────────────────────────────────────────
# Randomize MAC addresses
# ──────────────────────────────────────────────────────────────────────────────

if [ "$OS_FAMILY" = "windows" ]; then
  echo "Windows administrator approval is required to change network settings."
else
  echo "Your administrator password is required to change network settings."
fi
if [ "$has_wifi" -eq 1 ]; then
  echo "Wi-Fi will be disconnected automatically and re-enabled after the change."
fi
echo ""

for ((i=0; i<${#SELECTED_DEVICES[@]}; i++)); do
  echo "Randomizing ${SELECTED_PORTS[$i]} (${SELECTED_DEVICES[$i]})..."
  run_spoof_command "${SELECTED_DEVICES[$i]}"
done

echo ""
echo "Done! MAC addresses have been randomized for the selected interfaces."
if [ "$has_wifi" -eq 1 ]; then
  echo "You may need to reconnect to your Wi-Fi network."
fi
