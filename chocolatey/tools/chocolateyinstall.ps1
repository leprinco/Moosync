$ErrorActionPreference = 'Stop';
$toolsDir = "$(Split-Path -parent $MyInvocation.MyCommand.Definition)"
$url64 = 'https://github.com/Moosync/Moosync/releases/download/v8.1.0/Moosync-8.1.0-win-x64.exe'

$packageArgs = @{
  packageName    = $env:ChocolateyPackageName
  unzipLocation  = $toolsDir
  fileType       = 'exe'
  url64bit       = $url64

  softwareName   = 'Moosync*'

  checksum64     = '2d04cba92a6e17bde4800b25d5b25042f967deaa0c4bad5780e740b91e52040c'
  checksumType64 = 'sha256'

  validExitCodes = @(0, 3010, 1641)
  silentArgs     = '/S'
}

Install-ChocolateyPackage @packageArgs



















