import { execFileSync } from 'child_process';
import path from 'path';
import getCopyFiles from '@/common/utils/getCopyFiles';

const POWERSHELL_EXPLORER_PATH_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RubickExplorerCompat {
  [DllImport("user32.dll")]
  public static extern IntPtr GetForegroundWindow();
}
"@ | Out-Null
$hwnd = [RubickExplorerCompat]::GetForegroundWindow().ToInt32()
$shell = New-Object -ComObject Shell.Application
$window = $shell.Windows() | Where-Object { $_.HWND -eq $hwnd } | Select-Object -First 1
if ($window -and $window.Document -and $window.Document.Folder -and $window.Document.Folder.Self) {
  [Console]::Out.Write($window.Document.Folder.Self.Path)
}
`.trim();

const getPathFromCopiedFiles = () => {
  const copiedFiles = getCopyFiles() || [];
  if (!copiedFiles.length) {
    return '';
  }

  const candidateFolders = copiedFiles
    .map((item) => {
      if (!item?.path || typeof item.path !== 'string') {
        return '';
      }

      return item.isDirectory ? item.path : path.dirname(item.path);
    })
    .filter(Boolean);

  if (!candidateFolders.length) {
    return '';
  }

  const uniqueFolders = [...new Set(candidateFolders)];
  return uniqueFolders[0] || '';
};

const getWindowsExplorerCurrentFolderPath = () => {
  if (process.platform !== 'win32') {
    return getPathFromCopiedFiles();
  }

  try {
    const result = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command', POWERSHELL_EXPLORER_PATH_SCRIPT],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1500,
        windowsHide: true,
      }
    )
      .trim()
      .replace(/\r?\n/g, '');

    if (result) {
      return result;
    }
  } catch {
    // ignore and fall back to clipboard-derived paths below
  }

  return getPathFromCopiedFiles();
};

export default getWindowsExplorerCurrentFolderPath;
