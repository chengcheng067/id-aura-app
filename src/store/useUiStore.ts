import { create } from 'zustand';

/**
 * UI 瞬态状态：抽屉开关、当前选中 stage、向导可见性、时间轴缩放档位。
 * 与业务数据严格分离——刷新即失，不落库。
 */

export type TimelineZoom = 'month' | 'half-month';

export interface UiState {
  stageDrawerStageId: string | null; // 打开的抽屉对应阶段
  contractWizardOpen: boolean;
  manualFormOpen: boolean;
  timelineZoom: TimelineZoom;

  openStageDrawer(stageId: string): void;
  closeStageDrawer(): void;
  openContractWizard(): void;
  closeContractWizard(): void;
  openManualForm(): void;
  closeManualForm(): void;
  setTimelineZoom(zoom: TimelineZoom): void;
}

export const useUiStore = create<UiState>((set) => ({
  stageDrawerStageId: null,
  contractWizardOpen: false,
  manualFormOpen: false,
  timelineZoom: 'month',

  openStageDrawer: (stageId) => set({ stageDrawerStageId: stageId }),
  closeStageDrawer: () => set({ stageDrawerStageId: null }),
  openContractWizard: () => set({ contractWizardOpen: true, manualFormOpen: false }),
  closeContractWizard: () => set({ contractWizardOpen: false }),
  openManualForm: () => set({ manualFormOpen: true, contractWizardOpen: false }),
  closeManualForm: () => set({ manualFormOpen: false }),
  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
}));
