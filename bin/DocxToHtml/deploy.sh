#!/bin/bash
# deploy.sh

cd /path/to/dynadoc/bin/DocxToHtml

dotnet publish -c Release -r win-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/win && dotnet publish -c Release -r osx-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac && dotnet publish -c Release -r osx-arm64 --self-contained true /p:PublishSingleFile=true -o ./publish/mac-arm64 && dotnet publish -c Release -r linux-x64 --self-contained true /p:PublishSingleFile=true -o ./publish/linux && chmod +x ./publish/mac/DocxToHtml ./publish/mac-arm64/DocxToHtml ./publish/linux/DocxToHtml && cp -R "publish/" "../../resources/bin/"

echo "✅ Deployment successful!"