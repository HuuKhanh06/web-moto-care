// src/engine/graph.ts
// Nạp và điều hướng đồ thị BPMN To-Be từ process-graph.json

import processGraphData from '../../docs/process-graph.json';

export interface BpmnOutgoing {
  flow: string;
  to: string;
  label: string | null;
}

export interface BpmnNode {
  id: string;
  type: string;
  name: string;
  lane: string;
  scope: 'MAIN' | 'SP1' | 'SP2';
  outgoing?: BpmnOutgoing[];
  gatewayRole?: 'split' | 'join';
  attachedTo?: string; // Cho timer boundary
  cancelActivity?: boolean;
}

export class BpmnGraph {
  private nodesMap: Map<string, BpmnNode> = new Map();

  constructor() {
    for (const node of processGraphData.nodes as BpmnNode[]) {
      this.nodesMap.set(node.id, node);
    }
  }

  /**
   * Lấy nút theo ID
   */
  public getNode(nodeId: string): BpmnNode | undefined {
    return this.nodesMap.get(nodeId);
  }

  /**
   * Lấy thông tin nút bắt buộc, ném lỗi nếu không tồn tại
   */
  public requireNode(nodeId: string): BpmnNode {
    const node = this.nodesMap.get(nodeId);
    if (!node) {
      throw new Error(`[BpmnGraph] Không tìm thấy phần tử BPMN có ID: '${nodeId}'`);
    }
    return node;
  }

  /**
   * Lấy danh sách các nhánh ra của một nút
   */
  public getOutgoings(nodeId: string): BpmnOutgoing[] {
    const node = this.requireNode(nodeId);
    return node.outgoing || [];
  }

  /**
   * Kiểm tra và ném lỗi nếu không tồn tại cạnh nối từ `fromNodeId` đến `toNodeId`
   */
  public assertEdge(fromNodeId: string, toNodeId: string): void {
    const outgoings = this.getOutgoings(fromNodeId);
    const valid = outgoings.some((edge) => edge.to === toNodeId);
    if (!valid) {
      throw new Error(
        `[BpmnGraph Vi phạm cấu trúc BPMN] Không tồn tại cạnh nối từ '${fromNodeId}' đến '${toNodeId}' trong mô hình To-Be!`
      );
    }
  }

  /**
   * Lấy nút tiếp theo theo nhãn rẽ nhánh của cổng XOR
   * @param gatewayId ID của cổng rẽ nhánh
   * @param branchLabel Nhãn nhánh (ví dụ: 'Có', 'Không', 'Đủ', 'Sai/thiếu',...)
   */
  public getNextByLabel(gatewayId: string, branchLabel: string): string {
    const outgoings = this.getOutgoings(gatewayId);
    const match = outgoings.find((edge) => {
      if (!edge.label) return false;
      return edge.label.trim().toLowerCase() === branchLabel.trim().toLowerCase();
    });

    if (!match) {
      const available = outgoings.map((o) => `'${o.label}' -> ${o.to}`).join(', ');
      throw new Error(
        `[BpmnGraph] Cổng '${gatewayId}' không có nhánh ra với nhãn '${branchLabel}'. Các nhánh hiện có: [${available}]`
      );
    }

    return match.to;
  }

  /**
   * Lấy nút tiếp theo cho nút có duy nhất 1 nhánh ra không nhãn
   */
  public getSingleNext(nodeId: string): string {
    const outgoings = this.getOutgoings(nodeId);
    if (outgoings.length === 0) {
      throw new Error(`[BpmnGraph] Nút '${nodeId}' là nút kết thúc hoặc không có nhánh ra.`);
    }
    return outgoings[0].to;
  }

  /**
   * Kiểm tra xem một nút có thuộc quy trình chính (scope: MAIN) không
   */
  public isMainScope(nodeId: string): boolean {
    const node = this.getNode(nodeId);
    return node?.scope === 'MAIN';
  }
}

export const bpmnGraph = new BpmnGraph();

