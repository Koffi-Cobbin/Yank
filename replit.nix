{pkgs}: {
  deps = [
    pkgs.openssl
    pkgs.pkg-config
    pkgs.curl
    pkgs.gcc
    pkgs.cmake
  ];
}
