$sig = @'
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);
[DllImport("user32.dll")]
public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
'@
Add-Type -MemberDefinition $sig -Name WindowHelper -Namespace Win32 -ErrorAction SilentlyContinue

$procs = Get-Process chrome -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
foreach ($p in $procs) {
    [Win32.WindowHelper]::ShowWindow($p.MainWindowHandle, 3) # SW_MAXIMIZE
    [Win32.WindowHelper]::SetForegroundWindow($p.MainWindowHandle)
}
