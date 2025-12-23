import type { FileItem } from './types';
import { formatTime, formatSize } from './utils';
import { Shell } from 'langningchen';

export async function initializeShell(): Promise<void> {
  if (!Shell) throw new Error('Shell对象未定义');
  if (typeof Shell.initialize !== 'function') throw new Error('Shell.initialize方法不存在');
  await Shell.initialize();
}

export async function loadDirectory(currentPath: string): Promise<FileItem[]> {
  if (!Shell) throw new Error('Shell模块未初始化');
  let path = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
  if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);

  const cmd = `cd "${path}" && ls -la --time-style=+%s 2>/dev/null || ls -la 2>/dev/null`;
  const result = await Shell.exec(cmd);
  if (!result.trim()) return [];

  const lines = result.trim().split('\n').slice(1);
  const files: FileItem[] = [];

  for (const line of lines) {
    const file = parseFileLine(line, path);
    if (file) files.push(file);
  }
  return files;
}

function parseFileLine(line: string, currentPath: string): FileItem | null {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 6) return null;

  const permissions = parts[0];
  let name = parts[parts.length-1];
  if (name === '.' || name === '..') return null;

  const typeChar = permissions.charAt(0);
  let type: 'file' | 'directory' | 'link' = 'file';

  if (typeChar === 'd') type = 'directory';
  else if (typeChar === 'l') {
    type = 'link';
    const arrowIndex = name.indexOf('->');
    if (arrowIndex >= 0) name = name.substring(0, arrowIndex).trim();
  }

  let size = 0;
  for (let i = 1; i < parts.length-1; i++) {
    const num = parseInt(parts[i],10);
    if (!isNaN(num) && num > 0 && num < 1e9) { size = num; break; }
  }

  const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
  const isHidden = name.startsWith('.');
  const isExecutable = permissions.includes('x');

  return {
    name,
    type,
    permissions,
    size,
    sizeFormatted: type==='directory'?'<DIR>':formatSize(size),
    modifiedTime: Math.floor(Date.now()/1000),
    modifiedTimeFormatted: formatTime(Math.floor(Date.now()/1000)),
    fullPath,
    isHidden,
    isExecutable,
    icon: '', // UI 层调用 getFileIcon 设置
  };
}

export async function deleteItem(file: FileItem): Promise<void> {
  if (!Shell) throw new Error('Shell模块未初始化');
  await Shell.exec(`rm -rf "${file.fullPath}"`);
}

export async function renameItem(file: FileItem, newName: string, currentPath: string): Promise<void> {
  if (!Shell) throw new Error('Shell模块未初始化');
  const newPath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;
  await Shell.exec(`mv "${file.fullPath}" "${newPath}"`);
}
