@echo off
set "JAVA_HOME=C:\Users\sesef\.jdk21\jdk-21.0.6+7"
set "ANDROID_HOME=C:\Users\sesef\AppData\Local\Android\Sdk"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "%~dp0..\android"
call gradlew.bat assembleDebug

