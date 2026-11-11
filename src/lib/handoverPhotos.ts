import { imageRefToDataUrl } from '@/ai/images';
import { withOcrDeadline } from '@/ai/timeout';

/** Convert legacy browser-local blobs while still available on the uploading device. */
export async function durableHandoverPhotos(refs: string[]): Promise<string[]> {
  return withOcrDeadline(signal => Promise.all(refs.map(async ref => {
    if (!ref) throw new Error('Vui lòng chọn đủ ảnh bàn giao.');
    if (!ref.startsWith('blob:')) return ref;
    try { return await imageRefToDataUrl(ref, signal); }
    catch { throw new Error('Ảnh cũ chỉ tồn tại trên trình duyệt tải lên và không còn đọc được. Vui lòng chọn lại ảnh từ máy rồi gửi lại.'); }
  })), 15000);
}
