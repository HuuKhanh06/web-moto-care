// src/lib/bpmnModeStore.ts
// Quản lý chế độ hiển thị chấm thi BPMN (BPMN Inspector Mode)

import { create } from 'zustand';

interface BpmnModeState {
  isBpmnMode: boolean;
  toggleBpmnMode: () => void;
  setBpmnMode: (val: boolean) => void;
}

export const useBpmnModeStore = create<BpmnModeState>((set) => ({
  isBpmnMode: false, // Mặc định tắt để trang web sạch đẹp theo chuẩn người dùng thật
  toggleBpmnMode: () => set((state) => ({ isBpmnMode: !state.isBpmnMode })),
  setBpmnMode: (val) => set({ isBpmnMode: val }),
}));
