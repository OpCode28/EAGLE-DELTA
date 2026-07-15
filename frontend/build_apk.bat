call npm run build
call npx cap sync android
cd android
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\OM\AppData\Local\Android\Sdk
call gradlew.bat assembleDebug
copy app\build\outputs\apk\debug\app-debug.apk ..\..\..\Netra32-Dashboard.apk /y
