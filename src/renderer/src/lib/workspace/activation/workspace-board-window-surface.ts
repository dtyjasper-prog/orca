let workspaceBoardWindowSurface = false

/** Called once by the pop-out board entry; that renderer mirrors the main window and owns no workspaces. */
export function markWorkspaceBoardWindowSurface(): void {
  workspaceBoardWindowSurface = true
}

export function isWorkspaceBoardWindowSurface(): boolean {
  return workspaceBoardWindowSurface
}
