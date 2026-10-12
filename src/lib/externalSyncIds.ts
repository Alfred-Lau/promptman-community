/**
 * 与 electron/main 中 promptPathSync / skillPathSync 写入的稳定 ID 前缀一致，
 * 用于在列表中区分「用户创建」与「从外部目录/文件同步」的记录。
 */
export function isExternalSyncedPromptId(promptId: string): boolean {
  return promptId.startsWith('fs-prompt-')
}

export function isExternalSyncedSkillId(skillId: string): boolean {
  return skillId.startsWith('fs-scan-')
}

export function partitionRowsByExternalSync<T>(
  rows: T[],
  getGroupId: (row: T) => string,
  isExternalId: (id: string) => boolean,
): { userRows: T[]; externalRows: T[] } {
  const userRows: T[] = []
  const externalRows: T[] = []
  for (const row of rows) {
    if (isExternalId(getGroupId(row))) externalRows.push(row)
    else userRows.push(row)
  }
  return { userRows, externalRows }
}
