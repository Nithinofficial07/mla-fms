import { createHash } from 'node:crypto';
import { formatId } from '@mla/shared';
import { DocumentModel } from '../../models/Document.js';
import { RequestModel } from '../../models/Request.js';
import { Letter } from '../../models/Letter.js';
import { Department } from '../../models/Department.js';
import { SystemSettings } from '../../models/config.js';
import { AppError } from '../../utils/AppError.js';
import { nextSequence, yearlyKey } from '../../utils/sequence.js';
import { buildDocumentKey, storage } from '../../storage/index.js';
import { runOcr } from './ocr.service.js';

/** Which record a document hangs off. */
export type DocOwner = { kind: 'request' | 'letter'; id: string };

interface AddFileInput {
  owner: DocOwner;
  documentType: string;
  description?: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  uploadedBy: string;
  source: 'upload' | 'scan';
  pageCount?: number;
}

async function deptCodeForOwner(owner: DocOwner): Promise<string> {
  let departmentId: unknown = null;
  if (owner.kind === 'request') {
    const req = await RequestModel.findById(owner.id).lean();
    if (!req) throw AppError.notFound('Request not found');
    departmentId = req.primaryDepartmentId;
  } else {
    const letter = await Letter.findById(owner.id).lean();
    if (!letter) throw AppError.notFound('Letter not found');
    departmentId = letter.departmentId;
  }
  if (!departmentId) return 'unassigned';
  const dept = await Department.findById(departmentId as string).lean();
  return dept?.code ?? 'unassigned';
}

function ownerFields(owner: DocOwner) {
  return owner.kind === 'request' ? { requestId: owner.id } : { letterId: owner.id };
}

function ownerOf(doc: { requestId?: unknown; letterId?: unknown }): DocOwner {
  return doc.requestId
    ? { kind: 'request', id: String(doc.requestId) }
    : { kind: 'letter', id: String(doc.letterId) };
}

export const documentsService = {
  async addDocument(input: AddFileInput) {
    const cfg = (await SystemSettings.findById('app').lean()) ?? { documentIdFormat: 'DOC-{YYYY}-{SEQ:6}' };
    const seq = await nextSequence(yearlyKey('documentId'));
    const deptCode = await deptCodeForOwner(input.owner);
    const now = new Date();
    const key = buildDocumentKey({
      year: now.getFullYear(),
      deptCode,
      ownerRef: `${input.owner.kind}-${input.owner.id}`,
      version: 1,
      originalName: input.originalName,
    });
    const stored = await storage().put({ key, body: input.buffer, contentType: input.mimeType });
    const checksum = createHash('sha256').update(input.buffer).digest('hex');
    const ocr = await runOcr(input.buffer, input.mimeType);

    return DocumentModel.create({
      documentId: formatId({ format: cfg.documentIdFormat, seq, date: now }),
      ...ownerFields(input.owner),
      documentType: input.documentType,
      description: input.description ?? '',
      currentVersion: 1,
      pageCount: input.pageCount ?? 1,
      uploadedBy: input.uploadedBy,
      ocrText: ocr?.text ?? '',
      ocrStatus: ocr ? 'done' : 'none',
      versions: [
        {
          version: 1,
          storageKey: stored.key,
          fileName: input.originalName,
          mimeType: input.mimeType,
          size: stored.size,
          checksum,
          uploadedBy: input.uploadedBy,
          source: input.source,
        },
      ],
    });
  },

  async addVersion(documentId: string, input: Omit<AddFileInput, 'owner' | 'documentType'>) {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) throw AppError.notFound('Document not found');
    const owner = ownerOf(doc);
    const version = doc.currentVersion + 1;
    const deptCode = await deptCodeForOwner(owner);
    const key = buildDocumentKey({
      year: new Date().getFullYear(),
      deptCode,
      ownerRef: `${owner.kind}-${owner.id}`,
      version,
      originalName: input.originalName,
    });
    const stored = await storage().put({ key, body: input.buffer, contentType: input.mimeType });
    doc.versions.push({
      version,
      storageKey: stored.key,
      fileName: input.originalName,
      mimeType: input.mimeType,
      size: stored.size,
      checksum: createHash('sha256').update(input.buffer).digest('hex'),
      uploadedBy: input.uploadedBy,
      source: input.source,
      uploadedAt: new Date(),
    } as never);
    doc.currentVersion = version;
    await doc.save();
    return doc;
  },

  listForOwner(owner: DocOwner) {
    return DocumentModel.find(ownerFields(owner)).sort('-createdAt').lean();
  },

  async signedUrlFor(documentId: string, opts: { download?: boolean }) {
    const doc = await DocumentModel.findById(documentId).lean();
    if (!doc) throw AppError.notFound('Document not found');
    const current = doc.versions.find((v) => v.version === doc.currentVersion) ?? doc.versions.at(-1);
    if (!current) throw AppError.notFound('Document has no stored file');
    const url = await storage().getSignedUrl(current.storageKey, {
      download: opts.download,
      filename: current.fileName,
    });
    return { url, fileName: current.fileName, mimeType: current.mimeType, expiresInSeconds: 300 };
  },

  async remove(documentId: string) {
    const doc = await DocumentModel.findById(documentId);
    if (!doc) throw AppError.notFound('Document not found');
    doc.status = 'removed';
    await (doc as unknown as { softDelete: () => Promise<unknown> }).softDelete();
    return doc;
  },
};
