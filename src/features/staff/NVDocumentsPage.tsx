import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '@/db';
import { dataAdapter } from '@/db/adapter';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Input, Modal, toast } from '@/components/ui';
import { documentNamesMismatch, IDENTITY_MISMATCH_MESSAGE } from '@/ai/documentIdentity';
import { approveDocumentReview, requestDocumentSupplement, type ReviewedIdentity } from './documentReview';
import type { CustomerDocument, RentalRequest } from '@/db/types';

const labels = { CCCD_TRUOC: 'CCCD mặt trước', CCCD_SAU: 'CCCD mặt sau', BANG_LAI_TRUOC: 'Bằng lái mặt trước' };
export function NVDocumentsPage() {
  const [params] = useSearchParams(); const requestId = params.get('requestId');
  const navigate = useNavigate(); const actor = useAuthStore(state => state.currentActor);
  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [docs, setDocs] = useState<CustomerDocument[]>([]);
  const [profile, setProfile] = useState<ReviewedIdentity>({ fullName: '', idNumber: '', dob: '', licenseClass: '' });
  const [mismatch, setMismatch] = useState(false);
  const [ready, setReady] = useState(false); const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false); const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(null);
  const load = useCallback(async (sync = false) => {
    if (!requestId) { setLoading(false); return; }
    try {
      if (sync) await dataAdapter.syncCloudToLocal();
      const req = await db.rental_requests.get(requestId);
      const documents = await db.customer_documents.where('request_id').equals(requestId).toArray();
      const state = await db.process_state.get(requestId);
      setRequest(req || null); setDocs(documents); setReviewed(false);
      setReady(Boolean(req && ['MOI', 'CHO_HO_SO'].includes(req.status) && state?.waiting_node_ids.includes('M_CheckDocs')));
      setMismatch(documentNamesMismatch(documents) || state?.variables.document_identity_mismatch === true);
      const read = (type: string, key: string) => {
        const field = documents.find(doc => doc.doc_type === type)?.ai_result?.[key];
        return field && typeof field === 'object' && 'value' in field && typeof field.value === 'string' ? field.value : '';
      };
      const vars = state?.variables || {};
      setProfile({ fullName: String(vars.customer_full_name || read('CCCD_TRUOC', 'full_name')),
        idNumber: String(vars.customer_id_number || read('CCCD_TRUOC', 'id_number')),
        dob: String(vars.customer_date_of_birth || read('CCCD_TRUOC', 'date_of_birth')),
        licenseClass: String(vars.customer_license_class || read('BANG_LAI_TRUOC', 'license_class')) });
    } catch { toast.error('Không tải được hồ sơ. Vui lòng làm mới.'); }
    finally { setLoading(false); }
  }, [requestId]);
  useEffect(() => { void load(true); }, [load]);
  const decide = async (approve: boolean) => {
    if (!actor || !requestId || busy || (approve && !reviewed)) return;
    setBusy(true);
    try {
      if (approve) { await approveDocumentReview(requestId, actor, profile, docs); toast.success('Đã duyệt hồ sơ và chuyển sang đặt cọc.'); navigate('/nv/01'); }
      else { await requestDocumentSupplement(requestId, actor); toast.success('Đã gửi yêu cầu bổ sung giấy tờ.'); await load(); }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Không xử lý được hồ sơ.'); }
    finally { setBusy(false); }
  };
  if (loading) return <p className="p-6">Đang tải hồ sơ giấy tờ...</p>;
  if (!request) return <Card className="p-6 space-y-3"><p>Không tìm thấy hồ sơ.</p><Button onClick={() => navigate('/nv/01')}>Về hộp việc</Button></Card>;
  const allDocs = Object.keys(labels).every(type => docs.some(doc => doc.doc_type === type && doc.file_url));
  return <div className="max-w-4xl mx-auto space-y-5 pb-12">
    <div className="flex items-center justify-between gap-3"><h1 className="text-2xl font-semibold">Kiểm tra hồ sơ giấy tờ</h1><Button variant="outline" disabled={busy} onClick={() => void load(true)}>Làm mới</Button></div>
    <p className="text-sm text-slate-600">Đơn #{request.id.slice(-6).toUpperCase()}. Đối chiếu ba ảnh cùng một người trước khi duyệt.</p>
    {!ready && <p role="alert">Hồ sơ đã chuyển bước hoặc không còn chờ kiểm tra.</p>}
    {!allDocs && <p role="alert" className="p-4 bg-amber-50 rounded-xl">Khách chưa tải đủ ba ảnh giấy tờ. Nhân viên có thể yêu cầu bổ sung; chưa thể duyệt.</p>}
    {mismatch && <p role="alert" className="p-4 bg-rose-50 rounded-xl text-rose-800">{IDENTITY_MISMATCH_MESSAGE}</p>}
    <div className="grid md:grid-cols-3 gap-3">{Object.entries(labels).map(([type, label]) => {
      const doc = docs.find(item => item.doc_type === type);
      return <Card key={type} className="p-3 space-y-2"><h2 className="font-semibold">{label}</h2>{doc?.file_url ? <button type="button" className="w-full cursor-zoom-in" onClick={() => setPreview({ url: doc.file_url, label })}><img src={doc.file_url} alt={label} className="w-full h-48 object-contain" /></button> : <p className="text-sm text-slate-500">Chưa có ảnh</p>}</Card>;
    })}</div>
    {preview && <Modal isOpen onClose={() => setPreview(null)} title={preview.label}><img src={preview.url} alt={preview.label} className="w-full max-h-[75vh] object-contain" /></Modal>}
    <Card className="p-5 space-y-4"><div className="grid sm:grid-cols-2 gap-3">
      <Input label="Họ và tên trên giấy tờ" value={profile.fullName} disabled={busy || !ready} onChange={e => { setReviewed(false); setProfile({ ...profile, fullName: e.target.value }); }} />
      <Input label="Số CCCD" value={profile.idNumber} disabled={busy || !ready} onChange={e => { setReviewed(false); setProfile({ ...profile, idNumber: e.target.value }); }} />
      <Input label="Ngày sinh" type="date" value={profile.dob} disabled={busy || !ready} onChange={e => { setReviewed(false); setProfile({ ...profile, dob: e.target.value }); }} />
      <Input label="Hạng bằng lái" value={profile.licenseClass} disabled={busy || !ready} onChange={e => { setReviewed(false); setProfile({ ...profile, licenseClass: e.target.value }); }} />
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy || !allDocs || mismatch || !ready} onChange={e => setReviewed(e.target.checked)} />Tôi đã đối chiếu giấy tờ cùng một người và thông tin nhập là chính xác.</label>
    <div className="flex flex-wrap gap-3"><Button disabled={busy || !allDocs || mismatch || !ready || !reviewed} onClick={() => void decide(true)}>Duyệt hồ sơ và chuyển đặt cọc</Button><Button variant="outline" disabled={busy || !ready} onClick={() => void decide(false)}>Yêu cầu bổ sung giấy tờ</Button></div>
    </Card>
  </div>;
}
