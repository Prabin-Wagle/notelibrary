import { FormEvent, useEffect, useState } from 'react';
import { Archive, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardLayout } from '../components/DashboardLayout';
import { api, apiMessage } from '../lib/api';

type ResourceType = { id: number; code: string; name: string };
type Resource = { id: number; title: string; slug: string; type: string; status: string; visibility: string; updated_at: string };

export default function ResourcesManager() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ resource_type_id: '', title: '', slug: '', summary: '', status: 'draft', visibility: 'authenticated' });

  const load = async () => {
    setLoading(true);
    try {
      const [resourceResponse, typeResponse] = await Promise.all([
        api.get('/admin/resources', { params: { per_page: 100 } }),
        api.get('/admin/resource-types'),
      ]);
      setResources(resourceResponse.data.data.resources);
      setTypes(typeResponse.data.data.types);
    } catch (error) { toast.error(apiMessage(error, 'Unable to load content.')); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await api.post('/admin/resources', { ...form, resource_type_id: Number(form.resource_type_id), slug: form.slug || form.title });
      setForm({ resource_type_id: '', title: '', slug: '', summary: '', status: 'draft', visibility: 'authenticated' });
      toast.success('Content created');
      await load();
    } catch (error) { toast.error(apiMessage(error, 'Unable to create content.')); }
  };

  const archive = async (resource: Resource) => {
    if (!confirm(`Archive “${resource.title}”?`)) return;
    try { await api.delete(`/admin/resources/${resource.id}`); toast.success('Content archived'); await load(); }
    catch (error) { toast.error(apiMessage(error, 'Unable to archive content.')); }
  };

  return (
    <DashboardLayout>
      <header><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">Publishing</p><h2 className="mt-2 text-4xl font-semibold tracking-tight">Content library</h2><p className="mt-3 text-slate-600">Notes, books, articles, videos and playlists now share one resource model.</p></header>
      <form onSubmit={create} className="mt-8 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 lg:grid-cols-[180px_1fr_1fr_150px_120px]">
        <select required value={form.resource_type_id} onChange={(e) => setForm({ ...form, resource_type_id: e.target.value })} className="rounded-xl border px-3 py-2.5"><option value="">Content type</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
        <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className="rounded-xl border px-3 py-2.5" />
        <input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Short summary" className="rounded-xl border px-3 py-2.5" />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-xl border px-3 py-2.5"><option value="draft">Draft</option><option value="published">Published</option></select>
        <button className="flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-white"><Plus size={16} />Create</button>
      </form>
      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? <div className="p-12"><Loader2 className="mx-auto animate-spin" /></div> : <div className="divide-y divide-slate-100">{resources.map((resource) => <div key={resource.id} className="flex items-center justify-between gap-4 p-5"><div><div className="flex items-center gap-2"><p className="font-semibold">{resource.title}</p><span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{resource.type}</span></div><p className="mt-1 text-xs text-slate-500">/{resource.slug} · {resource.status} · {resource.visibility}</p></div><button onClick={() => archive(resource)} title="Archive" className="rounded-lg border p-2 text-slate-500 hover:text-red-600"><Archive size={17} /></button></div>)}{resources.length === 0 && <p className="p-12 text-center text-slate-500">No content yet.</p>}</div>}
      </div>
    </DashboardLayout>
  );
}
