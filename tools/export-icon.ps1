# Rebuild the checked-in launcher and WebView images after editing the README portrait.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$root = Split-Path -Parent $PSScriptRoot
$portrait = Join-Path $root 'docs/images/spira-companion.png'
$layers = Join-Path $root 'app/res/drawable-xxxhdpi'
New-Item -ItemType Directory -Force $layers | Out-Null

# The xxxhdpi canvas is 108 dp. The portrait occupies the middle 62 dp.
$launcher = 'scale=248:248:flags=lanczos,format=rgba,pad=432:432:(ow-iw)/2:(oh-ih)/2:color=black@0'
$header = 'scale=108:108:flags=lanczos,format=rgba'
$foreground = Join-Path $layers 'spira_portrait.webp'
& ffmpeg -v error -y -i $portrait -vf $launcher -frames:v 1 -c:v libwebp -lossless 1 $foreground
& ffmpeg -v error -y -i $portrait -vf $header -frames:v 1 -c:v libwebp -lossless 1 (Join-Path $root 'app/assets/spira-icon.webp')

# Android tints this layer using its alpha channel. Cut the dark ink out of
# the face and flower so both keep their detail when rendered in one color.
$ink = "format=gbrap,geq=r=255:g=255:b=255:a='alpha(X,Y)*clip((0.27*r(X,Y)+0.55*g(X,Y)+0.18*b(X,Y)-32)/130,0,1)'"
& ffmpeg -v error -y -i $foreground -vf $ink -frames:v 1 -c:v libwebp -lossless 1 (Join-Path $layers 'spira_portrait_mono.webp')
