__PLATFORM__=$(uname -s)

case $__PLATFORM__ in
    "Linux")
        __PLATFORM_ARCH__="linux-x64"
        ;;
    "Darwin")
        __PLATFORM_ARCH__="darwin-x64"
        ;;
esac

__NAME__="node-v$VERSION-$__PLATFORM_ARCH__"
__URL__="https://nodejs.org/dist/v$VERSION/$__NAME__.tar.gz"

mkdir -p "./versions"

__BIN_DIR__="./versions/$__NAME__/bin"

if [ ! -d $__BIN_DIR__ ]; then
    curl -s "$__URL__" | tar -xzf - -C "./versions"
fi

CWD=$(pwd)

export PATH=$(env -i bash -l -c 'echo $PATH')

export PATH="$CWD/versions/$__NAME__/bin:$PATH"