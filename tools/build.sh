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

# Script configuration
set -e  # Exit immediately if a command exits with a non-zero status

# Global variables
VERBOSE=false
FORCE_BUILD=false
AUTO_UPDATE=false

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Info log output
function log_info() {
    echo -e "[INFO] $*"
}

# Error log output  
function log_error() {
    echo -e "${RED}[ERROR] $*${NC}" >&2
}

# Success log output
function log_success() {
    echo -e "${GREEN}[SUCCESS] $*${NC}"
}

# Warning log output
function log_warning() {
    echo -e "${YELLOW}[WARNING] $*${NC}"
}

# Verbose log output
function log_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo "[VERBOSE] $*" >&2
    fi
}

# Display help information
function show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Build script for miniapp with version consistency check"
    echo ""
    echo "Options:"
    echo "  -h, --help          Display this help message"
    echo "  -v, --verbose       Enable verbose output"
    echo "  -f, --force         Force build even if version mismatch"
    echo "  -a, --auto          Auto update version in update.ts if mismatch"
    echo "  -c, --check-only    Only check version, don't build"
    echo ""
    echo "Examples:"
    echo "  $0                  Normal build with version check"
    echo "  $0 -f               Force build ignoring version mismatch"
    echo "  $0 -a               Auto update version if needed"
    echo "  $0 -c               Only check version consistency"
}

# Version consistency check function
function check_version_consistency() {
    log_info "Checking version consistency..."
    
    # Define file paths
    local package_file="./ui/package.json"
    local ts_file="./ui/src/pages/update/update.ts"
    
    # Check if files exist
    if [ ! -f "$package_file" ]; then
        log_error "Package.json not found: $package_file"
        return 1
    fi
    
    if [ ! -f "$ts_file" ]; then
        log_error "update.ts not found: $ts_file"
        return 1
    fi
    
    # Extract version from package.json
    local package_version=$(grep '"version"' "$package_file" | head -1 | sed 's/.*"version": "\([^"]*\).*/\1/')
    
    if [ -z "$package_version" ]; then
        log_error "Failed to extract version from package.json"
        return 1
    fi
    
    # Extract version from update.ts
    local ts_version=$(grep -E "CURRENT_VERSION\s*=\s*['\"][^'\"]+" "$ts_file" | head -1 | sed -E "s/.*CURRENT_VERSION\s*=\s*['\"]([^'\"]+).*/\1/")
    
    if [ -z "$ts_version" ]; then
        ts_version=$(grep -E "const\s+CURRENT_VERSION\s*=\s*['\"][^'\"]+" "$ts_file" | head -1 | sed -E "s/.*const\s+CURRENT_VERSION\s*=\s*['\"]([^'\"]+).*/\1/")
    fi
    
    if [ -z "$ts_version" ]; then
        log_error "Failed to extract version from update.ts"
        return 1
    fi
    
    # Display versions
    echo ""
    echo "========================================"
    echo -e "  package.json version: ${BLUE}v$package_version${NC}"
    echo -e "  update.ts version:    ${BLUE}v$ts_version${NC}"
    echo "========================================"
    echo ""
    
    # Compare versions
    if [ "$package_version" = "$ts_version" ]; then
        log_success "Version consistency check passed!"
        return 0
    else
        log_error "Version mismatch detected!"
        
        if [ "$AUTO_UPDATE" = true ]; then
            log_info "Auto-updating version in update.ts..."
            update_ts_version "$ts_file" "$package_version"
            return 0
        elif [ "$FORCE_BUILD" = true ]; then
            log_warning "Force build enabled, ignoring version mismatch"
            return 0
        else
            echo ""
            log_warning "Please choose an option:"
            echo "  1) Auto update update.ts to v$package_version"
            echo "  2) Manually fix and run again"
            echo "  3) Force build (not recommended)"
            echo "  4) Exit"
            echo ""
            
            read -p "Enter choice (1-4): " choice
            
            case $choice in
                1)
                    if update_ts_version "$ts_file" "$package_version"; then
                        log_success "Version updated, continuing build..."
                    fi
                    return 0
                    ;;
                2)
                    log_info "Please manually fix the version and run the script again"
                    return 1
                    ;;
                3)
                    log_warning "Force build enabled, continuing..."
                    return 0
                    ;;
                4)
                    log_info "Build cancelled"
                    return 1
                    ;;
                *)
                    log_error "Invalid choice"
                    return 1
                    ;;
            esac
        fi
    fi
}

# Update version in update.ts
function update_ts_version() {
    local ts_file="$1"
    local new_version="$2"
    
    # Backup original file
    cp "$ts_file" "${ts_file}.bak"
    
    # Try first pattern
    sed -i -E "s/(CURRENT_VERSION\s*=\s*['\"])[^'\"]*(['\"])/\1$new_version\2/" "$ts_file"
    
    # Check if update succeeded
    local updated_version=$(grep -E "CURRENT_VERSION\s*=\s*['\"][^'\"]+" "$ts_file" | head -1 | sed -E "s/.*CURRENT_VERSION\s*=\s*['\"]([^'\"]+).*/\1/")
    
    if [ "$updated_version" = "$new_version" ]; then
        log_success "Updated version in $ts_file to v$new_version"
        rm -f "${ts_file}.bak"
        return 0
    else
        # Try second pattern
        mv "${ts_file}.bak" "$ts_file"
        sed -i -E "s/(const\s+CURRENT_VERSION\s*=\s*['\"])[^'\"]*(['\"])/\1$new_version\2/" "$ts_file"
        
        updated_version=$(grep -E "const\s+CURRENT_VERSION\s*=\s*['\"][^'\"]+" "$ts_file" | head -1 | sed -E "s/.*const\s+CURRENT_VERSION\s*=\s*['\"]([^'\"]+).*/\1/")
        
        if [ "$updated_version" = "$new_version" ]; then
            log_success "Updated version in $ts_file to v$new_version"
            rm -f "${ts_file}.bak"
            return 0
        else
            log_error "Failed to update version in $ts_file"
            mv "${ts_file}.bak" "$ts_file"
            return 1
        fi
    fi
}

# Create necessary directories
function create_directories() {
    log_info "Creating necessary directories..."
    
    if ! mkdir -p ui/libs; then
        log_error "Failed to create ui/libs directory"
        return 1
    fi
    
    if ! mkdir -p dist; then
        log_error "Failed to create dist directory"  
        return 1
    fi
    
    log_verbose "Directories created successfully"
}

# Find and setup toolchain
function setup_toolchain() {
    log_info "Setting up toolchain..."
    
    # Use the first available toolchain
    local toolchain=$(find jsapi/toolchains -mindepth 1 -maxdepth 1 -type d | head -n 1)
    
    if [ -z "$toolchain" ]; then
        log_error "No toolchain found in jsapi/toolchains/"
        return 1
    fi
    
    log_info "Using toolchain: $toolchain"
    
    export CROSS_TOOLCHAIN_PREFIX=$(find $(pwd)/$toolchain/bin -name "*buildroot*gcc" | head -n 1 | sed 's/gcc$//')
    
    if [ -z "$CROSS_TOOLCHAIN_PREFIX" ]; then
        log_error "No suitable gcc compiler found in toolchain"
        return 1
    fi
    
    log_info "Using cross compiler prefix: $CROSS_TOOLCHAIN_PREFIX"
    log_verbose "Toolchain setup completed successfully"
}

# Build native library
function build_native() {
    log_info "Building native library..."
    
    log_verbose "Running cmake configuration..."
    if ! cmake -S jsapi -B jsapi/build; then
        log_error "CMake configuration failed"
        return 1
    fi
    
    log_verbose "Running make build..."
    if ! make -C jsapi/build -j $(nproc); then
        log_error "Make build failed"
        return 1
    fi
    
    log_verbose "Copying shared library..."
    if ! cp jsapi/build/libjsapi_langningchen.so ui/libs/; then
        log_error "Failed to copy libjsapi_langningchen.so to ui/libs/"
        return 1
    fi
    
    log_info "Native library build completed successfully"
}

# Package UI
function package_ui() {
    log_info "Packaging UI..."
    
    if ! pnpm -C ui package; then
        log_error "UI packaging failed"
        return 1
    fi
    
    log_verbose "UI packaging completed successfully"
}

# Create final distribution
function create_distribution() {
    log_info "Creating final distribution..."
    
    local amr_file=$(find ui -name "800*.amr")
    if [ -z "$amr_file" ]; then
        log_error "No AMR file found matching pattern '800*.amr' in ui directory"
        return 1
    fi
    
    local target_name="miniapp-$(basename $CROSS_TOOLCHAIN_PREFIX | sed 's/-$//').amr"
    
    log_verbose "Copying $amr_file to dist/$target_name"
    if ! cp "$amr_file" "dist/$target_name"; then
        log_error "Failed to copy AMR file to distribution directory"
        return 1
    fi
    
    log_info "Distribution created successfully: dist/$target_name"
}

# Main function
function main() {
    log_info "Starting miniapp build process..."
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -f|--force)
                FORCE_BUILD=true
                shift
                ;;
            -a|--auto)
                AUTO_UPDATE=true
                shift
                ;;
            -c|--check-only)
                log_info "Running version check only..."
                check_version_consistency
                exit $?
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Execute build steps
    if ! create_directories; then
        log_error "Directory creation failed"
        exit 1
    fi
    
    # Version check (before native build)
    if ! check_version_consistency; then
        log_error "Version check failed, build aborted"
        exit 1
    fi
    
    if ! setup_toolchain; then
        log_error "Toolchain setup failed"
        exit 1
    fi
    
    if ! build_native; then
        log_error "Native library build failed"
        exit 1
    fi
    
    if ! package_ui; then
        log_error "UI packaging failed"
        exit 1
    fi
    
    if ! create_distribution; then
        log_error "Distribution creation failed"
        exit 1
    fi
    
    log_success "Build process completed successfully!"
}

# Run main function with all arguments
main "$@"
