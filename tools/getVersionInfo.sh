#!/bin/bash

# Copyright (C) 2025 Langning Chen
# 
# This file is part of miniapp.
# 
# miniapp is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
# 
# miniapp is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
# 
# You should have received a copy of the GNU General Public License
# along with miniapp.  If not, see <https://www.gnu.org/licenses/>.

# Script information
SCRIPT_NAME="getVersionInfo.sh"
SCRIPT_VERSION="1.0.0"
SCRIPT_DESCRIPTION="Get curl and sqlite3 version information from the system"

# Default configuration
DEFAULT_ARCHIVE="/userdisk/Favorite/versionInfo.tar.gz"

# Global variables
VERBOSE=false
ARCHIVE_PATH=""

# Show help information
function show_help() {
    cat << EOF
$SCRIPT_NAME - $SCRIPT_DESCRIPTION

Usage: $SCRIPT_NAME [options]

Options:
    -h, --help              Show this help message and exit
    -v, --version           Show version information and exit
    --verbose               Enable verbose output
    -a, --archive PATH      Specify archive file path (default: $DEFAULT_ARCHIVE)
    --show-versions         Only show version information, don't download files

Examples:
    $SCRIPT_NAME                                    # Use default settings
    $SCRIPT_NAME --verbose                          # Enable verbose output
    $SCRIPT_NAME -a /tmp/my_headers.tar.gz          # Specify custom archive path
    $SCRIPT_NAME --show-versions                    # Only show version information

EOF
}

# Show version information
function show_version() {
    echo "$SCRIPT_NAME version $SCRIPT_VERSION"
    echo "Copyright (C) 2025 Langning Chen"
    echo "License GPLv3+: GNU GPL version 3 or later <https://gnu.org/licenses/gpl.html>"
    echo "This is free software: you are free to change and redistribute it."
    echo "There is NO WARRANTY, to the extent permitted by law."
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
            -v|--version)
                show_version
                exit 0
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            -a|--archive)
                ARCHIVE_PATH="$2"
                shift 2
                ;;
            --show-versions)
                echo "curl: $(getCurlVer)"
                echo "sqlite3: $(getSqlite3Ver)"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                echo "Use '$SCRIPT_NAME --help' for help information."
                exit 1
                ;;
        esac
    done

    # Set default values
    if [ -z "$ARCHIVE_PATH" ]; then
        ARCHIVE_PATH="$DEFAULT_ARCHIVE"
    fi
}

function getCurlVer() {
    log_verbose "Detecting curl version..."
    if [ -f /usr/lib/libcurl.so ]; then
        local curlVer=$(strings /usr/lib/libcurl.so | grep libcurl/ | head -n 1 | cut -d'/' -f2)
        if [[ $curlVer =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            log_verbose "Found curl version: $curlVer"
            echo $curlVer
        else
            log_verbose "Invalid curl version format: $curlVer"
        fi
    else
        log_verbose "/usr/lib/libcurl.so file does not exist"
    fi
}

function getSqlite3Ver() {
    log_verbose "Detecting sqlite3 version..."
    if [ -f /usr/lib/libsqlite3.so ]; then
        local sqliteYear=$(strings /usr/lib/libsqlite3.so | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n 1 | cut -d'-' -f1)
        local sqliteVer=$(strings /usr/lib/libsqlite3.so | grep -oE '3\.[0-9]+\.[0-9]+' | head -n 1)
        if [[ $sqliteYear =~ ^[0-9]{4}$ ]] && [[ $sqliteVer =~ ^3\.[0-9]+\.[0-9]+$ ]]; then
            log_verbose "Found sqlite3 version: $sqliteYear $sqliteVer"
            echo "$sqliteYear $sqliteVer"
        else
            log_verbose "Invalid sqlite3 version format: $sqliteYear $sqliteVer"
        fi
    else
        log_verbose "/usr/lib/libsqlite3.so file does not exist"
    fi
}

function getCurlHeader() {
    local dst="$1"
    if [ -z "$dst" ]; then
        log_error "Destination directory not specified."
        return 1
    fi

    local curlVer=$(getCurlVer)
    if [ -z "$curlVer" ]; then
        log_error "Unable to determine curl version."
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

    # Copy shared library
    log_verbose "Creating lib directory: $dst/lib"
    mkdir -p "$dst/lib"
    if [ -f /usr/lib/libcurl.so ]; then
        log_verbose "Copying libcurl.so..."
        cp /usr/lib/libcurl.so "$dst/lib/"
        log_info "libcurl.so copied to $dst/lib/"
    else
        log_verbose "libcurl.so not found in /usr/lib/"
    fi

    log_verbose "Cleaning up temporary directory: $tempDir"
    rm -rf "$tempDir"
}

function getSqlite3Header() {
    local dst="$1"
    if [ -z "$dst" ]; then
        log_error "Destination directory not specified."
        return 1
    fi

    local sqliteVer=$(getSqlite3Ver)
    if [ -z "$sqliteVer" ]; then
        log_error "Unable to determine sqlite3 version."
        return 1
    fi

    local sqliteYear=$(echo "$sqliteVer" | cut -d' ' -f1)
    sqliteVer=$(echo "$sqliteVer" | cut -d' ' -f2)

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
    if tar -xf "$tempDir/sqlite-autoconf-$sqliteNumVer.tar.gz" -C "$tempDir"; then
        log_verbose "Extraction completed."
    else
        log_error "Failed to extract sqlite3 source package."
        rm -rf "$tempDir"
        return 1
    fi

    # Copy header files
    if [ -d "$tempDir/sqlite-autoconf-$sqliteNumVer" ]; then
        log_verbose "Creating target directory: $dst/sqlite3"
        mkdir -p "$dst/include/sqlite3"
        log_verbose "Copying header files..."
        cp "$tempDir/sqlite-autoconf-$sqliteNumVer/"*.h "$dst/include/sqlite3/"
        log_info "sqlite3 header files copied to $dst/include/sqlite3/"
    else
        log_error "sqlite3 header directory not found."
        rm -rf "$tempDir"
        return 1
    fi

    # Copy shared library
    log_verbose "Creating lib directory: $dst/lib"
    mkdir -p "$dst/lib"
    if [ -f /usr/lib/libsqlite3.so ]; then
        log_verbose "Copying libsqlite3.so..."
        cp /usr/lib/libsqlite3.so "$dst/lib/"
        log_info "libsqlite3.so copied to $dst/lib/"
    else
        log_verbose "libsqlite3.so not found in /usr/lib/"
    fi

    log_verbose "Cleaning up temporary directory: $tempDir"
    rm -rf "$tempDir"
}

# Main function
function main() {
    # Parse command line arguments
    parse_arguments "$@"

    # Show current version information
    log_info "Detected version information:"
    echo "  curl: $(getCurlVer)"
    echo "  sqlite3: $(getSqlite3Ver)"

    # Create temporary directory for work
    local temp_workdir=$(mktemp -d)
    log_verbose "Created temporary work directory: $temp_workdir"

    # Download header files
    local download_success=true
    
    if ! getCurlHeader "$temp_workdir"; then
        download_success=false
    fi

    if ! getSqlite3Header "$temp_workdir"; then
        download_success=false
    fi

    if [ "$download_success" = false ]; then
        log_error "Some header files failed to download."
        rm -rf "$temp_workdir"
        exit 1
    fi

    # Create archive
    log_info "Creating archive: $ARCHIVE_PATH"
    
    if tar -czf "$ARCHIVE_PATH" -C "$temp_workdir" .; then
        log_info "Archive created successfully: $ARCHIVE_PATH"
    else
        log_error "Failed to create archive."
        rm -rf "$temp_workdir"
        exit 1
    fi

    log_verbose "Cleaning temporary work directory: $temp_workdir"
    rm -rf "$temp_workdir"
    
    log_info "All operations completed successfully!"
}

main "$@"
