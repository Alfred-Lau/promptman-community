import type { LibraryItem } from '@/lib/seekdb/types'

/** 优先显示库名称；无库时回退到旧版「分类」字段（兼容历史数据） */
export function resolveLibraryOrCategoryLabel(
  libraries: LibraryItem[],
  libraryId: string | undefined | null,
  legacyCategory?: string | null,
): string {
  if (libraryId) {
    const lib = libraries.find((l) => l.id === libraryId)
    if (lib) return lib.name
  }
  return (legacyCategory ?? '').trim()
}
