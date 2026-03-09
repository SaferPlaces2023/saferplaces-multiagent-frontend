@echo off

echo ========================================
echo Project modules setup starting
echo ========================================

REM --------------------------------------------------
REM MODULE: safer-3d-cesium
REM --------------------------------------------------

echo.
echo ----------------------------------------
echo Setting up module safer-3d-cesium
echo ----------------------------------------

REM ensure ext directory exists
if not exist public\ext mkdir public\ext

echo Checking repository...

if exist public\ext\safer-3d-cesium (
    echo Repository already exists - skipping clone
) else (
    echo Cloning safer-3d-cesium branch spma-integration
    cd public\ext
    git clone -b spma-integration https://github.com/SaferPlaces2023/safer-3d-cesium.git
    cd ..\..
)

echo Installing and building viewer
cd public\ext\safer-3d-cesium\viewer
call npm install
call npm run build

echo Installing and building viewer-demo
cd ..\demo
call npm install
call npm run build

echo.
echo ----------------------------------------
echo Cesium configuration
echo ----------------------------------------

set /p CESIUM_TOKEN=Please enter your CESIUM_ION_TOKEN: 

echo Writing token to demo\.env.local

echo VITE_CESIUM_ION_TOKEN=%CESIUM_TOKEN%> .env.local

echo Token saved successfully.

cd ..\..\..\..

echo Module safer-3d-cesium setup completed


REM --------------------------------------------------
REM MODULE: your-next-external-module
REM --------------------------------------------------


echo.
echo ========================================
echo All module setup operations completed
echo ========================================

pause