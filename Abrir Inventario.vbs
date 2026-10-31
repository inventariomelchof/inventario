Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d C:\Users\melchor\Desktop\inventario && npx next start", 0, False
WScript.Sleep 1200
WshShell.Run "http://localhost:3000", 1, False