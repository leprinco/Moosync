#!/bin/sh

RUSTC=$(which rustc)
CARGO=$(which cargo)
YARN=$(which yarn)

LIBRESPOT_URL="https://github.com/librespot-org/librespot"
LIBRESPOT_BRANCH="dev"

LIBRESPOT_NODE_URL="https://github.com/Moosync/librespot-node"
LIBRESPOT_NODE_BRANCH="main"

# TMP_DIR=$(mktemp -d -t librespot-patch-XXXXX)

TMP_DIR=$(realpath "$HOME/moosync_patch")
mkdir -p "${TMP_DIR}"

FLATPAK_APP_ID="app.moosync.moosync"
FLATPAK_ARCH="x86_64"
FLATPAK_FREEDESKTOP_PLATFORM_VERSION="21.08"

LIBRESPOT_LIB_DIR="resources/app.asar.unpacked/node_modules/librespot-node/dist/build/librespot.node"

LD_LIBRARY_PATH=/var/lib/flatpak/runtime/org.freedesktop.Platform/x86_64/21.08/active/files/lib/x86_64-linux-gnu/

get_node() {
    mkdir "${TMP_DIR}/node"
    CURR_DIR=${PWD}
    cd "${TMP_DIR}/node" || exit
    wget https://raw.github.com/dmrub/portable-node/master/bin/install-node.sh
    chmod +x ./install-node.sh
    ./install-node.sh --version=18.12.0
    PATH="${TMP_DIR}/node/share/nodejs/node-v18.12.0-linux-x64/bin:${PATH}"
    cd "${CURR_DIR}" || exit
}

get_rust() {
    if [ -z "$RUSTC" ] || [ -z "$CARGO" ] ; then
        SCRIPT_DIR="${TMP_DIR}/rustup.sh"
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -o "${SCRIPT_DIR}"
        
        chmod +x "${SCRIPT_DIR}"
        CARGO_HOME="${TMP_DIR}/cargo" RUSTUP_HOME="${TMP_DIR}/rustup" sh "${SCRIPT_DIR}" --no-modify-path --profile minimal -y
        . "${TMP_DIR}/cargo/env"
    fi
}

get_yarn() {
    if [ -z "$YARN" ]; then
        mkdir "${TMP_DIR}/yarn"
        curl -L "https://github.com/yarnpkg/yarn/releases/download/v1.22.19/yarn-v1.22.19.tar.gz" -o "${TMP_DIR}/yarn/yarn-v1.22.19.tar.gz"
        
        tar -zxf "${TMP_DIR}/yarn/yarn-v1.22.19.tar.gz" -C "${TMP_DIR}/yarn"
        
        PATH="${TMP_DIR}/yarn/yarn-v1.22.19/bin:${PATH}"
        
        echo ${PATH}
    fi
}

patch_cargo() {
    TOML_PATH="${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/native/Cargo.toml"
    
    sed -i -e 's@git = "https://github.com/librespot-org/librespot", branch = "dev"@path = "./librespot-custom"@' $TOML_PATH
}

patch_session() {
    SESSION_PATH="${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/native/librespot-custom/core/src/session.rs"
    
    sed -i -e "/fn check_catalogue(attributes: &UserAttributes)/{n;N;N;N;N;N;N;N;N;d}" ${SESSION_PATH}
    
    # Change function signature so it won't be fucked up the seocnd time
    sed -i -e "s/fn check_catalogue(attributes/fn check_catalogue(_/" ${SESSION_PATH}
}

patch_bitrate() {
    UTILS_PATH="${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/native/src/utils.rs"
    
    sed -i -e "N;s/Bitrate::from_str.*/Bitrate::Bitrate160,/" ${UTILS_PATH}
}

clone_librespot_node() {
    (cd "${TMP_DIR}" || exit; git clone "${LIBRESPOT_NODE_URL}" -b "${LIBRESPOT_NODE_BRANCH}" "librespot-node-${LIBRESPOT_NODE_BRANCH}")
    (cd "${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/native" || exit; git clone "${LIBRESPOT_URL}" -b ${LIBRESPOT_BRANCH} "librespot-custom")
}

compile_librespot() {
    (cd "${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}" || exit; yarn install)
}

strip_symbols() {
    strip -s "${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/dist/build/librespot.node"
    
    COMPILED_LIB_PATH="${TMP_DIR}/librespot-node-${LIBRESPOT_NODE_BRANCH}/dist/build/librespot.node"
}

copy_flatpak_libs() {
    FLATPAK_RUNTIME_DIR="${FLATPAK_INSTALL_DIR}/runtime/org.freedesktop.Platform/${FLATPAK_ARCH}/${FLATPAK_FREEDESKTOP_PLATFORM_VERSION}/active/files/lib/x86_64-linux-gnu/"
    
    LIBSSL="$(ldd ${COMPILED_LIB_PATH} | grep libssl | awk '/ => / { print $3 }' | head -n1)"
    LIBCRYPTO="$(ldd ${COMPILED_LIB_PATH} | grep libcrypto | awk '/ => / { print $3 }' | head -n1)"
    # GLIBC="$(ldd ${COMPILED_LIB_PATH} | grep libc.so | awk '/ => / { print $3 }' | head -n1)"
    
    
    sudo cp "${LIBSSL}" "${FLATPAK_RUNTIME_DIR}"
    sudo cp "${LIBCRYPTO}" "${FLATPAK_RUNTIME_DIR}"
    # sudo cp "${GLIBC}" "${FLATPAK_RUNTIME_DIR}"
}

flatpak_install() {
    FLATPAK_INSTALL_DIR=$(flatpak --installations)
    REPLACE_DIR="${FLATPAK_INSTALL_DIR}/app/${FLATPAK_APP_ID}/current/active/files/Moosync/${LIBRESPOT_LIB_DIR}"
    
    copy_flatpak_libs
    
    sudo rm -f "${REPLACE_DIR}"
    sudo cp "${COMPILED_LIB_PATH}" "${REPLACE_DIR}"
}

install_flatpak_shell() {
    REPLACE_DIR="/app/Moosync/${LIBRESPOT_LIB_DIR}"
    rm -f "${REPLACE_DIR}"
    cp "${COMPILED_LIB_PATH}" "${REPLACE_DIR}"
}

find_and_patch_moosync() {
    INSTALL_LOCATION=$(which moosync)
    echo "${INSTALL_LOCATION}"
    if [ -z "$INSTALL_LOCATION" ]; then
        INSTALL_LOCATION=$(which app.moosync.moosync)
        FLATPAK=true
    fi
    
    if [ "$FLATPAK" ]; then
        flatpak_install
        exit 0
    fi
    
    echo "Installing normal"
    install_flatpak_shell
}


main() {
    clone_librespot_node
    
    patch_cargo
    patch_session
    patch_bitrate
    
    get_rust
    get_yarn
    get_node
    
    compile_librespot
    strip_symbols
    
    if [ -z "${COMPILED_LIB_PATH}" ]; then
        echo "Compilation failed..."
        exit 1
    else
        find_and_patch_moosync
    fi
}

main