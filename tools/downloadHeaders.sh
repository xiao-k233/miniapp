#!/bin/bash

# Script information
SCRIPT_NAME="downloadHeaders.sh"
SCRIPT_VERSION="1.1.0"
SCRIPT_DESCRIPTION="Download headers and setup SDK environment based on device info"

# Default configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEFAULT_TARGET_DIR="$ROOT_DIR/jsapi"

# Global variables
VERBOSE=false
INPUT_ARCHIVE=""
TARGET_DIR=""

# Show help information
function show_help() {
    cat << EOF
$SCRIPT_NAME - $SCRIPT_DESCRIPTION

Usage: $SCRIPT_NAME [options]

Options:
    -h, --help              Show this help message and exit
    -v, --verbose           Enable verbose output
    -i, --input PATH        Specify input device info archive (e.g., versionInfo.tar.gz)
    -d, --dest PATH         Specify target directory (default: $DEFAULT_TARGET_DIR)

Description:
    This script sets up the jsapi directory by:
    1. Extracting the version info archive (if provided) to the target directory.
    2. Reading the versions.txt file.
    3. Downloading the corresponding Curl and Sqlite3 headers to the target directory.

Examples:
    $SCRIPT_NAME -i versionInfo.tar.gz          # Extract and download headers
    $SCRIPT_NAME                                # Use existing versions.txt in default target
EOF
}

# Verbose log output
function log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo "[VERBOSE] $*" >&2
    fi
}

# Error log output
function log_error() {
    echo "[ERROR] $*" >&2
}

# Info log output
function log_info() {
    echo "[INFO] $*"
}

# Parse command line arguments
function parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -i|--input)
                INPUT_ARCHIVE="$2"
                shift 2
                ;;
            -d|--dest)
                TARGET_DIR="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use '$SCRIPT_NAME --help' for help information."
                exit 1
                ;;
        esac
    done

    # Set default values
    if [ -z "$TARGET_DIR" ]; then
        TARGET_DIR="$DEFAULT_TARGET_DIR"
    fi
}

function getCurlHeader() {
    local dst="$1"
    local curlVer="$2"

    if [ -z "$curlVer" ]; then
        log_error "Curl version not provided."
        return 1
    fi

    log_info "Starting download of curl-$curlVer header files..."

    local url="https://curl.se/download/curl-$curlVer.tar.xz"
    local tempDir=$(mktemp -d)
    log_verbose "Created temporary directory: $tempDir"

    log_verbose "Downloading source package from $url..."
    if curl -k -L -o "$tempDir/curl-$curlVer.tar.xz" "$url"; then
        log_verbose "Download completed: $tempDir/curl-$curlVer.tar.xz"
    else
        log_error "Failed to download curl source package."
        rm -rf "$tempDir"
        return 1
    fi

    log_verbose "Extracting source package..."
    if tar -xf "$tempDir/curl-$curlVer.tar.xz" -C "$tempDir"; then
        log_verbose "Extraction completed."
    else
        log_error "Failed to extract curl source package."
        rm -rf "$tempDir"
        return 1
    fi

    # Copy header files
    if [ -d "$tempDir/curl-$curlVer/include/curl" ]; then
        log_verbose "Creating target directory: $dst/include/curl"
        mkdir -p "$dst/include/curl"
        log_verbose "Copying header files..."
        cp "$tempDir/curl-$curlVer/include/curl/"*.h "$dst/include/curl/"
        log_info "curl header files copied to $dst/include/curl/"
    else
        log_error "curl header directory not found."
        rm -rf "$tempDir"
        return 1
    fi

    rm -rf "$tempDir"
}

function getSqlite3Header() {
    local dst="$1"
    local sqliteVer="$2"
    local sqliteYear="$3"

    if [ -z "$sqliteVer" ] || [ -z "$sqliteYear" ]; then
        log_error "Sqlite3 version or year not provided."
        return 1
    fi

    local sqliteNumVer=$(echo "$sqliteVer" | awk -F. '{printf "%d%02d%02d00", $1, $2, $3}')

    log_info "Starting download of sqlite3-$sqliteVer header files..."

    local url="https://www.sqlite.org/$sqliteYear/sqlite-autoconf-$sqliteNumVer.tar.gz"
    local tempDir=$(mktemp -d)
    log_verbose "Created temporary directory: $tempDir"

    log_verbose "Downloading source package from $url..."
    if curl -k -L -o "$tempDir/sqlite-autoconf-$sqliteNumVer.tar.gz" "$url"; then
        log_verbose "Download completed: $tempDir/sqlite-autoconf-$sqliteNumVer.tar.gz"
    else
        log_error "Failed to download sqlite3 source package."
        rm -rf "$tempDir"
        return 1
    fi

    log_verbose "Extracting source package..."
    if tar -xzf "$tempDir/sqlite-autoconf-$sqliteNumVer.tar.gz" -C "$tempDir"; then
        log_verbose "Extraction completed."
    else
        log_error "Failed to extract sqlite3 source package."
        rm -rf "$tempDir"
        return 1
    fi

    # Copy header files
    if [ -d "$tempDir/sqlite-autoconf-$sqliteNumVer" ]; then
        log_verbose "Creating target directory: $dst/include/sqlite3"
        mkdir -p "$dst/include/sqlite3"
        log_verbose "Copying header files..."
        cp "$tempDir/sqlite-autoconf-$sqliteNumVer/"*.h "$dst/include/sqlite3/"
        log_info "sqlite3 header files copied to $dst/include/sqlite3/"
    else
        log_error "sqlite3 header directory not found."
        rm -rf "$tempDir"
        return 1
    fi

    rm -rf "$tempDir"
}

function main() {
    parse_arguments "$@"

    log_info "Target directory: $TARGET_DIR"
    mkdir -p "$TARGET_DIR"

    # Extract input archive if provided
    if [ -n "$INPUT_ARCHIVE" ]; then
        if [ ! -f "$INPUT_ARCHIVE" ]; then
            log_error "Input archive not found: $INPUT_ARCHIVE"
            exit 1
        fi
        log_info "Extracting $INPUT_ARCHIVE to $TARGET_DIR..."
        if tar -xf "$INPUT_ARCHIVE" -C "$TARGET_DIR"; then
            log_verbose "Extraction successful."
        else
            log_error "Failed to extract archive."
            exit 1
        fi
    fi

    # Read versions
    if [ -f "$TARGET_DIR/versions.txt" ]; then
        source "$TARGET_DIR/versions.txt"
    else
        log_error "versions.txt not found in $TARGET_DIR."
        if [ -z "$INPUT_ARCHIVE" ]; then
            log_error "Please provide -i <archive> or ensure versions.txt exists in the target directory."
        fi
        exit 1
    fi

    log_info "Detected versions:"
    echo "  curl: $CURL_VER"
    echo "  sqlite3: $SQLITE_YEAR $SQLITE_VER"

    # Download headers
    local download_success=true

    if ! getCurlHeader "$TARGET_DIR" "$CURL_VER"; then
        download_success=false
    fi

    if ! getSqlite3Header "$TARGET_DIR" "$SQLITE_VER" "$SQLITE_YEAR"; then
        download_success=false
    fi

    if [ "$download_success" = false ]; then
        log_error "Some header files failed to download."
        exit 1
    fi

    log_info "Headers downloaded successfully."
    log_info "Setup complete for $TARGET_DIR"
}

main "$@"
