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
SCRIPT_VERSION="1.1.0"
SCRIPT_DESCRIPTION="Get curl and sqlite3 version information from the system"

# Default configuration
DEFAULT_ARCHIVE="/userdisk/Favorite/versionInfo.tar"

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
    --show-versions         Only show version information, don't create archive

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

# Main function
function main() {
    # Parse command line arguments
    parse_arguments "$@"

    # Show current version information
    log_info "Detecting version information..."
    local curlVer=$(getCurlVer)
    local sqliteVerFull=$(getSqlite3Ver)
    
    echo "  curl: $curlVer"
    echo "  sqlite3: $sqliteVerFull"

    if [ -z "$curlVer" ]; then
        log_error "Unable to determine curl version."
        exit 1
    fi
    
    if [ -z "$sqliteVerFull" ]; then
        log_error "Unable to determine sqlite3 version."
        exit 1
    fi

    # Create temporary directory for work
    local temp_workdir=$(mktemp -d)
    log_verbose "Created temporary work directory: $temp_workdir"

    # Create lib directory
    mkdir -p "$temp_workdir/lib"

    # Copy libraries
    if [ -f /usr/lib/libcurl.so ]; then
        cp /usr/lib/libcurl.so "$temp_workdir/lib/"
        log_verbose "Copied libcurl.so"
    else
        log_error "/usr/lib/libcurl.so not found"
    fi

    if [ -f /usr/lib/libsqlite3.so ]; then
        cp /usr/lib/libsqlite3.so "$temp_workdir/lib/"
        log_verbose "Copied libsqlite3.so"
    else
        log_error "/usr/lib/libsqlite3.so not found"
    fi

    # Create versions.txt
    local sqliteYear=$(echo "$sqliteVerFull" | cut -d' ' -f1)
    local sqliteVer=$(echo "$sqliteVerFull" | cut -d' ' -f2)

    cat << EOF > "$temp_workdir/versions.txt"
CURL_VER="$curlVer"
SQLITE_VER="$sqliteVer"
SQLITE_YEAR="$sqliteYear"
EOF
    log_verbose "Created versions.txt with version info"

    # Create archive
    log_info "Creating archive: $ARCHIVE_PATH"
    
    # Ensure parent directory exists
    local parent_dir=$(dirname "$ARCHIVE_PATH")
    if [ ! -d "$parent_dir" ]; then
        log_verbose "Creating parent directory: $parent_dir"
        mkdir -p "$parent_dir"
    fi
    
    if tar -cf "$ARCHIVE_PATH" -C "$temp_workdir" .; then
        log_info "Archive created successfully: $ARCHIVE_PATH"
    else
        log_error "Failed to create archive."
        rm -rf "$temp_workdir"
        exit 1
    fi

    log_verbose "Cleaning temporary work directory: $temp_workdir"
    rm -rf "$temp_workdir"
    
    log_info "All operations completed successfully!"
    log_info "Please transfer '$ARCHIVE_PATH' to your computer and run 'downloadHeaders.sh -i <file>'"
}

main "$@"
