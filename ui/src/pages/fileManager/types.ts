export type FileType = 'file' | 'directory' | 'link';

export interface FileItem {
  name: string;
  type: FileType;
  permissions: string;
  size: number;
  sizeFormatted: string;
  modifiedTime: number;
  modifiedTimeFormatted: string;
  fullPath: string;
  isHidden: boolean;
  isExecutable: boolean;
  icon: string;
}

export interface FileManagerOptions {
  path?: string;
  refresh?: boolean;
}
