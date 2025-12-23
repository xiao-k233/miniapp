import type { FileItem } from './types';

export function getFileIcon(file: FileItem): string {
  if (file.type === 'directory') return 'Dir';
  if (file.type === 'link') return 'Lnk';
  if (file.name.match(/\.(png|jpg|jpeg|gif|bmp|svg)$/i)) return '图';
  if (file.name.match(/\.(txt|json|js|ts|vue|less|css|md|xml|html|htm|sh|bash|cfg)$/i)) return '文';
  if (file.isExecutable) return '执';
  return '文';
}
