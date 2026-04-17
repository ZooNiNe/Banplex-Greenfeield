import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import {
  resolveProfileId,
  resolveTeamId,
  resolveTelegramUserId,
} from '../lib/auth-context'

const DEFAULT_BUCKET_NAME = 'hrd_documents'

function normalizeText(value, fallback = null) {
  const normalizedValue = String(value ?? '').trim()

  return normalizedValue.length > 0 ? normalizedValue : fallback
}

function toNumber(value) {
  const parsedValue = Number(value)

  return Number.isFinite(parsedValue) ? parsedValue : 0
}

function toError(error, fallbackMessage) {
  const message =
    typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : fallbackMessage

  return error instanceof Error ? error : new Error(message)
}

function sanitizeFileName(fileName) {
  return String(fileName ?? 'document')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildStoragePath(fileName, folder = 'hrd') {
  const safeFileName = sanitizeFileName(fileName)
  const dateSegment = new Date().toISOString().slice(0, 10)
  const uniqueSegment =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`

  return [normalizeText(folder, 'hrd'), dateSegment, `${uniqueSegment}-${safeFileName}`]
    .filter(Boolean)
    .join('/')
}

function normalizeFileAssetRow(fileAsset) {
  return {
    ...fileAsset,
    team_id: normalizeText(fileAsset?.team_id, null),
    storage_bucket: normalizeText(
      fileAsset?.storage_bucket ?? fileAsset?.bucket_name,
      DEFAULT_BUCKET_NAME
    ),
    bucket_name: normalizeText(fileAsset?.bucket_name, DEFAULT_BUCKET_NAME),
    storage_path: normalizeText(fileAsset?.storage_path),
    original_name: normalizeText(fileAsset?.original_name ?? fileAsset?.file_name),
    file_name: normalizeText(fileAsset?.file_name ?? fileAsset?.original_name),
    public_url: normalizeText(fileAsset?.public_url),
    mime_type: normalizeText(fileAsset?.mime_type, null),
    size_bytes: toNumber(fileAsset?.size_bytes ?? fileAsset?.file_size),
    file_size: toNumber(fileAsset?.file_size ?? fileAsset?.size_bytes),
    uploaded_by_user_id: normalizeText(fileAsset?.uploaded_by_user_id, null),
    uploaded_by: normalizeText(fileAsset?.uploaded_by, null),
    deleted_at: normalizeText(fileAsset?.deleted_at, null),
  }
}

async function deleteStorageObject(bucketName, storagePath) {
  if (!supabase || !bucketName || !storagePath) {
    return null
  }

  const { error } = await supabase.storage.from(bucketName).remove([storagePath])

  return error ?? null
}

async function insertFileAssetRecord(uploadMeta = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const teamId = resolveTeamId(uploadMeta.team_id)
  const bucketName = normalizeText(uploadMeta.bucket_name, DEFAULT_BUCKET_NAME)
  const storagePath = normalizeText(uploadMeta.storage_path)
  const fileName = normalizeText(uploadMeta.file_name)
  const publicUrl = normalizeText(uploadMeta.public_url)
  const uploadedByUserId = resolveProfileId(uploadMeta.uploaded_by_user_id)
  const uploadedBy = resolveTelegramUserId(uploadMeta.uploaded_by)

  if (!teamId) {
    throw new Error('Akses workspace tidak ditemukan.')
  }

  if (!bucketName) {
    throw new Error('Nama bucket file wajib diisi.')
  }

  if (!storagePath) {
    throw new Error('Storage path file wajib diisi.')
  }

  if (!fileName) {
    throw new Error('Nama file wajib diisi.')
  }

  if (!publicUrl) {
    throw new Error('Public URL file wajib diisi.')
  }

  const { data, error } = await supabase
    .from('file_assets')
    .insert({
      team_id: teamId,
      storage_bucket: bucketName,
      bucket_name: bucketName,
      storage_path: storagePath,
      original_name: fileName,
      file_name: fileName,
      public_url: publicUrl,
      mime_type: normalizeText(uploadMeta.mime_type, null),
      size_bytes: toNumber(uploadMeta.file_size),
      file_size: toNumber(uploadMeta.file_size),
      uploaded_by_user_id: uploadedByUserId,
      uploaded_by: uploadedBy,
    })
    .select(
      'id, team_id, storage_bucket, bucket_name, storage_path, original_name, file_name, public_url, mime_type, size_bytes, file_size, uploaded_by_user_id, uploaded_by, created_at, updated_at, deleted_at'
    )
    .single()

  if (error) {
    throw error
  }

  return normalizeFileAssetRow(data)
}

async function uploadFileToStorage(file, options = {}) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  if (!(file instanceof File)) {
    throw new Error('File yang diunggah tidak valid.')
  }

  const bucketName = normalizeText(options.bucket_name, DEFAULT_BUCKET_NAME)
  const folder = normalizeText(options.folder, 'hrd')
  const storagePath = buildStoragePath(file.name, folder)
  const contentType = normalizeText(file.type, 'application/octet-stream')

  const { error } = await supabase.storage.from(bucketName).upload(storagePath, file, {
    contentType,
    upsert: false,
  })

  if (error) {
    throw error
  }

  const { data } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
  const publicUrl = normalizeText(data?.publicUrl)

  if (!publicUrl) {
    throw new Error('Public URL file gagal dibentuk.')
  }

  return {
    team_id: resolveTeamId(options.team_id),
    storage_bucket: bucketName,
    bucket_name: bucketName,
    storage_path: storagePath,
    original_name: file.name,
    file_name: file.name,
    public_url: publicUrl,
    mime_type: file.type || null,
    size_bytes: file.size,
    file_size: file.size,
    uploaded_by_user_id: resolveProfileId(options.uploaded_by_user_id),
    uploaded_by: resolveTelegramUserId(options.uploaded_by),
  }
}

async function uploadAndRegisterFile(file, options = {}) {
  const uploadedFile = await uploadFileToStorage(file, options)

  try {
    return await insertFileAssetRecord(uploadedFile)
  } catch (error) {
    await deleteStorageObject(uploadedFile.bucket_name, uploadedFile.storage_path)
    throw error
  }
}

async function deleteFileAsset(fileAssetId) {
  if (!supabase) {
    throw new Error('Client Supabase belum dikonfigurasi.')
  }

  const normalizedId = normalizeText(fileAssetId)

  if (!normalizedId) {
    throw new Error('ID file asset wajib diisi.')
  }

  const { data: fileAsset, error: fetchError } = await supabase
    .from('file_assets')
    .select('id')
    .eq('id', normalizedId)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
    throw fetchError
  }

  if (!fileAsset?.id) {
    return true
  }

  const { error } = await supabase
    .from('file_assets')
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', normalizedId)
    .is('deleted_at', null)

  if (error) {
    throw error
  }

  return true
}

const useFileStore = create((set) => ({
  uploadedFileAssets: [],
  isUploading: false,
  error: null,
  clearError: () => set({ error: null }),
  uploadFileToStorage: async (file, options = {}) => {
    set({ isUploading: true, error: null })

    try {
      const uploadedFile = await uploadFileToStorage(file, options)
      const fileAsset = await insertFileAssetRecord(uploadedFile)

      set((state) => ({
        uploadedFileAssets: [fileAsset, ...state.uploadedFileAssets],
        isUploading: false,
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal mengunggah file.')

      set({
        isUploading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  registerFileAsset: async (uploadMeta = {}) => {
    set({ isUploading: true, error: null })

    try {
      const fileAsset = await insertFileAssetRecord(uploadMeta)

      set((state) => ({
        uploadedFileAssets: [fileAsset, ...state.uploadedFileAssets],
        isUploading: false,
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menyimpan metadata file.')

      set({
        isUploading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  uploadAndRegisterFile: async (file, options = {}) => {
    set({ isUploading: true, error: null })

    try {
      const fileAsset = await uploadAndRegisterFile(file, options)

      set((state) => ({
        uploadedFileAssets: [fileAsset, ...state.uploadedFileAssets],
        isUploading: false,
        error: null,
      }))

      return fileAsset
    } catch (error) {
      const normalizedError = toError(error, 'Gagal mengunggah file.')

      set({
        isUploading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
  deleteFileAsset: async (fileAssetId) => {
    set({ isUploading: true, error: null })

    try {
      await deleteFileAsset(fileAssetId)

      set((state) => ({
        uploadedFileAssets: state.uploadedFileAssets.filter(
          (item) => item.id !== fileAssetId
        ),
        isUploading: false,
        error: null,
      }))

      return true
    } catch (error) {
      const normalizedError = toError(error, 'Gagal menghapus file.')

      set({
        isUploading: false,
        error: normalizedError.message,
      })

      throw normalizedError
    }
  },
}))

export default useFileStore
export {
  deleteFileAsset,
  insertFileAssetRecord,
  uploadAndRegisterFile,
  uploadFileToStorage,
  useFileStore,
}
