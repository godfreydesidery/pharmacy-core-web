import { Injectable, inject } from '@angular/core';
import { Api } from '../api/api.service';

export type OwnerType =
  | 'TENANT'
  | 'SALE'
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PRODUCT'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'EXPENSE'
  | 'OTHER';
export type Purpose = 'LOGO' | 'PRESCRIPTION' | 'INVOICE' | 'PHOTO' | 'ATTACHMENT';

export interface StoredFile {
  uid: string;
  name: string;
  contentType: string;
  size: number;
  ownerType: OwnerType;
  ownerUid: string | null;
  purpose: Purpose;
  sha256: string | null;
  createdAt: string;
  createdBy: string;
}

export interface UploadTicket {
  fileUid: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

export interface DownloadLink {
  url: string;
  expiresAt: string;
}

export interface Owner {
  ownerType: OwnerType;
  ownerUid: string | null;
  purpose?: Purpose;
}

export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

/** Why a file cannot be uploaded, as an i18n key, or null when it can. */
export function fileProblem(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) {
    return 'files.tooLarge';
  }
  const type = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  return ACCEPTED_TYPES.includes(type) ? null : 'files.unsupported';
}

/**
 * Files over the API: begin (a presigned PUT), PUT the bytes straight to storage with progress,
 * then complete. The PUT goes out with XMLHttpRequest, not HttpClient, so no session header leaks
 * to S3 and the progress is reported.
 */
@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly api = inject(Api);

  async upload(
    file: File,
    owner: Owner,
    progress?: (percent: number) => void,
  ): Promise<StoredFile> {
    const ticket = await this.api.post<UploadTicket>('/files/uploads', {
      name: file.name,
      contentType: file.type,
      size: file.size,
      ownerType: owner.ownerType,
      ownerUid: owner.ownerUid,
      purpose: owner.purpose ?? 'ATTACHMENT',
    });
    await put(ticket, file, progress);
    return this.api.post<StoredFile>(`/files/uploads/${ticket.fileUid}/complete`);
  }

  list(owner: Owner): Promise<StoredFile[]> {
    return this.api.get<StoredFile[]>('/files', {
      ownerType: owner.ownerType,
      ownerUid: owner.ownerUid,
    });
  }

  /** A presigned URL valid a few minutes, for an `<img src>` or a link. */
  async url(fileUid: string): Promise<string> {
    return (await this.api.get<DownloadLink>(`/files/${fileUid}/url`, {}, { silent: true })).url;
  }

  delete(fileUid: string): Promise<void> {
    return this.api.delete<void>(`/files/${fileUid}`);
  }
}

function put(
  ticket: UploadTicket,
  file: File,
  progress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', ticket.uploadUrl);
    for (const [name, value] of Object.entries(ticket.headers ?? {})) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && progress) {
        progress(Math.round((event.loaded / event.total) * 100));
      }
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (HTTP ${request.status})`));
    request.onerror = () => reject(new Error('Upload failed: the storage could not be reached'));
    request.send(file);
  });
}
